# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Real data, no undo

- This folder is not a git repository, so there is no history to restore from. Read a file before overwriting it, and don't delete anything you didn't create without asking.
- `dados/one-history.db` holds real data. Never delete, reset or overwrite it.
- `npm run dev`, `npm run build` and `npm start` all apply pending migrations to that database first. Use these instead:
  - Compile: `npx next build` (same build, no migration; the database stays untouched)
  - Run the app: `node scripts/servidor-teste.mjs 3457` (temporary database; needs a build)
- Production runs `npm run build` and `npm start` on a server with `dados/` on disk, so a new migration applies to production data on the next deploy. Use `/migrar-banco` to apply migrations locally.

## Commands

Use `/verificar` for the full check. There is no formatter or typecheck script; type checking is `npx tsc --noEmit`.

- Lint: `npx eslint <files>`. `npm run lint` fails on errors that already exist in the code, so judge only the files you changed, and don't fix unrelated findings unless asked.
- Rules test only (no build needed): `npx vitest run test/regras.test.ts`
- One API test: `npx vitest run test/api.test.ts -t "<test name>"`
- One E2E test: `npx playwright test -g "<test name>"`
- After changing `lib/servidor/schema.ts`: `npm run db:gerar`. `drizzle.config.ts` has no credentials, so use drizzle-kit only to generate. `scripts/migrar.mjs` applies migrations.

## Testing

- `test/api.test.ts` and `e2e/` run against the compiled build, not the source. Run `npx next build` after changing code or you will test stale code.
- They use a temporary database through `scripts/servidor-teste.mjs`, on fixed ports 3457 (API) and 3458 (E2E), which must be free.
- `vitest.config.ts` has no `@/` alias, so code imported by tests must use relative imports. That is why `lib/` and `test/` don't use `@/`.
- Signup allows 20 attempts per IP. API tests send a distinct `X-Forwarded-For` per client to stay under it; do the same in new tests that create many accounts.
- Playwright uses the installed Edge (`channel: 'msedge'`), not a bundled browser.

## Conventions

- Write everything in Brazilian Portuguese: files, folders, identifiers, routes, tables and columns, CSS classes, comments, test names and user-facing messages. Use the existing domain terms: ficha, campanha, mestre, jogador, rolagem, mesa, convite.
- Code comments use `/* ... */` and explain why, not what.
- Schema fields are camelCase in TypeScript and snake_case in columns.
- `lib/servidor/*` is server-only by convention, with no `server-only` guard. Client pages reach data through `/api/...` using SWR and `lib/cliente.ts`.
- Game formulas belong in `lib/regras.ts`, which runs in both browser and server, so it must not import server code.

## API (`lib/servidor/rotas.ts`)

- It has its own router, `rota(metodo, padrao, fn, publica = false)`, and the first match wins. Register static paths before `:id` paths.
- Routes require login unless `publica` is `true`.
- `app/api/[...rota]/route.ts` exports only GET, POST, PATCH and DELETE. A new method needs an export there.
- Every non-GET request needs a JSON content type, even with an empty body, or it gets 415. Bodies are limited to 512 KB.
- Raise errors with `throw new Erro(status, 'mensagem em português')`. The message is shown to the user.
- Someone outside a campaign gets 404, not 403, so its existence doesn't leak. Keep this in new campaign routes.

## Data model

- The schema has no foreign keys. Cascades are written by hand with `db.batch` in `rotas.ts`, so a new relation needs its cleanup added to `apagarCampanha` and `DELETE /api/conta`.
- `fichas.dados` is JSON. A new field on the sheet needs `DadosFicha` and `normalizar()` in `lib/regras.ts`, which drops unknown fields. A new top-level field also needs `CAMPOS_FICHA` in `rotas.ts`, or PATCH ignores it silently.
- Run `normalizar()` before every write to `fichas.dados`.
- Write sheets through `alterarFicha`, which compares `atualizado` to handle concurrent edits. `atualizado` must only grow, because `lib/useFicha.ts` relies on that to ignore stale responses.
- Keep `fichas.foto` out of `colunasFicha` and `dados`. The table view polls every 3 s, and photos are served separately from `/api/fichas/:id/foto`.

## Environment

- `next.config.ts` sets a strict CSP. External scripts, images, fonts and API calls are blocked until it changes.
- Scripts load only `.env`, while Next also reads `.env.local`. Setting `DATABASE_URL` only in `.env.local` sends the app and the migrations to different databases.
