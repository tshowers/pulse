# TODD Pulse redesign: architecture and implementation plan

Web (`web-products/pulse`, Angular 19) · iOS **Pulsur** (`apps/ios/pulse-ios`, SwiftUI) · Backend (`taliferrotech/todd-backend/functions`)

Source design: [`design_handoff_todd_pulse/README.md`](../design_handoff_todd_pulse/README.md). Screen ids (1a–1h, 2a–2n) below refer to that handoff.

---

## 1. Summary

The redesign does two things:

1. **One flow per pulse: Write → Share → Results.** A step bar, one primary button per screen, and plain status (Draft / Live / Closed). The Customer Health board, Care Cycle, the seven-button command view and the separate dashboard all go away.
2. **TODD at every step.** TODD writes questions from a sentence (1b), reviews them (1c), explains what publishing does (1d), and leads Results with a summary, three findings and a next move (1f). Pulses home (1a) shows the latest next move across all live pulses.

Nearly all the new intelligence lives on the **backend**, so web and Pulsur render the same TODD output from the same API. The clients only render it and send actions back.

```
┌────────────── Web (Angular) ──────────────┐   ┌──────────── Pulsur (SwiftUI) ────────────┐
│ Pulses · New · Write · Share · Results    │   │ Pulses · New · Write · Share · Results   │
│ Take (public) · Landing · About · Help    │   │ Help · Account/About · Push              │
│ PulseEditorStore (signals, autosave)      │   │ PulseEditorModel (@Observable, autosave) │
└──────────────────┬────────────────────────┘   └──────────────────┬───────────────────────┘
                   │  HTTPS JSON (Firebase ID token)               │
┌──────────────────┴───────────────────────────────────────────────┴───────────────────────┐
│ todd-backend /api                                                                        │
│  survey/surveys.*            CRUD, publish/close, responses (+ closeRule, identity)      │
│  survey/surveyInsights.*  NEW  draft · review · summary · next move · alt move · email   │
│  aiProvider.service          Anthropic / OpenAI with JSON schema                         │
│  push/push.service           APNs notify (app: "pulse")                                  │
│  movesController             "Add to my tasks"                                           │
│  triggers/surveyResponseCreated  NEW  → summary threshold check                          │
│  scheduledSurveyInsights         NEW  hourly refresh sweep                               │
└──────────────────────────────────────────────────────────────────────────────────────────┘
        Firestore: tenants/{t}/surveys · tenants/{t}/surveyResponses · tenants/{t}/surveyInsights (NEW)
```

---

## 2. Findings from the current code that change the plan

These came up while reading the three codebases. Several contradict assumptions in the handoff.

| # | Finding | Where | Consequence |
|---|---|---|---|
| F1 | Stored answers are **positional arrays** matched to `survey.questions` order. | `surveys.service.js` `summarizeSurveyResponses` comment | Drag-to-reorder (1c) or deleting a question after publishing **silently scrambles old results**. Must be fixed first (§4.1). |
| F2 | Question ids default to `q_${index+1}` when the client sends none. | `normalizeQuestion` | Ids aren't stable either. Clients must create UUIDs. |
| F3 | Results are **not** a live Firestore listener. The web dashboard fetches `GET /surveys/:id/responses` over HTTP. iOS only links FirebaseAuth. | `survey-dashboard.component.ts`, `project.yml` | "Live" means polling (§4.6). |
| F4 | Publish sets `visibility: "public"`, not `link_only`. | `publishSurvey` | Change it to `link_only` and check that `getPublicSurveyById` still accepts it (it does at line ~614). |
| F5 | `responseCount` is a read-then-+1 write. | `submitPublicSurveyResponse` | Concurrent answers lose counts. A wrong count would also break the 5-answer trigger. Switch to `FieldValue.increment`. |
| F6 | A `summarizeSurveyResponses` aggregator already exists (tallies plus text samples). The Maya planner uses it. | `surveys.service.js:1017` | Extend it rather than writing a new one. It only treats `text` as free text, so it needs `textarea`, rating averages and histograms. |
| F7 | APNs push is already built (`push.service.notify`, `POST /mobile/push/devices`). `outreach-ios` has a client `PushService.swift`. | `push/`, `outreach-ios` | "Push at 5 answers" (2k) is a small job. |
| F8 | `POST /moves` (Moves tasks) and `emailDrafting.service` / `emailCreatorHandoff.service` already exist. | backend | "Add to my tasks" and "Draft the email" can reuse them. |
| F9 | "One answer per device" is only a `localStorage` flag. | `take-survey.component.ts` | The About copy (2b) promises more than the code does. Either soften the copy or add a server-side device token. |
| F10 | **Pricing conflict.** The handoff says writing is free and publishing is paid. Today the web is "browse free, create with the app" (`write-access.service`, `/pricing` → get-the-app), and iOS puts the **whole app** behind `PaywallView` in `RootView`. Publish is gated server-side by `hasPaidSurveyAccess`. | web, iOS, backend | This needs a product decision before building 1d / 2j (§8). |
| F11 | The web working tree has uncommitted edits to `styles.css`, landing, footer and platform-menu. | git status | Commit or stash them before Phase 3 so the token work starts from a clean base. |

