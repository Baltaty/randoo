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
| Video | WebRTC P2P — Cloudflare Realtime TURN/STUN (credentials from server, sent in `matched`), STUN-only fallback |
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
| `app/api/cockpit/live/route.ts` | Live metrics proxied from the server `/stats` (polled every 5 s) |
| `app/api/cockpit/stats/route.ts` | Period stats via the `cockpit_stats()` Postgres function (+ previous period) |
| `app/api/cockpit/visits/route.ts` | Paginated recent visits (IPs masked) |
| `lib/cockpit-auth.ts` | Signed, expiring cockpit session cookie + login rate limit |
| `lib/cockpit-data.ts` | Europe/Paris time ranges, IP masking |
| `lib/webrtc.ts` | WebRTCManager class |
| `lib/socket.ts` | Socket.io singleton (uses `NEXT_PUBLIC_SERVER_URL`) |
| `lib/i18n.ts` | EN/FR translations |
| `lib/supabase-admin.ts` | Server-only Supabase client (service role) |
| `middleware.ts` | Auth guard for `/settings`, `/boost` — redirects to `/auth?next=` |

### Server (`server/`)
| File | Role |
|---|---|
| `src/index.ts` | Express + Socket.io bootstrap, `/health` (online count + `turn`: ok/not_configured/error/pending), `/stats` endpoints, CORS |
| `src/matchmaking.ts` | Queue, pairing, WebRTC signaling relay, interest/gender/country logic |
| `src/supabase.ts` | Supabase REST helpers (boost verification, connection_logs, reports) |
| `src/turn.ts` | Cloudflare TURN credentials (cached, refreshed server-side) |

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
CLOUDFLARE_TURN_KEY_ID      # Cloudflare Realtime TURN key — optional, STUN only if unset
CLOUDFLARE_TURN_API_TOKEN
```

---

## Supabase tables

| Table | Purpose |
|---|---|
| `boost_sessions` | One row per completed Stripe purchase — `plan`, `session_token`, `want_gender`, `expires_at`, `stripe_session_id`, `amount_cents` (paid) |
| `connection_logs` | One row per visit (socket) — `ts`, `ip`, `country`, `gender`, `interests`, `duration` (total chat s), `matches`, referrer/device. Before 2026-11-09: one row per join |
| `matches` | One row per conversation — `room_id`, `started_at`, `duration`, `connected`, `relay`, `setup_ms`, `wait_ms_a/b` |
| `reports` | User reports — `ts`, `reporter_ip`, `room_id`, `reason` |

Auth users have `gender` stored in `user_metadata.gender` — this is the source of truth, not localStorage.

---

## Socket events

```
Client → Server   join({ sessionId, gender, wantGender?, boostToken?, interests[], countries[], maxWait, privacyMode, isBot, referrer, device_type, os, screen })
                    → always closes the socket's current room first (peer gets peer-disconnected)
Server → Client   waiting
Server → Client   matched({ roomId, initiator, peerCountry?, commonInterests[], iceServers? })
Client → Server   offer / answer / ice-candidate  { roomId, … }  (relayed only if sender is in roomId;
                    relayed payload echoes roomId so clients drop messages from an old match)
Client → Server   next({ roomId })        (ignored if roomId is not the sender's current room)
Client → Server   report({ roomId, reason })  (reason ∈ nudity|spam|harassment|underage|other, once per room)
Server → Client   peer-disconnected({ roomId })
Client → Server   call-status({ roomId, connected, relay?, setupMs? })  (WebRTC outcome — cockpit stats)
Server → Client   online-count(n)         (throttled: at most every 2 s)
```

---

## Boost system

- **Plans:** $2.99 / 10 min · $7.99 / 30 min · $14.99 / 1 h (Stripe live, USD)
- **Flow:** `/boost` → POST `/api/create-checkout` → Stripe Checkout → webhook → `boost_sessions` → `/boost/success` polls → localStorage → `/chat`
- **localStorage key:** `randoo-boost` → `{ token, wantGender, expiresAt }`
- The **strict** `wantGender` filter is only unlocked with a valid, non-expired boost token verified server-side against Supabase (without boost it is a preference relaxed after `maxWait`)

---

## Matchmaking logic

- **Gender:** declarative — user declares their own gender at signup
- **wantGender:** strict filter only with a valid boost token (verified server-side, re-checked against `expires_at` while queued). Without boost, the requested gender is a free *preference*, enforced for `maxWait` seconds then relaxed
- **Country:** IP-detected via `geoip-lite` + `x-forwarded-for`; soft filter — relaxed after `maxWait` seconds (the waiting user stays relaxed for newcomers too)
- **Interests:** `string[]` sorted by `interestScore` (common interests = higher priority); never blocks a match

---

## Cockpit (`/cockpit`)

Internal dashboard (French, Europe/Paris), protected by `COCKPIT_PASSWORD` → signed session cookie `cockpit_session`.
Requires `supabase/2026-11-09_cockpit.sql` (table `matches`, columns, `cockpit_stats()` function) — shows a banner if missing.
- **En direct** (5 s, from server memory): online, queue, active chats, median wait, % calls connected, % via TURN, online sparkline (1 h)
- **Period** selector (Aujourd'hui / 7 j / 30 j / Tout) with deltas vs previous period:
  business (revenue from Stripe amounts, boosts, buyers, signups, paying accounts), call quality, audience
  (countries, sources, gender, devices, OS, interests, returning = IP seen on ≥ 2 days), moderation (reports)
- Recent visits (paginated, masked IPs), lazy 3D globe
- Charts are dependency-free SVG in `app/cockpit/charts.tsx`

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

- TURN via Cloudflare (1 000 GB/month free, then $0.05/GB) — if the env vars are missing or Cloudflare is down, clients fall back to STUN only
- In-memory queue and rooms on Railway — resets on redeploy
- `connection_logs` has no `user_id` — returning visitor tracking is IP-based only
- `listUsers` fetches up to 1000 users — will need pagination when scaling
- Stripe is live mode only — use test keys locally if needed
