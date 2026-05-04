import { NextResponse } from "next/server";
import { getGoogleTokens, googleFetch } from "@/lib/google/api";

type PeopleSearchResponse = {
  results?: {
    person?: {
      emailAddresses?: { value: string }[];
      photos?: { url: string; default?: boolean; metadata?: { primary?: boolean } }[];
    };
  }[];
};

function fotoNoDefault(
  photos?: { url: string; default?: boolean; metadata?: { primary?: boolean } }[],
): string | null {
  if (!photos || photos.length === 0) return null;
  const real = photos.find((p) => !p.default);
  return real?.url ?? null;
}

async function buscarEnEndpoint(
  endpoint: "people:searchContacts" | "otherContacts:search",
  query: string,
  accessToken: string,
): Promise<{ email: string; photo: string }[]> {
  const url = new URL(`https://people.googleapis.com/v1/${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("readMask", "emailAddresses,photos");
  url.searchParams.set("pageSize", "10");
  const data = await googleFetch<PeopleSearchResponse>(url.toString(), accessToken);
  if (!data?.results) return [];
  const out: { email: string; photo: string }[] = [];
  for (const r of data.results) {
    const emails = r.person?.emailAddresses ?? [];
    const foto = fotoNoDefault(r.person?.photos);
    if (!foto) continue;
    for (const e of emails) {
      if (e.value) out.push({ email: e.value.toLowerCase(), photo: foto });
    }
  }
  return out;
}

export async function POST(request: Request) {
  const { accessToken } = await getGoogleTokens();
  if (!accessToken) {
    return NextResponse.json({ connected: false, photos: {} });
  }

  let body: { emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ connected: true, photos: {} });
  }

  const emails = (body.emails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) {
    return NextResponse.json({ connected: true, photos: {} });
  }

  const unicos = Array.from(new Set(emails));
  const resultado: Record<string, string> = {};

  // Limitamos a 30 búsquedas en paralelo para no inundar Google
  const lote = unicos.slice(0, 30);

  await Promise.all(
    lote.map(async (email) => {
      // 1) Contactos guardados
      try {
        const matches = await buscarEnEndpoint(
          "people:searchContacts",
          email,
          accessToken,
        );
        const m = matches.find((x) => x.email === email);
        if (m) {
          resultado[email] = m.photo;
          return;
        }
      } catch {
        /* ignore */
      }
      // 2) "Otros contactos" (gente con la que has cruzado correos pero no
      //    está en tu agenda). Suele cubrir clientes/proveedores.
      try {
        const matches = await buscarEnEndpoint(
          "otherContacts:search",
          email,
          accessToken,
        );
        const m = matches.find((x) => x.email === email);
        if (m) resultado[email] = m.photo;
      } catch {
        /* ignore */
      }
    }),
  );

  return NextResponse.json({ connected: true, photos: resultado });
}
