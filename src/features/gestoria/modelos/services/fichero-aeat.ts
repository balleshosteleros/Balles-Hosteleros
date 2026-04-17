/**
 * Generador de ficheros posicionales AEAT para Sede Electrónica.
 * Formato texto ISO-8859-1 (Latin-1) posicional.
 *
 * NOTA sobre encoding: Supabase Storage devuelve bytes; este servicio produce
 * un Uint8Array con la codificación Latin-1 correcta.
 */

import type { CasillasMap, ModeloAeat, SnapshotEmpresa } from "../types/modelos";

function padRight(v: string | undefined | null, len: number): string {
  const s = (v ?? "").toString();
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function padNum(v: number | undefined, len: number, decimales = 2): string {
  const n = v ?? 0;
  const negativo = n < 0 ? "N" : " ";
  const entero = Math.abs(n);
  const cents = Math.round(entero * 10 ** decimales).toString();
  const padded = cents.padStart(len - 1, "0");
  return `${negativo}${padded.slice(0, len - 1)}`;
}

function nifLimpio(nif: string | undefined): string {
  return (nif ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function ejercicioEjerPeriodo(tipo: string, periodo: string, ejercicio: number): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (periodo === "Q1") return `${ejercicio}${pad(1)}1T`.slice(0, 7);
  if (periodo === "Q2") return `${ejercicio}2T`;
  if (periodo === "Q3") return `${ejercicio}3T`;
  if (periodo === "Q4") return `${ejercicio}4T`;
  return `${ejercicio}0A`;
}

interface BuildInput {
  modelo: ModeloAeat;
  snapshot: SnapshotEmpresa;
}

function build303(input: BuildInput): string {
  const { modelo, snapshot } = input;
  const c: CasillasMap = modelo.casillas ?? {};

  const cabecera =
    "<T303" +
    "0001" +
    ejercicioEjerPeriodo("303", modelo.periodo, modelo.ejercicio) +
    padRight(nifLimpio(snapshot.nif), 9) +
    padRight(snapshot.razon_social, 60) +
    ">";

  const detalle =
    "<DATOS>" +
    padNum(c["01"], 17) +
    padNum(c["03"], 17) +
    padNum(c["04"], 17) +
    padNum(c["06"], 17) +
    padNum(c["07"], 17) +
    padNum(c["09"], 17) +
    padNum(c["28"], 17) +
    padNum(c["29"], 17) +
    padNum(c["30"], 17) +
    padNum(c["31"], 17) +
    padNum(c["36"], 17) +
    padNum(c["37"], 17) +
    padNum(c["45"], 17) +
    padNum(c["46"], 17) +
    padNum(c["64"], 17) +
    padNum(c["67"], 17) +
    padNum(c["69"], 17) +
    padNum(c["71"], 17) +
    padNum(c["72"], 17) +
    "</DATOS>";

  return `${cabecera}${detalle}</T303>`;
}

function build130(input: BuildInput): string {
  const { modelo, snapshot } = input;
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    "<T130" +
    "0001" +
    ejercicioEjerPeriodo("130", modelo.periodo, modelo.ejercicio) +
    padRight(nifLimpio(snapshot.nif), 9) +
    padRight(snapshot.razon_social, 60) +
    "><DATOS>" +
    padNum(c["01"], 17) +
    padNum(c["02"], 17) +
    padNum(c["03"], 17) +
    padNum(c["04"], 7, 2) +
    padNum(c["06"], 17) +
    padNum(c["07"], 17) +
    padNum(c["08"], 17) +
    padNum(c["19"], 17) +
    "</DATOS></T130>"
  );
}

function build111(input: BuildInput): string {
  const { modelo, snapshot } = input;
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    "<T111" +
    "0001" +
    ejercicioEjerPeriodo("111", modelo.periodo, modelo.ejercicio) +
    padRight(nifLimpio(snapshot.nif), 9) +
    padRight(snapshot.razon_social, 60) +
    "><DATOS>" +
    padNum(c["02"], 9, 0) +
    padNum(c["01"], 17) +
    padNum(c["03"], 17) +
    padNum(c["08"], 9, 0) +
    padNum(c["07"], 17) +
    padNum(c["09"], 17) +
    padNum(c["25"], 17) +
    padNum(c["27"], 17) +
    padNum(c["28"], 17) +
    "</DATOS></T111>"
  );
}

