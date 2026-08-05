# Ayers Loan Application — web form

**Live:** https://haohuilu.com/ayersapplicationform/

> This repository is **public**. It holds the blank form only. Never commit a completed
> application — the exported JSON and PDF contain client personal and financial details.
> Everything typed into the form stays in the browser on the user's own computer; nothing is
> uploaded anywhere.

A browser version of the printed *Ayers Loan Application (version 3)* PDF. Same layout, colours,
logo and wording, with repeatable **property** and **employment** entries.

## Running it

Double-click **`Start Ayers Form.command`** in the folder above this one. It starts a local server
and opens the form; keep the Terminal window it opens while you use the form.

The equivalent by hand:

```bash
python3 -m http.server 8777 --directory web
```

Then open <http://localhost:8777>. Any static host works too — S3, Netlify, an intranet folder —
just upload the `web` folder as-is.

Opening `web/index.html` directly by double-click mostly works, but **Download** will not: it has to
read the PDF template, and browsers block that for pages opened from `file://`. Use the launcher.

## Editing: bump the cache buster

`index.html` loads `styles.css?v=12` and `app.js?v=12`. **Increment that number whenever you change
either file.** Browsers cache both aggressively; without it an edit can appear to do nothing, and —
worse — the form can still *print* with the old layout even though the screen looks current. This
has already caused one bad 6-page print of a form that lays out correctly in 3.

To check a print without guessing, render it headlessly and count the pages:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --no-pdf-header-footer --print-to-pdf=check.pdf --virtual-time-budget=4000 http://localhost:8777/
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page skeleton: the three sheets, section bars, and the static fields |
| `styles.css` | All styling, including the A4 print rules |
| `app.js` | Field templates, repeatable rows, totals, autosave |
| `pdf-export.js` | Builds the filled, still-editable PDF |
| `pdf-field-map.js` | Web field name → field name in the Ayers template (generated) |
| `assets/ayers-logo.svg` | Logo, extracted as vector from the original PDF |
| `assets/ayers-form-template.pdf` | The original Ayers PDF, values cleared, used as the fill template |
| `vendor/pdf-lib.min.js` | PDF library, vendored so nothing loads from the internet |

Repeated and per-applicant fields are generated from the lists at the top of `app.js`
(`GENERAL_EXPENSES`, `ASSETS_LEFT`, `CITIZENSHIP`, …). To add or rename a field, edit the list —
the markup follows automatically.

## What changed from the PDF

- **Properties** — was a fixed 5-row table. Now starts at 3 rows with **+ Add property**; rows can
  be removed. No upper limit.
- **Employment** — was one current plus one previous job per applicant. Now a repeatable list per
  applicant via a single **+ Add job** button. Each entry carries its own status, employer, job
  title, address, contact number and dates.
  - Whether an entry is current is controlled by the **Current job** tick on the card, not by which
    button added it. New entries start as previous employment; tick the box for any still held.
  - An applicant can have **more than one current job**. Entries are titled *Current Employment
    1, 2, …* and *Previous Employment 1, 2, …*, counted separately, and ticking or un-ticking moves
    a card into the right group and relabels everything automatically. The entered details always
    stay with their own card.
  - Current jobs are shown with an orange marker and hide the *End Date* field, since there isn't one.
- **Investment property expenses** (page 3) — was a fixed 4 rows. Now repeatable to match however
  many properties the applicant has.
- **Income** — was a single Base / Overtime / Commission / Others row per applicant. Now **one income
  line per job**, added and removed automatically with the employment entries and labelled with the
  job title. Each line totals itself; a *Total Income (all jobs)* line appears once there are two or
  more jobs. Removing a job removes its income line specifically, so the remaining figures stay with
  their own jobs.
- **Loan amount** — the PDF never asked how much was being applied for. Added **Loan Amount Requested** under Loan Purpose, alongside *Loan Term (years)* and *Security / Property Address*.
- **Totals** — income per job and per applicant, the two living-expense subtotals, and total living
  expenses now calculate automatically and are read-only.
- **Page footers** name their section instead of "Page 1 of 3", which stops being true once an
  applicant adds enough jobs or properties to run onto another sheet.
- Added an "If yes, please provide details" box under the significant-change question, and name/date
  lines under the declaration.

## Toolbar

```
[ New ]  │  [ Export data | Import data ]  │  [ Download ]
```

Left to right, in the order an application is worked through: start it, move it between machines,
then produce the PDF. **New** wipes the form, so it is kept at the opposite end from **Download**
rather than sitting a slip away from it.

| Button | What it does |
| --- | --- |
| **Download** | Builds the filled-in Ayers PDF and downloads it. Fields stay editable. |
| **New** | Clears the form to start a fresh application. |
| **Export data** / **Import data** | Saves/reads the application as a JSON file — for emailing it, backing it up, or continuing on another computer. |

The form autosaves as you type — the toolbar shows *Autosaved 14:32* so a broker filling this in
front of a client can see their work is safe. Closing the tab by accident doesn't lose it; reopening
the page restores where you left off. There is no saved-applications list — **Download** (or **Export data**) is how an
application is kept.

## Keeping an application

Nothing is sent anywhere — there is no server side. An application leaves the browser only when you
press **Download** (PDF) or **Export data** (JSON). The autosave is a convenience against an
accidental tab close, held in this browser on this computer only; it is not a filing system.

## The PDF output

**Download** produces your original Ayers PDF with its 230 form fields filled in and **still
editable** in Preview, Acrobat or Adobe Reader.

