import fs from 'node:fs';
const EMPRESA='fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';
const nt=t=>{const s=(t||'').replace(/[^0-9]/g,''); if(!s)return null; if(/^0034[6-9][0-9]{8}$/.test(s))return s.slice(4); if(/^34[6-9][0-9]{8}$/.test(s))return s.slice(2); return s;};
const src=fs.readFileSync('src/features/sala/data/prefijos-telefono.ts','utf8');
const PREF=[...src.matchAll(/prefijo:\s*"(\+\d+)"/g)].map(m=>m[1].slice(1)).sort((a,b)=>b.length-a.length);
const parse=(t)=>{const R=[];let f='',r=[],q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','){r.push(f);f=''}else if(c==='\n'){r.push(f);R.push(r);r=[];f=''}else if(c!=='\r')f+=c}if(f||r.length){r.push(f);R.push(r)}return R};
const rows=parse(fs.readFileSync('tmp/ghl/Bacanal clientes.csv','utf8'));const H=rows[0],I=n=>H.indexOf(n);
const recs=rows.slice(1).filter(r=>r.length>3).map(r=>({nom:(r[I('First Name')]||'').trim(),ape:(r[I('Last Name')]||'').trim(),tel:(r[I('Phone')]||'').trim(),email:(r[I('Email')]||'').trim().toLowerCase(),creado:r[I('Created')]}));
// El corte contra lo que ya habia (3.748 filas) se resolvio al generar: aqui van
// las 6.294 que no estaban. El WHERE NOT EXISTS de abajo lo vuelve a comprobar.
const YA=new Set(JSON.parse(fs.readFileSync('/tmp/ya.json','utf8')));
const nuevos=recs.filter(r=>{const t=nt(r.tel),e=r.email; if(!t&&!e)return false; return !((t&&YA.has('T'+t))||(e&&YA.has('E'+e)));});
const sinEmoji=s=>s.replace(/[\u{1F000}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2190}-\u{2BFF}\u{FE00}-\u{FE0F}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{200D}\u{20E3}\u{1D400}-\u{1D7FF}\u{1F0A0}-\u{1F0FF}]/gu,'').replace(/\s+/g,' ').trim();
function validarNombre(v){const n=(v||'').trim(); if(n.length<2)return false; const l=n.replace(/[^\p{L}]/gu,'').toLowerCase(); if(l.length<2)return false; if(/^(.)\1+$/.test(l))return false; if(l.length>=4&&!/[aeiouáéíóúüy]/i.test(l))return false; if(/asdf|qwer|zxcv|hjkl|wasd/.test(l))return false; if(/(.)\1{2,}/.test(l))return false; return true;}
const limpiar=v=>{const s=sinEmoji(v||''); return validarNombre(s)?s:null;};
function formatTel(e){const d=(e||'').replace(/\D/g,''); const p=PREF.find(p=>d.startsWith(p)&&d.length>p.length); return p?`+${p} ${d.slice(p.length)}`:`+${d}`;}
const q=s=>s===null||s===undefined?'NULL':"'"+String(s).replace(/'/g,"''")+"'";
const filas=nuevos.map((r,i)=>{const c=i===0?'::text':''; return `  (${q(limpiar(r.nom))}${c}, ${q(limpiar(r.ape))}${c}, ${q(r.tel?formatTel(r.tel):null)}${c}, ${q(r.email||null)}${c}, ${q(r.creado)}${i===0?'::timestamptz':''})`;});
console.error('filas:',filas.length);
const cab=`-- Los 6.294 comensales de BACANAL que solo existían en Go High Level.
--
-- GHL era el CRM de WhatsApp del restaurante: cuando alguien escribía, su
-- contacto quedaba allí. Al cerrarlo, esas personas se perderían — es gente que
-- comió en BACANAL y que no está en ningún otro sitio.
--
-- QUÉ ENTRA Y QUÉ NO. La exportación traía 10.637 contactos, pero:
--   · 3.748 ya estaban en la base (mismo teléfono o mismo correo, casi todos de
--     CoverManager): no se duplican, se quedan como están.
--   · 595 eran filas rotas de una importación vieja de GHL, con el registro
--     entero metido dentro del campo del nombre ("6vu2eau;jessica;martinez;34;
--     609957496;..."). Se rescataron los 591 que llevaban teléfono o correo
--     dentro y TODOS estaban ya en la base. No se pierde a nadie.
--   · quedan estos 6.294, que no están por ningún lado.
--
-- LOS DATOS QUE TRAEN. Los 6.294 tienen teléfono con prefijo de país y pasan el
-- validador de \`shared/lib/validar-contacto.ts\` — el 100 %, ni un número de
-- relleno. Correo solo 8: GHL era un canal de WhatsApp, no de email. Traían 15
-- prefijos de países que no estaban en \`sala/data/prefijos-telefono.ts\`
-- (Pakistán, Vietnam, Guinea Ecuatorial…); se añadieron allí, porque si el
-- prefijo no está en la lista el staff no puede editar esa ficha sin romper el
-- número.
--
-- EL NOMBRE. GHL guardaba el nombre del perfil de WhatsApp, así que 449 vienen
-- como "❤️", "S.", "😎🙃🤓" o un punto. Esos entran SIN nombre (NULL) en vez de
-- con basura: en pantalla se leen "Sin nombre" y se les localiza por su teléfono,
-- que es bueno. A los demás se les quitan los emojis y queda el nombre real
-- ("Javi Fernandez🤙🏻" → "Javi Fernandez").
--
-- EL ORIGEN de los 6.294 es WHATSAPP: por ahí entraron, y por eso GHL tenía su
-- contacto. Es el primer uso real de \`clientes_sala.origen\`.
--
-- LO QUE NO SE RELLENA, a propósito:
--   · visitas, última visita y valoraciones: esta exportación no las trae. Van en
--     las Oportunidades de GHL, que es otra descarga. Un 0 aquí parecería un dato
--     real ("no ha venido nunca") y sería falso.
--   · consentimiento de marketing: GHL no dice que nadie lo diera, así que queda
--     en no. No se presume un consentimiento que no consta (RGPD).
--
-- \`created_at\` es la fecha de alta en GHL, no la de hoy: así no se pierde la
-- antigüedad real de cada cliente (4.707 son de 2025 y 1.587 de 2026).
--
-- \`telefono_normalizado\` y \`email_normalizado\` NO se escriben: son columnas
-- generadas (\`bh_normalize_telefono\` / \`bh_normalize_email\`) y las calcula la
-- propia base. De ahí que el filtro de duplicados llame a esas mismas funciones,
-- para comparar exactamente lo que se va a guardar.
--
-- Idempotente: cada fila se inserta solo si su teléfono y su correo siguen sin
-- estar en la empresa. Ejecutarla dos veces no duplica a nadie.

WITH ghl(nombre, apellidos, telefono, email, creado) AS (VALUES
${filas.join(',\n')}
)
INSERT INTO public.clientes_sala (
  empresa_id, nombre, apellidos, telefono, email, origen, created_at
)
SELECT
  '${EMPRESA}'::uuid,
  g.nombre,
  g.apellidos,
  g.telefono,
  g.email,
  'WHATSAPP',
  g.creado
FROM ghl g
WHERE NOT EXISTS (
    SELECT 1 FROM public.clientes_sala c
    WHERE c.empresa_id = '${EMPRESA}'::uuid
      AND c.telefono_normalizado = public.bh_normalize_telefono(g.telefono)
  )
  AND (
    g.email IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.clientes_sala c
      WHERE c.empresa_id = '${EMPRESA}'::uuid
        AND c.email_normalizado = public.bh_normalize_email(g.email)
    )
  );
`;
fs.writeFileSync('supabase/migrations/20260907210200_clientes_bacanal_desde_ghl.sql',cab);
console.error('KB:',Math.round(cab.length/1024));
