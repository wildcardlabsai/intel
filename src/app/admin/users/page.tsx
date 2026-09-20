import type { Metadata } from "next";

import { Pagination } from "@/components/dashboard/pagination";
import {
  Badge,
  Card,
  CardContent,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Users | Admin" };
export const dynamic = "force-dynamic";

const PER_PAGE = 40;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [users, total, byRole] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastSeenAt: true,
        emailVerifiedAt: true,
        organisation: { select: { name: true } },
        _count: { select: { savedCompanies: true, alerts: true, apiKeys: true } },
      },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description={`${formatNumber(total)} active accounts.`}
      />

      <div className="flex flex-wrap gap-2">
        {byRole.map((entry) => (
          <Badge key={entry.role} tone="neutral">
            {humanise(entry.role)}: {entry._count}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th className="hidden lg:table-cell">Organisation</Th>
                <Th className="hidden md:table-cell">Activity</Th>
                <Th className="hidden sm:table-cell">Joined</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <Td>
                    <p className="font-medium text-ink-900">{user.name ?? "—"}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                    {!user.emailVerifiedAt && (
                      <Badge tone="warning" className="mt-1">
                        Unverified
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        user.role === "SUPER_ADMIN" || user.role === "ADMIN" ? "dark" : "neutral"
                      }
                    >
                      {humanise(user.role)}
                    </Badge>
                  </Td>
                  <Td className="hidden lg:table-cell text-muted">
                    {user.organisation?.name ?? "—"}
                  </Td>
                  <Td className="hidden md:table-cell text-xs text-muted">
                    {user._count.savedCompanies} saved · {user._count.alerts} alerts ·{" "}
                    {user._count.apiKeys} keys
                  </Td>
                  <Td className="hidden sm:table-cell whitespace-nowrap text-muted">
                    {formatDate(user.createdAt)}
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {user.lastSeenAt ? formatRelative(user.lastSeenAt) : "never"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER_PAGE))} params={params} />
    </>
  );
}
