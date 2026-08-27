/**
 * TEMPORAL — diagnóstico del enrutado de páginas web de preview.
 * Se borra en cuanto quede resuelto.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  resolverHostname,
  esHostPrincipal,
  esHostPreviewWeb,
  hostsPreviewWeb,
} from "@/features/marketing/pagina-web/services/hostname-resolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("x-paginas-web-host") ?? h.get("host") ?? "";

  const match = await resolverHostname(host, "");

  return NextResponse.json({
    host_visto: host,
    cabeceras: {
      "x-forwarded-host": h.get("x-forwarded-host"),
      "x-paginas-web-host": h.get("x-paginas-web-host"),
      host: h.get("host"),
    },
    env_preview_hosts_runtime: process.env.PAGINAS_WEB_PREVIEW_HOSTS ?? null,
    hostsPreviewWeb: hostsPreviewWeb(),
    esHostPreviewWeb: esHostPreviewWeb(host),
    esHostPrincipal: esHostPrincipal(host),
    resolver_encuentra_web: Boolean(match),
    resolver_detalle: match
      ? { empresa: match.nombre_empresa, pagina: match.nombre_pagina, bloques: match.bloques.length }
      : null,
  });
}
