"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui";

/** Botão de submit que se desabilita enquanto o formulário está sendo enviado (evita envio duplo). */
export function BotaoEnviar({ children, pendente = "Aguarde…", ...props }: ComponentProps<typeof Button> & { pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? pendente : children}
    </Button>
  );
}
