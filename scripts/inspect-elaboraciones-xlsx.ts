import * as XLSX from "xlsx";
const wb = XLSX.readFile("/Users/ivanballesteros/Desktop/SAAS/Logistica/FICHAS TECNICAS - ELABORACIONES (1).xlsx");
console.log("Total hojas:", wb.SheetNames.length);
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  console.log(`\n━━━ ${name} ━━━`);
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = (rows[i] ?? []).slice(0, 11).map((c) => String(c).slice(0, 20));
    console.log(`  ${String(i).padStart(2)}: ${r.join(" | ")}`);
  }
}
