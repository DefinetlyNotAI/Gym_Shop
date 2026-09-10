"use client";

import { useState } from "react";

export function MarketingConsent({ signedIn }: { signedIn: boolean }) {
  const [message, setMessage] = useState("");
  async function optIn() { const response = await fetch("/api/v1/account/marketing-consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ granted: true }) }); setMessage(response.ok ? "Optional email updates enabled. You can withdraw at any time." : "Sign in to choose optional email updates."); }
  return <section className="panel"><h2>Training gear updates</h2><p>Optional email announcements are separate from required order and security messages.</p>{signedIn ? <button className="secondary" onClick={optIn}>Yes, email me optional updates</button> : <a className="secondary" href="/account">Sign in to opt in</a>}<small aria-live="polite">{message}</small></section>;
}