---

## 3. Shared contract (single source of truth)

Define the contract once in `todd-backend/functions/survey/README` (or an OpenAPI fragment in `frontend/src/assets/api/ai-backend.yaml`). Then mirror it as TypeScript in `src/app/models/survey.model.ts` and as Swift `Codable` in `PulseIOS/Models/SurveyModels.swift`.

### 3.1 `Survey` additions

```ts
closeRule?: { type: 'manual' | 'date' | 'count'; value?: string | number }; // ISO date or count
collectIdentity?: boolean;          // true = ask name + email; false = anonymous
publishedAt?: string;               // exists, now always set on publish
closedAt?: string;
lastViewedAt?: string;              // owner opened Results
newSinceViewed?: number;            // server-computed, read-only ("6 new")
everPublished?: boolean;            // enables the Results step after Back to draft
insights?: ToddInsightsSummary;     // read-only, merged in on GET/list (see 3.2)
```

Server-owned fields (`responseCount`, `newSinceViewed`, `insights`, `publishedAt`, `closedAt`, `everPublished`) are **ignored on PUT**, the same way `buildSurveyWritePayload` already protects `responseCount`. Without this, autosave would overwrite them.

### 3.2 TODD insights (stored in `tenants/{t}/surveyInsights/{surveyId}`)

These are stored in a separate doc, not on the survey. Client PUTs then can't overwrite them, and regeneration doesn't bump the survey's `updatedAt`.

```ts
interface ToddInsights {
  status: 'waiting' | 'pending' | 'ready' | 'error';
  answerCount: number;              // answers included in this summary
  updatedAt: string;
  summary: string;                  // 1f headline (~26px), ≤ 200 chars
  findings: { n: string; text: string }[];          // exactly 3; n = "72%", "8.4", "11"
  nextMove: {
    id: string;
    eyebrow: string;                // "Your next move"
    text: string;                   // 18/700 recommendation
    why: string;                    // explanation
    segment?: { questionId: string; match: string[] }; // who it's about, e.g. rating ≤ 6
    actions: ('draft_email' | 'add_task' | 'another_idea')[];
  } | null;
  themesByQuestion: Record<string, { label: string; count: number; quoteIds: string[] }[]>;
  model: string; promptVersion: string;  // for evals/debugging
}
type ToddInsightsSummary = Pick<ToddInsights, 'status' | 'answerCount' | 'updatedAt' | 'summary'> &
  { nextMove: Pick<NonNullable<ToddInsights['nextMove']>, 'id' | 'text'> | null };
```

### 3.3 Response record addition

```ts
answers: Record<questionId, value>;   // NEW canonical
responses: any[];                     // legacy positional, still written for one release
respondent?: { name?: string; email?: string }; // only when survey.collectIdentity
```

### 3.4 New and changed endpoints

