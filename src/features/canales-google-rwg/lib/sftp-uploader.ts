/**
 * Wrapper de ssh2-sftp-client para subir feeds JSON al Actions Center.
 * Dry-run silencioso si faltan envs (no rompe el cron; deja un fallido legible).
 */

import Client from "ssh2-sftp-client";
import { gzipSync } from "node:zlib";

export interface UploadFile {
  /** Ruta remota relativa al GOOGLE_RWG_SFTP_REMOTE_DIR (ej. "merchant_feed.json.gz"). */
  remoteFileName: string;
  /** Cuerpo JSON serializable. */
  body: unknown;
}

export interface UploadResult {
  ok: boolean;
  bytes: number;
  error?: string;
  dryRun?: boolean;
  remotePath?: string;
}

interface SftpConfig {
  host: string;
  port: number;
  username: string;
  privateKey: Buffer;
  remoteDir: string;
}

function readSftpConfig(): { ok: true; config: SftpConfig } | { ok: false; missing: string[] } {
  const host = process.env.GOOGLE_RWG_SFTP_HOST?.trim();
  const portStr = process.env.GOOGLE_RWG_SFTP_PORT?.trim();
  const username = process.env.GOOGLE_RWG_SFTP_USER?.trim();
  const pkB64 = process.env.GOOGLE_RWG_SFTP_PRIVATE_KEY?.trim();
  const remoteDir = process.env.GOOGLE_RWG_SFTP_REMOTE_DIR?.trim();

  const missing: string[] = [];
  if (!host) missing.push("GOOGLE_RWG_SFTP_HOST");
  if (!username) missing.push("GOOGLE_RWG_SFTP_USER");
  if (!pkB64) missing.push("GOOGLE_RWG_SFTP_PRIVATE_KEY");
  if (!remoteDir) missing.push("GOOGLE_RWG_SFTP_REMOTE_DIR");
  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    config: {
      host: host!,
      port: portStr ? parseInt(portStr, 10) : 22,
      username: username!,
      privateKey: Buffer.from(pkB64!, "base64"),
      remoteDir: remoteDir!,
    },
  };
}

/**
 * Sube los ficheros indicados al SFTP del Actions Center, gzipeados.
 * Si faltan envs, devuelve dryRun=true con bytes computados pero no sube.
 */
export async function uploadFeedsToActionsCenter(files: UploadFile[]): Promise<UploadResult[]> {
  const cfg = readSftpConfig();

  // Prepara los buffers gzipeados (lo hacemos siempre — sirve para "bytes" del audit).
  const prepared = files.map((f) => {
    const json = JSON.stringify(f.body);
    const gz = gzipSync(json);
    return { fileName: `${f.remoteFileName}.gz`, gz };
  });

  if (!cfg.ok) {
    return prepared.map((p) => ({
      ok: false,
      dryRun: true,
      bytes: p.gz.byteLength,
      error: `dry_run: missing ${cfg.missing.join(",")}`,
    }));
  }

  const client = new Client();
  const results: UploadResult[] = [];
  try {
    await client.connect({
      host: cfg.config.host,
      port: cfg.config.port,
      username: cfg.config.username,
      privateKey: cfg.config.privateKey,
      readyTimeout: 30_000,
    });
    for (const p of prepared) {
      const remotePath = `${cfg.config.remoteDir.replace(/\/$/, "")}/${p.fileName}`;
      try {
        await client.put(p.gz, remotePath);
        results.push({ ok: true, bytes: p.gz.byteLength, remotePath });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown_sftp_put_error";
        results.push({ ok: false, bytes: p.gz.byteLength, error: msg.slice(0, 200), remotePath });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_sftp_connect_error";
    for (const p of prepared) {
      results.push({ ok: false, bytes: p.gz.byteLength, error: msg.slice(0, 200) });
    }
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }

  return results;
}
