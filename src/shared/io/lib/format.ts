export function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/[€$\s]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseBoolean(val: unknown): boolean | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  if (["si", "sí", "yes", "true", "1", "x", "v"].includes(s)) return true;
  if (["no", "false", "0", "-", ""].includes(s)) return false;
  return null;
}

export function parseDate(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const esMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (esMatch) {
    const [, dStr, mStr, yStr] = esMatch;
    const d = dStr.padStart(2, "0");
    const m = mStr.padStart(2, "0");
    const y = yStr.length === 2 ? `20${yStr}` : yStr;
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function parseStringArray(
  val: unknown,
  separator: RegExp | string = /[,;|]/
): string[] {
  if (val === null || val === undefined || val === "") return [];
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  return String(val)
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function formatBoolean(val: unknown): string {
  if (val === true) return "Sí";
  if (val === false) return "No";
  return "";
}

export function formatDate(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return "";
    return val.toISOString().slice(0, 10);
  }
  return String(val);
}

export function formatArray(val: unknown, separator = ", "): string {
  if (Array.isArray(val)) return val.map((v) => String(v)).join(separator);
  return val == null ? "" : String(val);
}