> Safari's built-in PDF viewer and Quick Look display PDFs **read-only** — they show the fields but
> will not let you type. Open the downloaded file in Preview or Acrobat to fill it in. This is an
> Apple limitation and applies equally to the original Ayers PDF.

Printing the page itself (⌘P) still works and still paginates onto clean A4 — see *Pagination*
below. That is the fallback for an application too large for the template (next section), because
the printed page includes every job and property however many there are. It is flat, though: printed
output can never contain fillable fields, in any browser.

### How the editable PDF works

A browser can never *print* a fillable PDF — print output is a flat rendering of the page, in every
browser. So this does not print at all: it loads `assets/ayers-form-template.pdf` (your original
form with all values cleared), fills its AcroForm fields with pdf-lib, and saves it with the fields
left editable. `pdf-field-map.js` maps each web field name to its counterpart in the template; it was
generated from the template's own AcroForm, so names containing carriage returns
(`Monthly \rRepayment 1`) are exact.

Two details are worth preserving if you touch `pdf-export.js`:

- **Appearances are left to the viewer** (`NeedAppearances`, with existing streams cleared) rather
  than drawn by pdf-lib. pdf-lib can only draw in a font it embeds, which loses the form's Gotham
  and renders smaller; and viewers redraw drop-downs from the field value regardless, so a stale
  stream left Title / Citizenship / Gender / Marital Status looking blank.
- **Tick boxes keep their appearance streams.** Those hold the check glyph and its on/off states,
  which a viewer will not reconstruct.

### Capacity

The original template is a fixed layout, so it holds only:

- **5 properties**
- **one current and one previous job per applicant** — extra jobs are totalled into the single income
  row rather than lost
- **4 investment-property expense lines**

Anything beyond that cannot be represented. The app counts it and tells the user exactly what did not
fit, and says to print the page (⌘P) for a record showing everything. This is the unavoidable tension
between "keep the original Ayers design" and "allow unlimited jobs and properties".

## Printing to PDF

⌘P prints the page itself — choose *Save as PDF* in the dialog for a flat A4 PDF with selectable
text and a sharp vector logo. Use this when an application is too big for the editable template.

- The filename is set from the applicant's name automatically —
  `Ayers Loan Application - Dean Laurence Smith.pdf`.
- The toolbar, all **+ Add** buttons and every **×** are hidden in the output.
- Records won't split across a page boundary, and the property table repeats its header if it runs
  onto a second page.
- The layout stays two-column at A4. Note the responsive rules are deliberately scoped to
  `@media screen` — an unqualified `max-width` query also matches the ~794px A4 print width and
  would collapse the printed form to a single column.

### Pagination

A standard application prints as **three A4 pages**, one per section. Adding jobs or properties
grows the middle section onto further A4 pages rather than distorting the layout:

Page counts below are measured from real Chrome print-to-PDF output, not estimated:

| Application | Pages |
| --- | --- |
| 1 job, 3 properties | 3 |
| 5 jobs, 6 properties, 4 investment expenses | 4 |

**Safari matters here.** The form is used in Safari as well as Chrome, and the two engines measure
text slightly differently, so the print layout must not depend on fitting a page exactly. Two rules
follow from that:

- **No `zoom` in print.** WebKit scales zoomed content when printing but does not reliably recompute
  page breaks from the scaled size — the classic "prints fine in Chrome, breaks in Safari" fault.
  Headroom is taken out of the layout itself, which every engine measures the same way.
- **No inline `style="margin-…"` on layout blocks.** An inline style beats the print stylesheet, so
  those spacings silently stay at their screen values and quietly eat the headroom. Spacing helpers
  (`.section-gap`, `.subhead.spaced-sm`, `.question`, `.field-gap`) exist as classes for this reason.

Each section currently leaves this much of an A4 page empty — the safety margin that absorbs
engine differences. Keep it near 8%; if an edit pushes a section under about 4%, it will start
spilling a near-empty page in some browser:

| Section | Headroom |
| --- | --- |
| Page 1 — Loan Purpose & Personal Details | 7.9% |
| Page 2 — Employment, Income, Assets | 8.8% |
| Page 3 — Living Expenses | 43.5% |

Three further things make the pagination work:

1. **Margins live on `@page`, not on `.sheet`.** Sheet padding is applied once at the top of the
   box, so a section running onto a second sheet of paper would start hard against the paper edge.
   `@page { margin: 10mm 11mm 8mm }` gives *every* physical page its own margins.
2. **Print styles are compacted** to roughly the density of the original printed form — a section
   would otherwise be ~25% too tall and spill a near-empty second page.
3. **Print styles are structural, not scaled.** Space was found by pairing fields onto shared rows
   (Country + Date moved in; Commencement + End + Contact) rather than by shrinking the page, so the
   saving is identical in every browser.

Records also carry `break-inside: avoid`, headings `break-after: avoid`, and the property table
repeats its header row when it runs on.

Field `name` attributes are stable and predictable, so wiring this to a backend later is a matter of
POSTing the form. Repeated entries are numbered from 1:

```
loan_amount, loan_term_years           # what's being applied for
a1_given_names, a2_surname, …          # applicant 1 / applicant 2
a1_emp_1_employer_name, a1_emp_2_…     # applicant 1's jobs, in display order
a1_emp_1_is_current                    # true = a current job, absent = previous
property_1_address, property_2_…       # property rows
investment_property_1_expense          # page 3 expense rows
```

Employment entries are numbered by position, not by current/previous — read `*_is_current` to tell
them apart. Renumbering happens automatically when a row is removed or reordered, so there are never
gaps, and values always stay with their own entry.
