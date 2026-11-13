-- =============================================================================
-- 0006 — cadastro apenas por convite
--
-- ATENÇÃO: aplique junto com a versão do app que chama aceitar_convite() (0005) no login.
-- Com a versão antiga do app, um convidado criaria a conta mas ficaria sem organização.
--
-- Antes: qualquer pessoa criava conta e ganhava uma organização própria (podia gastar a cota de IA
-- e disparar e-mails de convite), e o convidado entrava na organização no momento do cadastro,
-- antes de confirmar o e-mail.
-- Agora:
--   - e-mail convidado  -> a conta é criada; a entrada na organização acontece no primeiro login
--                          (aceitar_convite, que exige e-mail confirmado);
--   - instalação nova   -> se ainda não existe nenhuma organização, o primeiro usuário cria a sua;
--   - qualquer outro    -> cadastro recusado.
--
-- Para reabrir o cadastro livre no futuro, substitua o "raise exception" final pelo bloco que cria
-- a organização (o mesmo usado na instalação nova).
-- =============================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_nome text := coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1));
begin
  if exists (select 1 from public.convites where lower(email) = lower(new.email)) then
    return new;
  end if;

  if not exists (select 1 from public.organizacoes) then
    insert into public.organizacoes (nome)
    values (coalesce(nullif(new.raw_user_meta_data->>'organizacao', ''), 'Minha organização'))
    returning id into v_org;

    insert into public.membros (org_id, user_id, papel, nome, email)
    values (v_org, new.id, 'admin', v_nome, new.email);

    insert into public.alertas_config (org_id) values (v_org);
    return new;
  end if;

  raise exception 'Cadastro apenas por convite.' using errcode = 'P0001';
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
