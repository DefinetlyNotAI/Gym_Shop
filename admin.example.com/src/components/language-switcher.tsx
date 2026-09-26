"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher(){
  const{language,setLanguage,text}=useLanguage();
  return <nav className="language-switcher" aria-label={text("Language","اللغة")}><button onClick={()=>setLanguage(language==="ar"?"en":"ar")}>{language==="ar"?"English":"العربية"}</button></nav>;
}
