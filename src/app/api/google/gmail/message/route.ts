import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google/api";

type GmailFullMessage = {
  id: string;
  snippet: string;
  payload?: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailFullMessage["payload"][];
  };
};

function decodeBody(b64?: string): string {
  if (!b64) return "";
  try {
    const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(norm, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractText(payload: GmailFullMessage["payload"]): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  return "";
}

export async function GET(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ connected: false, cuerpo: "" });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const msg = await googleFetch<GmailFullMessage>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    accessToken,
  );
  if (!msg) return NextResponse.json({ connected: true, cuerpo: "" });

  const cuerpo = extractText(msg.payload) || msg.snippet;
  return NextResponse.json({ connected: true, cuerpo });
}
