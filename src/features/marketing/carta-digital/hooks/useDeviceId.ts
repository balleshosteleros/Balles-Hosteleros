"use client";

/**
 * Genera y persiste un device_id estable para likes anónimos.
 * Combina cookie/localStorage + fingerprint (UA + screen + tz + lang).
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "cd_device_id";

async function fingerprintHash(): Promise<string> {
  if (typeof window === "undefined") return "ssr";
  const parts = [
    navigator.userAgent ?? "",
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    navigator.language ?? "",
    navigator.hardwareConcurrency?.toString() ?? "",
  ].join("|");
  const enc = new TextEncoder().encode(parts);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function randomId(): string {
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(36))
    .join("");
}

export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (existing && existing.length >= 16) {
          if (!cancelled) setDeviceId(existing);
          return;
        }
        const fp = await fingerprintHash();
        const id = `${fp}-${randomId()}`;
        localStorage.setItem(STORAGE_KEY, id);
        if (!cancelled) setDeviceId(id);
      } catch {
        const fallback = `f-${randomId()}`;
        if (!cancelled) setDeviceId(fallback);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return deviceId;
}
