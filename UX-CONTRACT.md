# NexusDocs UI behavior contract

Visual ownership is documented in DESIGN.md. Existing FastAPI endpoints and authorization are the business source of truth. The frontend never replaces server authorization.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | components/ui.tsx Field and shared field CSS | API schemas; this contract | Auth, workspace details, Markdown metadata | UI regression; typecheck |
| Select/Listbox | Native select | This contract | Workspace switch, role, sort, graph topic; platform popup accepted | Browser check pending |
| Scrollbar | app/globals.css | DESIGN.md | Standards properties plus WebKit fallback | Static audit |
| Toast | components/ui.tsx Notice | This contract | Inline error, success, information; no transient toast loss | Component tests |
| CRUD | lib/api.ts and existing App Router routes | FastAPI contracts | Create opens saved document; edit stays; delete stays with restore | Editor/component tests; live E2E pending |
| Dialog | components/ui.tsx Dialog and ConfirmDialog | This contract | Search, confirmation | Component tests; native dialog focus test pending browser |
| Search | SearchField, SearchModes, CommandPaletteModal | FastAPI search schema | Submit full search; 300 ms debounced palette; local title filter | Stale-response, IME, clear, error regression tests |

## Navigation and permission behavior

Preserve existing routes and main navigation names. Workspace switching goes to that workspace dashboard. A newly registered account with no workspace gets a real create-workspace form. Viewer mode has no editing or membership actions. Editors retain the backend-authorized general workspace edit capability. Owners alone see membership mutations. Settings refreshes the shared workspace name after saving.

## Writing and saving

CodeMirror and Markdown preview remain first-class. Existing documents autosave after a 3-second pause, including title and tags; new documents require Save. Concurrent saves are prevented. An edit made while saving remains unsaved and schedules a later save. Failed saves preserve drafts and provide explicit retry via Save. In-app link navigation with edits requires confirmation. Browser unload uses beforeunload. Browser history navigation and session recovery need additional live verification; no offline persistence is claimed. Restoration pauses pending autosave and requires confirmation. Version history allows snapshot inspection before restoring.

## Search and sources

Full search submits explicitly; the command palette debounces for 300 ms. Stale responses are ignored, clearing is immediate, and IME composition defers requests. Committed search and library filters are reflected in the URL. Library filtering is local on the real fetched collection. Result snippets render text plus a small allowlist of highlight markers, never server HTML injection. Source links target exact section IDs when supplied. Outgoing resolved wiki links open their document; unresolved links open a title-filtered library.

## Feedback and data safety

Errors appear in context and preserve input. All destructive operations use named app-owned confirmation dialogs. Document delete offers immediate restore. Membership changes show success only after the server confirms. Import messages include failed files and explain background indexing. Metrics come from actual API responses. AI provider-disabled results are labeled as retrieved excerpts, not generated answers.

## Responsive and accessibility policy

Use semantic links and buttons, visible focus, labels, a skip link, and live status/error text. Native selects deliberately accept operating-system-owned popup geometry. A native dialog supplies modal focus containment and Escape handling. Graph node and edge lists provide keyboard alternatives to canvas selection. The drawer has a visible close action; the desktop sidebar collapses below 768 px. The editor stacks at narrower widths rather than clipping panes. Reduced motion stops skeleton animation; canvas layout does not animate.

## Verification boundary

Component tests mock API calls, Next navigation, and CodeMirror. They verify UI state behavior, not database or editor-engine integration. TypeScript checks the actual application. Real browser screenshots, responsive visual QA, full-stack E2E, and Next production build remain required before release; see docs/UI_REDESIGN.md for environment limits and commands.
