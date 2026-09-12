import { chromium } from "playwright";
const S=process.env.S, file=process.env.F, out=process.env.O;
const W=+(process.env.W||1080), H=+(process.env.H||1080);
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2});
const p=await ctx.newPage();
await p.goto(`file://${S}/${file}`,{waitUntil:"load",timeout:90000}); await p.waitForTimeout(2500);
await p.screenshot({path:`${S}/${out}`}); console.log("OK",out); await b.close();
