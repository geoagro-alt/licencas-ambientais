-- Impede escalação de privilégio em public.membros.
-- Antes: a policy membros_update_self deixava o usuário alterar qualquer coluna da própria linha
-- (inclusive papel e org_id). Agora um gatilho restringe o que pode mudar.

create or replace function public.proteger_membros() returns trigger
language plpgsql set search_path = public as $$
begin
  -- service_role / SQL Editor (sem usuário logado) passam direto
  if auth.uid() is null then
    return new;
  end if;

  if new.org_id is distinct from old.org_id
     or new.user_id is distinct from old.user_id
     or new.email is distinct from old.email then
    raise exception 'Não é permitido alterar organização, usuário ou e-mail do membro.' using errcode = '42501';
  end if;

  if new.papel is distinct from old.papel then
    if old.user_id = auth.uid() then
      raise exception 'Você não pode alterar o próprio papel.' using errcode = '42501';
    end if;
    if not public.is_admin(old.org_id) then
      raise exception 'Apenas administradores podem alterar papéis.' using errcode = '42501';
    end if;
  end if;

  return new;
end $$;

revoke execute on function public.proteger_membros() from public, anon, authenticated;

drop trigger if exists trg_membros_proteger on public.membros;
create trigger trg_membros_proteger
  before update on public.membros
  for each row execute function public.proteger_membros();

-- policies de update com WITH CHECK explícito
drop policy if exists membros_update_admin on public.membros;
create policy membros_update_admin on public.membros for update
  using (public.is_admin(org_id)) with check (public.is_admin(org_id));

drop policy if exists membros_update_self on public.membros;
create policy membros_update_self on public.membros for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
