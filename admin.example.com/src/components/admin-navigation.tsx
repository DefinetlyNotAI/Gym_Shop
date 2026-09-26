"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { routesForRole } from "@/lib/operations-routes";

const groupArabic: Record<string, string> = {
  Workspace: "مساحة العمل",
  Commerce: "التجارة",
  Growth: "النمو",
  "Trust & finance": "الثقة والمالية",
  Administration: "الإدارة",
};

export function AdminNavigation({ role }: { role: string }) {
  const pathname = usePathname();
  const { language, text } = useLanguage();
  const [open, setOpen] = useState(false);
  const routes = routesForRole(role);
  if (!routes.length) return null;
  const groups = [...new Set(routes.map((route) => route.group))];

  return (
    <aside className={`admin-sidebar${open ? " is-open" : ""}`}>
      <button
        className="sidebar-toggle secondary"
        aria-expanded={open}
        aria-controls="operations-navigation"
        onClick={() => setOpen(!open)}
      >
        {text("Workspace menu", "قائمة مساحة العمل")}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav
        id="operations-navigation"
        aria-label={text("Operations navigation", "تنقل العمليات")}
      >
        <div className="sidebar-context">
          <span className="eyebrow">{text("WORKSPACE", "مساحة العمل")}</span>
          <strong>{role.replaceAll("_", " ")}</strong>
        </div>
        {groups.map((group) => (
          <div className="nav-group" key={group}>
            <p>{language === "ar" ? groupArabic[group] : group}</p>
            {routes
              .filter((route) => route.group === group)
              .map((route) => (
                <Link
                  key={route.id}
                  href={route.href}
                  prefetch={false}
                  aria-current={pathname === route.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span>{language === "ar" ? route.titleAr : route.title}</span>
                  <span className="nav-indicator" aria-hidden="true">
                    {pathname === route.href ? "•" : ""}
                  </span>
                </Link>
              ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
