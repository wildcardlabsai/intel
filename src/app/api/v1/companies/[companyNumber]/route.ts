import { NextResponse } from "next/server";

import { apiResponse, authenticateApiRequest, recordApiCall } from "@/lib/api/auth";
import { getCompanyProfile } from "@/lib/services/company-profile";

/**
 * GET /api/v1/companies/:companyNumber — a full company profile, including
 * officers, filings, contracts and planning activity, each with provenance.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyNumber: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const { companyNumber } = await params;
  const profile = await getCompanyProfile(companyNumber);

  if (!profile) {
    await recordApiCall(auth.apiKey, auth.user, "/api/v1/companies/:companyNumber", 404);
    return NextResponse.json(
      {
        error: "not_found",
        message: `No company with number ${companyNumber} has been ingested.`,
      },
      { status: 404 }
    );
  }

  const { company } = profile;
  await recordApiCall(auth.apiKey, auth.user, "/api/v1/companies/:companyNumber", 200);

  return apiResponse(
    {
      companyNumber: company.companyNumber,
      name: company.name,
      previousNames: company.previousNames,
      status: company.status,
      companyType: company.companyType,
      incorporatedOn: company.incorporatedOn,
      dissolvedOn: company.dissolvedOn,
      sicCodes: company.sicCodes,
      sector: company.primarySector?.name ?? null,
      isWelsh: company.isWelsh,
      welshConfidence: company.welshConfidence,
      welshEvidence: company.welshEvidence,
      region: company.region,
      localAuthority: company.localAuthority?.name ?? null,
      registeredOffice: company.addresses[0]
        ? {
            addressLine1: company.addresses[0].addressLine1,
            addressLine2: company.addresses[0].addressLine2,
            locality: company.addresses[0].locality,
            postcode: company.addresses[0].postcode,
            country: company.addresses[0].country,
          }
        : null,
      latitude: company.latitude,
      longitude: company.longitude,
      accounts: {
        lastMadeUpTo: company.accountsLastMadeUpTo,
        nextDue: company.accountsNextDue,
        category: company.accountsCategory,
        sizeBand: company.sizeBand,
      },
      officers: company.officers.map((officer) => ({
        name: officer.name,
        role: officer.role,
        appointedOn: officer.appointedOn,
        resignedOn: officer.resignedOn,
        isActive: officer.isActive,
        nationality: officer.nationality,
      })),
      personsWithSignificantControl: company.pscs.map((psc) => ({
        name: psc.name,
        kind: psc.kind,
        naturesOfControl: psc.naturesOfControl,
        notifiedOn: psc.notifiedOn,
        ceasedOn: psc.ceasedOn,
      })),
      filings: company.filings.map((filing) => ({
        date: filing.date,
        category: filing.category,
        description: filing.description,
        transactionId: filing.transactionId,
      })),
      charges: company.charges.map((charge) => ({
        chargeCode: charge.chargeCode,
        status: charge.status,
        createdOn: charge.createdOn,
        satisfiedOn: charge.satisfiedOn,
        personsEntitled: charge.personsEntitled,
      })),
      publicContracts: profile.procurementAwards.map((award) => ({
        title: award.notice.title,
        ocid: award.notice.ocid,
        buyer: award.notice.buyer?.name ?? null,
        value: award.valueAmount,
        currency: award.valueCurrency,
        awardedAt: award.awardedAt,
        matchConfidence: award.supplier?.resolutionConfidence ?? null,
        source: award.source,
        sourceUrl: award.sourceUrl,
      })),
      planningApplications: profile.planningApplications.map((application) => ({
        reference: application.reference,
        authority: application.authority.name,
        siteAddress: application.siteAddress,
        description: application.description,
        status: application.status,
        submittedOn: application.submittedOn,
        decidedOn: application.decidedOn,
        source: application.source,
        sourceUrl: application.sourceUrl,
      })),
      timeline: profile.timeline.map((event) => ({
        type: event.type,
        title: event.title,
        description: event.description,
        occurredAt: event.occurredAt,
        source: event.source,
        sourceUrl: event.sourceUrl,
      })),
      source: company.source,
      sourceUrl: company.sourceUrl,
      firstSeenAt: company.firstSeenAt,
      lastSeenAt: company.lastSeenAt,
      lastUpdatedAt: company.lastUpdatedAt,
    },
    { sources: profile.sourcesUsed }
  );
}
