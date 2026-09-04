import { chromium } from 'playwright';
import fs from 'node:fs';
const dir='/private/tmp/claude-501/-Users-ivanballesteros-Balles-Hosteleros/657104bc-8651-40cf-846e-fdb23bf7cb02/scratchpad/sh/';
fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1280,height:1300}});
await p.goto('https://smartmenu.agorapos.com/?id=g013zjfc',{waitUntil:'domcontentloaded',timeout:90000});
await p.waitForTimeout(3500);
const idx=[];
for (const c of ['SHISHAS','VAPERS CON NICOTINA','VAPERS SIN NICOTINA']){
  await p.locator(`text=${c}`).first().click({timeout:8000});
  await p.waitForTimeout(2800);
  const catUrl=p.url();
  const total=await p.evaluate(()=>document.querySelectorAll('.ml-2.font-semibold.text-lg').length);
  for(let i=0;i<total;i++){
    try{
      const nom=await p.evaluate((k)=>{
        const pr=document.querySelectorAll('.ml-2.font-semibold.text-lg')[k];
        let el=pr?.parentElement;
        for(let j=0;j<6&&el;j++){ if(el.querySelector('img')) break; el=el.parentElement; }
        if(!el) return null;
        el.setAttribute('data-t','1');
        return ((el.innerText||'').split('\n').map(s=>s.trim()).filter(Boolean))[0]||null;
      }, i);
      if(!nom){ continue; }
      await p.click('[data-t]',{timeout:4000});
      await p.waitForFunction(()=>[...document.querySelectorAll('img')].some(i=>{
        const s=i.getAttribute('src')||''; return s.startsWith('data:image')&&(i.naturalWidth||0)>600&&!(i.naturalWidth===1682&&i.naturalHeight===935);
      }),{timeout:9000}).catch(()=>{});
      const d=await p.evaluate(()=>{
        let best=null;
        document.querySelectorAll('img').forEach(i=>{
          const s=i.getAttribute('src')||'';
          if(!s.startsWith('data:image')||(i.naturalWidth||0)<600) return;
          if(i.naturalWidth===1682&&i.naturalHeight===935) return;
          if(!best||i.naturalWidth>best.w) best={w:i.naturalWidth,h:i.naturalHeight,src:s};
        });
        return best;
      });
      if(d){
        const m=d.src.match(/^data:image\/(\w+);base64,(.+)$/);
        if(m){
          const fn=nom.replace(/[^A-Za-z0-9]+/g,'_').slice(0,50)+'.'+(m[1]==='jpeg'?'jpg':m[1]);
          fs.writeFileSync(dir+fn, Buffer.from(m[2],'base64'));
          idx.push({file:fn, cat:c, nombre:nom, w:d.w});
          console.log(d.w+'px', nom.slice(0,42));
        }
      }
      await p.goto(catUrl,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1400);
    }catch(e){}
  }
}
fs.writeFileSync(dir+'index.json', JSON.stringify(idx,null,1));
console.log('TOTAL:', idx.length);
await b.close();
