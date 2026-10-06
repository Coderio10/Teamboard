# TeamBoard

A collaborative whiteboard tool for teams, built on [Excalidraw](https://excalidraw.com). Create, sketch, and present boards with your team — all in the browser, no install needed.

**Live:** [chazonteamboard.vercel.app](https://chazonteamboard.vercel.app)

---

## Features

- **Google sign-in** — one click, no passwords, no magic links
- **Invite-only access** — team membership is enforced via a Supabase allowlist; unknown Google accounts are blocked at the door
- **Board management** — create, rename, delete, and search boards from a clean dashboard
- **Full Excalidraw canvas** — draw, write, add shapes, images, and frames
- **Auto-save** — changes sync to Supabase automatically as you draw
- **Presentation mode** — use Excalidraw frames as slides, navigate with arrow keys, goes fullscreen
- **Export** — download any board as PNG, SVG, or `.excalidraw` file
- **Import** — drag in an existing `.excalidraw` file to pick up where you left off
- **30-day sessions** — stay signed in on your device, auto-signed out when the session expires
- **Dark canvas by default** — the drawing surface opens in dark mode; toggle to light anytime

---

## Tech stack

| Layer | What |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite |
| Drawing engine | `@excalidraw/excalidraw` |
| Backend / DB | Supabase (Postgres + Auth) |
| Auth | Supabase OAuth → Google |
| Routing | React Router v7 |
| Deployment | Vercel |

---

## Project structure

```
src/
  features/
    auth/
      AuthProvider.tsx      # Session context + 30-day expiry enforcement
      Login.tsx             # Google OAuth sign-in screen
      ProtectedRoute.tsx    # Auth guard + team-membership check (RPC)
    boards/
      BoardList.tsx         # Dashboard: grid of boards, search, create, import
      BoardEditor.tsx       # Full-screen Excalidraw editor with auto-save & export
  lib/
    supabase.ts             # Supabase client (reads VITE_ env vars)
  styles/
    tokens.css              # Design tokens: colors, typography, spacing, radii
  main.tsx                  # App entry point + routing
```

---

## Database

TeamBoard uses two Supabase objects you create yourself:

**`boards` table**
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key, default `gen_random_uuid()` |
| `title` | `text` | board name |
| `scene` | `jsonb` | Excalidraw elements + files |
| `thumbnail` | `text` | base64 PNG preview |
| `created_by` | `uuid` | references `auth.users` |
| `updated_at` | `timestamptz` | updated on every save |

**`team_members` table** — your access allowlist
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `email` | `text` | Google account email to allow |

**`is_team_member` RPC** — called by `ProtectedRoute` after sign-in. Should return `true` if `auth.uid()` belongs to a row in `team_members`, `false` otherwise. The app never calls this with arguments; it reads the caller identity from the JWT.

---

## Environment variables

Create a `.env` file at the project root (never commit it):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Only the anon key is used. The service role key never touches the frontend.

---

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Other commands:

```bash
npm run build    # type-check + production build
npm run preview  # serve the production build locally
npm run lint     # ESLint
```

---

## Deployment

The repo deploys to Vercel automatically on push. `vercel.json` rewrites all routes to `index.html` so React Router handles client-side navigation correctly.

Make sure your Supabase project has:
1. Google provider enabled under **Authentication → Providers**
2. `https://chazonteamboard.vercel.app` added to **Authentication → URL Configuration → Redirect URLs**

---

## Access control

Sign-in is open to any Google account, but the app checks team membership immediately after. If the signed-in email isn't in `team_members`, the user sees a "You're not on the team yet" screen with a sign-out option. Add a row to `team_members` to grant access.
