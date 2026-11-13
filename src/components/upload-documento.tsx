"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registrarDocumento } from "@/app/(app)/licencas/actions";

/** Sobe o arquivo direto do navegador para o Supabase Storage (sem limite de 4,5 MB da Vercel) e registra no banco. */
export function UploadDocumento({ orgId, licencaId, condicionanteId }: { orgId: string; licencaId: string; condicionanteId?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [estado, setEstado] = useState<string | null>(null);

  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    try {
      for (const [i, file] of [...files].entries()) {
        setEstado(`Enviando ${i + 1}/${files.length}…`);
        const seguro = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
        const path = `${orgId}/${licencaId}/${crypto.randomUUID()}-${seguro}`;
        const { error } = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        await registrarDocumento({
          licenca_id: licencaId,
          condicionante_id: condicionanteId ?? null,
          nome: file.name,
          storage_path: path,
          tamanho_bytes: file.size,
          mime_type: file.type,
        });
      }
      setEstado(null);
      router.refresh();
    } catch (e) {
      setEstado(`Erro: ${(e as Error).message}`);
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <input ref={input} type="file" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50"
      >
        <Upload className="h-4 w-4" /> Anexar arquivo
      </button>
      {estado && <p className="mt-2 text-xs text-slate-500">{estado}</p>}
    </div>
  );
}
