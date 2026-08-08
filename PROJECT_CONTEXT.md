# PaperX Durable Project Context

Last refreshed: 8 August 2026
Code checkpoint: working tree after shared-market-data migration
Notion root: https://app.notion.com/p/3ad947a88a00803a91f8ff66b8a5845a

## Working agreement

- PaperX is built feature-by-feature in complete chunks.
- After a feature is implemented and verified, create detailed beginner-friendly learning notes as a child page under the PaperX Notion root **only when Shubham explicitly asks for the notes**.
- Do not create or update Notion documentation automatically.
- Preserve unrelated worktree changes and keep each chunk focused.
- For future sessions, read this file and `graphify-out/GRAPH_REPORT.md` before changing the project. Use `graphify query` for architecture questions when `graphify-out/graph.json` exists.

## Product

PaperX is a beginner-focused Indian-market paper-trading and learning platform. It combines real Upstox market/company data with simulated trading using virtual money. It must never submit real orders or represent the virtual wallet as withdrawable cash.

Long-term direction: real charts and live data, delivery/intraday practice, pending orders, visual learning, market replay, learning rewards, a visual journal, and a grounded visual AI tutor.

## Current implementation state

- Chunks 0–2 are complete: stable foundation, PostgreSQL watchlists, and authenticated profile/settings/account-safety flows.
- The stock experience includes stable routes, real chart ranges and intraday intervals, shared batched price polling, company details, watchlist actions, and simulated BUY/SELL.
- Souji is a durable, PostgreSQL-backed tutor with isolated stock and portfolio conversations. Intent-aware context can load the current stock, the authenticated paper portfolio, or both; portfolio coaching uses deterministic allocation, concentration, P&L, cash, and data-coverage analytics.
- Trading is restricted to scheduled/provider-confirmed market hours. Buys use weighted average cost; partial sells consume FIFO lots and credit live execution proceeds.
- Existing Notion roadmap text may lag the implementation page; treat the code and the newest implementation note as the current truth.

## Architecture

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- PostgreSQL via `pg` and Drizzle ORM.
- NextAuth v4 with Google OAuth and database sessions.
- One server-only Upstox Analytics token provides read-only quotes, candles, search, fundamentals, and market status for all users.
- Browser subscribers are multiplexed into grouped five-second REST polling; Vercel Runtime Cache coalesces identical regional reads for short TTLs.
- `lightweight-charts` renders stock charts.
- GSAP, Three.js, React Three Fiber, and Drei power the marketing experience.

## Core boundaries

- `src/app`: pages and server API routes.
- `src/components`: landing, dashboard, stock-detail, and shared UI.
- `src/db`: Drizzle connection, schema, instruments, profile, AI persistence, paper-account lots, and watchlist services.
- `src/lib/upstox`: server analytics client, regional cache wrapper, types, and shared browser polling manager.
- `src/lib/trading/engine.ts`: server-authoritative paper market-order execution.
- `src/app/stocks/[instrumentKey]` and `src/components/stocks`: current stock experience.

## Data and security invariants

- User ownership always comes from the server session; never trust a browser-supplied user ID.
- The shared Analytics token and all secrets stay server-side; no market credential is stored per user.
- Instrument identity uses the exact Upstox `instrumentKey`, not display names.
- Money is stored as integer paise. Starting virtual capital is `100_000_000` paise (₹10,00,000).
- Only NSE/BSE cash equities are currently tradeable; indices are view-only.
- Trading price is fetched server-side before the database transaction.
- Wallet and holding changes plus order creation are atomic; wallet/holding rows are locked to prevent double-spend and overselling.
- Watchlists, settings, wallet, holdings, and orders are PostgreSQL-backed, not localStorage-backed.
- Missing market/provider data must show unavailable/stale/error UI—never invented values.
- Market discovery, search, quotes, charts, fundamentals, and stock pages are public read-only experiences.
- Google authentication is required for every personalized or mutating feature: Souji, watchlists, paper orders, portfolio, wallet, orders, and profile.

## Main user flows

1. Any visitor can browse the dashboard, search instruments, and open public stock charts and fundamentals without signing in.
2. PaperX market data comes through server routes backed by one read-only Analytics token.
3. A personalized action sends an anonymous visitor to Google sign-in and then returns them to the page where they started.
4. Google login creates/loads the NextAuth database identity and session.
5. The shared polling manager batches required instruments, pauses in hidden tabs, and retries with capped backoff.
6. Watchlist mutations use authenticated APIs with optimistic UI and rollback.
7. Paper BUY/SELL requires authentication and open market hours, then validates the instrument, quantity, segment, fresh server price, funds/shares, and updates PostgreSQL atomically.

## Database model

- Auth: `user`, `account`, `session`.
- Market reference: `instrument` with stable key, raw and short names, exchange/segment, ISIN, and logo metadata.
- Paper account: `wallet`, `holding`, FIFO `holding_lot`, `order`.
- Souji: `ai_conversation`, `ai_message`, `ai_usage`.
- Preferences: `user_setting`.
- Watchlist: `watchlist`, `watchlist_item`.

The next major money-model roadmap item is an immutable capital ledger; current orders support `FILLED` and `REJECTED` market-order outcomes.

## Verification standard for every feature

- Cover loading, empty, success, validation, unauthorized, provider failure, and responsive states relevant to the feature.
- Run `npx tsc --noEmit`, focused/full ESLint, and `npm run build` in proportion to the change.
- Test the real browser flow when UI or authentication behavior changes.
- Never test destructive account actions against the real user account.
- Update the requested Notion child page with purpose, concepts, architecture/data flow, files changed, security decisions, edge cases, verification evidence, limitations, and next steps.

## Notion hierarchy discovered

Direct children of the PaperX root include the roadmap, AWS deployment guide, account reset/deletion notes, AMO design, stock-logo integration, and Chunk 3 stock-detail plan. The roadmap contains completed Chunk 0–2 pages; Chunk 3 contains an implementation child page.

## Durable navigation artifacts

- `graphify-out/graph.json`: machine-queryable project knowledge graph.
- `graphify-out/GRAPH_REPORT.md`: architecture/community report.
- `graphify-out/graph.html`: interactive project graph.
- `PROJECT_NOTION_GUIDE.md`: older reboot walkthrough; useful history, but some sections predate the current stock-detail implementation.

