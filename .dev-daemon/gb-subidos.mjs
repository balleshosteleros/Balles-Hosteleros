/** GB subidos por empresa. Lo usa el desatascador para saber si hay avance. */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env={};for(const l of fs.readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].replace(/^["']|["']$/g,"");}
const a=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
for(const[n,id]of[["BACANAL","fe2ea3c4-aa28-41ce-a135-bf196ab5dc47"],["BALLES","eb99bddd-9f49-4348-96ee-37f930c0d5d0"]]){
  let b=0,c=0;
  for(let d=0;;d+=1000){const{data:t}=await a.from("documentos").select("tamano_bytes").eq("empresa_id",id).not("drive_file_id","is",null).range(d,d+999);const f=t??[];for(const r of f){b+=Number(r.tamano_bytes??0);c++;}if(f.length<1000)break;}
  console.log(`${n}: ${c} archivos · ${(b/1024**3).toFixed(2)} GB`);
}
