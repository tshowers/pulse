# Handoff: TODD Pulse redesign

## Overview
Pulse is TODD's survey tool. A signed-in user writes a pulse (survey), publishes it to get a public link, shares the link, and watches results arrive live while TODD writes a summary and suggests a next move. Users found the current UI confusing: the survey view had seven equal buttons, results lived on a separate dashboard, and Home was an abstract "Customer Health" board.

The redesign gives every pulse one linear flow with three steps, **Write → Share → Results**, shown as a step bar at the top of every pulse screen. Each screen has exactly one primary (blue) button. TODD is present at each step: writes questions from a sentence (New), reviews questions (Write), explains what happens after publishing (Share), and leads Results with a summary and an actionable next move.

Repo: `tshowers/pulse` (Angular, standalone components). iOS twin: `pulse-ios` (SwiftUI).

## About the design files
The files in this bundle are **design references created in HTML**: prototypes showing intended look and behavior, not production code. Recreate them in the existing environments: the Angular app in `tshowers/pulse` (web) and the SwiftUI app (iOS), using their established patterns, services and routing. Do not ship the HTML.

Open `Pulse Redesign.dc.html` in a browser (keep `support.js`, `ios-frame.jsx` and the `public/` / `src/` asset folders next to it). Each screen has a badge id (1a, 2f…); `#1f` in the URL jumps to it. The Dark/Light button at the top toggles theme for every screen.

## Fidelity
**High fidelity.** Final colors, type, spacing, radii and copy. Recreate pixel-accurately with the codebase's own components. Sample data (Taliferro Tech, "Q4 client check-in", 38 answers) is illustrative.

## Design tokens ("Find" look, shared with the other TODD apps)
Font: `"Helvetica Neue", Helvetica, Arial, sans-serif` (iOS: SF Pro). Weights 400 / 600 / 700. Headlines use negative letter-spacing (-0.02em to -0.04em).

| Token | Light | Dark |
|---|---|---|
| --bg | #ffffff | #0c0e13 |
| --surface | #f2f3f6 | #171a22 |
| --surface2 | #e4e7ed | #242936 |
| --canvas | #d9dce3 | #05060a |
| --text | #0f1115 | #f2f4f8 |
| --muted | #5a6170 | #9aa2b2 |
| --blue (primary) | #2f6bff | #3d7bff |
| --blue-ink (links) | #1f55e0 | #86aeff |
| --t-blue / -fg | #e3ecff / #1d4fd6 | #15254a / #a3c1ff |
| --t-green / -fg | #e0f6e6 / #17703a | #0e2c19 / #80e2a4 |
| --t-yellow / -fg | #fff4c2 / #6e5700 | #2f2906 / #ffe56a |
| --t-pink / -fg | #ffe3f1 / #a8105a | #3a1029 / #ff92c9 |
| --t-violet / -fg | #efe5ff / #6427c9 | #2a1847 / #cdaaff |
| --t-cyan / -fg | #daf6fc / #08657d | #0c2d35 / #74e4f8 |
| shadow | 0 20px 50px rgba(15,17,21,.12) | 0 20px 50px rgba(0,0,0,.55) |

- Radii: buttons, inputs, tags, chips = 999px (pills). Cards 20–28px; hero cards 32–36px. Number/avatar dots are circles.
- No borders or hairlines. Separation comes from `--surface` fills on `--bg`. Selection/focus = `box-shadow: 0 0 0 2px var(--blue)`.
- Type scale (web): 68 hero / 52–60 page title / 40 section / 32 / 24 / 20 / 17–18 body large / 15–16 body / 13–14 meta / 12 uppercase eyebrow (700, letter-spacing .06em).
- Buttons: primary 42–56px tall, `--blue` fill, white 700 text; secondary `--surface` fill, hover `--surface2`; "go" buttons on list rows use `--text` fill with `--bg` text.
- Status tags: Live = green, Draft = yellow, Closed = `--surface2` fill / `--muted` text. "6 new" badge = `--blue` fill.
- Icons: Lucide, stroke-width 2.75, 16px default (14 in tags, 18–20 in iOS tabs).
- TODD is always shown with `src/assets/avatar-todd-sm.png` on a `--t-blue` card.

