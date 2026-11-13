-- Código da licença no sistema de origem (importação de planilha): permite reimportar sem duplicar.
alter table public.licencas add column if not exists codigo_externo text;
create unique index if not exists licencas_org_codigo_externo_key
  on public.licencas (org_id, codigo_externo) where codigo_externo is not null;
