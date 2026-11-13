-- =============================================================================
-- 0005 — cumprimento atômico, aceite de convite no login e controle de uso da IA
-- (somente adições: não muda o comportamento de quem ainda roda a versão anterior do app)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Registrar cumprimento numa transação só.
--    Trava a condicionante, confere se o prazo ainda é o que o usuário estava vendo
--    (um segundo clique encontra o prazo já avançado e é recusado), grava o cumprimento
--    e atualiza prazo/situação. Roda com as permissões de quem chama (RLS vale).
--    Retorna o id da licença (para o app revalidar a página).
-- -----------------------------------------------------------------------------
create or replace function public.cumprir_condicionante(
  p_id uuid,
  p_prazo_esperado date,
  p_data date,
  p_protocolo text,
  p_observacao text
) returns uuid
language plpgsql set search_path = public as $$
declare
  c public.condicionantes%rowtype;
begin
  select * into c from public.condicionantes where id = p_id for update;
  if not found then
    raise exception 'Condicionante não encontrada ou sem permissão.' using errcode = 'P0002';
  end if;

  if c.situacao not in ('pendente', 'em_andamento') or c.prazo is distinct from p_prazo_esperado then
    raise exception 'Este cumprimento já foi registrado (ou o prazo mudou). Atualize a página.' using errcode = 'P0001';
  end if;

  insert into public.cumprimentos (org_id, condicionante_id, prazo_referente, data_cumprimento, protocolo, observacao, user_id)
  values (
    c.org_id, c.id, c.prazo,
    coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date),
    nullif(trim(p_protocolo), ''), nullif(trim(p_observacao), ''),
    auth.uid()
  );

  if c.tipo = 'periodica' then
    -- periódica sem prazo definido continua pendente (antes virava "cumprida" para sempre)
    update public.condicionantes
       set situacao = 'pendente',
           prazo = case when c.prazo is null then null
                        else (c.prazo + make_interval(months => coalesce(c.periodicidade_meses, 12)))::date end
     where id = c.id;
  elsif c.tipo = 'permanente' then
    update public.condicionantes set situacao = 'pendente' where id = c.id;
  else
    update public.condicionantes set situacao = 'cumprida' where id = c.id;
  end if;

  return c.licenca_id;
end $$;

revoke execute on function public.cumprir_condicionante(uuid, date, date, text, text) from public, anon;
grant execute on function public.cumprir_condicionante(uuid, date, date, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Aceitar convites no login.
--    O usuário logado (com e-mail confirmado) entra nas organizações que convidaram o seu e-mail.
--    Serve para o primeiro acesso do convidado e para quem já tinha conta (ex.: removido e convidado de novo).
-- -----------------------------------------------------------------------------
create or replace function public.aceitar_convite() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_user record;
  v_convite record;
  v_aceitou boolean := false;
begin
  select id, email, email_confirmed_at, raw_user_meta_data into v_user from auth.users where id = auth.uid();
  if not found or v_user.email_confirmed_at is null then
    return false;
  end if;

  for v_convite in
    select * from public.convites where lower(email) = lower(v_user.email) order by created_at
  loop
    insert into public.membros (org_id, user_id, papel, nome, email)
    values (
      v_convite.org_id, v_user.id, v_convite.papel,
      coalesce(nullif(v_user.raw_user_meta_data->>'nome', ''), split_part(v_user.email, '@', 1)),
      v_user.email
    )
    on conflict (org_id, user_id) do nothing;
    delete from public.convites where id = v_convite.id;
    v_aceitou := true;
  end loop;

  return v_aceitou;
end $$;

revoke execute on function public.aceitar_convite() from public, anon;
grant execute on function public.aceitar_convite() to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Registro de leituras por IA (para o limite diário por organização).
--    Sem policy de update/delete: o usuário não consegue apagar o próprio histórico de uso.
-- -----------------------------------------------------------------------------
create table if not exists public.ia_leituras (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacoes(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists ia_leituras_org_created_idx on public.ia_leituras (org_id, created_at desc);

alter table public.ia_leituras enable row level security;

drop policy if exists ia_leituras_select on public.ia_leituras;
create policy ia_leituras_select on public.ia_leituras for select using (public.is_membro(org_id));

drop policy if exists ia_leituras_insert on public.ia_leituras;
create policy ia_leituras_insert on public.ia_leituras for insert
  with check (public.pode_editar(org_id) and user_id = auth.uid());