| Method | Path | Purpose | Screen |
|---|---|---|---|
| POST | `/surveys/todd/draft` | `{prompt}` → `{title, description, questions[]}` (not saved) | 1b, 2h |
| POST | `/surveys/:id/todd/review` | → `{suggestions:[{id, questionId, message, fix: QuestionPatch}]}` | 1c, 2i |
| GET | `/surveys/:id/insights` | full `ToddInsights` | 1f, 2l |
| POST | `/surveys/:id/insights/refresh` | owner-forced refresh (rate-limited) | — |
| POST | `/surveys/:id/todd/next-move/alternative` | replaces `nextMove`, keeps a history | 1f "Another idea" |
| POST | `/surveys/:id/todd/next-move/email` | → `{subject, body, recipients[]}` draft, **never sends** | 1f "Draft the email" |
| POST | `/surveys/:id/todd/next-move/task` | wraps `POST /moves` with a link back to Results | 1f "Add to my tasks" |
| POST | `/surveys/:id/close` | `status: archived`, `closedAt` | 1e "Close now" |
| POST | `/surveys/:id/unpublish` | existing; also keep `everPublished` | 1e "Back to draft" |
| POST | `/surveys/:id/publish` | existing; now `link_only`, honours `closeRule`/`collectIdentity` | 1d, 2j |
| POST | `/surveys/:id/viewed` | sets `lastViewedAt` | 1f open |
| GET | `/surveys` | existing; now includes `insights` summary + `newSinceViewed` | 1a, 2g |
| GET | `/surveys/:id/results` | per-question aggregates (extended F6) + recent quotes | 1f, 2l |
| GET | `/public/surveys/:id` | existing; add `ownerDisplay {name, logoUrl}`, `collectIdentity` | 1g, 2d |
| POST | `/public/surveys/:id/responses` | existing; accepts `answers` + `respondent`, enforces `closeRule` | 1g, 2d |

`/results` returns aggregates, not raw responses, so clients don't download every answer to draw charts. Keep `GET /responses` for CSV export, which is built on the client.

---

## 4. Backend architecture

### 4.1 Answers keyed by question id (blocks drag-reorder; do first)

1. The clients generate a UUID `id` for every new question. The backend keeps the `q_n` fallback only for legacy surveys and never renumbers.
2. `submit*Response` writes `answers` (keyed by id) **and** the legacy `responses` array.
3. `normalizeResponsesForRead` prefers `answers` and otherwise rebuilds it from the positional array using the survey's question order **at the time the response was submitted**. Snapshot `questionIds[]` onto each new response doc so this always works.
4. Run a one-off backfill script (`scripts/backfill-survey-answer-ids.js`) that adds `answers` and `questionIds` to every existing response, using the current order.
5. Until (1)–(4) ship, the Write screen disables reordering and deleting questions once a pulse has answers ("Duplicate to change the order").

### 4.2 Lifecycle and close rules

- `publishSurvey`: `status: published`, `visibility: link_only`, `publishedAt` (first time only), `everPublished: true`. Store `closeRule` and `collectIdentity` from the Share screen (send them in the publish body).
- `submitPublicSurveyResponse` runs in a **transaction**: read the survey, reject with `SURVEY_CLOSED` if `status != published`, the date has passed, or the count is reached; write the response; `increment(1)`; if `closeRule.type == 'count'` and the limit is now reached, set `status: archived, closedAt` in the same transaction.
- Date close is also applied by the hourly sweep (§4.4), so the status changes even if nobody submits.
- When `collectIdentity` is true, require name and email from respondents. When false, strip any `respondent` field the client sends.

### 4.3 New module: `survey/surveyInsights.service.js`

All model calls go through `aiProvider.service.generatePlanningJson({system, user, schema})`, which already supports Anthropic structured output. Add a `purpose` argument so Pulse can use its own model config: a fast model for draft and review, a stronger model for summaries. `costControl.js` meters calls per tenant.

| Function | Input to the model | Output | Notes |
|---|---|---|---|
| `draftSurvey(prompt, ctx)` | the sentence + tenant business profile (name, industry) | 3–5 questions using allowed types only | Validate with `surveys.validator.js` before returning. |
| `reviewSurvey(survey)` | questions only | ≤ 3 suggestions, each with a `QuestionPatch` | Cache by hash of the question content. Run when the client asks (debounced), not on every keystroke. |
| `summarize(surveyId)` | extended aggregates + ≤ 200 free-text answers (stratified, newest first), **no identity fields** | `ToddInsights` | Theme clustering for text questions happens in the same call. |
| `alternativeMove(surveyId)` | current insights + rejected move ids | new `nextMove` | Keep the last 5 rejected moves to avoid repeats. |
| `draftEmail(surveyId, moveId)` | nextMove + segment + owner profile | subject/body | Recipients = respondents in `segment` that have an email. Return 409 when the survey is anonymous. Hand off to Email Creator (`emailCreatorHandoff.service`) or open as `mailto:`. |

**Prompt-injection guard.** Respondent text is untrusted. Put it inside clearly delimited data blocks and ask only for schema output. TODD output is display text only and never triggers tool calls. "Draft the email" always opens a draft and never sends it.

### 4.4 When summaries regenerate

