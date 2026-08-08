# PaperX

PaperX is a paper-trading platform built with Next.js, PostgreSQL, Drizzle,
NextAuth, and Upstox market data.

## Local setup

1. Copy `.env.example` to `.env` and add your credentials.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the HTTPS development server:

   ```bash
   npm run dev
   ```

4. Open [https://localhost:3000](https://localhost:3000).

The local server uses HTTPS so its Google OAuth origin matches production-like
secure callback behavior. Your browser may ask you to trust the locally
generated development certificate.

## OAuth configuration

Google Cloud OAuth client:

- Authorized JavaScript origin: `https://localhost:3000`
- Authorized redirect URI:
  `https://localhost:3000/api/auth/callback/google`

Upstox does not use per-user OAuth. Add the read-only Analytics token to the
server environment as `UPSTOX_ANALYTICS_TOKEN`. Never prefix it with
`NEXT_PUBLIC_` or expose it to browser code.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

## Database

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```
