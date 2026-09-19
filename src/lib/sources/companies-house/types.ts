/**
 * Response shapes from the Companies House Public Data API.
 *
 * https://developer-specs.company-information.service.gov.uk/
 *
 * Every field is optional: the API omits fields rather than returning nulls,
 * and the shapes differ subtly between company types. Treating everything as
 * optional and validating explicitly is safer than trusting the documentation.
 */

export type ChAddress = {
  care_of?: string;
  premises?: string;
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  po_box?: string;
};

export type ChAccounts = {
  accounting_reference_date?: { day?: string; month?: string };
  last_accounts?: {
    made_up_to?: string;
    period_end_on?: string;
    period_start_on?: string;
    type?: string;
  };
  next_accounts?: {
    due_on?: string;
    period_end_on?: string;
    period_start_on?: string;
    overdue?: boolean;
  };
  next_due?: string;
  next_made_up_to?: string;
  overdue?: boolean;
};

export type ChCompanyProfile = {
  company_number?: string;
  company_name?: string;
  company_status?: string;
  company_status_detail?: string;
  type?: string;
  jurisdiction?: string;
  date_of_creation?: string;
  date_of_cessation?: string;
  sic_codes?: string[];
  registered_office_address?: ChAddress;
  service_address?: ChAddress;
  registered_office_is_in_dispute?: boolean;
  undeliverable_registered_office_address?: boolean;
  has_been_liquidated?: boolean;
  has_charges?: boolean;
  has_insolvency_history?: boolean;
  can_file?: boolean;
  accounts?: ChAccounts;
  confirmation_statement?: {
    next_due?: string;
    next_made_up_to?: string;
    last_made_up_to?: string;
    overdue?: boolean;
  };
  previous_company_names?: Array<{
    name?: string;
    effective_from?: string;
    ceased_on?: string;
  }>;
  links?: { self?: string; filing_history?: string; officers?: string; charges?: string };
};

export type ChSearchItem = {
  company_number?: string;
  title?: string;
  company_status?: string;
  company_type?: string;
  date_of_creation?: string;
  address?: ChAddress;
  address_snippet?: string;
  links?: { self?: string };
};

export type ChSearchResponse = {
  items?: ChSearchItem[];
  items_per_page?: number;
  start_index?: number;
  total_results?: number;
  page_number?: number;
};

export type ChAdvancedSearchItem = {
  company_number?: string;
  company_name?: string;
  company_status?: string;
  company_type?: string;
  company_subtype?: string;
  date_of_creation?: string;
  date_of_cessation?: string;
  sic_codes?: string[];
  registered_office_address?: ChAddress;
};

export type ChAdvancedSearchResponse = {
  items?: ChAdvancedSearchItem[];
  hits?: number;
  top_hit?: ChAdvancedSearchItem;
};

export type ChOfficer = {
  name?: string;
  officer_role?: string;
  appointed_on?: string;
  resigned_on?: string;
  nationality?: string;
  country_of_residence?: string;
  occupation?: string;
  date_of_birth?: { month?: number; year?: number };
  address?: ChAddress;
  links?: { self?: string; officer?: { appointments?: string } };
};

export type ChOfficerList = {
  items?: ChOfficer[];
  active_count?: number;
  resigned_count?: number;
  total_results?: number;
  items_per_page?: number;
  start_index?: number;
};

export type ChPsc = {
  name?: string;
  kind?: string;
  natures_of_control?: string[];
  notified_on?: string;
  ceased_on?: string;
  nationality?: string;
  country_of_residence?: string;
  date_of_birth?: { month?: number; year?: number };
  address?: ChAddress;
  identification?: {
    registration_number?: string;
    legal_authority?: string;
    legal_form?: string;
    place_registered?: string;
    country_registered?: string;
  };
  links?: { self?: string };
};

export type ChPscList = {
  items?: ChPsc[];
  active_count?: number;
  ceased_count?: number;
  total_results?: number;
  items_per_page?: number;
  start_index?: number;
};

export type ChFilingItem = {
  transaction_id?: string;
  category?: string;
  subcategory?: string | string[];
  type?: string;
  description?: string;
  description_values?: Record<string, string>;
  date?: string;
  pages?: number;
  links?: { self?: string; document_metadata?: string };
};

export type ChFilingHistory = {
  items?: ChFilingItem[];
  total_count?: number;
  items_per_page?: number;
  start_index?: number;
};

export type ChCharge = {
  id?: string;
  charge_code?: string;
  charge_number?: number;
  classification?: { type?: string; description?: string };
  status?: string;
  created_on?: string;
  delivered_on?: string;
  satisfied_on?: string;
  particulars?: { description?: string; type?: string };
  persons_entitled?: Array<{ name?: string }>;
  secured_details?: { type?: string; description?: string };
  links?: { self?: string };
};

export type ChChargeList = {
  items?: ChCharge[];
  total_count?: number;
  unfiltered_count?: number;
};
