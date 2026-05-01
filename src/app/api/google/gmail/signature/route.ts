import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";

type SendAs = {
  sendAsEmail: string;
  signature?: string;
  isPrimary?: boolean;
  isDefault?: boolean;
  displayName?: string;
};
type SendAsList = { sendAs?: SendAs[] };

/**
 * Devuelve la firma configurada en Gmail para la dirección "Send-as" primaria.
 * Requiere scope https://www.googleapis.com/auth/gmail.settings.basic.
 */
export async function GET() {
  const r = await googleFetchAuto<SendAsList>(
    "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
  );
  if (r.needsReauth) {
    return NextResponse.json({ needsReauth: true, signature: "" }, { status: 401 });
  }
  const sendAs = r.data?.sendAs ?? [];
  const principal =
    sendAs.find((s) => s.isPrimary) ??
    sendAs.find((s) => s.isDefault) ??
    sendAs[0];
  return NextResponse.json({
    signature: principal?.signature ?? "",
    email: principal?.sendAsEmail ?? null,
    nombre: principal?.displayName ?? null,
  });
}
