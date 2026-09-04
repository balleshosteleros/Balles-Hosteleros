import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
 .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
 .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:bac}=await sb.from('empresas').select('id').eq('carta_slug','bacanal').single();
const {data:hab}=await sb.from('empresas').select('id').eq('carta_slug','habana').single();
// Los mismos platos que ya tienen foto verificada en BACANAL
const COMUNES=['Burger Balles Hosteleros','Torreznos con guacamole y pico de gallo'];
for (const nom of COMUNES){
  const {data:src}=await sb.from('carta_items').select('foto_url,foto_storage_path')
    .eq('empresa_id',bac.id).eq('nombre',nom).not('foto_url','is',null).limit(1).maybeSingle();
  if(!src){ console.log('sin origen:',nom); continue; }
  const {data:up}=await sb.from('carta_items')
    .update({foto_url:src.foto_url, foto_storage_path:src.foto_storage_path})
    .eq('empresa_id',hab.id).eq('nombre',nom).select('id');
  console.log('ok',nom,'('+(up?.length||0)+')');
}
