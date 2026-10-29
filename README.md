# Pulse

Pulse is 16Ahead's survey product: write a short pulse of focused questions, share a link, and read the answers as a decision rather than a pile of responses. Built by [Taliferro Tech](https://taliferro.com) as part of the [16Ahead](https://app.16ahead.com) product family.

**Live:** [pulse.taliferro.tech](https://pulse.taliferro.tech) · **iOS twin:** `apps/ios/pulse-ios` (Pulsur, native Swift, separate repo)

## How it fits together

| Piece | What it is |
| --- | --- |
| This repo | Angular 19 standalone-component app (Bootstrap 5, Font Awesome). Public pages are prerendered at build time; everything else renders in the browser. |
| `@taliferro/ui` | Shared menu, footer, theme and product-page components used by every Taliferro web product. Installed from a **sibling checkout** (`file:../../taliferro-ui`), not from npm. |
| Firebase project `taliferrotech` | Shared by the 16Ahead hub and all its products. Pulse uses Firebase Auth (session), Firestore (`users/{uid}` for tenant lookup), and Hosting (site `todd-pulse`). |
| `https://api.taliferro.tech/api` | The shared 16Ahead backend. Surveys, public survey/response endpoints, profile, account/billing, checkout, onboarding and the in-app assistant. |
| 16Ahead hosted login | Sign-in isn't done in this app. `/login` sends people to the hub's hosted login (`app.16ahead.com/login?client=pulse-web` on 16ahead.com hosts, the legacy `todd.taliferro.tech/login` on localhost and taliferro.tech hosts; see `hostedLoginUrl` in `@taliferro/ui/platform/hosted-login.model`), which returns a custom token to `/auth/callback`. |

## Prerequisites

- **Node.js 22** (Angular 19 supports 18.19+, 20.11+ or 22; the team builds on 22) and npm
- **Angular CLI** — optional; `npx ng …` and the npm scripts work without a global install
- **Firebase CLI** (`npm i -g firebase-tools`) — runs the emulators for the end-to-end tests; no Firebase login is needed for that
- **Java runtime** (e.g. `brew install openjdk`) — the Firestore emulator used by the end-to-end tests needs it
- **Google Chrome** — the unit tests run in headless Chrome
- Access to the GitHub repos `tshowers/pulse` and `tshowers/taliferro-ui`
- A 16Ahead account to sign in with (any account the hosted login accepts; sign in once at [app.16ahead.com](https://app.16ahead.com))

### What you don't need

- **An environment file or secrets.** The config is committed (see [Configuration](#configuration)).
- **Access to the `taliferrotech` Firebase project.** You can run the app and all the tests without it. Deploys are done only by the project owner (see [Contributing](#contributing)).

## Get the code

`@taliferro/ui` is resolved from two folders up, so the checkouts have to sit side by side like this or `npm install` fails:

```
corporate/
├── taliferro-ui/          # git@github.com:tshowers/taliferro-ui.git
└── web-products/
    └── pulse/             # git@github.com:tshowers/pulse.git (this repo)
```

```bash
mkdir -p corporate/web-products && cd corporate
git clone git@github.com:tshowers/taliferro-ui.git
git clone git@github.com:tshowers/pulse.git web-products/pulse
cd web-products/pulse
npm install
```

## Run it locally

```bash
npm start            # ng serve → http://localhost:4200
```

The dev server reloads on change. Signing in from `localhost` uses the hosted-login client `pulse-web-local`, which hands you back to your local `/auth/callback`. If sign-in doesn't come back to your machine, check that client's return URL in TODD's hosted-login setup.

## Configuration

There is **no `.env` file and nothing to fill in**. All configuration is committed in `src/environments/`:

- `environment.ts` — used by `ng serve` and development builds
- `environment.prod.ts` — swapped in for production builds (`angular.json` → `fileReplacements`)

| Key | Used for |
| --- | --- |
| `production` | Turns on the service worker, version polling and chunk-error recovery |
| `PLATFORM_URL` | Public origin, `https://pulse.taliferro.tech` |
| `backendURL` | 16Ahead backend base URL, `https://api.taliferro.tech/api` |
| `apiKey` | Bearer key sent to the backend's `/app-assistant` endpoint |
| `firebaseConfig` | Firebase web config for the `taliferrotech` project |
| `taliferroTenantId` | The Taliferro admin account; signed-in as this uid shows admin-only UI |
| `COMPANY_NAME` | Display name |
| `linkPreview` | Not currently referenced by the app |

These values ship in the browser bundle anyway (Firebase web config is public by design; security comes from Firestore rules in `firestore.rules` and backend auth), so they're safe to keep in the repo. Don't add real secrets here.

> **Heads-up: local development talks to production.** Both environment files point at the live `taliferrotech` Firebase project and the live `api.taliferro.tech` backend. Surveys you create while running locally are real data in your real account. The only isolated setup is the end-to-end tests, which run against the Firebase emulators.

### Backend

Pulse calls these backend routes (all under `backendURL`). Signed-in requests carry a Firebase ID token plus `X-Tenant-Id` / `X-User-Id` headers (`src/app/core/interceptors/id-token.interceptor.ts`, `src/app/services/pulse-tenant.interceptor.ts`).

| Route | Purpose |
| --- | --- |
| `/surveys` | Create, list, read, update, delete the signed-in tenant's pulses |
| `/public/surveys/:id`, `/public/surveys/:id/responses` | Respondent view (`/take/:id`) and submitting answers — no sign-in |
| `/profile`, `/onboarding/profile`, `/getting-started/pulse` | Profile and first-run setup |
| `/account` | Plan and billing state |
| `/survey/checkout`, `/survey/checkout/confirm` | Web subscription checkout |
| `/app-assistant` | General Assistant |

The backend lives in its own repo, [taliferro-tech/taliferrotech](https://github.com/taliferro-tech/taliferrotech) (Firebase Functions; older code comments call it `todd-backend`). Changing an endpoint is done and deployed there, not here.

## Tests

```bash
npm test             # Karma unit tests, watch mode
npm run test:ci      # Karma unit tests once, headless Chrome
npm run e2e          # Cypress end-to-end tests against the Firebase emulators
npm run cy:open      # Cypress UI (start `npm run emulators:start` and `npm start` first)
```

`npm run e2e` starts the Auth and Firestore emulators, serves the app on port 4377, and runs every spec in `cypress/e2e/`. The app only connects to the emulators when Cypress is driving it (see `appReady` in `src/app/app.config.ts`), so normal `npm start` sessions never do.

Ports used: 4200 (dev server), 4377 (e2e app), 9299 (Auth emulator), 8280 (Firestore emulator), 4501 (emulator UI). Stop any leftover `ng serve` or emulator processes when you're done — a busy port makes `deploy.sh` fail.

If Cypress fails with `bad option: --no-sandbox`, your shell has `ELECTRON_RUN_AS_NODE` set; `unset ELECTRON_RUN_AS_NODE`.

## Public pages and SEO

`/`, `/about`, `/help`, `/ios`, `/support` and `/pricing` are **prerendered** to real HTML at build time (`outputMode: "static"` in `angular.json`, list in `src/app/app.routes.server.ts`). Crawlers and link previews get each page's own content, title, description, Open Graph tags and canonical URL. Every other route renders in the browser only, served from `index.csr.html` (Firebase rewrite in `firebase.json`, service-worker fallback in `ngsw-config.json`).

To add a public page:

1. Add the route in `src/app/app.routes.ts` with `data: { meta: { title, description } }` — `src/app/shared/page-meta.ts` applies it.
2. Add it as `RenderMode.Prerender` in `src/app/app.routes.server.ts`.
3. Add it to `public/sitemap.xml` (and keep it out of the `Disallow` list in `public/robots.txt`).

Prerendering runs the app in Node, where there's no `window`, `document`, `localStorage` or `sessionStorage`. Code that runs on a public page during construction or `ngOnInit` must guard those (`typeof document === 'undefined'` or `isPlatformBrowser`). Event handlers are fine. `npm run build` fails with `document is not defined` if one slips through; `npx ng build --configuration development` shows the source file and line.

## Contributing

Work on a branch and open a pull request against `main`. **Don't deploy.** The project owner reviews, merges and deploys.

```bash
git checkout main && git pull
git checkout -b your-change
# …make the change…
npm run test:ci
npm run e2e
npm run build        # catches prerendering errors (see Public pages and SEO)
git push -u origin your-change
```

Leave the build's version bump out of your commits. `npm run build` rewrites the `version` in `package.json` and `public/assets/version.json` every time, and committing it makes branches conflict with each other and with deploy commits. Before committing, undo it with `git checkout -- public/assets/version.json`, and keep only your real changes to `package.json` (for example, new dependencies).

## Build and deploy

```bash
npm run build          # production build → dist/pulse/browser (anyone)
npm run deploy:hosting # production deploy (project owner only)
```

Every `npm run build` first runs `scripts/generate-version.js`, which bumps the version in `package.json` and `public/assets/version.json` (`YYYY.M.D-build.N`). The running app polls `version.json` and reloads itself when a newer build is deployed.

`deploy.sh` (`npm run deploy:hosting`) deploys to production and needs a `firebase login` with access to the `taliferrotech` project. Only the project owner runs it, from an up-to-date `main`. It:

1. builds the production bundle,
2. runs the unit tests and the end-to-end tests,
3. **runs `git add -A` and commits everything in the working tree** as `Deploy <timestamp>`,
4. deploys to Firebase Hosting site `todd-pulse` in project `taliferrotech`.

Commit or stash anything you don't want shipped before running it. It stops before committing or deploying if any build or test step fails.

## Project layout

```
src/
├── app/
│   ├── app.routes.ts          # all routes; public pages carry data.meta
│   ├── app.routes.server.ts   # which routes are prerendered
│   ├── app.config.ts          # providers, Firebase init, Cypress emulator hook
│   ├── features/              # one folder per page (landing, about, help, pulse/write|share|results, take-survey, …)
│   ├── services/              # auth, survey API, billing, assistant, sounds
│   ├── core/                  # HTTP interceptors
│   └── shared/                # header, menu, write-access prompt, canonical URL + page meta
├── environments/              # committed config (see Configuration)
└── index.html                 # default title/description/OG tags, GA4 tag
public/                        # robots.txt, sitemap.xml, icons, sounds, version.json
cypress/                       # e2e specs and emulator helpers
docs/                          # redesign plan
design_handoff_todd_pulse/     # design reference for the current UI
```
