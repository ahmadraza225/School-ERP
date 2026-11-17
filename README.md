# Kid School System — Fee Management

A simple web app for fee collection across the **Boys Branch** and **Girls Branch** campuses.
It runs in Chrome. All office PCs share one cloud database (Supabase), so it also works from home.

## What it does (version 1)
- **Students**: add/edit, or import from Excel/CSV. A student can have a special monthly fee.
- **Classes & fees**: one monthly tuition fee per class (same for both campuses).
- **Generate challans**: one click per month, per campus or both. Unpaid months carry forward as
  "Previous dues" with their late fine.
- **Print challans**: A4 landscape, 2 copies (school + parent), with a QR code and fee history.
- **Collect fee** at the counter: search by challan no, admission no, name or phone. Full payment
  only. Prints a receipt.
- **Late fine**: Rs 200 per day after the due date (10th), capped at Rs 2,000 per month. It keeps
  growing on unpaid months until paid. All three numbers are editable in Settings.
- **Defaulters** and **payments report** (by date, campus, staff), printable or exported to Excel.

| Role | Can do |
|---|---|
| Owner | Everything, plus: waive fines, void a wrong payment, settings, user roles |
| Principal | Everything except settings, waivers, voids; can enter a back-dated payment |
| Accountant | Students, challans, collect fee (today's date only), reports |

## One-time setup (about 20 minutes)
1. Create a free account at <https://supabase.com> → **New project** (region: closest to Pakistan, e.g. Mumbai/Singapore).
2. In the project: **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), press **Run**.
3. **Authentication → Users → Add user**: create a login for the owner (tick "Auto confirm").
4. Make that user the owner. In SQL Editor run (with the real email):
   ```sql
   update profiles set role = 'owner', full_name = 'Owner' where email = 'owner@example.com';
   ```
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
6. Host the app for free on Netlify or Vercel. Import this GitHub repo with:
   - Base directory: `app`
   - Build command: `npm run build`
   - Publish directory: `app/dist`
   - Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from step 5)
7. Open the site, sign in as the owner. Go to **Classes & Fees** and enter fees, then **Settings** for
   campus address/phone. Add other staff logins in Supabase (step 3); they show up in Settings → Users
   where the owner gives them a role.

## Monthly routine
1. Start of month: **Generate Challans** → **Challans** → *Print all*.
2. Counter: **Collect Fee** → search → *Receive* → print receipt.
3. After the due date: **Defaulters**.

## Running locally (developers)
```bash
cd app && cp .env.example .env   # fill in the two keys
npm install && npm run dev
```

## Notes for later changes
- Money logic (fines, carry-forward, payments) lives in database functions in `supabase/schema.sql`,
  so every PC calculates the same amounts.
- Built to extend: `family_code` on students (family challans), `head` on dues (admission/annual/exam
  fees), and the role system (more roles).
- Backups: Supabase free tier has no automatic daily backups you can restore yourself; export
  regularly (Database → Backups on paid plan, or the Excel exports in the app).
