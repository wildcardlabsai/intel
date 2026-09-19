import type { WelshConfidence, WelshRegion } from "@/generated/prisma/enums";
import { findLocalAuthorityByName, type LocalAuthoritySeed } from "@/lib/wales/local-authorities";

/**
 * Decides whether a record belongs to Wales, and where in Wales it sits.
 *
 * Rules, in order of authority:
 *
 *   1. An ONS-backed lookup of the postcode (postcodes.io) that reports
 *      country = "Wales" — authoritative, CONFIRMED.
 *   2. A postcode in a postcode area that lies wholly within Wales —
 *      CONFIRMED.
 *   3. A postcode in a cross-border postcode area (CH, SY, HR, LL/NP edges)
 *      with corroborating address text naming a Welsh authority or Wales —
 *      LIKELY. Without corroboration the result is UNKNOWN and the record is
 *      queued for postcode lookup rather than guessed.
 *   4. No postcode, but address text explicitly names Wales or a Welsh
 *      authority — LIKELY.
 *   5. A non-Welsh country in the address — NOT_WELSH.
 *
 * A company's *name* is never evidence. "Cymru Scaffolding Ltd" registered in
 * Bristol is not a Welsh company, and "Smith & Sons Ltd" in Bangor is.
 */

/**
 * Postcode areas lying wholly (or all-but-entirely) within Wales.
 *
 * CF — Cardiff, LD — Llandrindod Wells, LL — Llandudno,
 * NP — Newport, SA — Swansea.
 */
export const WHOLLY_WELSH_POSTCODE_AREAS = new Set(["CF", "LD", "LL", "NP", "SA"]);

/**
 * Postcode areas straddling the England–Wales border. A postcode here is not
 * sufficient evidence on its own; we require an ONS lookup or corroborating
 * address text.
 *
 * CH — Chester (Flintshire districts are Welsh), SY — Shrewsbury (Powys and
 * parts of Wrexham are Welsh), HR — Hereford (a small Powys fringe).
 */
export const CROSS_BORDER_POSTCODE_AREAS = new Set(["CH", "SY", "HR"]);

const NON_WELSH_COUNTRY_PATTERN =
  /\b(england|scotland|northern ireland|ireland|isle of man|jersey|guernsey|united states|usa|france|germany|spain|netherlands|india|australia|canada)\b/i;

const WALES_PATTERN = /\b(wales|cymru)\b/i;

const UK_POSTCODE_PATTERN =
  /\b([A-Z]{1,2})([0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})\b/i;

