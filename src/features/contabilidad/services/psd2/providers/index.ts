import type { BankProvider } from "./types";
import { getGoCardlessProvider } from "./gocardless";

export type ProviderId = "gocardless";

export function getProvider(id: ProviderId): BankProvider {
  switch (id) {
    case "gocardless":
      return getGoCardlessProvider();
    default: {
      const _exhaustive: never = id;
      throw new Error(`Provider PSD2 desconocido: ${_exhaustive as string}`);
    }
  }
}

export type { BankProvider } from "./types";
export * from "./types";
