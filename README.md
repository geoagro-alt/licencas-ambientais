# Licenças Ambientais 🌱

Sistema web para **acompanhar licenças ambientais, outorgas, condicionantes e prazos**, com **alertas automáticos por e-mail** — inspirado no e-licencie, focado no que uma consultoria ambiental usa todo dia.

![stack](https://img.shields.io/badge/Next.js-16-black) ![db](https://img.shields.io/badge/Supabase-Postgres-3ecf8e) ![mail](https://img.shields.io/badge/Resend-e--mail-blue)

## O que já faz

| Módulo | Funcionalidades |
|---|---|
| **Painel** | KPIs (ativas, a vencer, vencidas, condicionantes em aberto), índice de conformidade, linha do tempo dos próximos 90 dias, ranking por empresa |
| **Licenças** | LP, LI, LO, LAS, LAU, AuA, ASV, outorgas, CTF/IBAMA, CADRI, CAR, alvarás… · validade · **prazo de renovação automático (120 dias, LC 140/2011 — configurável por licença)** · registro do protocolo de renovação · busca e filtros · exportação CSV |
| **Condicionantes** | únicas, **periódicas** (o prazo avança sozinho ao registrar a entrega) e permanentes · responsável · histórico de cumprimentos com protocolo · **colar várias de uma vez** a partir do PDF da licença |
| **Documentos** | upload de PDFs/fotos/relatórios por licença (Supabase Storage, privado) |
| **Calendário** | visão mensal de vencimentos, renovações e condicionantes · **feed .ics** para assinar no Google Agenda/Outlook/iPhone |
| **Alertas por e-mail** | resumo diário às 7h com o que está vencendo · marcos configuráveis (padrão 120, 90, 60, 30, 15, 7, 1 e 0 dias) · itens vencidos são lembrados 1×/semana · nunca repete o mesmo aviso · e-mails extras (cliente, gerente da fazenda) · botão de teste |
| **Equipe** | multiusuário com papéis (admin / editor / leitor) · convites por e-mail · cada organização só enxerga os próprios dados (Row Level Security) |
| **Empresas** | clientes/titulares → empreendimentos (fazendas, unidades, obras) com município/UF, CAR e coordenadas |

## Por que esta arquitetura

| Peça | Escolha | Motivo |
|---|---|---|
| App web | **Next.js 16** (App Router, Server Actions) | Um único projeto para telas + API; o Claude Code trabalha muito bem com ele |
| Banco, login e arquivos | **Supabase** (Postgres + Auth + Storage) | Plano gratuito, login pronto, segurança por linha (RLS) no próprio banco |
| E-mail | **Resend** | API simples; plano gratuito de 3.000 e-mails/mês (máx. 100/dia) |
| Hospedagem + agendamento | **Vercel** + Vercel Cron | Deploy automático a cada `git push`; cron diário dispara os alertas |

> Custos: dá para começar com **R$ 0**. Atenção: o plano Hobby (grátis) da Vercel é para uso **não comercial** — para uso na empresa, o plano Pro custa US$ 20/mês por membro. O Supabase gratuito pausa projetos após 7 dias sem atividade, mas o cron diário de alertas mantém o projeto ativo.

## Como colocar no ar (≈ 20 min)

### 1. Supabase (banco + login)
1. Crie uma conta em [supabase.com](https://supabase.com) → **New project** (região *South America (São Paulo)*).
2. Abra **SQL Editor → New query** e rode, em ordem, os arquivos de [`supabase/migrations/`](supabase/migrations/) (`0001_schema.sql`, depois `0002_endurecer_funcoes.sql`).
3. Em **Authentication → URL Configuration**, coloque a URL do site (ex.: `https://seu-app.vercel.app`) em *Site URL* e adicione `https://seu-app.vercel.app/auth/callback` em *Redirect URLs*.
4. Em **Project Settings → API**, copie `Project URL`, a chave `anon` e a chave `service_role`.

### 2. Resend (e-mails)
1. Crie conta em [resend.com](https://resend.com) → **API Keys → Create**.
2. Para enviar para qualquer pessoa, verifique seu domínio em **Domains** (ex.: `geoagro.com.br`). Sem domínio, só dá para testar enviando para o e-mail da própria conta Resend usando `onboarding@resend.dev`.

### 3. Vercel (hospedagem)
1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe este repositório do GitHub.
2. Em **Environment Variables**, cadastre as variáveis do arquivo [`.env.example`](.env.example):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` (secreta!) |
| `RESEND_API_KEY` | chave do Resend |
| `EMAIL_FROM` | ex.: `Licenças GeoAgro <alertas@geoagro.com.br>` |
| `NEXT_PUBLIC_APP_URL` | URL final do app, ex.: `https://seu-app.vercel.app` |
| `CRON_SECRET` | qualquer texto longo e aleatório |

3. **Deploy**. O cron em [`vercel.json`](vercel.json) roda todo dia às 10:00 UTC (07:00 em Brasília; no plano Hobby a Vercel pode disparar em qualquer minuto dentro dessa hora).
4. Acesse o site → **Criar conta**. O primeiro usuário vira admin da organização. Convide a equipe em **Configurações**.

### Rodar no computador
```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase/Resend
npm run dev                  # http://localhost:3000
```
Testar o disparo de alertas localmente (sem enviar, só simulando):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/alertas?dry=1"
```

## Comandos
| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm test` | testes da lógica de prazos/alertas (Vitest) |
| `npm run typecheck` / `npm run lint` | verificação de tipos / lint |

## Estrutura
```
supabase/migrations/      esquema do banco, RLS, gatilho de novos usuários, bucket de documentos
src/proxy.ts              protege as rotas (exige login) e renova a sessão
src/lib/prazos.ts         cálculo de status, dias restantes, prazo de renovação
src/lib/alertas.ts        regra dos alertas (pura, testada em tests/alertas.test.ts)
src/lib/executar-alertas.ts  busca no banco, monta e envia os e-mails, registra o histórico
src/lib/email.ts          template HTML do e-mail + envio via Resend
src/app/(app)/…           telas: dashboard, licencas, condicionantes, calendario, empresas, configuracoes
src/app/api/cron/alertas  endpoint chamado pelo cron diário
src/app/api/calendario    feed .ics
src/app/api/exportar      relatórios CSV
```

## Próximos passos sugeridos
Veja a lista priorizada em [`CLAUDE.md`](CLAUDE.md#roadmap) — está escrita para você pedir direto ao Claude Code (ex.: *"implemente o item 1 do roadmap"*).