## Information architecture
Signed-in web header: TODD Pulse logo · tabs **Pulses**, **Help** · **New pulse** (primary) · Menu.
Signed-out header: tabs **Home, About, Help** · Sign in · **Get started**.

| Route (existing → proposed) | Screen |
|---|---|
| `/` landing | 2a |
| — (new) `/about` | 2b |
| `/help` | 2c |
| `/app` (Customer Health board) + `/survey-list` → **`/app`** | 1a Pulses home |
| `/survey-edit` (no id) | 1b New pulse |
| `/survey-edit?id` | 1c Write |
| `/survey/:id` (command view) → **`/survey/:id/share`** | 1d / 1e Share |
| `/survey-dashboard/:id` → **`/survey/:id/results`** | 1f Results |
| `/take/:id` | 1g/1h phone, 2d/2e desktop |

The step bar links Write / Share / Results for the same pulse. Results is disabled (muted, no link) until the pulse has been published at least once.

## Screens

### 1a Pulses home (web, 1280)
- Greeting H1 40px + subline (muted 17px).
- **TODD next-move card** (`--t-blue`, radius 28, padding 24/28, grid `48px 1fr auto`): avatar 48, eyebrow "YOUR NEXT MOVE · {pulse}", 19px/600 message, buttons "Read TODD's summary" (primary → Results) and "Later" (dismiss for 24h). Shows the most recent next move across live pulses; hidden if none.
- Filter chips: All / Live / Drafts / Closed with counts (active = `--text` fill).
- Pulse rows (`--surface`, radius 24, padding 20/24, grid `96px 1fr 300px auto`): status tag · title 18/700 (+ "N new" badge) and meta line · one-line hint · actions. **One primary action per state**: Live → See results (+ Copy link); Draft ready → Share (+ Edit); Draft incomplete → Keep writing; Closed → See results (+ Reopen). The hint is TODD-written (`pulse-assistant-signal.service`), or a rule-based fallback.
- Replaces: Customer Health meters, Care Cycle board, and the separate "Current Pulse" list.

### 1b New pulse
- H1 48px "What do you want to find out?"; subline.
- TODD prompt bar (`--t-blue`, radius 32): free text + **Write my questions** (primary). Calls TODD to generate title, description and 3–5 questions, then opens 1c with them as a draft.
- 4 templates (tinted cards, 200px min height): Client check-in, Event feedback, Idea check, Team pulse.
- Start from blank (secondary) → empty 1c.

### 1c Step 1 · Write
- Pulse bar: back · title + "Draft · saved just now" (autosave, debounce ~1s) · step bar · **Try it** (opens `/take/:id?preview=1`) · **Next: Share** (primary). Next is disabled with a hint until the pulse has a title and at least one complete question (reuse `saveBlockers`).
- Left: title/description card, then question cards. Collapsed card: number dot, text, type tag, chevron. Expanded card (one at a time, 2px blue ring): question input, **type chips** (Short answer=text, Long answer=textarea, One choice=multiple_choice, Pick any=checkbox, Yes / No=yes_no, Rating=rating 0–10), options with remove × and "Add option" (choice types only), Required toggle, Duplicate, Delete. "Add question" full-width button at the end. Drag to reorder (handle = number dot).
- Right (380px): **What people see** live preview of the selected question, and **TODD's review** (`--t-blue`): 1–3 suggestions, each with a one-tap fix and Dismiss.

### 1d Step 2 · Share, before publishing
- H1 36 "Ready to share", subline.
- Checklist rows (green check dots) with Edit links back to Write.
- Settings (segmented pills): Stop taking answers — When I close it / On a date / After 50 answers. Names — Ask for name and email / Anonymous.
- **Publish and get my link** (primary, 52px) + note "Publishing is part of your paid plan. Writing and editing pulses is always free." If the user has no plan (`hasPaidSurveyAccess()` false), the button reads **Choose a plan to publish** and goes to `/pricing`, returning here after checkout.
- Right card "What happens next": 1 You get one link · 2 Answers show up live · 3 TODD tells you what it means (after 5 answers).

