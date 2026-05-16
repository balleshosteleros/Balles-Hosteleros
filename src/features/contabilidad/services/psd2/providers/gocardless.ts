import { z } from "zod";
import type {
  BankProvider,
  Balance,
  BankAccountInfo,
  Country,
  Institution,
  ProviderTransaction,
  Requisition,
  RequisitionInput,
} from "./types";

const API_BASE = "https://bankaccountdata.gocardless.com/api/v2";

const TokenResponse = z.object({
  access: z.string(),
  access_expires: z.number(),
  refresh: z.string(),
  refresh_expires: z.number(),
});

const InstitutionResponse = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    bic: z.string().optional(),
    logo: z.string().optional(),
    transaction_total_days: z.coerce.number().optional(),
    countries: z.array(z.string()),
  }),
);

const RequisitionResponse = z.object({
  id: z.string(),
  link: z.string(),
  reference: z.string(),
  status: z.string(),
  institution_id: z.string(),
  accounts: z.array(z.string()).default([]),
});

const AccountDetailsResponse = z.object({
  account: z.object({
    resourceId: z.string().optional(),
    iban: z.string().optional(),
    name: z.string().optional(),
    ownerName: z.string().optional(),
    currency: z.string().optional(),
    product: z.string().optional(),
  }),
});

const BalanceAmount = z.object({
  amount: z.coerce.number(),
  currency: z.string(),
});

const BalancesResponse = z.object({
  balances: z.array(
    z.object({
      balanceAmount: BalanceAmount,
      balanceType: z.string().optional(),
      referenceDate: z.string().optional(),
    }),
  ),
});

const TxBase = z.object({
  transactionId: z.string().optional(),
  internalTransactionId: z.string().optional(),
  bookingDate: z.string(),
  valueDate: z.string().optional(),
  transactionAmount: BalanceAmount,
  creditorName: z.string().optional(),
  debtorName: z.string().optional(),
  remittanceInformationUnstructured: z.string().optional(),
  remittanceInformationUnstructuredArray: z.array(z.string()).optional(),
  endToEndId: z.string().optional(),
});

const TransactionsResponse = z.object({
  transactions: z.object({
    booked: z.array(TxBase).default([]),
    pending: z.array(TxBase).default([]),
  }),
});

interface TokenCache {
  access: string;
  expiresAt: number;
  refresh: string;
  refreshExpiresAt: number;
}

let tokenCache: TokenCache | null = null;

function envCreds(): { secretId: string; secretKey: string } {
  const secretId = process.env.GOCARDLESS_SECRET_ID?.trim();
  const secretKey = process.env.GOCARDLESS_SECRET_KEY?.trim();
  if (!secretId || !secretKey) {
    throw new Error(
      "GOCARDLESS_SECRET_ID y GOCARDLESS_SECRET_KEY son obligatorias.",
    );
  }
  return { secretId, secretKey };
}

