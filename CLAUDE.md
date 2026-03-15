# Randoo — CLAUDE.md

## Project overview

Randoo is a random video chat platform (Omegle/Thundr alternative) at **https://randoo.fun**.
Monorepo with two deployable units: a Next.js frontend and a Node.js/Socket.io signaling server.

---

## Repository structure

```
/
├── web/          → Next.js 16 app (Vercel)
├── server/       → Node.js + Socket.io (Railway)
├── supabase/     → SQL migrations
└── bots/         → internal tooling
```

---

## Dev commands

```bash
cd server && npm run dev   # :3001
cd web && npm run dev      # :3000
```

**Always run git commands from the repo root `/Users/tuzzo/Documents/claude-projects/p2pkonect/`, never from `web/` or `server/`.**

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Realtime | Socket.io (client in `web/lib/socket.ts`) |
| Video | WebRTC P2P — Google STUN, no TURN |
| Auth | Supabase (email/password) |
| DB | Supabase (Postgres) |
| Payments | Stripe (live mode, USD) |
| Frontend deploy | Vercel |
| Server deploy | Railway |

---

## Design system

- **Primary (accent):** `#ffd53a` (yellow)
- **Secondary:** `#ff66b3` (pink)
- **Tertiary:** `#3aff43` (green)
- **Alternate:** `#7c61ff` (purple)
- **Background:** `#0a0a0a`, **Card:** `#141414`, **Border:** `#272727`
- **Success:** `#3beea8`, **Error:** `#f02031`
- CSS vars: `--theme-bg`, `--theme-text`, `--theme-accent`, `--theme-surface`, `--theme-border`, `--theme-btn-fg`, `--theme-text-muted`

Always use CSS vars for theming — never hardcode colors in components.

---

## Key files

### Frontend (`web/`)
| File | Role |
|---|---|
| `app/layout.tsx` | Root layout — Meta Pixel, Contentsquare, fonts, providers |
| `app/page.tsx` | Landing — interests chip input, START button, online count |
| `app/chat/page.tsx` | Video chat — WebRTC, socket, boost countdown, match toast, report button |
| `app/boost/page.tsx` | Boost purchase UI (3 plans) |
| `app/boost/success/page.tsx` | Polls boost activation, saves to localStorage, redirects to chat |
| `app/auth/page.tsx` | Login/signup — gender selector at signup, `?next=` redirect |
| `app/settings/page.tsx` | Profile, preferences, account deletion |
| `app/cockpit/` | Internal admin dashboard (password-protected) |
| `app/api/create-checkout/route.ts` | Creates Stripe Checkout session |
| `app/api/webhook/route.ts` | Stripe webhook → inserts `boost_sessions` |
| `app/api/boost-status/route.ts` | Polls `boost_sessions` by `stripe_session_id` |
| `app/api/account/route.ts` | DELETE: wipes user data + Supabase auth user |
| `app/api/cockpit/stats/route.ts` | Aggregates live + Supabase stats for cockpit |
| `lib/webrtc.ts` | WebRTCManager class |
| `lib/socket.ts` | Socket.io singleton (uses `NEXT_PUBLIC_SERVER_URL`) |
| `lib/i18n.ts` | EN/FR translations |
| `lib/supabase-admin.ts` | Server-only Supabase client (service role) |
| `middleware.ts` | Auth guard for `/settings`, `/boost` — redirects to `/auth?next=` |

### Server (`server/`)
| File | Role |
|---|---|
| `src/index.ts` | Express + Socket.io bootstrap, `/health`, `/stats` endpoints, CORS |
| `src/matchmaking.ts` | Queue, pairing, WebRTC signaling relay, interest/gender/country logic |

---

## Environment variables

### Vercel (web)
```
NEXT_PUBLIC_SERVER_URL=https://randoo-production.up.railway.app
SERVER_URL=https://randoo-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY          # sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # pk_live_...
STRIPE_WEBHOOK_SECRET      # whsec_...
COCKPIT_PASSWORD
STATS_SECRET
```

### Railway (server)
```
PORT                        # set automatically by Railway
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS=https://randoo.fun,https://www.randoo.fun,https://randoo-psi.vercel.app,http://localhost:3000
STATS_SECRET
```

---

## Supabase tables

| Table | Purpose |
|---|---|
| `boost_sessions` | One row per completed Stripe purchase — `plan`, `session_token`, `want_gender`, `expires_at`, `stripe_session_id` |
| `connection_logs` | One row per user connection — `ts`, `ip`, `country`, `gender`, `interests`, `duration` |
| `reports` | User reports — `ts`, `reporter_ip`, `room_id`, `reason` |

Auth users have `gender` stored in `user_metadata.gender` — this is the source of truth, not localStorage.

---

## Socket events

```
Client → Server   join(sessionId, gender, wantGender?, boostToken?, interests[], countries[])
Server → Client   waiting
Server → Client   matched(roomId, commonInterests[])
Client → Server   offer / answer / ice-candidate  (WebRTC signaling relay)
Client → Server   next
Server → Client   peer-disconnected
Server → Client   online-count(n)
```

---

## Boost system

- **Plans:** $2.99 / 10 min · $7.99 / 30 min · $14.99 / 1 h (Stripe live, USD)
- **Flow:** `/boost` → POST `/api/create-checkout` → Stripe Checkout → webhook → `boost_sessions` → `/boost/success` polls → localStorage → `/chat`
- **localStorage key:** `randoo-boost` → `{ token, wantGender, expiresAt }`
- `wantGender` (gender filter) is only unlocked with a valid, non-expired boost token verified server-side against Supabase

---

## Matchmaking logic

- **Gender:** declarative — user declares their own gender at signup
- **wantGender:** only active with valid boost token (verified server-side)
- **Country:** IP-detected via `geoip-lite` + `x-forwarded-for`; soft filter — relaxed after `maxWait` seconds
- **Interests:** `string[]` sorted by `interestScore` (common interests = higher priority); never blocks a match

---

## Cockpit (`/cockpit`)

Password-protected internal dashboard. Shows:
- Live: online users, queue, active chats, avg chat duration
- Today / This week / This month / All time: revenue, boosts, signups
- Signup → boost conversion rate
- Boost plan breakdown (10min / 30min / 1h)
- Top countries, gender split, top interests (computed from last 200 connection_log entries)
- Returning visitors table (all-time, IP-based, ≥ 2 sessions)
- Live globe (WebGL, `react-globe.gl`)
- Recent connections table

---

## Auth & routing

- `/settings` and `/boost` are protected by `middleware.ts` — redirects to `/auth?next=<path>`
- `/auth` redirects already-logged-in users to `?next=` param or `/`
- `/cockpit` is protected by a password cookie (`cockpit_pass`), independent of Supabase auth

---

## Analytics & tracking

- **Meta Pixel** (ID: `471242474063298`) — in `layout.tsx`, tracks `PageView`, `CompleteRegistration` (auth), `Purchase` (boost/success)
- **Contentsquare** — script in `<head>` of `layout.tsx`

---

## Constraints & known limitations

- No TURN server — WebRTC may fail on restrictive networks (corporate, some mobile)
- In-memory queue and rooms on Railway — resets on redeploy
- `connection_logs` has no `user_id` — returning visitor tracking is IP-based only
- `listUsers` fetches up to 1000 users — will need pagination when scaling
- Stripe is live mode only — use test keys locally if needed
