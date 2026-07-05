# Escalas CCLX — gestão de escalas de voluntários

Aplicação web para gerir escalas de voluntários por igreja. Reescrita na mesma
stack da **Agenda CCLX**: **React + Vite + Tailwind/shadcn** no frontend e
**Express (serverless) + PostgreSQL (Supabase)** no backend, com autenticação
**passwordless (OTP + JWT)** e deploy no **Vercel**.

Substitui o fluxo em Excel com:

- **Multi-tenant** — Organização → Igreja; cada igreja mantém os seus dados isolados.
- **Meses** com máquina de estados (`draft → availability_open → scheduling → final`).
- **Voluntários** e **equipas** com posições nomeadas e membros alocados.
- **Disponibilidade** online por domingo.
- **Editor de escala** por posição × domingo, com deteção de conflitos.
- **Publicação**: PDF, emails aos líderes/voluntários e feed **iCal**.
- **Relatórios** (pendentes, conflitos, carga) e **estatísticas**.
- **i18n** PT-PT/EN com traduções configuráveis.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui (Radix), TanStack Query, sonner, lucide-react |
| Backend | Node ≥20, Express (serverless no Vercel), `pg` (SQL parametrizado), zod |
| Auth | Código OTP por email (HMAC-SHA256 + pepper) + JWT em cookie httpOnly |
| BD | PostgreSQL (Supabase) |
| PDF / iCal | pdfkit / iCalendar (RFC 5545) feito à mão |
| Deploy | Vercel (frontend estático + função serverless) |

## Estrutura

```
.
├── index.html, vite.config.js, tailwind.config.js, vercel.json …
├── src/                     # Frontend React
│   ├── main.jsx, App.jsx    # Providers + router por hash
│   ├── components/          # AppShell, ui/ (shadcn), common
│   ├── pages/               # Ecrãs (dashboard, meses, escala, equipas, …)
│   ├── hooks/               # useAuth, useI18n, useTheme
│   ├── services/            # http, authService, api (por domínio)
│   ├── lib/                 # router (hash), utils (cn), format
│   └── i18n/                # dicionário PT/EN
├── server/                  # Backend Express
│   ├── serverless.js        # Handler do Vercel
│   └── src/
│       ├── app.js, index.js, config.js
│       ├── db/              # pool.js, schema.sql, migrate.js, seed.js
│       ├── auth/            # otp, jwt, email, session, routes
│       ├── middleware/      # auth (loadUser, requireRole, …)
│       ├── lib/             # http, dates, ics, slug, tenant
│       └── routes/          # orgs, churches, volunteers, teams, months,
│                            #   availability, schedule, reports, stats,
│                            #   calendar, publish, translations,
│                            #   adminRequests, dataImport, health
└── server.js                # Arranque combinado local (API + dist/)
```

## Setup local

Pré-requisitos: **Node ≥20** e uma base de dados **PostgreSQL** (local ou Supabase).

```powershell
# 1. Instalar dependências (frontend + backend)
npm install
npm --prefix server install

# 2. Configurar o backend
Copy-Item server/.env.example server/.env
# Edita server/.env: DATABASE_URL, JWT_SECRET, OTP_PEPPER, SEED_ADMIN_EMAIL …

# 3. Migrar e semear a base de dados
npm run db:migrate
npm run db:seed

# 4. Correr o backend (porta 4000) e o frontend (porta 5173) em terminais separados
npm --prefix server run dev
npm run dev
```

Abre <http://localhost:5173>. Entra com o email do administrador semeado
(`SEED_ADMIN_EMAIL`). Sem SMTP configurado, o **código OTP é impresso na consola
do backend** (ou define `OTP_LOG_CODES=true`). Para testes locais podes definir
`DEV_MASTER_OTP` no `.env` e usar sempre esse código.

## Variáveis de ambiente (backend)

As essenciais (ver [server/.env.example](server/.env.example) para a lista completa):

| Var | Obrigatória | Descrição |
|-----|:-:|-----------|
| `DATABASE_URL` | ✅ | String de ligação PostgreSQL (Supabase: pooler porta 6543). |
| `JWT_SECRET` | ✅ | Segredo para assinar o JWT da sessão. |
| `OTP_PEPPER` | ✅ | Pepper para o hash do código OTP. |
| `DB_SSL` | | `false` para Postgres local sem TLS (Supabase: deixa por definir). |
| `SESSION_HOURS`, `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS` | | Parâmetros de sessão/OTP. |
| `SMTP_*`, `MAIL_FROM` | | SMTP para envio de emails (sem isto, modo consola). |
| `ALLOW_PUBLIC_REGISTRATION` | | Permite `/auth/onboard` (criar igreja + admin). |
| `SEED_*` | | Dados do seed inicial (org, igreja, admin). |

## Scripts

| Comando | Efeito |
|---------|--------|
| `npm run dev` | Frontend Vite (proxy para o backend em `:4000`). |
| `npm --prefix server run dev` | Backend com auto-reload. |
| `npm run build` | Build do frontend para `dist/`. |
| `npm start` | Arranque combinado (backend serve a API + `dist/`). |
| `npm run db:migrate` / `db:seed` | Migração / seed da BD. |
| `npm run lint` / `npm test` | ESLint / testes do frontend (Vitest). |
| `npm --prefix server test` | Testes do backend (`node --test`). |

## Deploy (Vercel)

O [vercel.json](vercel.json) publica o `dist/` como estático e corre
`server/serverless.js` como função serverless. As rotas `/auth`, `/data` e
`/health` vão para a função; tudo o resto cai no SPA.

1. Define as variáveis de ambiente no projeto Vercel (as da tabela acima).
2. Faz deploy. Após o primeiro deploy, corre `npm run db:migrate` e
   `npm run db:seed` (localmente, apontando `DATABASE_URL` para a BD de produção).

## Autenticação e papéis

- **Passwordless**: pede-se um código de 6 dígitos por email (`/auth/request-code`)
  e confirma-se em `/auth/verify`, abrindo sessão num cookie httpOnly.
- Papéis: **admin**, **leader** (líder), **volunteer**; mais a flag **org admin**
  (gere organizações/igrejas e pode trocar de igreja ativa).
- Novos utilizadores pedem acesso em `/auth/register` e ficam **pendentes** até
  serem aprovados por um admin (área *Pedidos de acesso*).
