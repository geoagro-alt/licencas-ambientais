-- =============================================================================
-- Licenças Ambientais — esquema inicial
-- Rode este arquivo no SQL Editor do Supabase (ou via `supabase db push`).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Organizações e membros (multiusuário / multiempresa)
-- -----------------------------------------------------------------------------
create table public.organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  ics_token   text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_at  timestamptz not null default now()
);

create type public.papel_membro as enum ('admin', 'editor', 'leitor');

create table public.membros (
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  papel       public.papel_membro not null default 'editor',
  nome        text,
  email       text not null,
  receber_alertas boolean not null default true,
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.membros (user_id);

create table public.convites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  email       text not null,
  papel       public.papel_membro not null default 'editor',
  created_at  timestamptz not null default now(),
  unique (org_id, email)
);

-- -----------------------------------------------------------------------------
-- Cadastros: empresas (clientes) e empreendimentos (unidades / fazendas / obras)
-- -----------------------------------------------------------------------------
create table public.empresas (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacoes(id) on delete cascade,
  razao_social  text not null,
  cnpj_cpf      text,
  contato_nome  text,
  contato_email text,
  telefone      text,
  observacoes   text,
  created_at    timestamptz not null default now()
);
create index on public.empresas (org_id);

create table public.empreendimentos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  nome        text not null,
  atividade   text,
  municipio   text,
  uf          char(2),
  car         text,          -- nº do CAR, quando rural
  latitude    double precision,
  longitude   double precision,
  observacoes text,
  created_at  timestamptz not null default now()
);
create index on public.empreendimentos (org_id);
create index on public.empreendimentos (empresa_id);

-- -----------------------------------------------------------------------------
-- Licenças / autorizações / outorgas / registros
-- -----------------------------------------------------------------------------
create type public.situacao_licenca as enum ('ativa', 'em_renovacao', 'encerrada');

