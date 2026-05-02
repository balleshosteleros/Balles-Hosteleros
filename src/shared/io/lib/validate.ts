import type { ColumnDef, ImportError, ParsedFile, RowSchema } from "../types";
import {
  parseBoolean,
  parseDate,
  parseNumber,
  parseStringArray,
} from "./format";
import { buildColumnLookup } from "./xlsx";

export function coerceRow<T>(
  rawRow: Record<string, unknown>,
  columns: ColumnDef<T>[]
): Record<string, unknown> {
  const lookup = buildColumnLookup(columns);
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(rawRow)) {
    const col = lookup.get(rawKey);
    if (!col) continue;
    out[col.key] = coerceValue(rawValue, col);
  }
  for (const col of columns) {
    if (out[col.key] === undefined) {
      out[col.key] = null;
    }
  }
  return out;
}

function coerceValue<T>(value: unknown, col: ColumnDef<T>): unknown {
  if (value === null || value === undefined || value === "") return null;
  switch (col.type) {
    case "number":
      return parseNumber(value);
    case "boolean":
      return parseBoolean(value);
    case "date":
      return parseDate(value);
    case "array":
      return parseStringArray(value, col.arraySeparator);
    case "enum":
      return matchEnum(value, col.values ?? []);
    case "fk":
    case "string":
    default:
      return typeof value === "string" ? value.trim() : String(value).trim();
  }
}

function matchEnum(
  value: unknown,
  values: readonly (string | number)[]
): string | number | null {
  if (value === null || value === undefined) return null;
  const target = String(value).trim().toLowerCase();
  for (const v of values) {
    if (String(v).toLowerCase() === target) return v;
  }
  return null;
}

export function validateRows<T>(
  rawRows: Record<string, unknown>[],
  columns: ColumnDef<T>[],
  schema: RowSchema<T>
): ParsedFile<T> {
  const rows: T[] = [];
  const errors: ImportError[] = [];

  rawRows.forEach((rawRow, idx) => {
    const rowNum = idx + 2;
    const isEmpty = Object.values(rawRow).every(
      (v) => v === null || v === undefined || v === ""
    );
    if (isEmpty) return;

    const coerced = coerceRow(rawRow, columns);
    const result = schema.safeParse(coerced);
    if (result.success) {
      rows.push(result.data);
    } else {
      for (const issue of result.error.issues) {
        const path = issue.path.map((p) => String(p)).join(".");
        errors.push({
          row: rowNum,
          column: path || undefined,
          message: issue.message,
          rawValue: path ? coerced[path] : coerced,
        });
      }
    }
  });

  return { rows, errors, rawCount: rawRows.length };
}