```
onDocumentCreated(tenants/{t}/surveyResponses/{r})   ← triggers/surveyResponseCreated.js
  └─ shouldRefresh(survey, insights):
        count ≥ 5 AND insights.status ≠ 'pending' AND
        ( insights.answerCount < 5                   // first summary
          OR count − insights.answerCount ≥ 5
          OR (count > insights.answerCount AND updatedAt older than 1h) )
     └─ transaction: set status 'pending' (acts as a lock) → summarize() → write 'ready'
        first time crossing 5 → push.notify({app:'pulse', category:'pulse_summary',
            title:"TODD read your first 5 answers", route:`/survey/${id}/results`,
            collapseId:`pulse-summary-${id}`})

scheduledSurveyInsights (hourly)
  └─ live surveys with count > insights.answerCount and updatedAt > 1h → summarize()
  └─ apply closeRule.date
  └─ clear 'pending' locks older than 10 min (crash recovery)
```

Below 5 answers, `insights.status` is `waiting` and clients show the "after 5 answers. N so far." card.

### 4.5 Home "next move" and "N new"

`listSurveys` joins each survey with its insights summary (batch `getAll` on `surveyInsights`). It computes `newSinceViewed` as the count of responses since `lastViewedAt`: either a counter that the submit transaction increments and `/viewed` resets to 0, or a query. The counter is cheaper. The 1a card is the newest `insights.nextMove` across live surveys. "Later" is stored on the client (24h per move id), so no backend change is needed.

### 4.6 "Live" results

Both clients poll `GET /surveys/:id` (cheap, includes `responseCount` + `insights` summary) **every 15s while the screen is visible**. When the count or `insights.updatedAt` changes, they refetch `/results` and `/insights`. This works the same on web and iOS without adding Firestore to Pulsur. A Firestore `onSnapshot` on the survey doc can replace polling on the web later.

### 4.7 Tests (jest, `__tests__/`)

- `surveys.service.test.js`: answers-by-id read/write, legacy fallback, close-by-count inside the transaction, anonymous strips identity, publish → `link_only`, PUT ignores server-owned fields.
- `surveyInsights.service.test.js`: `shouldRefresh` table tests, schema validation of model output (mock `aiProvider`), identity never in the prompt, injection fixture ("ignore previous instructions…" in a text answer).
- **Eval fixtures:** 4 seeded surveys (client check-in, event, idea, team) with 5 / 38 / 200 answers. Snapshot the outputs and review them by hand each time `promptVersion` changes.

---

## 5. Web architecture (Angular 19, standalone)

### 5.1 Routes

| Path | Component | Replaces |
|---|---|---|
| `/` | `LandingComponent` (redesigned, 2a) | same |
| `/about` | `AboutComponent` NEW (2b) | — |
| `/help` | `HelpComponent` (redesigned, 2c) | same |
| `/app` | `PulsesHomeComponent` (1a; 1b when empty) | `pulse-home` + `survey-list` |
| `/survey-edit` | `NewPulseComponent` (1b) | `survey-add` (no id) |
| `/survey-edit?id=` | `WriteStepComponent` (1c) | `survey-add` (id) |
| `/survey/:id/share` | `ShareStepComponent` (1d / 1e by status) | `survey-view` |
| `/survey/:id/results` | `ResultsStepComponent` (1f) | `survey-dashboard` |
| `/take/:id` | `TakeSurveyComponent` (redesigned, 1g/1h/2d/2e) | same |
| `/survey-list` → `/app` · `/survey/:id` → `…/share` · `/survey-dashboard/:id` → `…/results` | redirects | keeps old links, emails and Universal Links working |

The three step routes are children of a `PulseShellComponent` (`/survey/:id`) that loads the survey once, shows the pulse bar and step bar, and provides `PulseEditorStore`. Write can stay on `/survey-edit?id` as the handoff says, or move to `/survey/:id/write` with a redirect. **Recommendation:** move it, so all three steps share one shell.

### 5.2 Folder layout

