// SOLO LECTURA: ¿qué más expone Ágora? Composición de productos, Stocks, Warehouses, Families.
// Uso: node scripts/agora/probe-stock-recipe.mjs <agora_token>
const TOKEN = process.argv[2];
if (!TOKEN) { console.error('uso: node scripts/agora/probe-stock-recipe.mjs <token>'); process.exit(2); }
const BASE = process.env.AGORA_POS_URL || 'http://habanabacanaliictpv.ddns.me:8984';

async function get(path) {
  const r = await fetch(BASE + path, { headers: { 'Api-Token': TOKEN, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

// 1) ¿Los productos traen su composición/receta?
const prods = (await get('/api/export-master/?filter=Products')).Products || [];
const keys = new Set();
for (const p of prods.slice(0, 500)) Object.keys(p).forEach((k) => keys.add(k));
console.log('== CLAVES de Product ==');
console.log('  ' + [...keys].sort().join(', '));
const compoKeys = [...keys].filter((k) => /(compo|recipe|ingred|escand|component|recet|bom|elabor)/i.test(k));
console.log('Claves que sugieren receta/composición:', compoKeys.length ? compoKeys : '(NINGUNA en Products)');

const target = prods.find((p) => /burger bacanal/i.test(p.Name)) || prods.find((p) => /cachopo/i.test(p.Name)) || prods.find((p) => /mojito/i.test(p.Name));
if (target) {
  console.log(`\n== Producto elaborado de ejemplo: "${target.Name}" (Id ${target.Id}) ==`);
  console.log(JSON.stringify(target, null, 2).slice(0, 2600));
}

// 2) ¿Ágora expone STOCK actual?
console.log('\n== STOCKS (filter=Stocks) ==');
try {
  const resp = await get('/api/export-master/?filter=Stocks');
  const stocks = resp.Stocks || resp.stocks || (Array.isArray(resp) ? resp : []);
  console.log('  filas:', Array.isArray(stocks) ? stocks.length : '(no es array) keys=' + Object.keys(resp).join(','));
  console.log('  muestra:', JSON.stringify((stocks || []).slice(0, 4), null, 2));
} catch (e) { console.log('  error:', e.message); }

// 3) Almacenes
console.log('\n== WAREHOUSES ==');
try {
  const wh = (await get('/api/export-master/?filter=Warehouses')).Warehouses || [];
  console.log('  total:', wh.length);
  for (const w of wh.slice(0, 20)) console.log('   ', w.Id, '—', w.Name);
} catch (e) { console.log('  error:', e.message); }

// 4) Familias (para resolver FamilyId -> nombre de categoría)
console.log('\n== FAMILIES ==');
try {
  const fam = (await get('/api/export-master/?filter=Families')).Families || [];
  console.log('  total:', fam.length, '| muestra:', fam.slice(0, 6).map((f) => `${f.Id}:${f.Name}`).join(', '));
} catch (e) { console.log('  error:', e.message); }

console.log('\nOK probe.');
