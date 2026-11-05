# Tablebola

Local-first 2D virtual tabletop for a small friend group.

## Development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `VITE_PARTYKIT_HOST` if the PartyKit server is not at `localhost:1999`.
3. Run `npm run dev` to start Vite and the PartyKit room server together. `npm run dev:vite` starts only the frontend.

Use `npm run test`, `npm run lint`, and `npm run build` for checks.

## Multiplayer scope

Room state is authoritative in the PartyKit server's memory and is lost when that server restarts. There is no account system or database persistence. Backgrounds are resized and compressed in the browser, then synchronized as data URLs; token sprites are also sent as data URLs.
