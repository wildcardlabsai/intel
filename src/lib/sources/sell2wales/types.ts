/**
 * Open Contracting Data Standard (OCDS) shapes.
 *
 * https://standard.open-contracting.org/latest/en/schema/release/
 *
 * Sell2Wales publishes Welsh public sector notices as OCDS releases. Using the
 * standard schema rather than a Sell2Wales-specific one means the same
 * connector can later consume any other OCDS publisher (Find a Tender,
 * Contracts Finder) without being rewritten.
 */

export type OcdsIdentifier = {
  scheme?: string;
  id?: string;
  legalName?: string;
  uri?: string;
};

export type OcdsAddress = {
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  countryName?: string;
};

export type OcdsOrganisation = {
  id?: string;
  name?: string;
  identifier?: OcdsIdentifier;
  additionalIdentifiers?: OcdsIdentifier[];
  address?: OcdsAddress;
  contactPoint?: { name?: string; email?: string; telephone?: string; url?: string };
  details?: { scale?: string };
  roles?: string[];
};

export type OcdsValue = {
  amount?: number;
  currency?: string;
};

export type OcdsPeriod = {
  startDate?: string;
  endDate?: string;
  maxExtentDate?: string;
  durationInDays?: number;
};

export type OcdsClassification = {
  scheme?: string;
  id?: string;
  description?: string;
  uri?: string;
};

export type OcdsDocument = {
  id?: string;
  documentType?: string;
  title?: string;
  description?: string;
  url?: string;
  datePublished?: string;
  dateModified?: string;
  format?: string;
  language?: string;
};

export type OcdsItem = {
  id?: string;
  description?: string;
  classification?: OcdsClassification;
  additionalClassifications?: OcdsClassification[];
  deliveryAddresses?: OcdsAddress[];
  deliveryLocation?: {
    geometry?: { type?: string; coordinates?: number[] };
    description?: string;
  };
};

export type OcdsTender = {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  procurementMethod?: string;
  procurementMethodDetails?: string;
  mainProcurementCategory?: string;
  additionalProcurementCategories?: string[];
  value?: OcdsValue;
  minValue?: OcdsValue;
  items?: OcdsItem[];
  tenderPeriod?: OcdsPeriod;
  contractPeriod?: OcdsPeriod;
  awardPeriod?: OcdsPeriod;
  documents?: OcdsDocument[];
  classification?: OcdsClassification;
  additionalClassifications?: OcdsClassification[];
  submissionMethodDetails?: string;
};

export type OcdsAward = {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  date?: string;
  value?: OcdsValue;
  suppliers?: OcdsOrganisation[];
  items?: OcdsItem[];
  contractPeriod?: OcdsPeriod;
  documents?: OcdsDocument[];
};

export type OcdsContract = {
  id?: string;
  awardID?: string;
  title?: string;
  status?: string;
  period?: OcdsPeriod;
  value?: OcdsValue;
  dateSigned?: string;
};

export type OcdsRelease = {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[];
  initiationType?: string;
  language?: string;
  parties?: OcdsOrganisation[];
  buyer?: OcdsOrganisation;
  tender?: OcdsTender;
  awards?: OcdsAward[];
  contracts?: OcdsContract[];
};

export type OcdsReleasePackage = {
  uri?: string;
  version?: string;
  publishedDate?: string;
  publisher?: { name?: string; uid?: string; scheme?: string; uri?: string };
  releases?: OcdsRelease[];
  links?: { next?: string; prev?: string };
  extensions?: string[];
};
