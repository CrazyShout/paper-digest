# AGENTS.md

Guidance for Codex, Claude Code, Cursor, and other coding agents working in this repository.

## Project Overview

Paper Digest is a static Astro site for periodic paper digests, paper reading reports, and optional anonymous comments.

The main data source is Markdown content under `content/`, with JSON frontmatter. Astro builds the static site into `dist/`. GitHub Actions deploys the built site to GitHub Pages. An optional Cloudflare Worker can accept anonymous comments and write them back to the repository through the GitHub Contents API.

## Tech Stack

- Runtime/tooling: Node.js, npm, ES modules (`"type": "module"`).
- CI Node version: Node 22, configured in `.github/workflows/deploy-pages.yml`.
- Local required Node version: not confirmed; `package.json` does not declare `engines`.
- Site framework: Astro `^5.16.2`, static output.
- Frontend: Astro components plus vanilla JavaScript and CSS in `public/assets/`.
- Content format: Markdown files with JSON frontmatter, parsed by local code in `src/lib/content.js`.
- Comments backend: optional Cloudflare Worker in `worker/comments-worker.mjs`.
- Database: none.

## Directory Structure

```text
config/
  research-interests.json   # Long-term topic/tag configuration
  runtime.json              # Public runtime config, currently commentsEndpoint
content/
  README.md                 # Content authoring instructions
  reported-papers.md        # Deduplication ledger for reported papers
  digests/                  # One Markdown file per digest
  papers/                   # One Markdown file per paper report
  templates/                # Content templates and selection rubric
src/
  components/               # Astro UI components
  layouts/                  # Base page layout
  lib/content.js            # Reads config/content and converts limited Markdown to HTML
  pages/                    # Static pages and generated asset endpoints
public/assets/
  site.js                   # Client-side navigation, search, notes, comments
  styles.css                # Site styles
scripts/
  validate-content.mjs      # Content integrity checks
worker/
  comments-worker.mjs       # Optional Cloudflare Worker for comments
  wrangler.toml.example     # Example Worker config
.github/workflows/
  deploy-pages.yml          # GitHub Pages deployment
```

Generated or local-only directories such as `dist/`, `.astro/`, `.npm-cache/`, `node_modules/`, `worker/.wrangler/`, and `.claude/` should not be edited manually.

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

Starts Astro development server with `ASTRO_TELEMETRY_DISABLED=1`. Use the URL printed by Astro; the exact local port is not guaranteed.

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

This runs `node scripts/validate-content.mjs` and checks Markdown frontmatter, IDs, tags, digest references, duplicate arXiv IDs/titles, and `content/reported-papers.md` consistency.

Unit tests:

```bash
npm test
```

This runs the Node test suite for content projection, review-center contracts,
idea-center data, and email publishing helpers.

End-to-end tests: not confirmed.

## Build Commands

```bash
npm run build
```

This runs `npm run validate` first, then `astro build` with telemetry disabled. Output goes to `dist/`.

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
- Keep frontend behavior in vanilla JavaScript unless the project explicitly adopts another library.
- Keep content frontmatter as strict JSON between `---` delimiters. Do not use YAML syntax, comments, or trailing commas.
- Keep paper IDs lowercase with numbers and hyphens, and make each `id` match its filename without `.md`.
- Use only topic IDs that exist in `config/research-interests.json` for `tag` and `tags`.
- Do not use affiliation placeholders such as `作者单位见论文 PDF`, `unknown`, or `not confirmed`. If arXiv API lacks affiliations, inspect the paper PDF, arXiv source, project page, or venue page and record verified institutions.
- Every new paper report must include at least one official figure image, preferably two. Use arXiv HTML/project-page URLs when available; otherwise extract a figure from the official PDF/source into `public/assets/papers/` and reference it from paper detail Markdown as `../../assets/papers/<file>.png`.
- Prefer existing helper functions in `src/lib/content.js` for content parsing and HTML escaping.
- `markdownToHtml` supports only a limited Markdown subset: headings, paragraphs, bullet lists, images, links, and `**strong**`. Do not assume tables, raw HTML, fenced code blocks, or arbitrary Markdown extensions will render.

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
- `src/pages/index.astro` renders the shell and loads generated scripts:
  - `assets/runtime-config.js`
  - `assets/data.js`
  - `assets/site.js`
- `src/pages/assets/data.js.js` generates JavaScript that assigns `window.PAPER_DIGESTS`.
- `src/pages/assets/runtime-config.js.js` generates JavaScript that assigns `window.PAPER_DIGEST_RUNTIME`.
- `src/pages/assets/research-interests.json.js` exposes `config/research-interests.json` as JSON.
- `src/pages/papers/[id]/index.astro` statically generates one detail page for each paper ID.
- `public/assets/site.js` handles digest navigation, search, local notes, optional remote comments, and UI state in `localStorage`.
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
- `dist/`
- `docs/`
- `.claude/`
- `.DS_Store` files
- `worker/.wrangler/`
- `worker/wrangler.toml`
- `.github/workflows/` unless the task is specifically about CI or deployment
- `package-lock.json` unless dependencies actually change
- `index.html` unless the task is specifically about the root redirect/local static entrypoint

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

Use the URL printed by Astro. Check the homepage, search, digest switching, paper detail pages, and notes drawer when relevant.

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
- New paper reports fail validation if they omit official images or use affiliation placeholders. A small legacy allowlist exists only to avoid rewriting older archived reports.
- Do not place drafts or explanatory Markdown files inside `content/digests/` or `content/papers/`; every `.md` file there is parsed as production content.
- The Worker accepts `digestId` values in `YYYY-MM-DD` form, with optional lowercase suffixes such as `YYYY-MM-DD-gpt`, and checks that the referenced `content/digests/<digestId>.md` file exists before reading or writing comments.
- Files like `src/pages/assets/data.js.js` have double extensions because they are Astro endpoint source files that output asset routes. Renaming them can break script paths in `src/pages/index.astro`.
- `npm run build` updates `dist/`; this is expected locally, but `dist/` remains an ignored artifact and should not be committed.