create table public.licencas (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references public.organizacoes(id) on delete cascade,
  empreendimento_id           uuid not null references public.empreendimentos(id) on delete cascade,
  tipo                        text not null,           -- LP, LI, LO, LAS, LAU, Outorga, CTF, CADRI, Alvará...
  numero                      text,
  orgao                       text,                    -- IBAMA, SEMA-MT, CETESB, ...
  processo                    text,
  descricao                   text,
  data_emissao                date,
  data_validade               date,                    -- null = sem validade (ex.: CTF tem relatório anual)
  antecedencia_renovacao_dias integer not null default 120, -- LC 140/2011, art. 14, §4º
  situacao                    public.situacao_licenca not null default 'ativa',
  protocolo_renovacao         text,
  data_protocolo_renovacao    date,
  responsavel_id              uuid references auth.users(id) on delete set null,
  observacoes                 text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index on public.licencas (org_id);
create index on public.licencas (empreendimento_id);
create index on public.licencas (data_validade);

-- -----------------------------------------------------------------------------
-- Condicionantes
-- -----------------------------------------------------------------------------
create type public.tipo_condicionante as enum ('unica', 'periodica', 'permanente');
create type public.situacao_condicionante as enum ('pendente', 'em_andamento', 'cumprida', 'nao_aplicavel');

create table public.condicionantes (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizacoes(id) on delete cascade,
  licenca_id          uuid not null references public.licencas(id) on delete cascade,
  numero              text,                       -- ex.: "2.1"
  descricao           text not null,
  tipo                public.tipo_condicionante not null default 'unica',
  periodicidade_meses integer,                    -- para periódicas: 1, 3, 6, 12...
  prazo               date,                       -- próximo vencimento
  situacao            public.situacao_condicionante not null default 'pendente',
  responsavel_id      uuid references auth.users(id) on delete set null,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.condicionantes (org_id);
create index on public.condicionantes (licenca_id);
create index on public.condicionantes (prazo);

-- Histórico de cumprimentos/entregas (protocolos, relatórios enviados ao órgão)
create table public.cumprimentos (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizacoes(id) on delete cascade,
  condicionante_id  uuid not null references public.condicionantes(id) on delete cascade,
  prazo_referente   date,
  data_cumprimento  date not null default current_date,
  protocolo         text,
  observacao        text,
  user_id           uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index on public.cumprimentos (condicionante_id);

-- -----------------------------------------------------------------------------
-- Documentos (arquivos no Supabase Storage, bucket "documentos")
-- -----------------------------------------------------------------------------
create table public.documentos (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizacoes(id) on delete cascade,
  licenca_id        uuid references public.licencas(id) on delete cascade,
  condicionante_id  uuid references public.condicionantes(id) on delete cascade,
  cumprimento_id    uuid references public.cumprimentos(id) on delete cascade,
  nome              text not null,
  storage_path      text not null unique,
  tamanho_bytes     bigint,
  mime_type         text,
  user_id           uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index on public.documentos (licenca_id);
create index on public.documentos (condicionante_id);

-- -----------------------------------------------------------------------------
-- Alertas
-- -----------------------------------------------------------------------------
create table public.alertas_config (
  org_id          uuid primary key references public.organizacoes(id) on delete cascade,
  dias_antes      integer[] not null default '{120,90,60,30,15,7,1,0}',
  emails_extras   text[] not null default '{}',
  ativo           boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- Registro de cada aviso enviado, para nunca repetir o mesmo marco
create table public.alertas_enviados (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacoes(id) on delete cascade,
  entidade        text not null check (entidade in ('licenca', 'renovacao', 'condicionante')),
  entidade_id     uuid not null,
  data_referencia date not null,
  marco_dias      integer not null,
  destinatarios   text[] not null default '{}',
  enviado_em      timestamptz not null default now(),
  unique (entidade, entidade_id, data_referencia, marco_dias)
);
create index on public.alertas_enviados (org_id, enviado_em desc);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_licencas_updated before update on public.licencas
  for each row execute function public.set_updated_at();
create trigger trg_condicionantes_updated before update on public.condicionantes
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helpers de permissão (security definer evita recursão nas policies)
-- -----------------------------------------------------------------------------
create or replace function public.is_membro(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.membros where org_id = p_org and user_id = auth.uid());
$$;

create or replace function public.pode_editar(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membros
    where org_id = p_org and user_id = auth.uid() and papel in ('admin', 'editor')
  );
$$;

create or replace function public.is_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membros
    where org_id = p_org and user_id = auth.uid() and papel = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Novo usuário: entra na organização do convite, ou cria a sua própria
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_convite record;
  v_org uuid;
  v_nome text := coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1));
begin
  select * into v_convite from public.convites where lower(email) = lower(new.email) limit 1;

  if found then
    insert into public.membros (org_id, user_id, papel, nome, email)
    values (v_convite.org_id, new.id, v_convite.papel, v_nome, new.email);
    delete from public.convites where lower(email) = lower(new.email);
  else
    insert into public.organizacoes (nome)
    values (coalesce(nullif(new.raw_user_meta_data->>'organizacao', ''), 'Minha organização'))
    returning id into v_org;

    insert into public.membros (org_id, user_id, papel, nome, email)
    values (v_org, new.id, 'admin', v_nome, new.email);

    insert into public.alertas_config (org_id) values (v_org);
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.organizacoes     enable row level security;
alter table public.membros          enable row level security;
alter table public.convites         enable row level security;
alter table public.empresas         enable row level security;
alter table public.empreendimentos  enable row level security;
alter table public.licencas         enable row level security;
alter table public.condicionantes   enable row level security;
alter table public.cumprimentos     enable row level security;
alter table public.documentos       enable row level security;
alter table public.alertas_config   enable row level security;
alter table public.alertas_enviados enable row level security;

-- organizações
create policy org_select on public.organizacoes for select using (public.is_membro(id));
create policy org_update on public.organizacoes for update using (public.is_admin(id));

-- membros
create policy membros_select on public.membros for select using (public.is_membro(org_id));
create policy membros_update_admin on public.membros for update using (public.is_admin(org_id));
create policy membros_update_self on public.membros for update using (user_id = auth.uid());
create policy membros_delete on public.membros for delete using (public.is_admin(org_id) and user_id <> auth.uid());

-- convites
create policy convites_all on public.convites for all
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

-- tabelas de dados: leitura para membros, escrita para admin/editor
do $$
declare t text;
begin
  foreach t in array array['empresas','empreendimentos','licencas','condicionantes','cumprimentos','documentos']
  loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_membro(org_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.pode_editar(org_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.pode_editar(org_id)) with check (public.pode_editar(org_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.pode_editar(org_id))', t);
  end loop;
end $$;

-- alertas
create policy alertas_config_select on public.alertas_config for select using (public.is_membro(org_id));
create policy alertas_config_update on public.alertas_config for update using (public.is_admin(org_id));
create policy alertas_enviados_select on public.alertas_enviados for select using (public.is_membro(org_id));

-- -----------------------------------------------------------------------------
-- Storage: bucket privado "documentos", caminho = <org_id>/<arquivo>
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy docs_select on storage.objects for select
  using (bucket_id = 'documentos' and public.is_membro(((storage.foldername(name))[1])::uuid));
create policy docs_insert on storage.objects for insert
  with check (bucket_id = 'documentos' and public.pode_editar(((storage.foldername(name))[1])::uuid));
create policy docs_delete on storage.objects for delete
  using (bucket_id = 'documentos' and public.pode_editar(((storage.foldername(name))[1])::uuid));
