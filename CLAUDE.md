# CLAUDE.md

## Project

AI Adoption & Impact Tracker for Northstar Systems, a fictional company (products: FlowOS, Connect, Insight). It helps an AI enablement lead see whether an AI rollout is working, while giving every employee a reason to take part.

Design principle:
1. Adoption data (who used AI, how often) comes from an imported usage export. Nobody logs anything to be counted.
2. Impact data (time saved, wins) comes from a 20-second weekly pulse, and every answer builds the employee's own "My AI impact" record for performance reviews.

All seed data is fictional and the UI labels it as demo data. Keep it that way.

## Stack

- `client/`: React 18 + Vite + React Router. Plain CSS with design tokens in `client/src/styles.css`.
- `server/`: Node + Express (ES modules), SQLite via `better-sqlite3`. The database lives in `server/data/tracker.db` (git-ignored) and is created and seeded on first start.
- AI features use the Anthropic SDK (`@anthropic-ai/sdk`) from `server/ai.js` only.
- npm workspaces: run everything from the repo root.

## Layout

- `server/index.js`: Express entry, mounts `/api` routes, serves `client/dist` in production.
- `server/seed.js`: deterministic demo data (25 employees, 8 weeks). `npm run seed` resets it.
- `server/metrics.js`: all aggregation (adoption, hours, teams, use cases, champions, headline, needs attention).
- `server/ai.js`: Claude calls plus demo-mode fallbacks.
- `server/routes/`: `api.js` (read endpoints and pulse), `ai.js` (invite, leadership update, review summary), `import.js` (CSV preview and commit).
- `client/src/pages/`: Overview, Pulse, MyImpact, Import.
- `sample-data/`: sample usage export CSV (`email,date,active_days,message_count`).

## Commands

- `npm install`: install both workspaces.
- `npm run dev`: API on :3001 and Vite on :5173 (proxies `/api`).
- `npm run build`: build the client.
- `npm start`: build, then serve everything from Express on :3001.
- `npm run seed`: reset the demo database.

## Rules

- **Demo mode.** The app must run fully with `npm install` and `npm run dev` and no keys. If `ANTHROPIC_API_KEY` is not set, or a Claude call fails, every AI feature returns realistic sample text built from the real numbers, with `demo: true` in the response. Never let an AI feature throw or show an empty state because a key is missing.
- **No keys in the browser.** The API key is read from the environment by the server only. Never send it to the client, never prefix it with `VITE_`, never put it in client code, and never commit a real key. `.env` is git-ignored; `.env.example` documents the variables.
- **Copy style.** No em dashes or en dashes in UI copy, docs, prompts or sample AI text. No emoji. `server/ai.js` also strips dashes from model output.
- **Visual design.** Manrope, tabular numbers for figures, the color tokens in `styles.css`. Marigold (`--ai`) is only for buttons that call the AI. No gradients. Real buttons and labels, 44px minimum touch targets, text contrast of at least 4.5:1. The pulse and My AI impact screens are phone-first.
- Headlines and "needs attention" logic are rule-based in `metrics.js` so they are deterministic and free; only the invite, leadership update and review summary use Claude.
