# AGENTS.md

Guidance for Codex, Claude Code, Cursor, and other coding agents working in this repository.

## Project Overview

Paper Digest is a static Astro site for periodic paper digests, paper reading reports, and optional anonymous comments.

The main data source is Markdown content under `content/`, with JSON frontmatter. Astro builds the static site into `dist/`. GitHub Actions deploys the built site to GitHub Pages. An optional Cloudflare Worker can accept anonymous comments and write them back to the repository through the GitHub Contents API.

## Tech Stack

- Runtime/tooling: Node.js, npm, ripgrep (`rg`), ES modules (`"type": "module"`).
- CI Node version: Node 22, configured in `.github/workflows/deploy-pages.yml`.
- Local required Node version: `>=22.12 <25`, declared in `package.json`.
- Literature-review validation executes `rg` against raw Markdown; CI installs ripgrep explicitly.
- Site framework: Astro `^7.2.4`, static output.
- Frontend: React 19 and Fumadocs 16 notebook layout with Astro content slots; Tailwind CSS 4 and `src/styles/global.css`. The Idea direction tabs use `public/assets/ideas.js`.
- Content format: Markdown files with JSON frontmatter, parsed by local code in `src/lib/content.js`.
- Comments backend: optional Cloudflare Worker in `worker/comments-worker.mjs`.
- Database: none.

## Directory Structure

```text
config/
  research-interests.json   # Long-term topic/tag configuration
  runtime.json              # Public runtime config, currently commentsEndpoint
  remote-figure-dimensions.json # Measured dimensions for official remote figures
content/
  README.md                 # Content authoring instructions
  reported-papers.md        # Deduplication ledger for reported papers
  digests/                  # One Markdown file per digest
  papers/                   # One Markdown file per paper report
  templates/                # Content templates and selection rubric
src/
  components/               # Astro content components and React notebook/search/comments
  layouts/                  # Base page layout
  lib/content.js            # Reads config/content and converts limited Markdown to HTML
  lib/navigation.js         # Shared notebook data and navigation tree
  lib/notebook-search.js    # Explicit search projection, without audit ledgers
  lib/content-cache.js      # Request snapshots and production build cache
  styles/global.css         # Notebook styles and responsive content styles
  pages/                    # Static pages and generated asset endpoints
public/assets/
  ideas.js                  # Idea direction tabs
  papers/                   # Original official figures
  paper-previews/           # Generated responsive WebP variants; ignored
scripts/
  validate-content.mjs      # Content integrity checks
worker/
  comments-worker.mjs       # Optional Cloudflare Worker for comments
  wrangler.toml.example     # Example Worker config
.github/workflows/
  deploy-pages.yml          # GitHub Pages deployment
```

Generated or local-only directories such as `dist/`, `.astro/`, `.generated/`, `public/assets/paper-previews/`, `.npm-cache/`, `node_modules/`, `worker/.wrangler/`, and `.claude/` should not be edited manually.

## Setup Commands

```bash
npm install
```

For a clean CI-style install when `package-lock.json` is present:

```bash
npm ci
```

Cloudflare Worker setup is optional. The repo documents this flow, but the `wrangler` installation method is not confirmed by repository scripts:

