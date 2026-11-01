# Environment variables

Copy the repository's `.env.example` to `/home/adventbird/DukaanAI/.env` for local development. Do not commit `.env`. The web app is built with Vite, so variables prefixed with `VITE_` are public in browser bundles and must never contain secrets.

| Variable | Where to get it | Used by | Secret? |
|---|---|---|---|
| `DATABASE_URL` | Supabase Dashboard → Connect → connection string; choose a pooler mode suitable for the API runtime. For local Docker, use the example local URL. | API Prisma runtime | Yes |
| `DIRECT_URL` | Supabase Dashboard → Connect → direct database connection, or a migration-capable session pooler URL if direct IPv6 access is unavailable. | Prisma CLI via `prisma.config.ts` | Yes; elevated migration credential |
| `SUPABASE_URL` | Project Dashboard → Project Settings → API | API token verification | No, but server config |
| `SUPABASE_ANON_KEY` | Project Dashboard → Project Settings → API, publishable/anon key | API verifies bearer tokens through Supabase Auth | No; never use a service-role/secret key here |
| `VITE_SUPABASE_URL` | Same Supabase project URL | Future browser Supabase client; not yet consumed | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Dashboard → Project Settings → API Keys → publishable key (or legacy anon key) | Future browser sign-in; not yet consumed | No; designed for public use with RLS |
| `AUTH_MODE` | Set locally by the developer | API auth middleware | No; use exactly `demo` only for local demo mode |
| `WEB_ORIGIN` | Local URL or deployed web origin | API CORS | No |
| `VITE_API_BASE_URL` | Local API URL or deployed API base | Web API requests | No |
| `PORT` | Hosting provider or local default | API listener | No |
| `AI_API_KEY` | AI provider account, only if AI is later enabled | Deferred AI provider | Yes; currently optional/unused by disabled routes |
| `AI_BASE_URL` | AI provider documentation, only if AI is later enabled | Deferred AI provider | No |
| `AI_MODEL` | AI provider documentation, only if AI is later enabled | Deferred AI provider | No |
| `SESSION_SECRET` | Generate a random secret if a future session feature uses it | No current Supabase bearer verification path | Yes; currently unused |

## Connection string notes

- Keep the API runtime credential least-privileged and separate from `DIRECT_URL`.
- Prisma CLI uses `DIRECT_URL` when present. If absent, it falls back to `DATABASE_URL`.
- Encode reserved URL characters in passwords (`#` as `%23`, `@` as `%40`, `/` as `%2F`). Never paste credentials into source, issues, chat, or logs. Rotate any credential already shared outside a secret manager.
- RLS is not yet active. Do not set the runtime role to a bypass-RLS role as a shortcut; RLS needs transaction-scoped identity context before it can protect Prisma queries.
- The current browser does not implement login. `VITE_SUPABASE_*` entries are placeholders for that work and do not make the app authenticated.