```
src/app/features/pulse/
  shell/            pulse-shell.component, pulse-bar.component, step-bar.component
  home/             pulses-home.component, pulse-row.component, next-move-card.component
  new/              new-pulse.component, template-cards.ts
  write/            write-step.component, question-card.component, type-chips.component,
                    question-preview.component, todd-review.component
  share/            share-step.component, share-checklist.component, live-hero.component, qr-dialog.component
  results/          results-step.component, todd-summary.component, next-move.component,
                    rating-card / choice-card / text-card.component, csv-export.ts
  pulse-editor.store.ts        signals: survey, selectedQuestionId, saveState, dismissedSuggestions
  pulse-insights.service.ts    polling + /results + /insights
  pulse-state.ts               pure fns: step, primaryAction(status), hint, saveBlockers
src/app/shared/todd/           todd-card.component (avatar + --t-blue), status-tag, pill-button, segmented
src/app/features/about/        about.component
```

`pulse-state.ts` holds the "one primary action per state" table and `saveBlockers` as pure functions with unit tests. Pulsur mirrors the same table (§6.4).

### 5.3 State and autosave

`PulseEditorStore` (signal-based, provided by `PulseShellComponent`):
- `survey = signal<Survey>()`, `dirty`, `saveState: 'idle'|'saving'|'saved'|'error'`, `savedAt`.
- Each edit runs `patch()` → an effect pushes to a `Subject` → `debounceTime(1000)` → `concatMap(PUT)`. Saves run strictly in order, and the last edit always wins.
- Optimistic concurrency: send `updatedAt` and have the backend return 409 if the doc changed since, e.g. when the same pulse is edited on Pulsur. On 409 the screen shows "Updated on another device · Reload".
- The TODD review runs from a separate debounced stream (3s after the last edit, and only when the question content hash changes).
- Flush pending saves on `beforeunload` and before leaving the route (Next: Share, back).

### 5.4 Design tokens

Add the "Find" tokens table to `src/styles.css` as `:root` variables plus `[data-theme=dark]` / `prefers-color-scheme`. Check `@taliferro/ui` first: other TODD apps use the same look, so the tokens may already exist there and should be imported rather than copied. Bootstrap is still installed. Don't use its components on the new screens (no borders, pill radii), and plan to drop it once the old screens are deleted. Lucide icons: add `lucide-angular` or inline the SVG paths from the prototype, at stroke-width 2.75. Font Awesome stays for old screens until they're removed.

### 5.5 Respondent flow (`/take/:id`)

- Layout switches at a breakpoint: phone (1g/1h) or desktop card (2d/2e). Both use one `TakeSurveyStore` (index, answers by question id, validation).
- Keyboard: Enter = Next, Shift+Enter / ← = Back, 0–9 (rating) or 1–n (choices).
- Identity step first when `collectIdentity`.
- Done screen: no countdown redirect, "What you sent" summary on desktop, and a "Want to run your own?" card linking to `/`.
- Preview (`?preview=1`) and owner mode keep the existing rule and show the yellow "Preview · answers aren't saved" pill.

### 5.6 TODD assistant

"Ask TODD" (2c, and anywhere it appears) opens the existing assistant box. Every pulse screen calls `PulseAssistantSignalService.setPageContext({feature:'pulse', page:'results', selectedEntityId, summary: insights})`, so chat answers are about the open pulse. The Results card itself doesn't use chat; it reads the stored `insights`.

### 5.7 What gets deleted

`pulse-home` (Customer Health, Care Cycle), `survey-list`, `survey-view`, `survey-dashboard`, `cockpit-*`, `arc-gauge`, `utils/cockpit-diagnosis-board.util.ts`, `todd-status-indicator.util.ts`, `business-symptom.model.ts`, the landing `buildStats` counters, and Help's health sections. Delete them only after the redirects ship and Cypress passes.

### 5.8 Tests

- Karma: `pulse-state.ts` table, `PulseEditorStore` debounce/ordering/409, results aggregation rendering, CSV escaping.
- Cypress (emulators, existing `e2e` script): new → TODD draft (stubbed) → write → share → publish (paid and unpaid tenant) → take on phone and desktop viewports → results with <5 and ≥5 answers → close → redirects from old URLs.

---

## 6. Pulsur (iOS) architecture

### 6.1 Rename to Pulsur

