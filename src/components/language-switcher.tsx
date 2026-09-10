"use client";

import { useEffect, useState } from "react";

type Language = "en" | "ar";

function applyLanguage(language:Language){
  document.documentElement.lang=language;
  document.documentElement.dir=language==="ar"?"rtl":"ltr";
}

export function LanguageSwitcher(){
  const[language,setLanguage]=useState<Language>("en");
  useEffect(()=>applyLanguage(language),[language]);
  function choose(next:Language){setLanguage(next);}
  return <nav className="language-switcher" aria-label="Language / اللغة"><button aria-pressed={language==="en"} onClick={()=>choose("en")}>English</button><button aria-pressed={language==="ar"} onClick={()=>choose("ar")}>العربية</button></nav>;
}
