import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CORES_NIVEL, type Nivel } from "@/lib/prazos";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Card({ children, className, titulo, acoes }: { children: ReactNode; className?: string; titulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {(titulo || acoes) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {acoes}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Badge({ nivel, children }: { nivel: Nivel; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", CORES_NIVEL[nivel])}>
      {children}
    </span>
  );
}

const BTN = {
  primario: "bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm",
  secundario: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  perigo: "bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50",
  fantasma: "text-slate-600 hover:bg-slate-100",
};
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function Button({ variante = "primario", className, ...props }: ComponentProps<"button"> & { variante?: keyof typeof BTN }) {
  return <button className={cx(BTN_BASE, BTN[variante], className)} {...props} />;
}

export function LinkButton({ variante = "primario", className, ...props }: ComponentProps<typeof Link> & { variante?: keyof typeof BTN }) {
  return <Link className={cx(BTN_BASE, BTN[variante], className)} {...props} />;
}

const INPUT =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-emerald-600";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(INPUT, className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(INPUT, "pr-8", className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(INPUT, className)} rows={3} {...props} />;
}

export function Field({ label, children, dica, className }: { label: string; children: ReactNode; dica?: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Tabela({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-3 py-2.5 align-top text-slate-700", className)}>{children}</td>;
}
