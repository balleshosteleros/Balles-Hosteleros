/**
 * Cliente compartido de Cloudflare R2 (compatible S3).
 *
 * Antes `getR2()` estaba triplicado inline en varias rutas API. Este módulo lo
 * centraliza. R2 se configura con las variables `R2_*` del entorno.
 *
 * Solo debe importarse desde código de servidor (runtime "nodejs").
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash, createHmac } from "crypto";

let _client: S3Client | null = null;

export type R2 = { client: S3Client; bucket: string; publicUrl: string };

/** Devuelve el cliente R2 + bucket + URL pública. Lanza si falta configuración. */
export function getR2(): R2 {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!bucket || !publicUrl || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables R2_* para configurar Cloudflare R2");
  }
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return { client: _client, bucket, publicUrl };
}

/**
 * Genera una URL PUT firmada (AWS SigV4, query-string) para subir un objeto
 * DIRECTAMENTE a R2 desde el navegador, sin que el archivo pase por la función
 * serverless. Esto elimina el límite de ~4.5 MB del body de las API Routes en
 * Vercel, que hacía fallar las grabaciones aunque hubiera conexión.
 *
 * Implementado con `crypto` nativo para no añadir dependencias
 * (@aws-sdk/s3-request-presigner). Firma el "unsigned payload" para que el
 * cliente pueda subir un blob de tamaño arbitrario.
 */
export function presignPutR2(
  key: string,
  contentType: string,
  expiresSeconds = 900,
): string {
  const endpoint = process.env.R2_ENDPOINT!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables R2_* para firmar la subida");
  }

  const region = "auto";
  const service = "s3";
  const host = new URL(endpoint).host;

  // Timestamp SigV4 (YYYYMMDD'T'HHMMSS'Z'). No usamos toISOString con guiones.
  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "")
    .replace(/(\d{8})(\d{6})Z/, "$1T$2Z");
  const dateStamp = amzDate.slice(0, 8);

  const encodeKey = (k: string) =>
    k.split("/").map((seg) => encodeURIComponent(seg)).join("/");
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signedHeaders = "host";

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const hmac = (key: Buffer | string, data: string) =>
    createHmac("sha256", key).update(data).digest();
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  return `${endpoint.replace(/\/$/, "")}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Sube un buffer a R2 y devuelve su URL pública. */
export async function putObjectR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { client, bucket, publicUrl } = getR2();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return `${publicUrl}/${key}`;
}

/**
 * Descarga un objeto de R2 y devuelve su cuerpo como stream web + metadatos.
 * Se usa para el proxy de descarga: como el objeto se sirve desde el mismo
 * origen que la app, el atributo `download`/`Content-Disposition: attachment`
 * SÍ fuerza la descarga (el navegador ignora `download` en enlaces cross-origin
 * a R2, por eso los vídeos se abrían en la pestaña en vez de descargarse).
 */
export async function getObjectR2(
  key: string,
): Promise<{ body: ReadableStream; contentType: string; contentLength?: number }> {
  const { client, bucket } = getR2();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body as unknown as ReadableStream;
  return {
    body,
    contentType: res.ContentType ?? "application/octet-stream",
    contentLength: res.ContentLength,
  };
}

/** Borra un objeto de R2. No lanza si el objeto ya no existe. */
export async function deleteObjectR2(key: string): Promise<void> {
  const { client, bucket } = getR2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
