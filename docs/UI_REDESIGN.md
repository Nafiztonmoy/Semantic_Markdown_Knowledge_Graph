# Frontend redesign

## Apply the update to your running project

1. Keep your existing backend, database, uploaded documents, root `.env`, and `apps/web/.env.local`.
2. Copy this archive's `apps/web/src`, `apps/web/public`, `apps/web/tailwind.config.ts`, `apps/web/package.json`, `apps/web/e2e`, and `apps/web/tests` into the corresponding locations in your existing project. The dependency versions and lockfile are unchanged.
3. From `apps/web`, run `npm ci` if dependencies are missing or were installed for another operating system, then `npm run dev`.
4. Keep your existing API, worker, PostgreSQL, and Redis running. The frontend defaults to `http://localhost:8000`; set `NEXT_PUBLIC_API_URL` in `.env.local` if your API uses another address. Restart the frontend after changing that value.

For a fresh setup, follow the original root README. This is a source-only archive: it intentionally omits installed dependencies, virtual environments, database directories, caches, local secrets, build outputs, and previous test results. It contains the original backend and infrastructure source, unchanged. It is not a backup of your database. Do not replace your existing database directory with this archive.

## What changed

Every frontend screen has a new light, green-accented design: public entry page, login, registration, workspace shell, dashboard, document library, editor/preview, search, knowledge graph, assistant, and settings. Added consistent error/not-found views, shared UI controls, self-hosted typography, mobile navigation, a real dashboard graph preview, document sorting, and topic browsing.

The existing product name, primary routes, navigation labels, API endpoints, and backend functionality remain. No backend schema or provider configuration changed. No third-party dependencies were added.

Behavior improvements:

- Quick search has a modal dialog, real keyboard-focusable result links, a clear control, IME handling, and stale-response protection.
- Search snippets are rendered as text with supported highlights rather than injected HTML.
- Existing-document autosave includes title and tag changes and avoids overlapping writes. New documents save explicitly.
- Revision snapshots can be inspected and restored with confirmation; pending autosave pauses during restoration.
- Unsaved edits trigger an in-app link confirmation and browser unload protection.
- Viewer mode presents read-only documents and hides editing/membership actions.
- Deleting documents offers immediate restore. Partial import failures are displayed.
- Citation links use exact section targets when available. Wiki links use resolved document identities where the API supplies them.
- The graph has topic filtering, keyboard-accessible node/connection lists, zoom/fit/center, and selection inspection.
- The assistant distinguishes retrieved excerpts from AI generation when no provider key exists. Removed unsupported “anti-hallucination active” and infrastructure status claims.
- Accounts with no workspace can create their first workspace.

## Validation performed

| Check | Result |
| --- | --- |
| `npm run type-check` | Passed |
| `npm run test:ui` | 15/15 passed |
| CSS parse and source-format pass | Passed with existing PostCSS and Babel tooling |
| Strict premium UI static audit | Passed: zero violations, warnings, or unresolved owners |
| Backend/infrastructure source comparison against original ZIP | Unchanged; see packaging verification |
| `npm run test:run` (Vitest) | Could not start: source archive contains Windows native packages; Linux Rollup binary is absent |
| `npm run build` | Blocked by sandbox runtime error: `ENOENT ... uv_resident_set_memory` |
| Next development server | Cannot obtain the missing Linux SWC package; npm registry download unavailable |
| `npm run lint` | Original repository has no ESLint configuration/dependencies; Next opens its setup prompt |
| Official DESIGN.md CLI lint | CLI not cached; unavailable offline |
| Browser visual/responsive QA and full-stack Playwright | Not run successfully: cloud browser blocks local server URLs; no accessible database/browser runtime |

The 15-test regression runner uses the existing TypeScript, React Testing Library, and jsdom packages without a native bundler. Run it on Node 22.12+ or Node 24. It tests search mode semantics, clear/focus behavior, accessible result links, source anchors, stale responses, IME composition, search failure states, safe snippets, confirmation cancellation, saving title/content/tags, autosave, read-only mode, and explicit new-document saving. APIs, navigation, and CodeMirror are mocked only in this test runner. Production application paths continue using the real API and CodeMirror.

These checks are not a substitute for rendered browser verification or backend integration. No pixel-perfect, WCAG-conformance, full-stack, or production-readiness claim is made.

## Verify locally before release

With your existing backend and database running:

```bash
cd apps/web
npm ci
npm run type-check
npm run test:ui
npm run test:run
npm run build
npm run dev
```

In another terminal, from `apps/web`:

```bash
npx playwright install chromium
npm run test:e2e
```

Check desktop and phone widths for the dashboard, library, editor, search, graph, assistant, and settings. Exercise create/edit/autosave/import, history restoration, delete/restore, role restrictions, graph selections and filters, citations, provider-disabled answers, network errors, command search, and keyboard navigation. Add/configure ESLint if you want to run the existing `lint` script; it was absent in the supplied project.

## Design ownership

See root `DESIGN.md` and `UX-CONTRACT.md` for tokens, responsive rules, and shared behavior. `premium-audit.json` records static checks only. Public/authentication graph content is explicitly illustrative; authenticated workspace graphs and counts come from the API.
