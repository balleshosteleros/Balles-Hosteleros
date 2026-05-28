import { withMetricas } from "@/features/canales-google-rwg/lib/instrumentacion";
import type { HealthCheckResponse } from "@/features/canales-google-rwg/lib/proto-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withMetricas("HealthCheck", async () => {
  const body: HealthCheckResponse = { operation_succeeded: true };
  return { status: 200, body, metrica: { causa: "ok" } };
});
