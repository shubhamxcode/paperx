# PaperX Project Guide (Full Reboot Notes)

This document is a full technical walkthrough of your `paperx` project so you can restart quickly after a long break.

---

## 1) What This Project Is

`PaperX` is a Next.js app for **paper trading practice** (no real orders), with:
- Google login using NextAuth
- PostgreSQL + Drizzle for user/session/token storage
- Upstox OAuth integration for market-data access
- REST + WebSocket market data display on dashboard
- A marketing landing page + candlestick pattern mini-game

Core idea: users sign in, connect Upstox, then view live quotes in a simulated environment.

---

## 2) Tech Stack

- Framework: `Next.js 16` (App Router)
- Language: `TypeScript`
- UI: React + Tailwind + many inline style objects
- Auth: `next-auth` + Google Provider + Drizzle adapter
- Database: PostgreSQL (`pg`) + `drizzle-orm`
- Data provider: Upstox (OAuth + market quote APIs + websocket auth endpoint)
- Notifications: `react-hot-toast`
- Icons: `lucide-react`

---

## 3) Folder & Architecture Map

### High-level map

- `src/app/*` -> pages + API routes
- `src/components/*` -> dashboard + landing UI components
- `src/db/*` -> DB connection, schema, token helpers
- `src/lib/upstox/ *` -> Upstox client + type definitions
- `src/types/*` -> type augmentation (NextAuth session user id)
- root config files -> Next, TS, ESLint, Drizzle, PostCSS

---

## 4) End-to-End Functional Flows (Scratch to 100)
 
## Flow A: First visit (Landing)

1. User opens `/`.
2. `src/app/page.tsx` checks `useSession()`.
3. If logged in -> redirects to `/dashboard`.
4. If not logged in -> shows landing sections:
   - `Navigation`
   - `Hero`
   - `Ticker`
   - `SimulationDemo`
   - `Features`
   - `CallToAction`
   - `Footer`

---

## Flow B: Authentication (Google)

1. User goes to `/login` (`src/app/login/page.tsx`).
2. Clicks "Continue with Google" -> `signIn("google", { callbackUrl: "/" })`.
3. NextAuth route `src/app/api/auth/[...nextauth]/route.ts` handles OAuth.
4. On success:
   - Drizzle adapter creates/updates user, account, session rows.
   - Session callback adds `session.user.id`.
5. User returns to `/` and is auto-redirected to `/dashboard`.

---

## Flow C: Dashboard access control

1. `src/app/dashboard/page.tsx` checks session status.
2. If unauthenticated -> redirect to `/login`.
3. If authenticated -> dashboard UI loads.
4. It checks `/api/upstox/status` to decide whether to show:
   - Upstox connection instructions
   - OR live market watch area

---

## Flow D: Connect Upstox (OAuth)

1. User clicks "Connect Upstox" in `src/components/UpstoxConnect.tsx`.
2. Browser goes to `/api/auth/upstox/authorize`.
3. Route validates session, creates Upstox auth URL via `UpstoxClient.getAuthorizationUrl()`.
4. User is redirected to Upstox auth page.
5. Upstox redirects back to `/api/auth/upstox/callback?code=...`.
6. Callback route:
   - validates session and code
   - calls `UpstoxClient.getAccessToken(code)`
   - stores token in DB via `saveUpstoxToken(...)`
   - redirects to `/dashboard?upstox_connected=true`
7. Dashboard reads query param, shows success toast, cleans URL.

---

## Flow E: Fetch quotes + live websocket updates

1. `MarketWatch` mounts (`src/components/MarketWatch.tsx`).
2. Calls `/api/upstox/market/quotes` with default instrument keys.
3. API route builds `UpstoxClient` for current user and calls `getMarketQuotes`.
4. `UpstoxClient` ensures token validity:
   - reads DB token
   - refreshes if expiry near
5. REST quote response is transformed and rendered in list cards.
6. In parallel, client requests `/api/upstox/websocket/auth`.
7. Route returns `authorizedRedirectUri` built from token.
8. Browser opens WebSocket, sends subscription message, updates market rows in real-time.

---

## Flow F: Disconnect Upstox

1. User clicks Disconnect in `UpstoxConnect`.
2. Calls `/api/auth/upstox/disconnect` (POST).
3. Route deletes `upstox_token` row for user.
4. UI reverts to disconnected state.

---

## 5) Database Layer

## File: `src/db/index.ts`
- Creates PostgreSQL pool from `DATABASE_URL`.
- Exports Drizzle client `db`.

## File: `src/db/schema.ts`
Defines tables:
- `user` (id, name, email, image, etc.)
- `account` (OAuth account links)
- `session` (database session strategy)
- `verificationToken`
- `authenticator` (WebAuthn-support table, currently not used in UI flow)
- `upstox_token` (one token row per user):
  - `accessToken`
  - `refreshToken`
  - `expireAt`
  - timestamps

## File: `src/db/upstox.ts`
Helper functions:
- `getUpstoxToken(userId)`
- `saveUpstoxToken(userId, token)` (insert or update)
- `deleteUpstoxToken(userId)`
- `isTokenExpired(expiresAt)`

---

## 6) Upstox Integration Layer

## File: `src/lib/upstox/client.ts`
`UpstoxClient` class responsibilities:
- build Upstox authorization URL
- exchange auth code -> token
- refresh access token
- automatically get valid access token before any API request
- make authenticated requests
- fetch:
  - market quotes
  - OHLC
  - LTP
  - websocket authorization URL

Token refresh logic:
- If token expires within next 5 minutes, refresh automatically.
- If refresh fails, user must reconnect account.

