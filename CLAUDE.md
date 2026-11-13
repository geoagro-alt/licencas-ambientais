@AGENTS.md

# Licenças Ambientais — guia para o Claude Code

Sistema de acompanhamento de licenças ambientais (prazos, condicionantes, documentos) com alertas por e-mail.
Usuários: consultoria ambiental brasileira (GeoAgro) e seus clientes do agro. **Toda a interface, mensagens e nomes de domínio ficam em português do Brasil.**

## Stack
- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack). Atenção às mudanças do Next 16: `params`/`searchParams`/`cookies()` são assíncronos; o middleware se chama **`src/proxy.ts`** (função `proxy`). Use os tipos globais `PageProps<"/rota">` e `RouteContext<"/rota">`. Docs locais em `node_modules/next/dist/docs/`.
- **Supabase**: Postgres + Auth (e-mail/senha) + Storage (bucket privado `documentos`). Cliente SSR via `@supabase/ssr`.
- **Tailwind CSS v4** (via `@tailwindcss/turbopack`, configurado em `next.config.ts` — não remova). Componentes visuais simples em `src/components/ui.tsx` (sem shadcn).
- **Resend** para e-mail. **Vercel Cron** (`vercel.json`) chama `/api/cron/alertas` 1×/dia.
- **Vitest** para testes (`npm test`).

## Modelo de dados (supabase/migrations/0001_schema.sql)
```
organizacoes 1─N membros (papel admin|editor|leitor, receber_alertas)
organizacoes 1─N convites            (novo usuário com e-mail convidado entra na org; senão cria a sua — gatilho handle_new_user)
organizacoes 1─N empresas 1─N empreendimentos 1─N licencas 1─N condicionantes 1─N cumprimentos
licencas/condicionantes 1─N documentos (arquivo em storage: <org_id>/<licenca_id>/<uuid>-<nome>)
organizacoes 1─1 alertas_config (dias_antes[], emails_extras[], ativo)
alertas_enviados  (entidade, entidade_id, data_referencia, marco_dias) UNIQUE → evita aviso repetido
```
- Toda tabela de dados tem `org_id` e RLS: leitura = `is_membro(org_id)`, escrita = `pode_editar(org_id)` (admin/editor). Funções `security definer` evitam recursão.
- **Ao criar tabela nova:** inclua `org_id`, habilite RLS e crie as 4 policies no mesmo padrão. Crie um novo arquivo `supabase/migrations/000N_descricao.sql` (nunca edite migrações já aplicadas).

## Convenções
- Leitura de dados: Server Components com `createClient()` de `@/lib/supabase/server` (respeita RLS). Use `getContexto()` (`@/lib/contexto`) para obter `orgId`, `papel`, `podeEditar`.
- Escrita: Server Actions em `actions.ts` de cada rota, terminando com `revalidatePath(...)`.
- `createAdminClient()` (service role, ignora RLS) **só** em rotas sem usuário: cron de alertas e feed .ics.
- Upload: direto do navegador para o Storage (`components/upload-documento.tsx`), depois `registrarDocumento` — evita o limite de 4,5 MB do corpo de requisição na Vercel.
- Datas são `date` (sem hora) no formato ISO `yyyy-MM-dd`; "hoje" é sempre `hojeISO()` (fuso America/Sao_Paulo). Formatação com `fmtData`/`fmtDias` de `@/lib/prazos`.
- Regras de negócio puras (sem I/O) ficam em `src/lib/*.ts` e devem ter teste em `tests/`.

## Regras de negócio importantes
- **Renovação**: prazo-limite = validade − `antecedencia_renovacao_dias` (padrão 120, LC 140/2011 art. 14 §4º). Protocolada no prazo → situação `em_renovacao` (validade prorrogada até manifestação do órgão).
- **Condicionante periódica**: ao registrar cumprimento, `prazo += periodicidade_meses` e volta a `pendente`. Única → `cumprida`. Permanente → continua `pendente`.
- **Alertas** (`src/lib/alertas.ts`): para cada item calcula os dias até a data; avisa no menor marco já cruzado que ainda não consta em `alertas_enviados` (recupera dias em que o cron falhou). Vencidos: marco semanal (-1, -8, -15…). Admins e e-mails extras recebem tudo; editores/leitores só os itens em que são responsáveis. Depois de vencida, a licença não gera mais alerta de "renovação" (só de vencimento).

## Verificação antes de concluir qualquer tarefa
```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Roadmap
Itens priorizados para implementar (peça ao Claude Code: "implemente o item N do roadmap"):

1. **Extração de condicionantes do PDF com IA** — ao anexar o PDF da licença, chamar a API da Anthropic (`@anthropic-ai/sdk`, modelo Claude com entrada de PDF) para extrair nº, órgão, validade e a lista de condicionantes com prazos sugeridos; mostrar tela de revisão antes de salvar. Variável `ANTHROPIC_API_KEY`.
2. **Alertas por WhatsApp** — via WhatsApp Business Cloud API (Meta) ou Z-API/Twilio; campo `telefone` em `membros`; template aprovado com resumo diário.
3. **Relatório PDF** por empresa/empreendimento (licenças + condicionantes + histórico), para enviar ao cliente/auditoria.
4. **Evidências de campo com foto + GPS** — upload pelo celular (PWA) com coordenadas EXIF/geolocalização vinculadas à condicionante.
5. **Mapa dos empreendimentos** (Leaflet + OpenStreetMap) colorido pela situação das licenças; importar polígono do CAR (shapefile/KML).
6. **Importação de planilha** (Excel/CSV) de licenças e condicionantes existentes.
7. **Vistorias e planos de ação** (não conformidades, responsáveis, prazos).
8. **Troca de organização** para usuários que pertencem a mais de uma (hoje usa a primeira).
9. **Portal do cliente**: papel `cliente` com acesso somente leitura às próprias empresas.
10. **Outorgas**: volumes outorgados × medidos (horímetro/hidrômetro) com alerta de excesso.
11. **Log de auditoria** (quem alterou o quê e quando) via trigger em tabela `auditoria`.
