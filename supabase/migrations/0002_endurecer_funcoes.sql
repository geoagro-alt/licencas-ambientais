-- Recomendações do Security Advisor do Supabase
alter function public.set_updated_at() set search_path = public;

-- gatilho de novos usuários não deve ser chamável pela API
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- helpers de permissão: só usuários logados (usados nas policies de RLS)
revoke execute on function public.is_membro(uuid) from public, anon;
revoke execute on function public.pode_editar(uuid) from public, anon;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_membro(uuid) to authenticated;
grant execute on function public.pode_editar(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
