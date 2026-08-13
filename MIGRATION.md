# Moving to livcafeandbistro.com (GoDaddy)

Checklist for cutting the site over from the GitHub Pages URL
(`jacobsmit.github.io/liv-cafe-website`) to the custom domain
**livcafeandbistro.com**, and confirming every service that emails
customers/staff is using **info@livcafeandbistro.com**.

**livcafeandbistro.com is currently a live, indexed domain serving real
traffic from Webflow** — this isn't a blank domain being pointed somewhere
for the first time. Two things follow from that:

- Before cutting over, do a quick side-by-side check that this Astro site
  actually has everything the current Webflow site has — current hours,
  menu items/prices, any pages that might exist on Webflow but haven't
  been rebuilt here. Cutting over to something that's missing content the
  live site currently has would be a regression, not just a hosting change.
- **Do the steps in this order, and don't skip ahead to Step 3 (DNS)
  before Step 1 and 2 are merged and deployed.** If DNS is pointed at
  GitHub Pages before the code/`CNAME` file is live, GitHub won't
  recognize the domain yet and visitors get a GitHub 404 during that gap.
  If the code deploys first while DNS still points at Webflow, nothing
  changes for visitors — Webflow keeps serving exactly as it does today.
  So: merge & deploy Step 1–2 (and set the custom domain in GitHub's
  settings from Step 4 at the same time, not after — GitHub can't issue
  the HTTPS cert until DNS resolves either way, but registering the
  domain early means it starts trying the moment DNS goes live, instead
  of losing extra time), confirm the deploy succeeded, *then* do Step 3.

---

## Step 1 — Fix the base-path bug (do this first)

The site currently lives at a subpath (`/liv-cafe-website`), so every link is
built as `` `${import.meta.env.BASE_URL}/about` ``. Once the site moves to the
domain root, Astro's `BASE_URL` becomes `/` instead of `/liv-cafe-website`,
and that same pattern produces `//about` — a broken link (the browser reads
it as "go to a site named `about`", not a page on this site).

This affects every one of these files:

- [`src/layouts/Layout.astro`](src/layouts/Layout.astro) — favicon link, all desktop + mobile nav links
- [`src/pages/index.astro`](src/pages/index.astro) — both "Reservations" buttons, the small logo mark
- [`src/pages/menu.astro`](src/pages/menu.astro) — all 3 menu PDF links
- [`src/pages/catering.astro`](src/pages/catering.astro) — canapé PDF link, **and the post-submit redirect URL**
- [`src/pages/contact.astro`](src/pages/contact.astro) — **the post-submit redirect URL** (sends reservation submitters to the thank-you page)
- [`src/pages/404.astro`](src/pages/404.astro) — "Return Home" link
- [`src/pages/thank-you.astro`](src/pages/thank-you.astro) — "Return Home" link

**Fix:** in each file, instead of using `import.meta.env.BASE_URL` directly
in a template string like `` `${import.meta.env.BASE_URL}/about` ``, strip
any trailing slash first:

```js
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
```

