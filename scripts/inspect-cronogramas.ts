import * as XLSX from "xlsx";
import * as fs from "fs";
const dir = "/Users/ivanballesteros/Desktop/SAAS/Cronogramas";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".xlsx"));
for (const f of files) {
  console.log(`\n━━━━━━━━ ${f} ━━━━━━━━`);
  const wb = XLSX.readFile(dir + "/" + f);
  for (const name of wb.SheetNames) {
    console.log(`  HOJA: ${name}`);
    const sheet = wb.Sheets[name];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      const r = (rows[i] ?? []).slice(0, 8).map((c) => String(c).slice(0, 30));
      if (r.every((c) => !c)) continue;
      console.log(`    ${String(i).padStart(2)}: ${r.join(" | ")}`);
    }
  }
}