export type WelshClassificationInput = {
  postcode?: string | null;
  /** Free-text locality/town from the address. */
  locality?: string | null;
  /** Free-text county/region from the address. */
  region?: string | null;
  /** Country as published by the source. */
  country?: string | null;
  /**
   * Result of an authoritative postcode lookup, when one has been performed.
   * This is the only input that can produce CONFIRMED from a cross-border area.
   */
  postcodeLookup?: {
    country: string | null;
    localAuthority: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export type WelshClassification = {
  isWelsh: boolean;
  confidence: WelshConfidence;
  region: WelshRegion;
  localAuthoritySlug: string | null;
  /** Human-readable justification, stored on the record for transparency. */
  evidence: string;
  /** True when an authoritative postcode lookup would change the answer. */
  needsPostcodeLookup: boolean;
};

export function parsePostcodeArea(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const match = UK_POSTCODE_PATTERN.exec(postcode.trim());
  if (!match) return null;
  return match[1].toUpperCase();
}

export function normalisePostcode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const match = UK_POSTCODE_PATTERN.exec(postcode.trim());
  if (!match) return null;
  return `${match[1]}${match[2]} ${match[3]}`.toUpperCase();
}

function notWelsh(evidence: string): WelshClassification {
  return {
    isWelsh: false,
    confidence: "NOT_WELSH",
    region: "UNKNOWN",
    localAuthoritySlug: null,
    evidence,
    needsPostcodeLookup: false,
  };
}

function unknown(evidence: string, needsPostcodeLookup = false): WelshClassification {
  return {
    isWelsh: false,
    confidence: "UNKNOWN",
    region: "UNKNOWN",
    localAuthoritySlug: null,
    evidence,
    needsPostcodeLookup,
  };
}

function welsh(
  confidence: Exclude<WelshConfidence, "NOT_WELSH" | "UNKNOWN">,
  authority: LocalAuthoritySeed | null,
  evidence: string,
  needsPostcodeLookup = false
): WelshClassification {
  return {
    isWelsh: true,
    confidence,
    region: authority?.region ?? "UNKNOWN",
    localAuthoritySlug: authority?.slug ?? null,
    evidence,
    needsPostcodeLookup,
  };
}

export function classifyWelshLocation(input: WelshClassificationInput): WelshClassification {
  const addressText = [input.locality, input.region, input.country]
    .filter(Boolean)
    .join(", ");

  // 1. Authoritative postcode lookup wins over everything else.
  if (input.postcodeLookup?.country) {
    const authority = findLocalAuthorityByName(input.postcodeLookup.localAuthority);
    if (/wales/i.test(input.postcodeLookup.country)) {
      return welsh(
        "CONFIRMED",
        authority,
        `Postcode ${normalisePostcode(input.postcode) ?? "lookup"} resolves to ` +
          `${input.postcodeLookup.localAuthority ?? "Wales"} (ONS postcode lookup).`
      );
    }
    return notWelsh(
      `Postcode lookup reports country "${input.postcodeLookup.country}", not Wales.`
    );
  }

  const area = parsePostcodeArea(input.postcode);

  // 2. Wholly-Welsh postcode area.
  if (area && WHOLLY_WELSH_POSTCODE_AREAS.has(area)) {
    const authority =
      findLocalAuthorityByName(input.region) ?? findLocalAuthorityByName(input.locality);
    return welsh(
      "CONFIRMED",
      authority,
      `Postcode area ${area} lies within Wales.` +
        (authority ? ` Address names ${authority.name}.` : " Local authority not yet resolved."),
      authority === null
    );
  }

  // 3. Cross-border postcode area — needs corroboration.
  if (area && CROSS_BORDER_POSTCODE_AREAS.has(area)) {
    const authority =
      findLocalAuthorityByName(input.region) ?? findLocalAuthorityByName(input.locality);
    if (authority) {
      return welsh(
        "LIKELY",
        authority,
        `Postcode area ${area} straddles the border; address names ${authority.name}, ` +
          `a Welsh authority. Pending ONS postcode confirmation.`,
        true
      );
    }
    if (WALES_PATTERN.test(addressText)) {
      return welsh(
        "LIKELY",
        null,
        `Postcode area ${area} straddles the border; address text names Wales. ` +
          `Pending ONS postcode confirmation.`,
        true
      );
    }
    return unknown(
      `Postcode area ${area} straddles the England–Wales border and the address ` +
        `gives no Welsh corroboration. Awaiting ONS postcode lookup.`,
      true
    );
  }

  // A postcode outside every Welsh or border area settles it.
  if (area) {
    return notWelsh(`Postcode area ${area} is outside Wales.`);
  }

  // 4/5. No usable postcode — fall back to address text.
  if (input.country && NON_WELSH_COUNTRY_PATTERN.test(input.country)) {
    return notWelsh(`Address country is "${input.country}".`);
  }

  const authority =
    findLocalAuthorityByName(input.region) ?? findLocalAuthorityByName(input.locality);
  if (authority) {
    return welsh(
      "LIKELY",
      authority,
      `No usable postcode; address names ${authority.name}, a Welsh unitary authority.`,
      true
    );
  }

  if (WALES_PATTERN.test(addressText)) {
    return welsh("LIKELY", null, "No usable postcode; address text names Wales.", true);
  }

  return unknown("No postcode and no Welsh indicator in the address.", Boolean(input.postcode));
}

/**
 * Combines evidence from several addresses for one company. A registered
 * office in Wales is stronger evidence than a trading address, so the
 * registered office is passed first and only downgraded to POSSIBLE when a
 * secondary address is the sole Welsh link.
 */
export function classifyCompanyLocation(
  registeredOffice: WelshClassificationInput,
  otherAddresses: WelshClassificationInput[] = []
): WelshClassification {
  const primary = classifyWelshLocation(registeredOffice);
  if (primary.isWelsh || primary.confidence === "NOT_WELSH") return primary;

  for (const address of otherAddresses) {
    const result = classifyWelshLocation(address);
    if (result.isWelsh) {
      return {
        ...result,
        confidence: "POSSIBLE",
        evidence:
          `Registered office is not in Wales (${primary.evidence}) but a secondary ` +
          `address is: ${result.evidence}`,
      };
    }
  }

  return primary;
}
