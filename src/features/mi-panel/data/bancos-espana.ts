// Catálogo de entidades bancarias operativas en España.
// El código (4 dígitos) corresponde a las posiciones 5-8 de un IBAN ES,
// inmediatamente después de "ES" + 2 dígitos de control. Permite resolver
// el banco automáticamente al introducir el IBAN.
export interface BancoEspana {
  codigo: string;
  nombre: string;
  alias?: string[];
}

export const BANCOS_ESPANA: BancoEspana[] = [
  { codigo: "0049", nombre: "Banco Santander", alias: ["Santander"] },
  { codigo: "0030", nombre: "Banco Santander (antiguo Banesto)", alias: ["Banesto"] },
  { codigo: "1490", nombre: "Openbank", alias: ["Open Bank"] },
  { codigo: "0182", nombre: "BBVA", alias: ["Banco Bilbao Vizcaya Argentaria"] },
  { codigo: "0061", nombre: "Banca March" },
  { codigo: "0073", nombre: "Open Bank Santander Consumer" },
  { codigo: "0075", nombre: "Banco Popular (integrado en Santander)", alias: ["Popular"] },
  { codigo: "0081", nombre: "Banco Sabadell", alias: ["Sabadell"] },
  { codigo: "0083", nombre: "Renta 4 Banco" },
  { codigo: "0128", nombre: "Bankinter" },
  { codigo: "0186", nombre: "Banco Mediolanum", alias: ["Mediolanum"] },
  { codigo: "0188", nombre: "Banco Alcalá" },
  { codigo: "0198", nombre: "Banco Cooperativo Español" },
  { codigo: "0216", nombre: "Targobank" },
  { codigo: "0234", nombre: "Banco Caminos" },
  { codigo: "0237", nombre: "CajaSur" },
  { codigo: "0238", nombre: "Banco Pastor (Santander)" },
  { codigo: "0239", nombre: "Evo Banco" },
  { codigo: "0487", nombre: "Banco Mare Nostrum" },
  { codigo: "0488", nombre: "Banco Finantia Sofinloc" },
  { codigo: "1000", nombre: "ICO (Instituto de Crédito Oficial)" },
  { codigo: "1465", nombre: "ING España", alias: ["ING", "ING Direct"] },
  { codigo: "1491", nombre: "Triodos Bank" },
  { codigo: "1494", nombre: "EBN Banco de Negocios" },
  { codigo: "1497", nombre: "N26 Bank", alias: ["N26"] },
  { codigo: "1525", nombre: "Wizink Bank", alias: ["Wizink"] },
  { codigo: "1538", nombre: "Pibank" },
  { codigo: "1544", nombre: "Andbank España" },
  { codigo: "1550", nombre: "Allfunds Bank" },
  { codigo: "1583", nombre: "Self Trade Bank" },
  { codigo: "2038", nombre: "CaixaBank (antiguo Bankia)", alias: ["Bankia"] },
  { codigo: "2048", nombre: "Liberbank (Unicaja)" },
  { codigo: "2080", nombre: "Abanca", alias: ["Novagalicia"] },
  { codigo: "2085", nombre: "Ibercaja Banco", alias: ["Ibercaja"] },
  { codigo: "2086", nombre: "Banco Grupo Cajatres (Ibercaja)" },
  { codigo: "2095", nombre: "Kutxabank" },
  { codigo: "2100", nombre: "CaixaBank", alias: ["La Caixa"] },
  { codigo: "2103", nombre: "Unicaja Banco", alias: ["Unicaja"] },
  { codigo: "2105", nombre: "Caja Castilla La Mancha (Liberbank)" },
  { codigo: "3008", nombre: "Caja Rural de Navarra" },
  { codigo: "3025", nombre: "Caixa de Crèdit dels Enginyers" },
  { codigo: "3035", nombre: "Caja Laboral / Laboral Kutxa" },
  { codigo: "3058", nombre: "Cajamar Caja Rural" },
  { codigo: "3081", nombre: "Eurocaja Rural" },
  { codigo: "3085", nombre: "Caja Rural Central" },
  { codigo: "3140", nombre: "Caja de Ingenieros" },
  { codigo: "3183", nombre: "Caja Rural de Asturias" },
  { codigo: "3187", nombre: "Caja Rural del Sur" },
  { codigo: "3190", nombre: "Caja Rural de Extremadura" },
  // Bancos digitales / extranjeros con frecuencia de uso real
  { codigo: "9000", nombre: "Banco de España" },
  { codigo: "0058", nombre: "BNP Paribas España" },
  { codigo: "0019", nombre: "Deutsche Bank España" },
  { codigo: "0149", nombre: "BNP Paribas Securities" },
  { codigo: "0152", nombre: "Barclays Bank España" },
];

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