function build115(input: BuildInput): string {
  const { modelo, snapshot } = input;
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    "<T115" +
    "0001" +
    ejercicioEjerPeriodo("115", modelo.periodo, modelo.ejercicio) +
    padRight(nifLimpio(snapshot.nif), 9) +
    padRight(snapshot.razon_social, 60) +
    "><DATOS>" +
    padNum(c["01"], 9, 0) +
    padNum(c["02"], 17) +
    padNum(c["03"], 17) +
    padNum(c["06"], 17) +
    "</DATOS></T115>"
  );
}

function build390(input: BuildInput): string {
  const { modelo, snapshot } = input;
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    "<T390" +
    "0001" +
    ejercicioEjerPeriodo("390", modelo.periodo, modelo.ejercicio) +
    padRight(nifLimpio(snapshot.nif), 9) +
    padRight(snapshot.razon_social, 60) +
    "><DATOS>" +
    padNum(c["100"], 17) +
    padNum(c["101"], 17) +
    padNum(c["102"], 17) +
    padNum(c["103"], 17) +
    padNum(c["104"], 17) +
    padNum(c["105"], 17) +
    padNum(c["108"], 17) +
    padNum(c["109"], 17) +
    padNum(c["190"], 17) +
    padNum(c["191"], 17) +
    padNum(c["192"], 17) +
    padNum(c["193"], 17) +
    padNum(c["597"], 17) +
    padNum(c["598"], 17) +
    padNum(c["599"], 17) +
    padNum(c["645"], 17) +
    padNum(c["658"], 17) +
    padNum(c["660"], 17) +
    "</DATOS></T390>"
  );
}

interface Build347Input {
  modelo: ModeloAeat;
  snapshot: SnapshotEmpresa;
  registros: Array<{
    nif: string;
    nombre: string;
    clave: string;
    importe_q1: number;
    importe_q2: number;
    importe_q3: number;
    importe_q4: number;
    importe_total: number;
  }>;
}

function build347(input: Build347Input): string {
  const { modelo, snapshot, registros } = input;
  const cabecera =
    "<T347" +
    "0001" +
    ejercicioEjerPeriodo("347", "ANUAL", modelo.ejercicio) +
    padRight(nifLimpio(snapshot.nif), 9) +
    padRight(snapshot.razon_social, 60) +
    ">";

  const detalle = registros
    .map(
      (r) =>
        "<REG>" +
        padRight(nifLimpio(r.nif), 9) +
        padRight(r.nombre, 60) +
        padRight(r.clave, 1) +
        padNum(r.importe_total, 17) +
        padNum(r.importe_q1, 17) +
        padNum(r.importe_q2, 17) +
        padNum(r.importe_q3, 17) +
        padNum(r.importe_q4, 17) +
        "</REG>",
    )
    .join("\n");

  return `${cabecera}\n${detalle}\n</T347>`;
}

export interface GenerarFicheroInput {
  modelo: ModeloAeat;
  snapshot: SnapshotEmpresa;
  registros347?: Build347Input["registros"];
}

export function generarFicheroAEAT(input: GenerarFicheroInput): {
  contenido: string;
  mimeType: string;
  filename: string;
} {
  const { modelo, snapshot } = input;
  let contenido = "";

  switch (modelo.tipo) {
    case "303":
      contenido = build303({ modelo, snapshot });
      break;
    case "130":
      contenido = build130({ modelo, snapshot });
      break;
    case "111":
      contenido = build111({ modelo, snapshot });
      break;
    case "115":
      contenido = build115({ modelo, snapshot });
      break;
    case "390":
      contenido = build390({ modelo, snapshot });
      break;
    case "347":
      contenido = build347({
        modelo,
        snapshot,
        registros: input.registros347 ?? [],
      });
      break;
  }

  const periodoTxt =
    modelo.periodo === "ANUAL" ? `${modelo.ejercicio}` : `${modelo.ejercicio}${modelo.periodo}`;

  return {
    contenido,
    mimeType: "text/plain; charset=iso-8859-1",
    filename: `modelo-${modelo.tipo}-${periodoTxt}.${modelo.tipo}`,
  };
}

export function toLatin1Bytes(texto: string): Uint8Array {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const code = texto.charCodeAt(i);
    bytes[i] = code <= 0xff ? code : 0x3f;
  }
  return bytes;
}
