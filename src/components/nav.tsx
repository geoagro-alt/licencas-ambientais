"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarDays, ClipboardCheck, FileBadge, LayoutDashboard, Settings } from "lucide-react";
import { cx } from "./ui";

const ITENS = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/licencas", label: "Licenças", icon: FileBadge },
  { href: "/condicionantes", label: "Condicionantes", icon: ClipboardCheck },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITENS.map(({ href, label, icon: Icon }) => {
        const ativo = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              ativo ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