### 1e Step 2 · Share, live
- Green hero card (`--t-green`, radius 32): "It's live. Send people this link." · link pill (60px) · **Copy link** (primary) · Email, Text message, QR code, Try it yourself.
- Three cards: Answers so far (count, live) · TODD note ("I'll write your summary… once 5 people have answered") · Settings with Close now and Back to draft.
- Header button: See results.

### 1f Step 3 · Results
- Pulse bar subtitle: green dot "Live · 38 answers · 6 today". Actions: Copy link, CSV.
- **TODD summary** (`--t-blue`, radius 32, grid `1fr 420px`): source line "What TODD heard · from N answers, updated X ago", 26px headline summary, 3 findings (big number + sentence). **Next move** card (`--bg`): eyebrow, 18/700 recommendation, explanation, **Draft the email** (primary), Add to my tasks, Another idea.
- Question cards (2-column grid, `--surface`, radius 28): Rating → big average + 0–10 histogram (9–10 blue, 7–8 blue-fg, else muted). One choice / Pick any → horizontal bars with "count · %". Long/short answer → TODD theme chips ("Faster replies · 11") + 3 quotes + "See all N answers".
- Before 5 answers, the summary card shows "TODD will write a summary after 5 answers. N so far." and the question cards still render.

### 1g / 1h Answering on a phone (public `/take/:id`)
- Sender row (initials/logo + name + pulse title), progress bar + "2 of 4", question 28px, options as 60px pill rows (selected = `--t-blue` fill + 2px blue ring + filled radio), Back (round) + **Next** (primary, 56px), footer "Your answers go to {owner}. Powered by TODD Pulse."
- Done: green check circle, "Thanks, that's everything.", no countdown redirect, soft "Want to run your own?" card linking to landing.
- Preview mode (`?preview=1`) and owner mode keep the existing banner rule: show a small yellow pill "Preview · answers aren't saved".

### 2a Landing (signed out)
Hero grid `1fr 520px`: tag "Surveys, read by TODD", H1 68 "Every response is a signal.", sub "TODD reads it so you do not have to.", lead, **Get started free** + "iPhone app coming soon" (disabled), price note. Right: a live-looking product card (TODD summary + one bar question) built from real components, not an image. Then "Three steps, every time" (green/violet/blue cards), "The problem" (existing pain-point copy), FAQ accordion (first open), dark CTA band (Get started free, Pricing). The animated counters (`buildStats`) are dropped.

### 2b About (new route)
H1 60 "Pulse is how TODD listens." + paragraph · Who it's for (3 tinted cards, existing audience copy) · Part of TODD (daily briefing, Maya) · For the people answering (no account, one answer per device, owners can't answer their own) · TODD CTA band.

### 2c Help (signed in)
Left sticky "On this page" nav (220px). H1 52 "Pulse help" + **Ask TODD** (opens the existing assistant). Getting started progress (existing `GettingStartedService`, 4 steps, 2-column, strike-through when done). "From a question to a decision": 3 numbered steps Write / Share / Results with bullets and a link each. Tips (existing 6). FAQ accordion (updated answers for anonymity setting, closing, CSV export). Customer Health meters and Care Cycle sections removed. Signed out: hide progress, header switches to the public one.

### 2d / 2e Answering on a computer
Full-window `--surface` page. Top bar: sender + progress (200px bar, "1 of 4"). Centered 820px `--bg` card (radius 36, padding 56/60, shadow): question 40px, answers (rating = eleven 60px pills, selected blue), **Next** + hint "or press Enter. Number keys pick a score." Footer: owner note + "Powered by TODD Pulse". Done: thanks card + "What you sent" summary card side by side, footer link "Try TODD Pulse free". Keyboard: Enter = Next, Shift+Enter or ← = Back, 0–9 / 1–n select options.

