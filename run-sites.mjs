import { spawn } from "node:child_process";

const mode=process.argv[2]??"sim";
if(!["sim","dev"].includes(mode))throw new Error("Usage: node run-sites.mjs [sim|dev]");
const simulation=mode==="sim";
const inherited={...process.env};
if(simulation){
  for(const key of[
    "DATABASE_URL","DATABASE_OWNER_URL","APS_ACCESS_CODE","APS_MERCHANT_IDENTIFIER","APS_SHA_REQUEST_PHRASE","APS_SHA_RESPONSE_PHRASE",
    "NOTIFICATION_PROVIDER_API_URL","NOTIFICATION_PROVIDER_API_TOKEN","NOTIFICATION_FROM_EMAIL","SECURITY_ALERT_EMAIL",
    "CAPTCHA_VERIFY_URL","CAPTCHA_API_TOKEN","R2_ENDPOINT","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET","R2_PUBLIC_BASE_URL","MEDIA_SCAN_SECRET",
  ])delete inherited[key];
}
const shared=simulation?{
  APP_ENV:"local",SIM_MODE:"1",STOREFRONT_ORIGIN:"http://localhost:3030",API_ORIGIN:"http://localhost:5000",ADMIN_ORIGIN:"http://localhost:4000",
  WEBAUTHN_RP_ID:"localhost",WEBAUTHN_RP_NAME:"Gym Shop Simulation",CTO_OWNER_EMAIL:"cto@sim.gym-shop.local",APS_ENVIRONMENT:"sandbox",
  OUTBOUND_SECRET_KEY:"BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc",
}:{STOREFRONT_ORIGIN:process.env.STOREFRONT_ORIGIN??"http://localhost:3030",API_ORIGIN:process.env.API_ORIGIN??"http://localhost:5000",ADMIN_ORIGIN:process.env.ADMIN_ORIGIN??"http://localhost:4000"};
const sites=["api.example.com","example.com","admin.example.com"];
const windows=process.platform==="win32";
const npmCommand=windows?"cmd.exe":"npm";
const npmArgs=windows?["/d","/s","/c","npm run dev"]:["run","dev"];
const children=sites.map(site=>spawn(npmCommand,npmArgs,{cwd:new URL(`./${site}/`,import.meta.url),env:{...inherited,...shared},stdio:"inherit",windowsHide:true}));
let stopping=false;function stop(signal="SIGTERM"){if(stopping)return;stopping=true;for(const child of children)if(!child.killed)child.kill(signal);}
for(const signal of["SIGINT","SIGTERM"])process.on(signal,()=>stop(signal));
for(const child of children)child.on("exit",code=>{if(!stopping&&code!==0){stop();process.exitCode=code??1;}});
await Promise.all(children.map(child=>new Promise(resolve=>child.once("exit",resolve))));
