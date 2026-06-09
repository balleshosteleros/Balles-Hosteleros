import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Versión desplegada actualmente (SHA del commit en Vercel). El cliente la
 * compara contra NEXT_PUBLIC_BUILD_SHA (horneada en su bundle) para auto-
 * recargar la PWA cuando hay un deploy nuevo. Sin cache para que siempre
 * refleje el deploy vivo.
 */
export function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  return NextResponse.json(
    { sha },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}