| Item | Change |
|---|---|
| `CFBundleDisplayName` | `Pulse` → **`Pulsur`** (`project.yml`) |
| App Store Connect name | Rename the existing record to "Pulsur" (check the name is available). **Keep the bundle id** `tech.taliferro.pulseios`: a new bundle id would mean a new app with no subscribers, reviews or StoreKit product. |
| `PULSE_APP_STORE_PRODUCT_ID` | keep `Pulse10001` (subscription group can be relabeled in ASC) |
| User-facing strings | Face ID usage text, `AwardUnlockView(appName:)`, paywall, sign-in, onboarding copy |
| Xcode target / folder `PulseIOS` | **keep** for now. Renaming the target just churns `project.yml`, signing and the TODD*Kit wiring. |
| Universal Links | keep `applinks:pulse.taliferro.tech`; add `/survey/*/results` to the AASA paths for push and email deep links. The AASA file isn't in `web-products/pulse/public/`, so find where it's served. |
| App icon | `design_handoff_todd_pulse/public/assets/todd-pulse-icon.png` (or a Pulsur variant) |
| Web copy | "iPhone app coming soon" → "Get Pulsur for iPhone" once it's live |

### 6.2 Structure

```
PulseIOS/
  App/            PulsurApp (was PulseIOSApp), RootView, AppTabs (Pulses · Help · Account + "+" button), DeepLinkRouter
  DesignSystem/   Tokens.swift (Color assets light/dark from §tokens), Typography, PillButtonStyle,
                  ToddCard, StatusTag, ChipRow, Segmented, StepBar
  Features/
    Welcome/      WelcomeView (2f) — Get started → existing PreAuthSurveyBuilderView path; I have an account → SignInView
    Pulses/       PulsesView + PulsesModel (2g), NextMoveCard, PulseCard
    NewPulse/     NewPulseSheet (2h): TODD prompt, templates, blank
    Pulse/        PulseFlowView (step bar host) + PulseEditorModel
      Write/      WriteView (2i), QuestionCard, TypeChipsScroller, ToddSuggestionBar
      Share/      ShareView (2j), LiveView (2k), QRCodeView
      Results/    ResultsView (2l), SummaryCard, NextMoveCard, RatingChart / ChoiceBars (Swift Charts), ThemeChips
    Help/         HelpView (2m)
    Account/      AccountView (TODDProfileKit), AboutView (2n), sign out
  Models/         SurveyModels (+ closeRule, collectIdentity, insights), ToddModels (Insights, Suggestion, Draft)
  Services/       SurveyAPIClient (+ §3.4 endpoints), PushService (port of outreach-ios), PulseState (primary-action table)
```

Delete `Features/Status` (Customer Health) and `Shared/StatTile`. Fold `Features/Dashboard` into `Pulse/Results`. Replace `SurveyList` with `Pulses`. Rebuild `SurveyBuilder` as `Pulse/Write`, reusing its question-type enum.

### 6.3 Key decisions

- **State:** `@Observable` (iOS 17 Observation) `PulseEditorModel` per open pulse. It autosaves with a 1s debounced `Task` that cancels and restarts on each edit, saves in order, and handles 409 like the web.
- **Tab bar:** a native `TabView` with three tabs, plus an overlaid 62pt round "+" that presents `NewPulseSheet`. On iOS 26 the system floating glass tab bar matches 2g with no custom work. Earlier iOS gets the standard bar. **Keep `IPHONEOS_DEPLOYMENT_TARGET` at 17.0** and build with the iOS 26 SDK.
- **Live:** poll every 15s while `scenePhase == .active` and a pulse screen is visible (§4.6). Pull-to-refresh as well.
- **Share:** `ShareLink` (system sheet), `UIPasteboard`, a QR code from `CIFilter.qrCodeGenerator`, and "Try it" opens `/take/:id?preview=1` in `SFSafariViewController`.
- **Push:** port `outreach-ios/OutreachIOS/Services/PushService.swift`. Add the `aps-environment` entitlement to `project.yml`, register with `POST /mobile/push/devices` (`app: "pulse"`), and ask permission **on the Live screen** (2k: "I'll ping you at 5 answers"), not at launch. A tap opens `route` through `DeepLinkRouter` to Results.
- **Paywall:** depends on the F10 decision. If the design wins, remove the `!entitlementService.isEntitled` gate from `RootView` and show `PaywallView` as a sheet from "Publish and get my link" (2j). That needs the backend to allow create and update without entitlement.
- **Respondents** keep using the web flow (handoff: "Respondents on iPhone use the web flow").

### 6.4 Shared logic parity

`PulseState.swift` and `pulse-state.ts` implement the same table:

| Status | Condition | Primary | Secondary | Hint fallback |
|---|---|---|---|---|
| draft | no title or no complete question | Keep writing | — | "Add a question to finish" |
| draft | ready | Share | Edit | "Ready to publish" |
| published | — | See results | Copy link | insights.nextMove.text ?? "N answers so far" |
| archived | — | See results | Reopen | "Closed · N answers" |

