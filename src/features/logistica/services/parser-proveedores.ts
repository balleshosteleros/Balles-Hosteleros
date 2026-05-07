/**
 * Parser de proveedores desde Excel/CSV.
 * Acepta múltiples aliases de columna para máxima compatibilidad.
 */

import type { ProveedorImport } from "../types/import";
import type { ProveedorEstado } from "../types/db";
import { readSheet, getField, parseStringArray } from "./parser-excel";

const ESTADOS_VALIDOS: ProveedorEstado[] = ["Activo", "Inactivo", "Archivado"];

function normalizeEstado(raw: string | null): ProveedorEstado {
  if (!raw) return "Activo";
  const lower = raw.toLowerCase();
  if (lower.startsWith("inactiv")) return "Inactivo";
  if (lower.startsWith("archiv")) return "Archivado";
  return "Activo";
}

export async function parseProveedoresFile(file: File): Promise<ProveedorImport[]> {
  const rows = await readSheet(file);
  if (rows.length === 0) throw new Error("El archivo no tiene filas de datos");

  const proveedores: ProveedorImport[] = [];

  for (const row of rows) {
    const nombreComercial =
      getField(row, ["nombre comercial", "nombre", "comercial", "name"]) ?? "";

    if (!nombreComercial) continue;

    const diasRaw = getField(row, ["dias reparto", "dias de reparto", "reparto"]);

    proveedores.push({
      nombreComercial,
      razonSocial: getField(row, ["razon social", "razon", "legal name"]),
      cifNif: getField(row, ["cif", "nif", "cif/nif", "cif nif", "tax id"]),
      categoria:
        getField(row, ["categoria", "category", "tipo"]) ?? "Otros",
      estado: normalizeEstado(getField(row, ["estado", "status"])),
      personaContacto: getField(row, [
        "persona contacto",
        "contacto",
        "persona",
        "contact",
      ]),
      telefonoPrincipal: getField(row, [
        "telefono",
        "telefono principal",
        "phone",
        "tel",
        "tel principal",
      ]),
      telefonoSecundario: getField(row, [
        "telefono secundario",
        "tel secundario",
        "tel 2",
        "movil",
        "mobile",
      ]),
      emailPrincipal: getField(row, [
        "email",
        "email principal",
        "correo",
        "e-mail",
      ]),
      emailComercial: getField(row, ["email comercial", "correo comercial"]),
      emailPedidos: getField(row, ["email pedidos", "correo pedidos"]),
      emailContabilidad: getField(row, [
        "email contabilidad",
        "correo contabilidad",
        "email incidencias",
        "correo incidencias",
      ]),
      telefonoComercial: getField(row, [
        "telefono comercial",
        "tel comercial",
        "movil comercial",
      ]),
      web: getField(row, ["web", "website", "url", "pagina web"]),
      direccion: getField(row, ["direccion", "address", "calle"]),
      ciudad: getField(row, ["ciudad", "city", "poblacion"]),
      provincia: getField(row, ["provincia", "province", "state"]),
      pais: getField(row, ["pais", "country"]) ?? "España",
      codigoPostal: getField(row, [
        "codigo postal",
        "cp",
        "zip",
        "postal code",
      ]),
      diasReparto: parseStringArray(diasRaw),
      condicionesPago: getField(row, [
        "condiciones pago",
        "forma de pago",
        "payment terms",
        "condiciones",
      ]),
      plazoEntrega: getField(row, ["plazo entrega", "plazo", "lead time"]),
      observaciones: getField(row, ["observaciones", "notas", "notes"]),
      comentariosInternos: getField(row, [
        "comentarios internos",
        "comentarios",
        "internal notes",
      ]),
    });
  }

  if (proveedores.length === 0) {
    throw new Error(
      'No se encontraron proveedores. Asegúrate de que el archivo tiene una columna "Nombre comercial" o similar.'
    );
  }

  return proveedores;
}

export function validateEstado(estado: string | undefined): ProveedorEstado {
  if (!estado) return "Activo";
  return ESTADOS_VALIDOS.includes(estado as ProveedorEstado)
    ? (estado as ProveedorEstado)
    : "Activo";
}
