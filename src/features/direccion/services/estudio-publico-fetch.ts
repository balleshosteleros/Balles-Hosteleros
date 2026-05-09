/**
 * Lectura pública de un estudio de apertura por share_slug.
 * Server-side: usa service-role para esquivar RLS y devuelve solo lo
 * necesario al cliente.
 *
 * Una fila se considera "compartible" cuando:
 *   · share_active = true
 *   · share_slug coincide
 *
 * El cliente público nunca ve foto_path crudo, sino URLs firmadas (1h).
 */
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  bloqueLocalInicial,
  bloqueOcupacionInicial,
  imagenMarcaInicial,
  normalizeBloqueOcupacion,
  normalizeFacturacion,
  propuestaGastronomicaInicial,
  type BloqueLocal,
  type CategoriaFotoLocal,
  type EstudioApertura,
  type ImagenMarcaEstudio,
  type PropuestaGastronomica,
} from "@/features/direccion/data/aperturas";

const BUCKET = "estudios-apertura-fotos";
const SIGNED_URL_TTL = 60 * 60; // 1h

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Sb = ReturnType<typeof serviceClient>;

async function firmarLocal(sb: Sb, local: BloqueLocal): Promise<BloqueLocal> {
  const next: BloqueLocal = {
    caracteristicas: local.caracteristicas,
    ubicacion: local.ubicacion,
    fotos: {
      fachada: [], interior: [], barra: [], terraza: [], cocina: [],
      aseos: [], almacen: [], parking: [], otras: [],
    },
  };
  for (const cat of Object.keys(next.fotos) as CategoriaFotoLocal[]) {
    const fotos = local.fotos?.[cat] ?? [];
    next.fotos[cat] = await Promise.all(fotos.map(async (f) => ({
      ...f,
      url: f.path ? (await sb.storage.from(BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL)).data?.signedUrl ?? undefined : undefined,
    })));
  }
  return next;
}

async function firmarMarca(sb: Sb, marca: ImagenMarcaEstudio): Promise<ImagenMarcaEstudio> {
  if (!marca.logoPath) return { ...marca, logoUrl: undefined };
  const signed = await sb.storage.from(BUCKET).createSignedUrl(marca.logoPath, SIGNED_URL_TTL);
  return { ...marca, logoUrl: signed.data?.signedUrl ?? undefined };
}

async function firmarGastronomia(sb: Sb, prop: PropuestaGastronomica): Promise<PropuestaGastronomica> {
  const platos = await Promise.all((prop.platos ?? []).map(async (p) => {
    if (!p.foto?.path) return p;
    const signed = await sb.storage.from(BUCKET).createSignedUrl(p.foto.path, SIGNED_URL_TTL);
    return { ...p, foto: { ...p.foto, url: signed.data?.signedUrl ?? undefined } };
  }));
  return { ...prop, platos };
}

export interface EstudioPublico {
  estudio: EstudioApertura;
  empresaNombre: string;
  empresaLogoUrl: string | null;
}

export async function fetchEstudioPorSlug(slug: string): Promise<EstudioPublico | null> {
  const sb = serviceClient();

  const { data: row, error } = await sb
    .from("estudios_apertura")
    .select("id, empresa_id, datos, facturacion, costes, procedencia, destinos, amortizacion, foto_path, viabilidad, actividad, creado, local, imagen_marca, propuesta_gastronomica, ocupacion, share_active")
    .eq("share_slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[estudio-publico] fetch:", error);
    return null;
  }
  if (!row) return null;
  if (!row.share_active) return null;

  // Firma de URLs
  let fotoUrl: string | undefined;
  if (row.foto_path) {
    const s = await sb.storage.from(BUCKET).createSignedUrl(row.foto_path as string, SIGNED_URL_TTL);
    fotoUrl = s.data?.signedUrl ?? undefined;
  }

  const localRaw = (row.local as BloqueLocal | null) ?? null;
  const local = localRaw && Object.keys(localRaw).length > 0
    ? { ...bloqueLocalInicial(), ...localRaw, fotos: { ...bloqueLocalInicial().fotos, ...(localRaw.fotos ?? {}) } }
    : bloqueLocalInicial();

  const marcaRaw = (row.imagen_marca as ImagenMarcaEstudio | null) ?? null;
  const marca = marcaRaw && Object.keys(marcaRaw).length > 0
    ? { ...imagenMarcaInicial(), ...marcaRaw }
    : imagenMarcaInicial();

  const propRaw = (row.propuesta_gastronomica as PropuestaGastronomica | null) ?? null;
  const prop = propRaw && Object.keys(propRaw).length > 0
    ? { ...propuestaGastronomicaInicial(), ...propRaw }
    : propuestaGastronomicaInicial();

  const estudio: EstudioApertura = {
    id: row.id as string,
    datos: row.datos as EstudioApertura["datos"],
    facturacion: normalizeFacturacion(row.facturacion),
    costes: row.costes as EstudioApertura["costes"],
    procedencia: (row.procedencia as EstudioApertura["procedencia"]) ?? [],
    destinos: (row.destinos as EstudioApertura["destinos"]) ?? [],
    amortizacion: (row.amortizacion as EstudioApertura["amortizacion"]) ?? [],
    creado: (row.creado as string) ?? "",
    imagen: fotoUrl,
    viabilidad: (row.viabilidad as EstudioApertura["viabilidad"]) ?? "viable",
    actividad: (row.actividad as EstudioApertura["actividad"]) ?? "no_activo",
    local: await firmarLocal(sb, local),
    imagenMarca: await firmarMarca(sb, marca),
    propuesta: await firmarGastronomia(sb, prop),
    ocupacion: normalizeBloqueOcupacion(row.ocupacion) ?? bloqueOcupacionInicial(),
  };

  // Empresa: nombre + logo (público)
  const { data: empresa } = await sb
    .from("empresas")
    .select("nombre, logo_url")
    .eq("id", row.empresa_id as string)
    .maybeSingle();

  return {
    estudio,
    empresaNombre: (empresa?.nombre as string) ?? "",
    empresaLogoUrl: (empresa?.logo_url as string | null) ?? null,
  };
}