```bash
cp worker/wrangler.toml.example worker/wrangler.toml
cd worker
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

## Development Commands

```bash
npm run dev
```

Prepares local figure previews, then starts Astro with `ASTRO_TELEMETRY_DISABLED=1`. Use the URL printed by Astro; the exact local port is not guaranteed. After adding or replacing a local figure during development, rerun `npm run images:prepare`.

```bash
npm run preview
```

Previews the built site after a successful build.

Lint command: not confirmed.

Format command: not confirmed.

Typecheck command: not confirmed.

## Test Commands

The confirmed validation command is:

```bash
npm run validate
```

This runs `scripts/validate-content.mjs` and `scripts/validate-idea-center.mjs`, checking content integrity, references, deduplication, and Idea review contracts.

Unit tests:

```bash
npm test
```

This runs the Node test suite for content projection, review-center contracts,
raw-corpus ripgrep audits, idea-center data, search ranking and pagination data,
content caching, figure preparation, comment persistence, and email publishing helpers.

End-to-end tests: not confirmed.

## Build Commands

```bash
npm run build
```

This runs `npm run validate`, generates local figure previews with `npm run images:prepare`, then runs `astro build` with telemetry disabled. Output goes to `dist/`. Figure originals are preserved. Builds do not fetch remote figure metadata.

GitHub Pages deployment uses:

```bash
npm ci
npm test
npm run build
```

Do not commit `dist/`; it is an ignored build artifact uploaded by GitHub Actions.

## Code Style

- Use ES modules and keep the existing semicolon style.
- Use two-space indentation in JavaScript, Astro, JSON, and Markdown examples.
- Keep notebook, search, and comment interactions in the existing React/Fumadocs components. Use vanilla JavaScript for the existing Idea direction tabs; do not reintroduce the retired homepage shell.
- Keep content frontmatter as strict JSON between `---` delimiters. Do not use YAML syntax, comments, or trailing commas.
- Keep paper IDs lowercase with numbers and hyphens, and make each `id` match its filename without `.md`.
- Use only topic IDs that exist in `config/research-interests.json` for `tag` and `tags`.
- Do not use affiliation placeholders such as `作者单位见论文 PDF`, `unknown`, or `not confirmed`. If arXiv API lacks affiliations, inspect the paper PDF, arXiv source, project page, or venue page and record verified institutions.
- Every new paper report must include at least one official figure image, preferably two. Use arXiv HTML/project-page URLs when available; otherwise extract a figure from the official PDF/source into `public/assets/papers/` and reference it from paper detail Markdown as `../../assets/papers/<file>.png`.
- After adding a new remote arXiv figure URL, run `npm run images:measure-remote` and include the measured `config/remote-figure-dimensions.json` update. Failed measurements are reported; never guess dimensions.
- Prefer existing helper functions in `src/lib/content.js` for content parsing and HTML escaping.
- New or substantially rewritten paper reports follow `content/templates/paper-report-template.md`: keep the eight level-two headings and use level-three subsections for mechanisms, equations, related-work comparisons, experimental evidence, and a concrete follow-up plan. Verify comparisons against each related work's own primary source; distinguish author claims from report analysis.
- `markdownToHtml` supports headings (levels 1–3), paragraphs, bullet lists, images, links, bold text, inline code, pipe tables, and `$...$` / `$$...$$` math. Tables need outer pipes and consistent column counts; display-math delimiters may each occupy their own line. KaTeX renders during the build with untrusted commands disabled. Escape literal dollars as `\$`. Raw HTML, fenced code blocks, Obsidian syntax, and arbitrary extensions remain unsupported.

## Dynamic Literature Review Workflow

Every update to `content/reviews/` must use the repository workflow in
`config/literature-review-workflow.json`. This contract is derived from the
installed ARIS `research-lit`, `comm-lit-review`, and `citation-audit` skills.
It is mandatory for Codex, Claude, and human-assisted maintenance.

Before searching, verify both local skill installations:

```bash
npm run review:preflight
```

Generate the direction-specific prompt instead of composing a new search prompt
from scratch:

```bash
npm run review:prompt -- <direction-id>
```

The generated prompt requires source fan-out, canonical-ID deduplication,
primary-source verification, paper-level limitation extraction, structured
synthesis, and an independent final review. Retrieval agents may collect
evidence but must not rank or accept their own output. Each configured query
family must have one `searchAudit.queryRuns` record with the actual query,
scope rationale, source, execution date, result count, canonical-ID sample, and
reproducible retrieval metadata. `searchAudit.sourceAttempts` must cover every
configured source family, even when a source is limited or contributes no
accepted record. Its `acceptedCount` is the number of included references
verified through that exact source family and must match `references[].sourceFamily`;
it is not a retrieval-hit or deduplication-candidate count. Retained IDs must exactly match references, and excluded
candidates need primary URLs and explicit reasons. Run
`content/templates/review-quality-checklist.md` before independent review;
`reviewedAt` changes only after references and claims have been reopened and
checked. A passed review must store the SHA-256 `snapshotFingerprint` for the
review content excluding the mutable `independentReview` metadata; any later
content, reference, or audit change invalidates that approval.

For `local-corpus` runs, `resultCount` means the papers that survived scope
screening and entered cross-source deduplication. Record the broader `rg` file
matches separately as `rawHitCount`, plus `screenedOutCount` and a concrete
`screeningNote`; never use raw keyword-hit counts as paper-candidate counts.
Every canonical tagged hit must appear in
`localCandidateDisposition.candidateLocalPaperIds` and then be accounted for
by an included local reference or one explicit `deferredGroups` entry.

For searches on or after `requirements.candidateLedgerRequiredFrom`, maintain
`searchAudit.candidateLedger` with one canonical-ID row per deduplicated
candidate, its final disposition, contributing `queryFamilies`, and occurrence
count. The validator resolves DOI/arXiv/venue aliases to the primary record,
recomputes every family `resultCount` plus candidate and deduplicated totals,
and requires duplicates to be visible in at least two query samples.

For an accepted paper that has both a publisher/venue page and an arXiv record,
keep both. Use the formal page as `url`. Prefer a formal DOI for `canonicalId`
when available and then add the arXiv destination to `links`; otherwise retain
the arXiv canonical ID so the page derives that link automatically. Use
`links` for code and official project pages as well. Reserve `peer-reviewed`
and `workshop` for records with a verifiable formal destination. Use `accepted`
or `workshop-accepted` while the formal page is still unavailable.

## Architecture Notes

- `astro.config.mjs` sets `output: "static"` and `outDir: "./dist"`.
- `src/lib/content.js` reads `config/` and `content/` from `process.cwd()`. Commands should be run from the repository root.
- Pages share `NotebookDocs.jsx` with a Fumadocs notebook, lazy search dialog, and optional digest comments.
- The homepage is a compact reading index; the full research landscape lives at `src/pages/landscape/index.astro`. Keep its search record and the homepage's legacy anchor redirects consistent when changing routes.
- `src/styles/reading.css` controls the shared reading layout. Preserve full abstracts behind the expand control and keep author/institution metadata below titles; avoid adding decorative homepage visuals.
- `getNotebookData()` builds navigation and page data; `getNotebookSearchIndex()` separately generates the search index. Do not reattach the index to every page's data or index entire audit objects.
- `content-cache.js` shares promises within each data snapshot and across production build routes. Development requests and direct Node validation calls see fresh data.
- Historical local-corpus audits can use the hash-pinned archive in `config/content-quality.json` only when the entire review fingerprint matches its recorded binding. `review-corpus-snapshot.js` restores the captured raw Markdown to a temporary directory so validation still executes `rg`; any changed review uses the current corpus. Do not regenerate or rebind the archive just to silence an audit failure. Its capture provenance is distinct from the original search date.
- Paper identity deduplication reads the primary `source` frontmatter. Related-work citations in the body are not additional identities of the report.
- `src/pages/assets/notebook-search.json.js` exposes the complete searchable reading content. Its `.json.gz.js` sibling emits a compressed static asset; `search-index-client.js` loads it with native decompression and falls back to JSON for older browsers or unavailable assets. Keep both projections identical. The browser prepares text once, ranks title matches first, and offers type filters and more results.
- `src/pages/assets/research-interests.json.js` exposes `config/research-interests.json` as JSON.
- `src/pages/papers/[id]/index.astro` statically generates detail pages, adding measured figure dimensions and responsive previews while linking to original images.
- `scripts/prepare-paper-images.mjs` produces ignored WebP variants and `.generated/paper-images.json`; changed source bytes get new content-addressed URLs. Do not replace original paper images with previews.
- Comment validation and the 1200-character limit are shared through `src/lib/comment-contract.js`. Failed local persistence must retain the editor's draft.
- `index.html` at the repository root redirects to `dist/` for quick local static viewing. The deployed Pages workflow uses `dist/` directly.

## Database, Environment Variables, and Secrets

- There is no database.
- `config/runtime.json` is public frontend runtime config. It currently contains `commentsEndpoint`. Never put secrets in this file.
- Anonymous comments are optional. Without `commentsEndpoint`, comments stay in browser `localStorage`.
- Worker variables are shown in `worker/wrangler.toml.example`:
  - `GITHUB_OWNER`
  - `GITHUB_REPO`
  - `GITHUB_BRANCH`
  - `COMMENTS_DIR`
  - `ALLOWED_ORIGIN`
- Worker secret:
  - `GITHUB_TOKEN`
- Do not commit `worker/wrangler.toml`, `worker/.wrangler/`, tokens, or generated secret files.
- If configuring `GITHUB_TOKEN`, use a fine-grained token scoped to the current repository with the minimum required Contents read/write permission.

## Files and Directories Agents Should Not Edit Unless Explicitly Asked

- `node_modules/`
- `.npm-cache/`
- `.astro/`
- `.generated/`
- `public/assets/paper-previews/`
- `dist/`
- `.claude/`
- `.DS_Store` files
- `worker/.wrangler/`
- `worker/wrangler.toml`
- `.github/workflows/` unless the task is specifically about CI or deployment
- `package-lock.json` unless dependencies actually change
- `index.html` unless the task is specifically about the root redirect/local static entrypoint

Update `docs/` when the documentation directly supports the requested change; this is part of the authorized task. Avoid unrelated documentation rewrites.

Be careful with `content/reported-papers.md`: it is not generated, but it is a deduplication ledger. When adding, removing, or renaming non-revision papers, update it consistently with `content/papers/` and `content/digests/`.

## How to Validate Changes

For content-only changes:

```bash
npm run validate
```

For changes that affect site generation or UI:

```bash
npm run build
```

Then optionally preview:

```bash
npm run preview
```

For frontend behavior changes, also run the dev server and inspect the site in a browser:

```bash
npm run dev
```

Use the URL printed by Astro. Check the homepage, search ranking/type filters/more results, digest navigation, paper figures, and inline comments when relevant.

## Pull Request and Commit Guidance

- Keep commits focused by change type: content update, UI change, validation logic, Worker change, or deployment change.
- Do not include ignored/generated artifacts such as `dist/`, `.astro/`, `node_modules/`, or Worker local state.
- For content updates, include the relevant files together:
  - `content/papers/<paper-id>.md`
  - `content/digests/<digest-id>.md`
  - `content/reported-papers.md`
  - `config/research-interests.json` only if adding/changing topic IDs
- Mention the validation command run in the PR description, usually `npm run validate` or `npm run build`.
- Do not commit secrets or real tokens. Redact endpoint credentials and Worker secrets from logs and discussion.

## Known Pitfalls

- Frontmatter is JSON, not YAML. Unquoted keys, comments, single quotes, and trailing commas will fail.
- Paper `id` must match the filename. Digest `id` must match the filename.
- Digest `date` must match the leading `YYYY-MM-DD` portion of the digest filename.
- Every digest `papers` entry must reference an existing paper file.
- Every non-revision paper must be referenced by exactly one digest and listed in `content/reported-papers.md`.
- `revisionOf` must point to an original paper, not another revision. Revision papers should not be listed in `content/reported-papers.md`.
- Duplicate arXiv IDs and normalized duplicate titles are rejected unless handled as a revision.
- Every tag in `tag` or `tags` must exist in `config/research-interests.json`.
- Every paper report, including archived reports and revisions, fails validation if it omits an official image or uses an affiliation placeholder; there is no legacy exception list.
- Do not place drafts or explanatory Markdown files inside `content/digests/` or `content/papers/`; every `.md` file there is parsed as production content.
- The Worker accepts `digestId` values in `YYYY-MM-DD` form, with optional lowercase suffixes such as `YYYY-MM-DD-gpt`, and checks that the referenced `content/digests/<digestId>.md` file exists before reading or writing comments.
- Asset endpoints such as `src/pages/assets/notebook-search.json.js` intentionally have double extensions. Keep their generated URLs consistent with `NotebookDocs` search props.
- `npm run build` updates `dist/`; this is expected locally, but `dist/` remains an ignored artifact and should not be committed.