async function fetchJson(
  path: string,
  init: RequestInit & { authToken?: string } = {},
): Promise<unknown> {
  const { authToken, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GoCardless ${res.status} ${path}: ${text || res.statusText}`);
  }
  return res.json();
}

async function obtainAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt - 60 > now) return tokenCache.access;

  const { secretId, secretKey } = envCreds();
  const raw = await fetchJson("/token/new/", {
    method: "POST",
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  const parsed = TokenResponse.parse(raw);
  tokenCache = {
    access: parsed.access,
    expiresAt: now + parsed.access_expires,
    refresh: parsed.refresh,
    refreshExpiresAt: now + parsed.refresh_expires,
  };
  return parsed.access;
}

function extractDescripcion(
  t: z.infer<typeof TxBase>,
): string | undefined {
  if (t.remittanceInformationUnstructured) return t.remittanceInformationUnstructured;
  if (t.remittanceInformationUnstructuredArray?.length) {
    return t.remittanceInformationUnstructuredArray.join(" ");
  }
  return undefined;
}

function toProviderTx(
  t: z.infer<typeof TxBase>,
  estado: "BOOKED" | "PENDING",
): ProviderTransaction | null {
  const providerTxId = t.transactionId ?? t.internalTransactionId;
  if (!providerTxId) return null;
  return {
    providerTxId,
    bookingDate: t.bookingDate,
    valueDate: t.valueDate,
    amount: t.transactionAmount.amount,
    currency: t.transactionAmount.currency,
    descripcion: extractDescripcion(t),
    contraparte: t.creditorName ?? t.debtorName,
    referencia: t.endToEndId,
    estado,
    raw: t,
  };
}

class GoCardlessProvider implements BankProvider {
  readonly id = "gocardless";

  async listInstitutions(country: Country): Promise<Institution[]> {
    const token = await obtainAccessToken();
    const raw = await fetchJson(`/institutions/?country=${country}`, {
      authToken: token,
    });
    const parsed = InstitutionResponse.parse(raw);
    return parsed.map((i) => ({
      id: i.id,
      name: i.name,
      bic: i.bic,
      logo: i.logo,
      transactionTotalDays: i.transaction_total_days ?? 90,
      countries: i.countries,
    }));
  }

  async createRequisition(input: RequisitionInput): Promise<Requisition> {
    const token = await obtainAccessToken();
    const raw = await fetchJson("/requisitions/", {
      method: "POST",
      authToken: token,
      body: JSON.stringify({
        redirect: input.redirectUrl,
        institution_id: input.institutionId,
        reference: input.reference,
        user_language: input.userLanguage ?? "ES",
        access_valid_for_days: input.accessValidForDays ?? 90,
      }),
    });
    const parsed = RequisitionResponse.parse(raw);
    return {
      id: parsed.id,
      link: parsed.link,
      reference: parsed.reference,
      status: parsed.status,
      institutionId: parsed.institution_id,
      accounts: parsed.accounts,
    };
  }

  async getRequisition(requisitionId: string): Promise<Requisition> {
    const token = await obtainAccessToken();
    const raw = await fetchJson(`/requisitions/${requisitionId}/`, {
      authToken: token,
    });
    const parsed = RequisitionResponse.parse(raw);
    return {
      id: parsed.id,
      link: parsed.link,
      reference: parsed.reference,
      status: parsed.status,
      institutionId: parsed.institution_id,
      accounts: parsed.accounts,
    };
  }

  async getAccount(externalAccountId: string): Promise<BankAccountInfo> {
    const token = await obtainAccessToken();
    const raw = await fetchJson(`/accounts/${externalAccountId}/details/`, {
      authToken: token,
    });
    const parsed = AccountDetailsResponse.parse(raw);
    return {
      externalId: externalAccountId,
      iban: parsed.account.iban,
      name: parsed.account.name,
      ownerName: parsed.account.ownerName,
      currency: parsed.account.currency,
      product: parsed.account.product,
    };
  }

  async getBalances(externalAccountId: string): Promise<Balance[]> {
    const token = await obtainAccessToken();
    const raw = await fetchJson(`/accounts/${externalAccountId}/balances/`, {
      authToken: token,
    });
    const parsed = BalancesResponse.parse(raw);
    return parsed.balances.map((b) => ({
      amount: b.balanceAmount.amount,
      currency: b.balanceAmount.currency,
      referenceDate: b.referenceDate,
      type: b.balanceType,
    }));
  }

  async getTransactions(
    externalAccountId: string,
    params: { dateFrom?: string; dateTo?: string },
  ): Promise<ProviderTransaction[]> {
    const token = await obtainAccessToken();
    const qs = new URLSearchParams();
    if (params.dateFrom) qs.set("date_from", params.dateFrom);
    if (params.dateTo) qs.set("date_to", params.dateTo);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const raw = await fetchJson(
      `/accounts/${externalAccountId}/transactions/${query}`,
      { authToken: token },
    );
    const parsed = TransactionsResponse.parse(raw);
    const booked = parsed.transactions.booked
      .map((t) => toProviderTx(t, "BOOKED"))
      .filter((x): x is ProviderTransaction => x !== null);
    const pending = parsed.transactions.pending
      .map((t) => toProviderTx(t, "PENDING"))
      .filter((x): x is ProviderTransaction => x !== null);
    return [...booked, ...pending];
  }
}

let instance: GoCardlessProvider | null = null;
export function getGoCardlessProvider(): BankProvider {
  if (!instance) instance = new GoCardlessProvider();
  return instance;
}
