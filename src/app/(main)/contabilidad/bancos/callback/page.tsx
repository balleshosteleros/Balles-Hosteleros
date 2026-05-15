import { redirect } from "next/navigation";
import { finalizarConexion } from "@/features/contabilidad/actions/psd2-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PSD2CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string;
    reference?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const ref = params.ref ?? params.reference;

  if (params.error) {
    redirect(
      `/contabilidad/bancos?psd2_error=${encodeURIComponent(params.error)}`,
    );
  }
  if (!ref) {
    redirect("/contabilidad/bancos?psd2_error=missing_ref");
  }

  const result = await finalizarConexion(ref);
  if (!result.ok) {
    redirect(
      `/contabilidad/bancos?psd2_error=${encodeURIComponent(result.error ?? "unknown")}`,
    );
  }
  redirect(`/contabilidad/bancos?psd2_ok=${result.cuentasCreadas}`);
}