Write a small set of JSON fixtures (`fixtures/pulse-state-cases.json`) that both unit test suites load, so the two tables can't drift apart. Pulsur has no test target today (`testTargets: []`). Add `PulsurTests` for this table, model decoding and the autosave ordering.

---

## 7. Phased delivery

Each phase can ship by itself. Web and iOS run in parallel after Phase 1.

| Phase | Scope | Depends on | Size |
|---|---|---|---|
| **0. Decisions & base** | Answer §8. Commit the web WIP (F11). Write the §3 contract. Import or check the tokens in `@taliferro/ui`. | — | S |
| **1. Backend data** | §4.1 answers-by-id + backfill · §4.2 lifecycle/close rules/identity/`link_only`/atomic count · server-owned field protection · 409 on stale `updatedAt` · `/viewed`, `/close`, `/results`, list join · tests | 0 | M |
| **2. Backend TODD** | `surveyInsights.service` (draft, review, summarize, alternative) · trigger + hourly sweep · push at 5 · eval fixtures | 1 | M–L |
| **3. Web core flow** | Tokens + shared TODD components · shell/step bar · 1a, 1b, 1c (autosave, all types, reorder after 1.1), 1d/1e, 1f · `/take` redesign 1g/1h/2d/2e · redirects · Cypress | 1 (2 for TODD parts; stub until then) | L |
| **4. Pulsur core** | Rename · design system · tabs · 2f–2l · push · paywall move · tests · TestFlight | 1, 2 | L |
| **5. Marketing pages** | 2a landing, 2b about, 2c help (web) · 2m help, 2n about (iOS) | 3 / 4 | M |
| **6. Next-move actions** | Draft the email (Email Creator handoff), Add to my tasks (Moves), CSV export, slugs (optional) | 2, 3 | M |
| **7. Cleanup & release** | Delete old screens (§5.7, §6.2) · drop Bootstrap from new screens · App Store "Pulsur" listing and screenshots · web "Get Pulsur" CTA | 3–6 | S |

Within Phase 3, build in this order: **Results (1f)** first, since it's the reason to use the product and it proves the insights contract end to end; then Write, Share, Home and Take.

---

## 8. Decisions needed before Phase 1

1. **Pricing model (F10).** Design: write free, publish paid. Today: web is browse-only without a plan, iOS paywalls the whole app. *Recommendation:* adopt the design. It's the lower-friction funnel, and TODD drafting questions on the free tier is the hook. The backend already gates only publish and public submit, so most of the work is client-side.
2. **Where web users pay.** `/pricing` currently says "get the app" (App Store exclusive billing). If publishing on the web needs a plan, does "Choose a plan to publish" send people to Pulsur, or bring back web checkout (`/survey/checkout` still exists)?
3. **Brand split.** Web stays "TODD Pulse" and iOS is "Pulsur"? The respondent footer ("Powered by TODD Pulse") and the landing iPhone CTA depend on this.
4. **"Add to my tasks"** creates a Moves task. Should it work for users without a Moves subscription (as a free system task), or be hidden for them?
5. **"Draft the email"** hands off to Email Creator / Outreach, or opens a simple `mailto:` with the draft? *Recommendation:* `mailto:` in v1 and the Email Creator handoff later.
6. **Link slugs** (`/take/q4-check-in`) or keep ids? *Recommendation:* keep ids for v1.
7. **"One answer per device" (F9):** soften the About copy, or add a server-side device token?

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Reorder scrambles historical results (F1) | Phase 1 answers-by-id; reorder stays locked until it ships |
| LLM cost from frequent regeneration | Threshold rules (§4.4), `pending` lock, per-tenant `costControl`, cache review by content hash |
| Summary is wrong or overconfident with few answers | 5-answer minimum, show "from N answers", findings must cite counts, `promptVersion` evals |
| Prompt injection via respondent text | Delimited data, schema-only output, no tool calls, human-confirmed actions only |
| PII sent to the model | Strip `respondent` before the prompt; email drafting gets recipients from the server, not the model |
| Web and iOS edit the same draft | `updatedAt` precondition → 409 → reload prompt |
| Old links break | Redirects for `/survey-list`, `/survey/:id`, `/survey-dashboard/:id`; AASA paths updated |
| App Store rename rejected or name taken | Check "Pulsur" availability in ASC now; the bundle id is unchanged either way |