### iPhone (402 × 874, iOS 26)
Floating tab bar pill (Pulses, Help, Account) + separate 62px round blue **+** (New pulse). Same tokens as web.
- **2f Welcome** (signed out): icon, H 40 "Every response is a signal.", three step rows, Get started / I have an account.
- **2g Pulses**: large title, TODD next-move card, filter chips, pulse cards (tap = the state's primary action).
- **2h New pulse** (sheet): TODD prompt + Write my questions, 2×2 templates, Start from blank.
- **2i Write**: compact step bar, collapsed question cards, expanded card with horizontally scrolling type chips; sticky bottom: one TODD suggestion + round Add question + **Next: Share**.
- **2j Share**: checklist, two segmented settings, What happens next, sticky **Publish and get my link**.
- **2k Live**: green card with link, **Share** (system share sheet), Copy, QR code, Try it; TODD note promises a push notification at 5 answers; answers count + See results.
- **2l Results**: summary card with 3 mini findings, next move + Draft the email, then question cards.
- **2m Help** tab: Ask TODD, Getting started progress, How Pulse works, FAQ list.
- **2n About** (pushed from Account).
Respondents on iPhone use the web flow (1g/1h).

## Interactions & behavior
- Autosave drafts on Write (no Create/Update button). Show "Saving…" / "Saved just now".
- Publishing sets `status: 'published'`, `publishedAt`, and `visibility: 'link_only'`. Back to draft sets `status: 'draft'` and stops answers. Close now sets `status: 'archived'` (shown as Closed).
- Results update live (existing Firestore listener). The "N new" badge counts answers since `lastViewedAt`; opening Results updates `lastViewedAt`.
- TODD summary regenerates when the answer count crosses 5, then on every 5 new answers or once an hour, whichever comes first. Show "updated X ago".
- Next-move buttons: Draft the email opens a TODD-drafted email to the respondents in that group (needs names/emails; hide when Anonymous). Add to my tasks posts to TODD tasks. Another idea asks TODD for an alternative.
- Hover: secondary buttons `--surface` → `--surface2`; rows `--surface` → `--surface2`. Focus: 2px `--blue` ring, offset 2px.
- Empty states: no pulses → 1b is the home content. No answers yet → Results shows the "after 5 answers" card.
- Errors: link copy failure → toast "Couldn't copy. Long-press the link instead." Publish failure → inline message under the button, button re-enabled.

## Data & state
- `Survey` (existing `survey.model.ts`): `title, description, questions[], status, visibility, responseCount, publishedAt, lastViewedAt`.
- **New fields needed**: `closeRule: { type: 'manual' | 'date' | 'count', value? }`, `collectIdentity: boolean`, `todd: { summary, findings[{n,text}], nextMove{text, actions[]}, themesByQuestion{[qid]: [{label,count}]}, answerCount, updatedAt }`.
- Builder must support all `SurveyQuestionType`s already in the model; today it only offers text, multiple_choice and checkbox. Rating = 0–10 scale.
- UI state: `selectedQuestionId`, `step` (derived from status), `filter` on home, dismissed TODD suggestions per pulse.

## Placeholders to confirm
- Public link domain (`pulse.taliferro.tech/take/q4-check-in`): use the real host and id, or add slugs.
- Close-by-date / close-at-count, Anonymous vs name+email, CSV export, Draft the email, Add to my tasks: need backend work.
- "iPhone app coming soon" mirrors today's disabled App Store button.
- Sample business and numbers are illustrative.

## Assets
- `public/assets/todd-pulse-icon.png`: app icon (from `tshowers/pulse`).
- `src/assets/avatar-todd-sm.png`: TODD avatar (from `tshowers/pulse`).
- Icons: Lucide (inline SVG paths in the prototype's logic class).
- `ios-frame.jsx`: device bezel used only for presentation.

## Files
- `Pulse Redesign.dc.html`: all screens (1a–1h, 2a–2n). Copy and data live in the `renderVals()` logic at the bottom of the file.
- `support.js`, `ios-frame.jsx`: needed to open the prototype.
- `screenshots/`: one PNG per screen.
