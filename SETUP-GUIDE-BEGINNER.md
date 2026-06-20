# Beginner Setup Guide — No Terminal, No Coding

> ## 🔄 Updating from the first version? Read this box first.
>
> This version adds logins, inventory auto-deduction, payroll/OT, expenses,
> HR profiles, and photo/signature/document uploads. To update your live app:
>
> 1. **Replace your files on GitHub** with the ones in this new zip (drag & drop,
>    overwrite when asked, then Commit). Vercel will redeploy automatically.
> 2. **Add one new environment variable in Vercel** → Project → Settings →
>    Environment Variables:
>    - `AUTH_SECRET` = any long random string (40+ characters). This signs login
>      sessions. Keep it private. *(Without it, logins won't work.)*
>    - *(Optional)* `DRIVE_FOLDER_ID` if you want uploads in a specific Drive folder.
> 3. **Enable the Google Drive API** in your Google Cloud project (same place you
>    enabled the Sheets API). Photos, signatures, and document uploads need it.
>    Go to console.cloud.google.com → APIs & Services → Library → search
>    "Google Drive API" → Enable.
> 4. After it redeploys, open **`/setup`** on your site and click
>    **Initialize my sheet** once more. This adds the new tabs (Users, Recipes,
>    StockMovements, Settings, Queue, and the expanded columns). Your existing data stays.
> 5. Go to **`/login`** and sign in. Default logins are created for you:
>    - Admin — `admin` / `admin123`
>    - Cashier — `cashier` / `cashier123`
>    - Attendant — `marco` / `marco123`
>    **Change these immediately** in the Admin → Users tab.
>
> A note on security: these logins are operational access control (good for daily
> staff use), not bank-grade. Don't store anything highly sensitive, and pick a
> strong `AUTH_SECRET`.

---

This guide gets your carwash app online using only your web browser. You will
**not** install anything on your computer and you will **not** type any commands.

The four stages:

1. Put the code on **GitHub** (drag & drop in the browser)
2. Set up **Google** (so the app can read/write your data)
3. Deploy on **Vercel** (puts the app online for free)
4. Click **one button** in the app to build your spreadsheet

Take your time. If a step fails, the app's Setup page will tell you in plain
language what to fix.

You will need a free account on three sites (sign up with the same email to keep
it simple): GitHub, Google, and Vercel.

---

## STAGE 1 — Put the code on GitHub

GitHub stores your code. Vercel reads from it.

1. Go to **github.com** and sign up / log in.
2. Click the **+** in the top-right → **New repository**.
3. Name it (e.g. `carwash-pos`). Leave everything else default. Click **Create repository**.
4. On the next screen, click the link **"uploading an existing file"**
   (it's in the line "…or push an existing repository… or **uploading an existing file**").
5. **Unzip** the template file on your computer first (right-click → Extract / Unzip).
   You'll get a folder called `carwash-pos`.
6. Open that folder, select **everything inside it** (all the files and folders —
   `app`, `lib`, `package.json`, etc.), and **drag them into the GitHub upload box**.
   - Important: drag the *contents*, not the outer folder. GitHub should show
     `app/…`, `lib/…`, `package.json`, and so on.
7. Scroll down, click **Commit changes**.

Done. Your code is on GitHub.

---

## STAGE 2 — Set up Google (the data backend)

This is the fiddliest stage. It's all clicking — no coding. ~10 minutes.

### 2A. Make your spreadsheet
1. Go to **sheets.google.com** → **Blank spreadsheet**.
2. Name it (top-left), e.g. "Carwash Data".
3. Look at the address bar. The URL looks like:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...long...XyZ`**`/edit`
4. Copy the **long code between `/d/` and `/edit`**. That's your **Sheet ID**.
   Paste it into a sticky note / Notepad for later.

### 2B. Make a Google Cloud project
1. Go to **console.cloud.google.com**. Agree to terms if asked.
2. Top bar, click the project dropdown → **New Project** → name it → **Create**.
3. Wait a few seconds, then make sure that new project is selected in the top bar.

### 2C. Turn on the Sheets API
1. In the top search bar, type **Google Sheets API** → click the result.
2. Click **Enable**. Wait for it to finish.

### 2D. Create the "robot" account (service account)
1. Left menu (☰) → **APIs & Services** → **Credentials**.
2. **+ Create Credentials** → **Service account**.
3. Give it any name → **Create and continue** → skip the optional steps →
   **Done**.
4. You'll see it listed under "Service accounts". **Copy its email address** —
   it looks like `something@your-project.iam.gserviceaccount.com`.
   Paste it into your sticky note. This is `GOOGLE_SERVICE_ACCOUNT_EMAIL`.

### 2E. Create the robot's key (the password file)
1. Click the service account you just made.
2. Open the **Keys** tab → **Add key** → **Create new key** → choose **JSON** →
   **Create**.
3. A `.json` file downloads. **Open it with Notepad / TextEdit.** Inside you'll find:
   - `"private_key": "-----BEGIN PRIVATE KEY-----\n....\n-----END PRIVATE KEY-----\n"`
   You'll copy this whole value (including the quotes' contents and all the `\n`s)
   in Stage 3. This is `GOOGLE_PRIVATE_KEY`.
   - Keep this file safe and private — it's like a password.

### 2F. Let the robot into your sheet (most-forgotten step!)
1. Go back to your Google Sheet.
2. Click the green **Share** button (top-right).
3. Paste the robot's **email** (from 2D).
4. Make sure it's set to **Editor**.
5. Click **Send / Share**. (Ignore any "outside your organization" warning.)

If you skip this, the app will say "the robot can't open your sheet." Now you have
three things saved: the **Sheet ID**, the **robot email**, and the **JSON file**.

---

## STAGE 3 — Deploy on Vercel

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub** (easiest).
2. Click **Add New… → Project**.
3. Find your `carwash-pos` repo in the list → **Import**.
4. Before deploying, expand **Environment Variables** and add these **three**.
   For each: type the **Name** exactly as shown, paste the **Value**, click **Add**.

   | Name | Value |
   |------|-------|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the robot email from 2D |
   | `GOOGLE_SHEET_ID` | the Sheet ID from 2A |
   | `GOOGLE_PRIVATE_KEY` | the full private key from the JSON (see note) |

   **Private key note:** in the JSON file, copy everything **between the quotes**
   after `"private_key":` — it starts with `-----BEGIN PRIVATE KEY-----\n` and ends
   with `\n-----END PRIVATE KEY-----\n`. Paste that whole thing as the value.
   Keep the `\n` pieces; don't try to "clean them up."

5. Click **Deploy**. Wait 1–3 minutes for it to finish.
6. Click **Continue to Dashboard** / **Visit** to get your live web address
   (something like `your-carwash.vercel.app`).

---

## STAGE 4 — Click the button

1. Open your live address and add **`/setup`** to the end, e.g.
   `https://your-carwash.vercel.app/setup`
2. The page checks the connection:
   - **Green "Connected"** → great, continue.
   - **Red message** → it tells you exactly what to fix (usually: share the sheet,
     or re-paste the key). Fix it, then press **Re-check**.
     - If you change an environment variable in Vercel, you must **redeploy**:
       Vercel → your project → **Deployments** → top one → **⋯ → Redeploy**.
3. Leave **"Add sample data"** ticked for your first try.
4. Click **Initialize my sheet**. It builds all 7 tabs in a few seconds.
5. Click **Open the POS**. You should see sample services load. Open your Google
   Sheet in another tab — the tabs and data are there.

That's it. You're live.

---

## Make it yours (optional, later)

To change the business name, colors, logo, currency, or commission:

1. On GitHub, open the file `config/branding.ts`.
2. Click the **pencil icon** (Edit).
3. Change the values (business name, tagline, colors, etc.).
4. Scroll down → **Commit changes**.
5. Vercel automatically redeploys in ~1 minute. Refresh your site to see it.

For a **logo**: in GitHub open the `public` folder → **Add file → Upload files** →
upload `logo.png` → commit. Then edit `branding.ts` and set
`logoUrl: "/logo.png"` → commit.

To **reuse this for another business later:** make a new Google Sheet + robot,
import the same GitHub repo as a new Vercel project with that new sheet's variables,
edit `branding.ts`. Five minutes.

---

## If something goes wrong

The `/setup` page is your friend — it translates Google's confusing errors into
plain English. The three most common issues:

- **"can't open your sheet"** → you forgot Stage 2F (share the sheet with the robot email).
- **"private key looks malformed"** → re-copy the key from the JSON, keep the `\n`s, re-paste in Vercel, redeploy.
- **"Sheet not found"** → the `GOOGLE_SHEET_ID` is wrong; re-copy it from the sheet URL.

After fixing anything in Vercel's variables, always **redeploy** before re-checking.

---

## One safety note

Right now the **Admin** screen has no password — anyone with your web address could
view sales and payroll. That's fine while you're testing. Before you share the link
with staff or the public, ask to have a login added (it's a quick addition).
