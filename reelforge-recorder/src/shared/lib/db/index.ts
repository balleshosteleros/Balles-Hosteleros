import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

// Reintenta una query cuando Neon devuelve "Control plane request failed"
// (compute suspendido despertando) o errores de red transitorios.
export async function withNeonRetry<T>(
  fn: () => Promise<T>,
  attempts = 5,
  delayMs = 2000
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        msg.includes("Control plane") ||
        msg.includes("fetch failed") ||
        msg.includes("ECONNRESET") ||
        msg.includes("HeadersTimeout") ||
        (typeof err === "object" && err !== null && "neon:retryable" in err);
      
      if (!retryable || i === attempts - 1) throw err;
      
      console.warn(`[Neon DB] Intento ${i + 1} falló. Reintentando en ${delayMs * (i + 1)}ms... Error: ${msg.substring(0, 50)}`);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