## File: `src/lib/upstox/types.ts`
Type contracts for:
- token responses
- quote/ohlc/ltp
- websocket feed shape
- error structure

---

## 7) API Routes (Server Endpoints)

## Auth routes

- `src/app/api/auth/[...nextauth]/route.ts`
  - NextAuth config
  - Google provider
  - Drizzle adapter
  - database session strategy
  - adds `user.id` to session

- `src/app/api/auth/upstox/authorize/route.ts`
  - starts Upstox OAuth

- `src/app/api/auth/upstox/callback/route.ts`
  - handles code exchange + token storage

- `src/app/api/auth/upstox/disconnect/route.ts`
  - removes user Upstox token

## Market routes

- `src/app/api/upstox/status/route.ts`
  - checks if user has stored token

- `src/app/api/upstox/market/quotes/route.ts`
  - returns current quotes for requested instruments

- `src/app/api/upstox/websocket/auth/route.ts`
  - returns websocket authorized URL data

---

## 8) UI Layer

## App shell

- `src/app/layout.tsx`
  - font setup (Archivo + Space Mono)
  - global metadata
  - wraps app in `Providers`

- `src/app/provider.tsx`
  - wraps with `SessionProvider`

- `src/app/globals.css`
  - full global design system + responsive classes
  - custom classes for landing layout blocks

## Landing page components (`src/components/landing/*`)

- `Navigation.tsx` -> top nav + mobile hamburger
- `Hero.tsx` -> main headline + CTA
- `Ticker.tsx` -> scrolling metrics strip
- `SimulationDemo.tsx` -> interactive candlestick pattern game
- `Features.tsx` -> feature and stat sections
- `CallToAction.tsx` -> signup CTA section
- `Footer.tsx` -> final links/info
- `Header.tsx` -> alternate header component (currently not used in `src/app/page.tsx`)

## Auth/Dashboard components

- `src/components/UpstoxConnect.tsx`
  - checks connection status
  - connect / disconnect actions

- `src/components/MarketWatch.tsx`
  - initial quote fetch
  - opens websocket stream
  - renders live symbol cards and status badge

## Pages

- `src/app/page.tsx` -> landing + redirect when already logged in
- `src/app/login/page.tsx` -> Google sign-in page
- `src/app/dashboard/page.tsx` -> protected dashboard with Upstox + MarketWatch

---

## 9) Config & Tooling Files

- `package.json`
  - scripts: `dev`, `build`, `start`, `lint`, drizzle commands
- `drizzle.config.ts`
  - points schema + output + DB URL
- `next.config.ts`
  - enables React compiler
- `tsconfig.json`
  - strict mode + `@/*` alias
- `eslint.config.mjs`
  - Next core-web-vitals + TS lint setup
- `postcss.config.mjs`
  - tailwind postcss plugin
- `.gitignore`
  - standard Next/node ignores + `.env*`

---

## 10) Utility & Support Files

- `src/lib/utils.ts`
  - custom `cn()` helper (clsx + basic merge behavior)

- `src/types/next-auth.d.ts`
  - augments NextAuth `Session` and `User` to include `id`

- `check-upstox.ts`
  - debug script to inspect DB token + test market quote fetch
  - loads `.env` manually before imports

- `.cursor/plans/real-time_indian_stock_data_754ed298.plan.md`
  - planning document (many checklist items still marked pending)
  - acts as implementation intent/reference, not runtime code

---

## 11) Environment Variables Required

Minimum required for app to run correctly:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `UPSTOX_API_KEY`
- `UPSTOX_API_SECRET`
- `UPSTOX_REDIRECT_URI` (example: `http://localhost:3000/api/auth/upstox/callback`)

---

## 12) Current State: What Works vs What Is Pending

## Implemented
- Google auth with persistent DB sessions
- protected dashboard route behavior
- Upstox OAuth connect/disconnect
- token storage and refresh path
- quote fetch endpoint + dashboard quote rendering
- browser websocket subscription and live row updates
- rich landing page + pattern-learning simulation

## Not fully built yet (based on code + plan notes)
- actual buy/sell paper order engine
- portfolio tracking persistence
- P&L history and analytics engine
- advanced candlestick charting integration (tradingview library is in deps but no dedicated chart module currently wired)
- configurable watchlists and broader instrument selector

---

## 13) Important Observations / Risks

- `src/app/login/page.tsx` has a `console.log` debug line.
- `src/components/landing/Header.tsx` is present but unused.
- Several dependencies exist but are not yet actively used in visible runtime paths (`@supabase/supabase-js`, `bcryptjs`, `nodemailer`, etc.).
- Landing components reference `/Logo.png`, but this file was not visible in the listed `public` assets snapshot (verify this asset exists in `public`).
- In `SimulationDemo`, displayed profit/loss amount after answering is randomly recalculated for text display, so shown number can differ from balance-change amount (cosmetic consistency issue).

---

## 14) Quick Start Commands (When You Resume)

```bash
npm install
npm run db:push
npm run dev
```

Useful DB commands:

```bash
npm run db:studio
npm run db:generate
npm run db:migrate
```

---

## 15) Suggested Restart Plan (Practical)

1. Confirm `.env` completeness and correct Upstox redirect URL.
2. Run app + verify login flow first.
3. Verify Upstox connect/disconnect and status endpoint.
4. Verify live quote fetch and websocket updates during market hours.
5. Implement paper-trade engine (orders table + positions + virtual wallet ledger).
6. Add portfolio widgets to dashboard placeholders.
7. Add tests for auth/api routes and token refresh behavior.

---

If you want, next I can create a **Phase-wise action roadmap** (`Week 1/2/3`) in another markdown file so you can resume development step-by-step without confusion.
