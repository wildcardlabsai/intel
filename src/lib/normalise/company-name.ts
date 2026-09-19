/**
 * Company name normalisation for entity resolution.
 *
 * Different publishers write the same organisation differently:
 *
 *   "ABC Construction Ltd"      (Companies House)
 *   "ABC CONSTRUCTION LIMITED"  (Sell2Wales award)
 *   "A.B.C. Construction"       (planning applicant field)
 *
 * All three normalise to "ABC CONSTRUCTION", which is what we index and
 * compare. Normalisation is deliberately conservative: it only removes legal
 * form suffixes and punctuation, never meaningful words, because collapsing
 * too aggressively merges genuinely different companies.
 */

/**
 * Legal form suffixes, longest first so "PUBLIC LIMITED COMPANY" is removed
 * before "COMPANY". Only stripped from the end of the name.
 */
const LEGAL_SUFFIXES = [
  "PUBLIC LIMITED COMPANY",
  "COMMUNITY INTEREST COMPANY",
  "LIMITED LIABILITY PARTNERSHIP",
  "CYFYNGEDIG CYHOEDDUS",
  "COMPANY LIMITED",
  "CWMNI CYFYNGEDIG",
  "AND COMPANY",
  "LIMITED",
  "CYFYNGEDIG",
  "UNLIMITED",
  "INCORPORATED",
  "PARTNERSHIP",
  "PLC",
  "LTD",
  "LLP",
  "LLC",
  "CIC",
  "CIO",
  "LP",
  "CYF",
  "INC",
  "CO",
];

/** Trailing noise that some registers append. */
const TRAILING_NOISE = [
  "THE COMPANY WAS DISSOLVED",
  "IN LIQUIDATION",
  "IN ADMINISTRATION",
  "DISSOLVED",
];

export function normaliseCompanyName(input: string | null | undefined): string {
  if (!input) return "";

  let value = input
    .normalize("NFD")
    // Strip diacritics: "Llŷn Cyf" → "LLYN CYF".
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  // "&" and "+" are written both ways across sources.
  value = value.replace(/[&+]/g, " AND ");

  // Drop anything in trailing brackets, e.g. "ABC LTD (FORMERLY XYZ)".
  value = value.replace(/\([^)]*\)/g, " ");

  // Collapse dotted initials so "A.B.C. Construction" matches "ABC
  // Construction". Requires at least two initials, so "J. Smith" is untouched.
  value = value.replace(/\b(?:[A-Z]\.){2,}[A-Z]?\b/g, (match) => match.replace(/\./g, ""));

  // Punctuation to spaces. Apostrophes are removed rather than spaced so
  // "O'BRIEN" stays one token.
  value = value.replace(/['’`]/g, "");
  value = value.replace(/[^A-Z0-9]+/g, " ");
  value = value.replace(/\s+/g, " ").trim();

  for (const noise of TRAILING_NOISE) {
    if (value.endsWith(` ${noise}`)) {
      value = value.slice(0, -(noise.length + 1)).trim();
    }
  }

  // Strip legal suffixes repeatedly: "ABC LIMITED LTD" does occur.
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      if (value === suffix) break;
      if (value.endsWith(` ${suffix}`)) {
        value = value.slice(0, -(suffix.length + 1)).trim();
        changed = true;
        break;
      }
    }
  }

  // A leading "THE" carries no distinguishing information.
  if (value.startsWith("THE ") && value.length > 4) {
    value = value.slice(4);
  }

  return value.trim();
}

/** Normalises a person's name for officer / PSC matching. */
export function normalisePersonName(input: string | null | undefined): string {
  if (!input) return "";

  let value = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  // Companies House publishes "SMITH, John Andrew" in some endpoints.
  if (value.includes(",")) {
    const [surname, rest] = value.split(",", 2);
    value = `${rest ?? ""} ${surname}`;
  }

  value = value.replace(/\b(MR|MRS|MS|MISS|DR|PROF|SIR|DAME|LORD|LADY|REV)\b\.?/g, " ");
  value = value.replace(/\b(JR|SR|I{1,3}|IV|OBE|MBE|CBE|QC|KC)\b\.?/g, " ");
  value = value.replace(/['’`]/g, "");
  value = value.replace(/[^A-Z0-9]+/g, " ");

  return value.replace(/\s+/g, " ").trim();
}

/**
 * Token-set similarity in [0, 1]: the Jaccard index over word tokens, with a
 * bonus when one name is a strict prefix of the other ("ABC CONSTRUCTION" vs
 * "ABC CONSTRUCTION SERVICES").
 *
 * Used alongside — never instead of — a company number match.
 */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  const jaccard = intersection / union;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const prefixBonus = longer.startsWith(`${shorter} `) ? 0.15 : 0;

  return Math.min(1, jaccard + prefixBonus);
}

/**
 * Companies House company numbers are 8 characters: either 8 digits, or a
 * 2-letter prefix (SC, NI, OC, SO, NC, FC…) followed by 6 digits. Shorter
 * numeric forms appear in third-party data and are zero-padded here.
 */
export function normaliseCompanyNumber(input: string | null | undefined): string | null {
  if (!input) return null;

  const value = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!value) return null;

  if (/^[0-9]{1,8}$/.test(value)) {
    return value.padStart(8, "0");
  }

  if (/^[A-Z]{2}[0-9]{1,6}$/.test(value)) {
    const prefix = value.slice(0, 2);
    const digits = value.slice(2);
    return `${prefix}${digits.padStart(6, "0")}`;
  }

  // Anything else is not a recognisable company number; better to return null
  // than to fabricate an identifier that would create a false link.
  return null;
}

/**
 * Extracts a company number from an OCDS organisation identifier such as
 * "GB-COH-01234567". Returns null for schemes that are not Companies House.
 */
export function companyNumberFromOcdsIdentifier(
  scheme: string | null | undefined,
  id: string | null | undefined
): string | null {
  if (!id) return null;
  const normalisedScheme = (scheme ?? "").toUpperCase();
  if (normalisedScheme && !normalisedScheme.includes("COH") && !normalisedScheme.includes("COMPANIES")) {
    return null;
  }
  const bare = id.toUpperCase().replace(/^GB-?COH-?/, "");
  return normaliseCompanyNumber(bare);
}
