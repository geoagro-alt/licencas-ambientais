/** Exibido na hora em que se clica no menu, enquanto a página carrega os dados. */
export default function Carregando() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="mb-2 h-7 w-48 rounded-lg bg-slate-200" />
      <div className="mb-6 h-4 w-72 rounded bg-slate-100" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