then use `` `${base}/about` `` etc. (The bare `href={import.meta.env.BASE_URL}`
use for the home/logo link does **not** need this — it's already correct.)

**Verify after fixing:** run `npm run build` and confirm no doubled slashes
made it into the output:

```bash
grep -rn '="//' dist/ || echo "clean"
```

---

## Step 2 — Code changes for the new domain

1. **[`astro.config.mjs`](astro.config.mjs)**
   ```js
   site: 'https://livcafeandbistro.com',
   base: '/',
   ```
2. **Add `public/CNAME`** containing exactly one line:
   ```
   livcafeandbistro.com
   ```
   This must be committed to the repo (not just set in the GitHub UI) —
   the Actions-based deploy rebuilds the site from source every time, so a
   UI-only setting gets wiped on the next push.
3. **[`public/robots.txt`](public/robots.txt)** — update the `Sitemap:` line
   (it's hand-written, not auto-generated):
   ```
   Sitemap: https://livcafeandbistro.com/sitemap-index.xml
   ```
4. Run `npm run build` locally once more and spot-check `dist/` — nav links,
   menu PDF links, and the reservation form's `redirect` field should all
   point at `livcafeandbistro.com`, not the old GitHub Pages URL.

---

## Step 3 — DNS at GoDaddy

The domain's DNS zone was checked directly (GoDaddy → **My Products →
livcafeandbistro.com → DNS → Manage DNS**) — here's what's actually there
today, and exactly what to change.

Before editing anything, scroll through the **full** DNS record list in
GoDaddy yourself — what's documented below is everything visible in the
zone at the time it was checked, but if there's another Webflow-related
row further down the list that wasn't seen, it should be treated the same
way as the two Webflow `A` records below (safe to remove once cut over),
not left alone like the Microsoft 365 rows.

**The site is currently live on Webflow, and email runs on Microsoft 365 /
Exchange Online.** Only two rows need to change. Everything else in the
zone belongs to Microsoft 365 mail — touching those breaks
`info@livcafeandbistro.com`.

### Change these two rows

| Type | Name | Current value | New value |
|------|------|----------------|-----------|
| A | @ | `75.2.70.75` | delete |
| A | @ | `99.83.190.102` | delete |

Replace both with four new **A** records, all with Name `@`:

| Type | Name | Value |
|------|------|-------|
| A | @ | `185.199.108.153` |
| A | @ | `185.199.109.153` |
| A | @ | `185.199.110.153` |
| A | @ | `185.199.111.153` |

Then edit the existing **CNAME `www`** record:

| Type | Name | Current value | New value |
|------|------|----------------|-----------|
| CNAME | www | `proxy-ssl.webflow.com.` | `jacobsmit.github.io.` |

That's it for the pointing-to-GitHub-Pages part. `75.2.70.75` and
`99.83.190.102` are Webflow's servers — once these are removed, the site
will no longer be reachable through Webflow's hosting, only through
GitHub Pages. (Confirm the new GitHub Pages site is live and working
*before* removing the Webflow rows, so there's no gap.)

### Leave every other row exactly as-is

These belong to the Microsoft 365 mailbox behind `info@livcafeandbistro.com`
and to unrelated verification records. Do not edit or delete any of these:

- `NS` (@) → `ns15.domaincontrol.com`, `ns16.domaincontrol.com` — GoDaddy's own nameservers, this is what makes GoDaddy authoritative for the zone
- `SOA` (@) — zone metadata, managed automatically
- `MX` (@) → `livcafeandbistro-com.mail.protection.outlook.com` — **this delivers all mail for `info@livcafeandbistro.com`. Deleting or changing this breaks email entirely.**
- `CNAME autodiscover` → `autodiscover.outlook.com` — lets Outlook/mail clients auto-configure the mailbox
- `CNAME email` → `email.secureserver.net` — GoDaddy's own email/webmail record
- `CNAME lyncdiscover`, `CNAME msoid`, `CNAME sip`, `SRV _sip._tls`, `SRV _sipfederationtls._tcp` — Microsoft Teams/Skype for Business discovery records, part of the same Microsoft 365 setup
- `CNAME _domainconnect` → `_domainconnect.gd.domaincontrol.com` — GoDaddy's own "Domain Connect" feature, unrelated to the site
- `TXT` (@) → `google-site-verification=...` — likely Google Search Console or Google Workspace ownership verification; unrelated to this migration
- `TXT` (@) → `NETORGFT18932459.onmicrosoft.com` — Microsoft 365 tenant verification
- `TXT` (@) → `v=spf1 include:secureserver.net -all` — SPF record (see note below)
- `TXT _webflow` → `one-time-verification=...` — Webflow's domain-ownership check. Harmless to leave; can be deleted later once you're confident you're done with Webflow, but there's no rush or downside to leaving it.

**One thing worth flagging, unrelated to this website migration:** the SPF
record (`v=spf1 include:secureserver.net -all`) only authorizes GoDaddy's
mail servers to send as `@livcafeandbistro.com`, but the MX record shows
mail is actually hosted on Microsoft 365. If staff send email *from*
Outlook/Microsoft 365 (not just receive), that mismatch can cause outgoing
mail to fail SPF checks and land in recipients' spam folders. Worth a
quick check with whoever manages the Microsoft 365 account — this is
independent of the website move and not something to change as part of it.

DNS changes can take anywhere from a few minutes to ~24–48 hours to
propagate. Do this during low-traffic hours if possible, and keep the
Webflow site untouched (don't unpublish/cancel it) until the GitHub Pages
site is confirmed working over the new DNS.

---

## Step 4 — GitHub repo settings

1. **Settings → Pages → Custom domain** → enter `livcafeandbistro.com` → Save.
   (This is a secondary confirmation — Step 2's `public/CNAME` is what
   actually persists it across deploys.)
2. Wait for GitHub to issue the HTTPS certificate (the **Enforce HTTPS**
   checkbox is greyed out until this finishes — can take minutes to a few
   hours after DNS propagates).
3. Once available, check **Enforce HTTPS**.

---

## Step 5 — Services to point at info@livcafeandbistro.com

The display text in the code already reads `info@livcafeandbistro.com`
everywhere (contact page, hours page, footer, etc.) — no source changes
needed there. What actually needs checking is which inbox each *backend*
service is wired to, since none of that is visible from the repo:

- [ ] **Web3Forms** (dashboard at web3forms.com) — confirm the access key
  used in [`contact.astro`](src/pages/contact.astro) and
  [`catering.astro`](src/pages/catering.astro)
  (`e078d5cf-50ba-406c-b20d-49a516de89a0`) delivers to
  `info@livcafeandbistro.com`. If it's pointed at a different inbox,
  generate a new key under the correct address and swap it into both files.
- [ ] **Web3Forms domain restriction** — if the dashboard has this key
  restricted to the old `jacobsmit.github.io` domain, add
  `livcafeandbistro.com` (and `www.livcafeandbistro.com`) or submissions
  will silently fail after cutover.
- [ ] **Mailchimp** — the mailing-list signup on the contact page posts to
  `shaw.us4.list-manage.com` ([`contact.astro`](src/pages/contact.astro)).
  Confirm that Mailchimp account/list is still the one you want new
  subscribers landing in.
- [ ] **Domain registrar contact email** (GoDaddy account) — confirm the
  admin/contact email on the GoDaddy account itself is one you check, since
  renewal and security notices go there.
- [ ] **Cloudflare account email** — same idea, for the account that owns
  the Web Analytics token in [`Layout.astro`](src/layouts/Layout.astro).

---

## Step 6 — Cloudflare Web Analytics

In the Cloudflare dashboard → **Web Analytics → Add a site** → add
`livcafeandbistro.com` as a registered hostname. Skipping this doesn't
break the site, but analytics silently stop recording after cutover with
no visible error.

---

## Step 7 — Post-launch smoke test

Once DNS has propagated and HTTPS is enforced:

- [ ] **Submit a real test reservation and confirm it arrives at
  `info@livcafeandbistro.com` — do this one first.** Every other item on
  this list fails loudly (a broken link, a 404, a missing image). This one
  fails silently — if Web3Forms is domain-restricted to the old GitHub
  Pages URL, the form can look like it worked (the visitor still reaches
  the thank-you page) while the email never arrives.
- [ ] Submit a real test catering inquiry, same reasoning
- [ ] Visit `https://livcafeandbistro.com` and click through every nav
  link (About, Hours, Menu, Catering, Food To Go, Reservations)
- [ ] Download/view all 4 menu PDFs
- [ ] Check the favicon loads in a browser tab
- [ ] Check `https://livcafeandbistro.com/robots.txt` and
  `https://livcafeandbistro.com/sitemap-index.xml` both point at the new
  domain
- [ ] Check `https://www.livcafeandbistro.com` redirects to the bare domain
- [ ] Confirm the padlock/HTTPS shows valid, no mixed-content warnings
- [ ] Check the Cloudflare Web Analytics dashboard shows the new domain
  recording hits
