// Genera un HTML con el stock reflejado de Bacanal (solo lectura) para verlo sin login.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const EMP = 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const { data: stock } = await sb.from('stock').select('producto_id, producto_nombre, cantidad_actual, unidad').eq('empresa_id', EMP);
const { data: prods } = await sb.from('productos').select('id, categoria, tipo, agora_id').eq('empresa_id', EMP);
const pById = new Map((prods || []).map((p) => [p.id, p]));
const rows = (stock || []).map((s) => ({ nombre: s.producto_nombre, cant: Number(s.cantidad_actual), cat: pById.get(s.producto_id)?.categoria || '-', agora: pById.get(s.producto_id)?.agora_id || '' }));
rows.sort((a, b) => (a.cat || '').localeCompare(b.cat || '') || b.cant - a.cant);
const neg = rows.filter((r) => r.cant < 0).length;

const html = `<!doctype html><html lang=es><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Stock Bacanal · espejo Ágora</title>
<style>body{font-family:system-ui,Segoe UI,Arial;margin:24px;background:#0b0f17;color:#e6edf3}h1{font-size:20px;margin:0 0 4px}.sub{color:#8b949e;margin-bottom:16px;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:6px 12px;border-bottom:1px solid #21262d;text-align:left}th{position:sticky;top:0;background:#161b22;cursor:default}
td.num{text-align:right;font-variant-numeric:tabular-nums}tr:hover{background:#161b22}.neg{color:#f85149;font-weight:600}.cat{color:#58a6ff}.aid{color:#6e7681;font-size:12px}
input{padding:8px 10px;width:300px;margin-bottom:14px;background:#0d1117;border:1px solid #30363d;color:#e6edf3;border-radius:6px;font-size:14px}.pill{display:inline-block;background:#161b22;border:1px solid #30363d;border-radius:999px;padding:2px 10px;margin-right:6px}</style></head><body>
<h1>Stock de Bacanal — espejo de Ágora</h1>
<div class=sub><span class=pill>${rows.length} productos con stock</span><span class=pill>${neg} en negativo (Ágora sin regularizar)</span><span class=pill>almacén Ágora 4 → empresa BACANAL</span></div>
<input id=q placeholder="Filtrar por producto o categoría…" autofocus>
<table id=t><thead><tr><th>Categoría</th><th>Producto</th><th>Cantidad</th><th>agora_id</th></tr></thead><tbody>
${rows.map((r) => `<tr><td class=cat>${esc(r.cat)}</td><td>${esc(r.nombre)}</td><td class="num ${r.cant < 0 ? 'neg' : ''}">${r.cant}</td><td class=aid>${esc(r.agora)}</td></tr>`).join('')}
</tbody></table>
<script>const q=document.getElementById('q'),trs=[...document.querySelectorAll('#t tbody tr')];q.addEventListener('input',()=>{const v=q.value.toLowerCase();trs.forEach(t=>t.style.display=t.innerText.toLowerCase().includes(v)?'':'none')});</script>
</body></html>`;

const out = '/mnt/c/Users/Fernando/Downloads/bacanal-stock-agora.html';
writeFileSync(out, html, 'utf-8');
console.log(`HTML escrito: ${out} · ${rows.length} filas · ${neg} negativos`);
