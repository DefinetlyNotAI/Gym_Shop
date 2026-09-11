"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";

type AuthResponse={mfaRequired?:boolean;options?:Parameters<typeof startAuthentication>[0]["optionsJSON"];pendingToken?:string;developmentVerificationToken?:string};

export function AuthPanel({terms}:{terms:{id:string;version:string;title:string}|null}){
  const[mode,setMode]=useState<"login"|"register">("login");
  const[message,setMessage]=useState("");
  const search=useSearchParams();
  useEffect(()=>{const token=search.get("verifyEmail");if(!token)return;void fetch("/api/v1/auth/verify-email",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})}).then(response=>setMessage(response.ok?"Email verified. You can sign in. / تم تأكيد البريد":"The verification link is invalid or expired."));},[search]);
  async function submit(form:FormData){
    const body=mode==="login"?{email:form.get("email"),password:form.get("password")}:{email:form.get("email"),password:form.get("password"),displayName:form.get("name"),termsDocumentId:terms?.id,language:"en",marketing:form.get("marketing")==="on"};
    const response=await fetch(`/api/v1/auth/${mode}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const payload=await response.json();
    const data=payload.data as AuthResponse|undefined;
    if(response.ok&&mode==="login"&&data?.mfaRequired&&data.options&&data.pendingToken){
      setMessage("Touch your security key / استخدم مفتاح الأمان");
      const assertion=await startAuthentication({optionsJSON:data.options});
      const mfa=await fetch("/api/v1/auth/mfa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pendingToken:data.pendingToken,response:assertion})});
      if(mfa.ok)location.reload();else setMessage("MFA failed / فشل التحقق");
      return;
    }
    if(response.ok&&mode==="register"){
      setMessage(data?.developmentVerificationToken?`Registered. Local verification token: ${data.developmentVerificationToken}`:"Registered. Check your verification message.");
    }else setMessage(response.ok?"Signed in.":(payload.error?.message??"Unable to continue."));
    if(response.ok&&mode==="login")location.reload();
  }
  return <section className="panel">
    <div className="tabs"><button aria-pressed={mode==="login"} onClick={()=>setMode("login")}>Sign in / دخول</button><button aria-pressed={mode==="register"} onClick={()=>setMode("register")}>Create account / حساب جديد</button></div>
    <form action={submit}>
      {mode==="register"?<label>Name / الاسم<input name="name" required minLength={2}/></label>:null}
      <label>Email / البريد<input name="email" type="email" required/></label>
      <label>Password / كلمة المرور<input name="password" type="password" required minLength={12}/></label>
      {mode==="register"?<>{terms?<><article className="notice"><strong>{terms.title}</strong><span>Version {terms.version}</span></article><label className="check"><input name="accept" type="checkbox" required/>I accept this version / أوافق على هذه النسخة</label></>:<p className="alert">Registration is unavailable until reviewed terms are published.</p>}<label className="check"><input name="marketing" type="checkbox"/>Optional marketing / تسويق اختياري</label></>:null}
      <button className="primary" type="submit" disabled={mode==="register"&&!terms}>Continue / متابعة</button>
    </form>
    <p aria-live="polite">{message}</p>
  </section>;
}
