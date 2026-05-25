/**
 * Cliente mínimo para Google Places API.
 *
 * Endpoints usados:
 *   - findplacefromtext  → resolver place_id a partir de "{nombre} {direccion}"
 *   - place/details      → traer las (hasta 5) reseñas más relevantes
 *
 * Requiere GOOGLE_MAPS_API_KEY en el entorno (server-only).
 */

const FIND_PLACE_URL =
  "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

export function getGoogleMapsApiKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export interface PlaceCandidate {
  placeId: string;
  name: string;
  formattedAddress: string;
}

export interface PlaceReview {
  externalId: string;
  authorName: string;
  authorUrl: string | null;
  authorAvatar: string | null;
  language: string | null;
  rating: number;
  text: string;
  time: string;
  relativeTime: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating: number | null;
  totalRatings: number | null;
  reviews: PlaceReview[];
}

export async function findPlaceByText(
  query: string,
): Promise<PlaceCandidate | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) throw new Error("MISSING_GOOGLE_MAPS_API_KEY");
  if (!query.trim()) return null;

  const url = new URL(FIND_PLACE_URL);
  url.searchParams.set("input", query);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id,name,formatted_address");
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "es");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`places_find_http_${res.status}`);
  const json = (await res.json()) as {
    status: string;
    candidates?: Array<{
      place_id: string;
      name?: string;
      formatted_address?: string;
    }>;
  };

  if (json.status === "ZERO_RESULTS") return null;
  if (json.status !== "OK") throw new Error(`places_find_${json.status}`);

  const top = json.candidates?.[0];
  if (!top) return null;
  return {
    placeId: top.place_id,
    name: top.name ?? "",
    formattedAddress: top.formatted_address ?? "",
  };
}

export async function getPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) throw new Error("MISSING_GOOGLE_MAPS_API_KEY");

  const url = new URL(DETAILS_URL);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,rating,user_ratings_total,reviews",
  );
  url.searchParams.set("language", "es");
  url.searchParams.set("reviews_no_translations", "true");
  url.searchParams.set("reviews_sort", "newest");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`places_details_http_${res.status}`);
  const json = (await res.json()) as {
    status: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      rating?: number;
      user_ratings_total?: number;
      reviews?: Array<{
        author_name: string;
        author_url?: string;
        profile_photo_url?: string;
        language?: string;
        rating: number;
        text?: string;
        time: number;
        relative_time_description?: string;
      }>;
    };
  };

  if (json.status === "NOT_FOUND" || json.status === "ZERO_RESULTS") return null;
  if (json.status !== "OK") throw new Error(`places_details_${json.status}`);

  const r = json.result;
  if (!r) return null;

  const reviews: PlaceReview[] = (r.reviews ?? []).map((rev) => ({
    externalId: `google:${placeId}:${rev.time}:${hashString(rev.author_name)}`,
    authorName: rev.author_name,
    authorUrl: rev.author_url ?? null,
    authorAvatar: rev.profile_photo_url ?? null,
    language: rev.language ?? null,
    rating: rev.rating,
    text: (rev.text ?? "").trim(),
    time: new Date(rev.time * 1000).toISOString(),
    relativeTime: rev.relative_time_description ?? "",
  }));

  return {
    placeId: r.place_id ?? placeId,
    name: r.name ?? "",
    formattedAddress: r.formatted_address ?? "",
    rating: typeof r.rating === "number" ? r.rating : null,
    totalRatings:
      typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
    reviews,
  };
}

/**
 * Mapea la puntuación de Google (1-5 estrellas) al estado del pipeline.
 * El usuario puede mover manualmente la tarjeta después; este es solo el
 * encasillado inicial al importar.
 */
export function estadoDesdeRating(
  rating: number,
): "excelente" | "regular" | "malo" {
  if (rating >= 5) return "excelente";
  if (rating >= 3) return "regular";
  return "malo";
}

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
