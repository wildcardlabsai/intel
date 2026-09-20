import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  toSearchQuery,
  type Pagination,
  type ProcurementFilters,
  type SearchResult,
} from "@/lib/search/types";

/**
 * Procurement search.
 *
 * Uses the same expression-based tsvector as the migration's
 * `procurement_notices_fts_idx`; keep the two in step or the index stops
 * being used.
 */

export type ProcurementSearchRow = {
  id: string;
  ocid: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  valueAmount: string | null;
  valueCurrency: string | null;
  publishedAt: Date | null;
  deadlineAt: Date | null;
  buyerName: string | null;
  localAuthorityName: string | null;
  deliveryLocality: string | null;
  supplierNames: string[];
  source: string;
  sourceUrl: string | null;
};

const SEARCH_VECTOR = Prisma.sql`(
  setweight(to_tsvector('english', coalesce(n.title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(n.description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(n.delivery_locality, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(immutable_array_to_string(n.cpv_codes, ' '), '')), 'C')
)`;

function buildConditions(filters: ProcurementFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  const query = toSearchQuery(filters.q);
  if (query) {
    conditions.push(Prisma.sql`${SEARCH_VECTOR} @@ websearch_to_tsquery('english', ${query})`);
  }

  if (filters.status?.length) {
    conditions.push(Prisma.sql`n.status = ANY(${filters.status}::text[]::"ProcurementStatus"[])`);
  }

  if (filters.type?.length) {
    conditions.push(Prisma.sql`n.type = ANY(${filters.type}::text[]::"ProcurementNoticeType"[])`);
  }

  if (filters.minValue !== undefined) {
    conditions.push(Prisma.sql`n.value_amount >= ${filters.minValue}`);
  }

  if (filters.maxValue !== undefined) {
    conditions.push(Prisma.sql`n.value_amount <= ${filters.maxValue}`);
  }

  if (filters.cpvPrefix) {
    // CPV is hierarchical: 45000000 covers all construction codes beneath it.
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM unnest(n.cpv_codes) AS code
        WHERE code LIKE ${`${filters.cpvPrefix.replace(/0+$/, "")}%`}
      )`
    );
  }

  if (filters.localAuthority) {
    conditions.push(
      Prisma.sql`n.local_authority_id = (SELECT id FROM local_authorities WHERE slug = ${filters.localAuthority})`
    );
  }

  if (filters.region) {
    conditions.push(Prisma.sql`n.region = ${filters.region}::"WelshRegion"`);
  }

  if (filters.buyerId) {
    conditions.push(Prisma.sql`n.buyer_id = ${filters.buyerId}`);
  }

  if (filters.publishedFrom) {
    conditions.push(Prisma.sql`n.published_at >= ${new Date(filters.publishedFrom)}`);
  }

  if (filters.publishedTo) {
    conditions.push(Prisma.sql`n.published_at <= ${new Date(filters.publishedTo)}`);
  }

  if (filters.supplierId) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM procurement_awards a
        WHERE a.notice_id = n.id AND a.supplier_id = ${filters.supplierId}
      )`
    );
  }

  return conditions;
}

function buildOrderBy(filters: ProcurementFilters, hasQuery: boolean): Prisma.Sql {
  switch (filters.sort) {
    case "value_desc":
      return Prisma.sql`ORDER BY n.value_amount DESC NULLS LAST`;
    case "value_asc":
      return Prisma.sql`ORDER BY n.value_amount ASC NULLS LAST`;
    case "oldest":
      return Prisma.sql`ORDER BY n.published_at ASC NULLS LAST`;
    case "newest":
      return Prisma.sql`ORDER BY n.published_at DESC NULLS LAST`;
    default:
      return hasQuery
        ? Prisma.sql`ORDER BY rank DESC, n.published_at DESC NULLS LAST`
        : Prisma.sql`ORDER BY n.published_at DESC NULLS LAST`;
  }
}

