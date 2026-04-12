import * as XLSX from "xlsx";
const wb = XLSX.readFile("/Users/ivanballesteros/Desktop/SAAS/Logistica/FICHAS TECNICAS - PRODUCTO .xlsx");
console.log("Total hojas:", wb.SheetNames.length);
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const cat = String(rows[5]?.[2] ?? "").trim();
  console.log(`  [${cat.padEnd(30)}] ${name}`);
}
