const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");

for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) {
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "").trim();
    console.log(`${key}: length=${val.length}, startsWith=${val.substring(0, 10)}`);
  }
}
