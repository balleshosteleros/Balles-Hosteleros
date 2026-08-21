import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const EMP='00000000-0000-0000-0000-000000000001';
const { data: local } = await sb.from('locales').select('id').eq('empresa_id',EMP).order('created_at').limit(1).single();
const { data: mesas } = await sb.from('mesas').select('id,codigo,x,y').eq('local_id',local!.id).eq('activa',true).like('codigo','A%');
const pos=new Map((mesas??[]).map(m=>[m.codigo as string,{x:Number(m.x),y:Number(m.y)}]));
console.log('Posiciones de las Altas (izq -> der):');
for(const [c,p] of [...pos.entries()].sort((a,b)=>a[1].x-b[1].x)) console.log(`  ${c}  x=${Math.round(p.x)}`);

const { data: combis } = await sb.from('mesa_combinaciones').select('id,codigo').eq('local_id',local!.id).like('codigo','A%');
// Contiguas = pegadas de verdad (menos de 115px entre centros).
const pegadas=(a:string,b:string)=>{const p=pos.get(a)!,q=pos.get(b)!;
  return Math.abs(p.x-q.x)<=115 && Math.abs(p.y-q.y)<=40;};
const conexo=(cs:string[])=>{const v=new Set([cs[0]]);const q=[cs[0]];
  while(q.length){const c=q.pop()!;for(const o of cs)if(!v.has(o)&&pegadas(c,o)){v.add(o);q.push(o);}}
  return v.size===cs.length;};

let borradas=0;
for(const c of combis??[]){
  const cs=(c.codigo as string).split('+');
  if(conexo(cs)) continue;
  await sb.from('mesa_combinaciones').delete().eq('id',c.id as string);
  console.log(`  BORRADA ${c.codigo}  (no estan pegadas)`);
  borradas++;
}
console.log(`\nBorradas: ${borradas}`);
const { data: fin } = await sb.from('mesa_combinaciones').select('codigo,capacidad_min,capacidad_max').eq('local_id',local!.id).like('codigo','A%').order('codigo');
console.log('\nAltas quedan:');
for(const f of fin??[]) console.log(`  ${(f.codigo as string).padEnd(12)} ${f.capacidad_min}-${f.capacidad_max}`);
