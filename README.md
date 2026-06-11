# WINTERPROOF26 Leaderboard — Vercel Edition

A modern, fast, mobile-first leaderboard for the G3 Fitness Blaxland WINTERPROOF26
challenge. It reads live data from your existing Google Spreadsheet (read-only) and
preserves every behaviour of the Apps Script version:

- **Scoreboard tab** — team totals + 4 metric cards from the 🏆 Scoreboard sheet
  (stops at the POINTS SYSTEM section), points split bar, per-team THIS WEEK lists,
  points system card, live countdown, Trivia Night banner
- **This Week tab** — full roster always visible, points accumulate Mon→Sun from
  the Combined Data sheet, resets every Monday (Sydney time), ALL/ORANGE/BLACK
  filters, top-3 podium, tied-rank handling
- Overall individual totals stay hidden until Trivia Night 🏆
- Auto-refresh every 2 minutes; server caches Sheets reads for 60 seconds

Your Spreadsheet, Google Forms, Code.gs and the old Apps Script deployment are
**not modified** — they keep working in parallel.

---

## Setup (one time, ~25 minutes, all free)

### Part A — Create a Google service account (the "robot reader")

1. Go to https://console.cloud.google.com and sign in with your **personal Gmail**
   (the account that owns the spreadsheet copy).
2. Top bar → project dropdown → **New Project** → name it `winterproof26` → Create.
3. With the project selected, search for **"Google Sheets API"** → **Enable**.
4. Menu → **IAM & Admin → Service Accounts** → **Create service account**.
   - Name: `winterproof26-reader` → Create and continue → skip the optional steps → Done.
5. Click the new service account → **Keys** tab → **Add key → Create new key → JSON**
   → a `.json` file downloads. Keep it private — it's a password.
6. Open the JSON file in a text editor. You need two values:
   - `client_email` (looks like `winterproof26-reader@winterproof26.iam.gserviceaccount.com`)
   - `private_key` (the long `-----BEGIN PRIVATE KEY-----...` block)

### Part B — Share the sheet with the robot

1. Open your spreadsheet → **Share**.
2. Paste the `client_email` address → role **Viewer** → Send (untick "Notify people").

That's the only change to your existing setup, and it's read-only.

### Part C — Deploy to Vercel

1. Put this project folder on GitHub:
   - Create a free account at https://github.com → New repository → `winterproof26`.
   - Upload all files in this folder (or use git if you're comfortable).
2. Go to https://vercel.com → sign up with GitHub → **Add New → Project** →
   import the `winterproof26` repo.
3. Before clicking Deploy, open **Environment Variables** and add three:

   | Name | Value |
   |---|---|
   | `SHEET_ID` | `1HBttjTig_uBa6ifPoqU1MLLTrz41k5A-eUOiuDPK-NM` |
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` from the JSON |
   | `GOOGLE_PRIVATE_KEY` | the `private_key` from the JSON — paste the whole thing, including the BEGIN/END lines and the `\n` characters |

4. Click **Deploy**. ~1 minute later you'll get a URL like
   `https://winterproof26.vercel.app` — that's the link to share with members.

### Optional — custom domain

Vercel project → Settings → Domains → add e.g. `winterproof26.com.au`
(buy the domain anywhere, ~$15/yr, and point it per Vercel's instructions).

---

## Local development (optional)

```bash
cp .env.example .env.local   # then fill in the three values
npm install
npm run dev                  # http://localhost:3000
```

## How updates work from now on

- **Scores/data** — nothing to do. Edit the sheet / members submit forms; the site
  refreshes itself (60s server cache + 2-min page auto-refresh).
- **Code/design changes** — push to GitHub; Vercel redeploys automatically.
  No more "Manage deployments → New version" dance.

## Maintenance notes

- Free tiers used: Google Cloud (Sheets API reads are far below quota at one
  request/minute), Vercel Hobby, GitHub.
- If the API key is ever exposed, delete the key in Google Cloud (Service account →
  Keys) and create a new one, then update the Vercel env var.
- The architecture is future-ready: the frontend only talks to `/api/scoreboard`.
  Migrating to Postgres/Supabase later means rewriting only `lib/sheets.ts`.
