#!/bin/zsh
# Mantiene la generación de miniaturas hasta que no quede ninguna foto sin ella.
cd "/Users/ivanballesteros/Balles Hosteleros"
LOG=.dev-daemon/miniaturas.log
while true; do
  if ! pgrep -f miniaturas-todo >/dev/null; then
    FALTAN=$(node -e "
const fs=require('fs');const {createClient}=require('@supabase/supabase-js');
const env={};for(const l of fs.readFileSync('.env.local','utf8').split('\n')){const m=l.match(/^([A-Z0-9_]+)=(.*)\$/);if(m)env[m[1]]=m[2].replace(/^[\"']|[\"']\$/g,'');}
const a=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{let n=0;
for(const e of ['00000000-0000-0000-0000-000000000001','fe2ea3c4-aa28-41ce-a135-bf196ab5dc47']){
 const {count}=await a.from('documentos').select('id',{count:'exact',head:true}).eq('empresa_id',e).or('tipo_mime.like.image/%,tipo_mime.like.video/%,tipo_mime.eq.application/pdf').is('miniatura_key',null);
 n+=count??0;}
console.log(n);})();" 2>/dev/null | tail -1)
    if [ "${FALTAN:-0}" -le 20 ]; then
      echo "$(date '+%H:%M:%S') miniaturas al dia (faltan ${FALTAN:-0})" >> $LOG
      break
    fi
    echo "$(date '+%H:%M:%S') faltan $FALTAN miniaturas, relanzando" >> $LOG
    (PARALELO=10 nohup npx tsx .dev-daemon/miniaturas-todo.mts 00000000-0000-0000-0000-000000000001 fe2ea3c4-aa28-41ce-a135-bf196ab5dc47 >> .dev-daemon/miniaturas-consola.log 2>&1 < /dev/null &)
    sleep 30
  fi
  sleep 60
done
