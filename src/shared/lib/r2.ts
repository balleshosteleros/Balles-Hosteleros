/**
 * Cliente compartido de Cloudflare R2 (compatible S3).
 *
 * Antes `getR2()` estaba triplicado inline en varias rutas API. Este módulo lo
 * centraliza. R2 se configura con las variables `R2_*` del entorno.
 *
 * Solo debe importarse desde código de servidor (runtime "nodejs").
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

/** Borra un objeto de R2. No lanza si el objeto ya no existe. */
export async function deleteObjectR2(key: string): Promise<void> {
  const { client, bucket } = getR2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
