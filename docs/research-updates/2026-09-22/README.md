# 2026-09-22 publication evidence

This directory records the selection, source corrections and independent review of the September 22 issue. It is an editorial and source-verification record, not an experiment reproduction.

## New issue

- Canonical production selection/query ledger: `content/digest-audits/2026-09-22.json`.
- Independent selection: `digest-selection.json`; 752 distinct records, 149 abstract readings, 13 full-text comparisons, seven selected reports. Final source review then checked one additional publisher abstract that was nested in metadata, correcting its availability reason without changing selection or the full-text comparison pool. The final production audit therefore records 150 abstract readings and 602 title-only records.
- Five official monthly arXiv directories were paginated to their reported totals. They yielded 10,029 category occurrences and 7,929 unique titles; 4,246 IDs were absent from the previous category snapshot. A title difference is not a count of newly submitted papers.
- New reports retain the eight-section template, official figures, actual resource availability, and negative or protocol-limited results. They do not assert that model code or experiments were run.

## Existing direction reviews

Seven reviews exceeded the repository's 45-day source-review interval before this update. Their historical external query dates and search boundaries are retained. The September 22 revalidation reopened their 193 reference occurrences and relevant body-only citations, corrected supported differences, and reran the current raw-Markdown local corpus search. It is not represented as a fresh exhaustive external survey.

- `review-source-manifest.json`: original primary/metadata URL snapshots, dates, status and hashes. A 200 challenge/empty page is not treated as a readable source.
- `review-source-claims.json`: world models, reconstruction, testing and security reference checks.
- `review-policy-claims.json`: policy/interaction reference checks and numerical/protocol findings.
- `review-body-claims.json`: excluded candidates nevertheless used as factual evidence in prose.
- `review-corrections.json`: proposed field/prose corrections with original and new values. Final production fields take precedence where source families, source-link labels or later verified protocol corrections required integration changes.

Publisher and arXiv versions can disagree. V2VNet, CoDriving and STORM retain formal-version author/title metadata. DrivingWorld and SAFECOMP chapters distinguish 2026 online publication from 2027 volume copyright. Access limits, including paid standards and some challenged publisher full texts, remain explicit. Models, datasets and archives were not downloaded wholesale or executed.

## Review and release gate

Independent semantic reviews use fresh agents from the same model family and are recorded as provisional assurance. Schema validation, hash checks, tests and build checks are separate mechanical evidence. Final review records bind the current report/review snapshot; later content changes require renewed checking.

- `review-existing-round2.json`: all eight direction snapshots passed; the LiDAR anomaly direction covers only its local-corpus audit.
- `review-papers-representation.json` and `review-papers-policy-round2.json`: all seven final reports and fourteen original images passed and match their recorded SHA-256 values. Policy Round 1 is retained to show the two MILER corrections. The final removal of one redundant EOF line feed in each policy report is bound by `review-papers-policy-round3-eof.json` and `eof-normalization.json`; appending one LF reconstructs each approved semantic snapshot exactly.
- `review-release-integration.json`: final digest, audit body, landscape, paper identities, tags and ledger passed. The digest audit's mutable approval metadata was filled only after these checks. `review-release-integration-round2-eof.json` carries that approval to the final files after independently verifying the EOF-only change.
- `browser-qa.json`: representative desktop/mobile reading, official-figure rendering, search/filter/pagination and digest-comment controls.
- `build-verification.json`: successful production build, 183 HTML pages, 202 search records, equal JSON/gzip content, all seven eight-section reports and fourteen byte-identical original figures. `npm test` passed 285 tests, with seven skipped and zero failures; `npm run validate` passed the content and current Idea-state contracts.

Publication requires the matching Git commit and successful Pages workflow, followed by live page checks, complete JSON/gzip search-index equality, and original-figure byte checks. Subscriber notification uses the repository's email templates and BCC recipient handling only after that gate. SMTP credentials, addresses and delivery receipts remain local and are not stored here.
