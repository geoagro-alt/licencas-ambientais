import { LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { getContexto } from "@/lib/contexto";
import { sair } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexto();

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Logo size={34} className="shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{ctx.orgNome}</div>
            <div className="text-xs text-slate-500">Licenças Ambientais</div>
          </div>
        </div>
        <div className="px-3 pb-3 md:flex-1">
          <Nav />
        </div>
        <div className="hidden border-t border-slate-100 px-5 py-4 md:block">
          <div className="truncate text-xs text-slate-500">{ctx.email}</div>
          <form action={sair}>
            <button className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 md:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
