import { Logo } from "@/components/logo";
import { FormLogin } from "./form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const erro = sp.erro === "sem-organizacao" ? "Seu usuário não está vinculado a nenhuma organização." : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-sky-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo size={56} className="mx-auto mb-3 drop-shadow-sm" />
          <h1 className="text-2xl font-semibold tracking-tight">Licenças Ambientais</h1>
          <p className="mt-1 text-sm text-slate-500">Prazos, condicionantes e renovações em um só lugar</p>
        </div>
        <FormLogin next={next} erroInicial={erro} />
      </div>
    </main>
  );
}
