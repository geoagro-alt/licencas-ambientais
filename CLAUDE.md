@AGENTS.md

# Licenças Ambientais — guia para o Claude Code

Sistema de acompanhamento de licenças ambientais (prazos, condicionantes, documentos) com alertas por e-mail.
Usuários: consultoria ambiental brasileira (GeoAgro) e seus clientes do agro. **Toda a interface, mensagens e nomes de domínio ficam em português do Brasil.**

## Stack
- **Next.js 16** (App Router, Server Components, Server Actions, Turbopack). Atenção às mudanças do Next 16: `params`/`searchParams`/`cookies()` são assíncronos; o middleware se chama **`src/proxy.ts`** (função `proxy`). Use os tipos globais `PageProps<"/rota">` e `RouteContext<"/rota">`. Docs locais em `node_modules/next/dist/docs/`.
- **Supabase**: Postgres + Auth (e-mail/senha) + Storage (bucket privado `documentos`). Cliente SSR via `@supabase/ssr`.
- **Tailwind CSS v4** (via `@tailwindcss/turbopack`, configurado em `next.config.ts` — não remova). Componentes visuais simples em `src/components/ui.tsx` (sem shadcn).
- **Resend** para e-mail. **Vercel Cron** (`vercel.json`) chama `/api/cron/alertas` 1×/dia.
- **Região**: funções da Vercel em `gru1` (São Paulo, `vercel.json`) — mesma região do Supabase (`sa-east-1`). Não remova: com o servidor nos EUA cada clique fica ~0,5 s mais lento.
- Autenticação no servidor usa `supabase.auth.getClaims()` (valida o JWT sem ida extra ao Auth). `loading.tsx` em `(app)` dá resposta imediata ao navegar.
- **Vitest** para testes (`npm test`).
- **IA**: lê PDF/foto de licenças em `/licencas/ler`. Provedores em `src/lib/ia.ts`: **Gemini** (REST, `GEMINI_API_KEY`, plano grátis, `responseSchema` gerado por `paraSchemaGemini`, fallback para `gemini-3.5-flash-lite` em 404/429) ou **Claude** (`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, `tool_choice` forçado). Gemini tem prioridade; `IA_PROVEDOR=claude` força o Claude. Arquivo vai do navegador para o Storage (`<org>/ia/...`), o servidor baixa e envia em base64; resposta normalizada por `normalizarExtracao` (testada). Sem chave a tela mostra aviso.
- Na interface, a tabela `empresas` aparece como **Clientes** (rota `/clientes`; `/empresas` redireciona).

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

1. **Extrair condicionantes por IA numa licença já cadastrada** — a leitura de licença nova já existe em `/licencas/ler` (`src/lib/ia.ts` + `src/lib/extracao-ia.ts`, ferramenta `registrar_licenca`, modelo em `ANTHROPIC_MODEL`); falta um botão na página da licença para ler um PDF anexado e acrescentar só as condicionantes.
2. **Alertas por WhatsApp** — via WhatsApp Business Cloud API (Meta) ou Z-API/Twilio; campo `telefone` em `membros`; template aprovado com resumo diário.
3. **Relatório PDF** por empresa/empreendimento (licenças + condicionantes + histórico), para enviar ao cliente/auditoria.
4. **Evidências de campo com foto + GPS** — upload pelo celular (PWA) com coordenadas EXIF/geolocalização vinculadas à condicionante.
5. **Mapa dos empreendimentos** (Leaflet + OpenStreetMap) colorido pela situação das licenças; importar polígono do CAR (shapefile/KML).
6. **Importação de condicionantes por planilha** (licenças já importam em `/licencas/importar`, via `src/lib/importacao.ts`).
7. **Vistorias e planos de ação** (não conformidades, responsáveis, prazos).
8. **Troca de organização** para usuários que pertencem a mais de uma (hoje usa a primeira).
9. **Portal do cliente**: papel `cliente` com acesso somente leitura às próprias empresas.
10. **Outorgas**: volumes outorgados × medidos (horímetro/hidrômetro) com alerta de excesso.
11. **Log de auditoria** (quem alterou o quê e quando) via trigger em tabela `auditoria`.
