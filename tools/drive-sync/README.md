# Menu & special events publisher (Google Drive → website)

Lets the chef update menus and upcoming special-event dinners by dropping
PDFs into Google Drive folders and pressing a button — no GitHub account, no
password, no technical steps.

**How menus work:** each Drive folder maps to one fixed filename in
`public/menus/`. The script takes the *newest PDF* in each folder and commits it
to that filename, which triggers the normal GitHub Actions deploy. Because the
destination filename is fixed, whatever the chef names their file, the links on
the site can never break.

**How special events work:** one Drive folder holds up to 3 PDFs at a time —
one per upcoming special dinner. The script takes the *newest 3* PDFs in that
folder, and the chef gives each one a name and date on the same publish page.
Removing a PDF from the folder removes that event from the site on the next
publish.

---

## Setup (one time, ~25 minutes)

### 1. Create the Drive folders

Make five folders in Google Drive — for example inside one parent folder
called "Liv Website Menus":

- `Lunch Menu`
- `Brunch Menu`
- `Dinner Menu`
- `Canapé Menu`
- `Special Events`

Put the current PDF in each menu folder (the Special Events folder can start
empty, or with up to 3 PDFs for any dinners already planned). Share the parent
folder with the chef so they can add files.

For each folder, open it and copy the ID from the URL:

```
https://drive.google.com/drive/folders/1AbC...XyZ
                                       ^^^^^^^^^^ this part
```

### 2. Create the GitHub token

Go to **GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**.

- **Repository access:** Only select repositories → `liv-cafe-website`
- **Permissions:** Repository permissions → **Contents: Read and write**
- **Expiration:** the maximum offered (see "Yearly upkeep" below)

Copy the token — GitHub only shows it once.

### 3. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Rename it "Liv Menu Publisher".
3. Replace the contents of `Code.gs` with this folder's `Code.gs`.
4. Add a file: **+ → HTML**, name it exactly `Page`, and paste in `Page.html`.
5. In `Code.gs`, replace the four menu `PASTE_..._FOLDER_ID` placeholders and
   the `PASTE_SPECIAL_EVENTS_FOLDER_ID` placeholder with the folder IDs from
   step 1.
6. In `Code.gs`, replace `PASTE_CHEFS_EMAIL_HERE` in the `ALLOWED_EMAILS` list
   with the chef's actual Google account email (the address they'll be signed
   into when they use the tool). Add your own email to that same list too, on
   its own line, so you can still open it yourself to test.

### 4. Store the token

In the Apps Script editor: **Project Settings** (gear icon) → **Script
Properties** → **Add script property**.

- Property: `GITHUB_TOKEN`
- Value: the token from step 2

Storing it here keeps it server-side at Google. It is never sent to the browser
and the chef never sees it.

### 5. Deploy

**Deploy → New deployment → Web app**, then:

- **Execute as:** User accessing the web app
- **Who has access:** Anyone

This pair looks backwards at first, so it's worth explaining. "Who has access"
only offers three options — only you, your Google Workspace domain, or anyone
— and the chef's personal Google account is in none of those except "anyone."
The real restriction isn't this setting at all; it's the `ALLOWED_EMAILS` list
in `Code.gs`, checked in code every time any part of the tool is used. "Who
has access: Anyone" just means "anyone can *try*" — the code itself rejects
everyone not on that list.

"Execute as: User accessing the web app" is what makes that check possible —
Google only reveals who's actually using it under this mode. The tradeoff:
the script now runs under **the chef's own Google permissions**, not yours.
In practice that's fine, since they already have access to the Drive folders
they're dropping files into — but the first time each allow-listed person
opens the tool, Google will show a one-time sign-in/consent screen asking
them to authorize it. That's expected, not an error.

Authorise it yourself when prompted, then copy the web app URL and send it to
the chef to bookmark.

---

## The chef's instructions

> 1. Open the Google Drive folder for the menu you're changing.
> 2. Drag the new PDF in. (No need to delete the old one — the newest wins.)
> 3. Open the **Publish Menus** bookmark.
> 4. Check it shows your new file, then press **Update Website**.
> 5. The website updates about 2 minutes later.

---

## Notes

**Filenames don't matter.** `Autumn menu FINAL v3.pdf` publishes just fine — it
always lands at the correct fixed name in the repo.

**Pressing the button twice is harmless.** The script compares file contents and
skips anything unchanged, so no empty commits.

**Nothing is served from Drive.** PDFs are copied into the repo and served by
GitHub Pages exactly as before, so visitors never depend on Drive or Google being
up. If Drive is down, publishing fails with a clear message and the live site is
unaffected.

**Only PDFs are picked up.** Other file types in the folder are ignored.

### Yearly upkeep

Fine-grained GitHub tokens expire (about a year maximum). When it does, the chef
will see **"GitHub refused the access token — it has probably expired"**. Generate
a new token as in step 2 and update the `GITHUB_TOKEN` script property.

Worth putting a calendar reminder a couple of weeks before the expiry date so it
doesn't surprise anyone.

### If something goes wrong

| What the chef sees | What it means |
| --- | --- |
| "No PDF found in this folder." | The folder is empty, or only has non-PDF files. |
| "Folder not found — check the folder ID" | A folder ID in `Code.gs` is wrong, or the folder was deleted. |
| "GitHub refused the access token" | Token expired or was revoked — see Yearly upkeep. |
| Wrong menu updated | The PDF went into the wrong folder. Move it and publish again. |
| "Not authorized. Signed in as: ..." | Their Google account isn't in `ALLOWED_EMAILS` in `Code.gs` — add it (using the exact email shown), or they're signed into the wrong Google account in their browser. |

Every failure results in "the update didn't happen, and someone was told" — never
a broken website.
