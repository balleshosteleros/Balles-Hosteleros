export type ColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "array"
  | "fk";

export interface ColumnDef<T = unknown> {
  key: keyof T & string;
  label: string;
  aliases?: string[];
  type?: ColumnType;
  required?: boolean;
  unique?: boolean;
  values?: readonly (string | number)[];
  arraySeparator?: RegExp | string;
  refSubmodule?: string;
  example?: string;
  description?: string;
  hideInExport?: boolean;
  hideInImport?: boolean;
}

export interface IOContext {
  empresaId?: string;
  userId?: string;
  variant?: string;
  [key: string]: unknown;
}

export type ImportMode = "insert" | "upsert" | "replace";

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  rawValue?: unknown;
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface ParsedFile<T> {
  rows: T[];
  errors: ImportError[];
  rawCount: number;
}

export type ParseSuccess<T> = { success: true; data: T };
export type ParseFailure = {
  success: false;
  error: { issues: Array<{ path: (string | number)[]; message: string }> };
};
export interface RowSchema<T> {
  safeParse(input: unknown): ParseSuccess<T> | ParseFailure;
}

export interface ModuleIO<T> {
  module: string;
  submodule: string;
  label: string;
  description?: string;
  columns: ColumnDef<T>[];
  schema: RowSchema<T>;
  uniqueBy?: keyof T & string;
  fetchAll: (ctx: IOContext) => Promise<T[]>;
  upsert?: (rows: T[], ctx: IOContext, mode: ImportMode) => Promise<ImportResult>;
  dictionary?: Record<string, readonly (string | number)[]>;
  supportedExportFormats?: ("xlsx" | "csv" | "json" | "pdf")[];
  supportedImportFormats?: ("xlsx" | "csv" | "json")[];
}
