// Catálogo de entidades bancarias operativas en España.
// El código (4 dígitos) corresponde a las posiciones 5-8 de un IBAN ES,
// inmediatamente después de "ES" + 2 dígitos de control. Permite resolver
// el banco automáticamente al introducir el IBAN.
//
// `dominio` se usa para componer la URL del logo (favicon de Google) sin
// depender de assets propios; los logos cambian cuando los bancos rebrandean.
export interface BancoEspana {
  codigo: string;
  nombre: string;
  dominio?: string;
  alias?: string[];
}

export const BANCOS_ESPANA: BancoEspana[] = [
  // Bancos tradicionales
  { codigo: "0049", nombre: "Banco Santander", dominio: "bancosantander.es", alias: ["Santander"] },
  { codigo: "0182", nombre: "BBVA", dominio: "bbva.es", alias: ["Banco Bilbao Vizcaya Argentaria"] },
  { codigo: "0061", nombre: "Banca March", dominio: "bancamarch.es" },
  { codigo: "0081", nombre: "Banco Sabadell", dominio: "bancsabadell.com", alias: ["Sabadell"] },
  { codigo: "0083", nombre: "Renta 4 Banco", dominio: "r4.com" },
  { codigo: "0128", nombre: "Bankinter", dominio: "bankinter.com" },
  { codigo: "0186", nombre: "Banco Mediolanum", dominio: "bancomediolanum.es", alias: ["Mediolanum"] },
  { codigo: "0188", nombre: "Banco Alcalá", dominio: "bancoalcala.com" },
  { codigo: "0198", nombre: "Banco Cooperativo Español", dominio: "bancocooperativo.es" },
  { codigo: "0216", nombre: "Targobank", dominio: "targobank.es" },
  { codigo: "0234", nombre: "Banco Caminos", dominio: "bancocaminos.es" },
  { codigo: "0237", nombre: "CajaSur", dominio: "cajasur.es" },
  { codigo: "0239", nombre: "Evo Banco", dominio: "evobanco.com" },
  { codigo: "1000", nombre: "ICO", dominio: "ico.es", alias: ["Instituto de Crédito Oficial"] },
  { codigo: "0019", nombre: "Deutsche Bank España", dominio: "deutsche-bank.es" },
  { codigo: "0058", nombre: "BNP Paribas España", dominio: "bnpparibas.es" },

  // Bancos digitales / neobancos con IBAN ES
  { codigo: "1490", nombre: "Openbank", dominio: "openbank.es", alias: ["Open Bank"] },
  { codigo: "1465", nombre: "ING España", dominio: "ing.es", alias: ["ING", "ING Direct"] },
  { codigo: "1491", nombre: "Triodos Bank", dominio: "triodos.es" },
  { codigo: "1494", nombre: "MyInvestor", dominio: "myinvestor.es", alias: ["EBN Banco", "EBN"] },
  { codigo: "1497", nombre: "N26", dominio: "n26.com", alias: ["N26 Bank"] },
  { codigo: "1525", nombre: "Wizink Bank", dominio: "wizink.es", alias: ["Wizink"] },
  { codigo: "1538", nombre: "Pibank", dominio: "pibank.es" },
  { codigo: "1544", nombre: "Andbank España", dominio: "andbank.es" },
  { codigo: "1550", nombre: "Allfunds Bank", dominio: "allfunds.com" },
  { codigo: "1583", nombre: "Revolut", dominio: "revolut.com", alias: ["Revolut Bank UAB", "Revolut España"] },

  // CaixaBank y antiguas cajas
  { codigo: "2080", nombre: "Abanca", dominio: "abanca.com", alias: ["Novagalicia"] },
  { codigo: "2085", nombre: "Ibercaja Banco", dominio: "ibercaja.es", alias: ["Ibercaja"] },
  { codigo: "2095", nombre: "Kutxabank", dominio: "kutxabank.es" },
  { codigo: "2100", nombre: "CaixaBank", dominio: "caixabank.es", alias: ["La Caixa", "imaginBank", "Bankia"] },
  { codigo: "2103", nombre: "Unicaja Banco", dominio: "unicajabanco.es", alias: ["Unicaja", "Liberbank"] },

  // Cajas rurales y cooperativas
  { codigo: "3008", nombre: "Caja Rural de Navarra", dominio: "cajaruraldenavarra.com" },
  { codigo: "3025", nombre: "Caixa de Crèdit dels Enginyers", dominio: "caixaenginyers.com", alias: ["Caja de Ingenieros"] },
  { codigo: "3035", nombre: "Laboral Kutxa", dominio: "laboralkutxa.com", alias: ["Caja Laboral"] },
  { codigo: "3058", nombre: "Cajamar Caja Rural", dominio: "cajamar.es" },
  { codigo: "3081", nombre: "Eurocaja Rural", dominio: "eurocajarural.es" },
  { codigo: "3183", nombre: "Caja Rural de Asturias", dominio: "cajaruraldeasturias.com" },
  { codigo: "3187", nombre: "Caja Rural del Sur", dominio: "cajaruraldelsur.es" },
  { codigo: "3190", nombre: "Caja Rural de Extremadura", dominio: "cajaruralextremadura.es" },

  // Banco de España (referencia)
  { codigo: "9000", nombre: "Banco de España", dominio: "bde.es" },
];

// URL de logo basada en el favicon servido por Google. Funciona para cualquier
// dominio sin requerir mantener assets propios; si el banco rebrandea, el
// favicon se actualiza solo. `size` permite pedir resolución mayor (32-128 px).
export function urlLogoBanco(banco: BancoEspana | null | undefined, size = 64): string | null {
  if (!banco?.dominio) return null;
  return `https://www.google.com/s2/favicons?domain=${banco.dominio}&sz=${size}`;
}

export function buscarBancoPorCodigo(codigo: string | null | undefined): BancoEspana | null {
  if (!codigo) return null;
  return BANCOS_ESPANA.find((b) => b.codigo === codigo) ?? null;
}

export function buscarBancoPorIban(iban: string | null | undefined): BancoEspana | null {
  if (!iban) return null;
  const limpio = iban.replace(/\s+/g, "").toUpperCase();
  if (limpio.length < 8 || !limpio.startsWith("ES")) return null;
  const codigo = limpio.substring(4, 8);
  return buscarBancoPorCodigo(codigo);
}