export async function searchProcurement(
  filters: ProcurementFilters,
  pagination: Pagination
): Promise<SearchResult<ProcurementSearchRow>> {
  const startedAt = Date.now();
  const query = toSearchQuery(filters.q);
  const conditions = buildConditions(filters);
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  const rankExpression = query
    ? Prisma.sql`ts_rank(${SEARCH_VECTOR}, websearch_to_tsquery('english', ${query}))`
    : Prisma.sql`0`;

  const offset = (pagination.page - 1) * pagination.perPage;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        ocid: string;
        title: string;
        description: string | null;
        type: string;
        status: string;
        value_amount: Prisma.Decimal | null;
        value_currency: string | null;
        published_at: Date | null;
        deadline_at: Date | null;
        buyer_name: string | null;
        local_authority_name: string | null;
        delivery_locality: string | null;
        supplier_names: string[] | null;
        source: string;
        source_url: string | null;
        rank: number;
      }>
    >(Prisma.sql`
      SELECT n.id, n.ocid, n.title, n.description, n.type::text, n.status::text,
             n.value_amount, n.value_currency, n.published_at, n.deadline_at,
             b.name AS buyer_name, la.name AS local_authority_name,
             n.delivery_locality, n.source, n.source_url,
             ARRAY(
               SELECT s.name FROM procurement_awards a
               JOIN procurement_suppliers s ON s.id = a.supplier_id
               WHERE a.notice_id = n.id
             ) AS supplier_names,
             ${rankExpression} AS rank
      FROM procurement_notices n
      LEFT JOIN procurement_buyers b ON b.id = n.buyer_id
      LEFT JOIN local_authorities la ON la.id = n.local_authority_id
      ${where}
      ${buildOrderBy(filters, Boolean(query))}
      LIMIT ${pagination.perPage} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM procurement_notices n ${where}
    `),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    items: rows.map((row) => ({
      id: row.id,
      ocid: row.ocid,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      valueAmount: row.value_amount?.toString() ?? null,
      valueCurrency: row.value_currency,
      publishedAt: row.published_at,
      deadlineAt: row.deadline_at,
      buyerName: row.buyer_name,
      localAuthorityName: row.local_authority_name,
      deliveryLocality: row.delivery_locality,
      supplierNames: row.supplier_names ?? [],
      source: row.source,
      sourceUrl: row.source_url,
    })),
    total,
    page: pagination.page,
    perPage: pagination.perPage,
    totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
    query: filters.q ?? null,
    tookMs: Date.now() - startedAt,
  };
}

/** Full notice with buyer, supplier and related-contract context. */
export async function getProcurementNotice(id: string) {
  const notice = await prisma.procurementNotice.findUnique({
    where: { id },
    include: {
      buyer: { include: { resolvedCompany: { select: { companyNumber: true, name: true } } } },
      localAuthority: { select: { name: true, slug: true } },
      documents: { orderBy: { publishedAt: "desc" } },
      awards: {
        include: {
          supplier: {
            include: { resolvedCompany: { select: { companyNumber: true, name: true } } },
          },
        },
      },
    },
  });

  if (!notice) return null;

  const supplierIds = notice.awards
    .map((award) => award.supplierId)
    .filter((value): value is string => value !== null);

  const [buyerHistory, supplierHistory] = await Promise.all([
    notice.buyerId
      ? prisma.procurementNotice.findMany({
          where: { buyerId: notice.buyerId, id: { not: notice.id } },
          orderBy: { publishedAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            valueAmount: true,
            valueCurrency: true,
            publishedAt: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    supplierIds.length
      ? prisma.procurementAward.findMany({
          where: { supplierId: { in: supplierIds }, noticeId: { not: notice.id } },
          orderBy: { awardedAt: "desc" },
          take: 8,
          include: {
            notice: { select: { id: true, title: true, buyer: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  return { notice, buyerHistory, supplierHistory };
}
