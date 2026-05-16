export type Country = "ES" | "FR" | "IT" | "DE" | "PT";

export interface Institution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  transactionTotalDays: number;
  countries: string[];
}

export interface RequisitionInput {
  institutionId: string;
  redirectUrl: string;
  reference: string;
  userLanguage?: string;
  accessValidForDays?: number;
}

export interface Requisition {
  id: string;
  link: string;
  reference: string;
  status: string;
  institutionId: string;
  accounts: string[];
}

export interface BankAccountInfo {
  externalId: string;
  iban?: string;
  name?: string;
  ownerName?: string;
  currency?: string;
  product?: string;
}

export interface Balance {
  amount: number;
  currency: string;
  referenceDate?: string;
  type?: string;
}

export interface ProviderTransaction {
  providerTxId: string;
  bookingDate: string;
  valueDate?: string;
  amount: number;
  currency: string;
  descripcion?: string;
  contraparte?: string;
  referencia?: string;
  estado: "BOOKED" | "PENDING";
  raw: unknown;
}

export interface BankProvider {
  readonly id: string;
  listInstitutions(country: Country): Promise<Institution[]>;
  createRequisition(input: RequisitionInput): Promise<Requisition>;
  getRequisition(requisitionId: string): Promise<Requisition>;
  getAccount(externalAccountId: string): Promise<BankAccountInfo>;
  getBalances(externalAccountId: string): Promise<Balance[]>;
  getTransactions(
    externalAccountId: string,
    params: { dateFrom?: string; dateTo?: string },
  ): Promise<ProviderTransaction[]>;
}
