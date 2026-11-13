"use client";

import type { ComponentProps } from "react";

/** Botão de submit que pede confirmação antes de enviar o formulário (para exclusões). */
export function BotaoConfirmar({ mensagem, ...props }: ComponentProps<"button"> & { mensagem: string }) {
  return (
    <button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    />
  );
}
