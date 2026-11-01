# 4D Gaussian survey author checks

Date: 2026-11-01. Author: `/root/review_scope_4d_nov01`.

This checklist documents author work only. Independent review remains pending.

## Production changes

- `content/reviews/3d-reconstruction.json`: six sections rewritten around actual representation choices, input/optimization axes and task-specific evidence; 24 existing references retained and six added. Repeated RoadVGGT paragraphs consolidated into one protocol-specific comparison. Route and section IDs unchanged.
- `content/reviews/dynamic-scene-representation.json`: scope, Gaussian taxonomy and the GaussianWorld time-update sentence clarified. Two local foundation reports added. Existing claims and Idea status outside this narrow scope unchanged. The substantive review date remains 2026-10-18.
- No world-models production changes made by this author.

## Source checks and corrections

1. The old 24-reference reconstruction bibliography was reopened. `existing-reference-revalidation.json` separates abstract/metadata scope from specific full-text sections; no claim of reading every full paper or running experiments.
2. Wu, Yang, Dynamic 3D Gaussians and Spacetime Gaussians were independently selected by root as mechanism foundations. Their titles, full author lists, formal publication destinations and original identities were checked. Dynamic 3D Gaussians is 3DV 2024.
3. OmniRe's former OpenReview URL returned a challenge page. Its formal ICLR proceedings URL and arXiv 2408.16760 were verified and adopted; the old identity remains in the immutable before snapshot. This does not establish that the old OpenReview identifier was false.
4. Real2Sim and physically consistent 4D reconstruction were previously grouped as if both supplied collision dynamics. The new text separates MPM/material dynamics from OPG/TV reconstruction constraints and includes the original Real2Sim warning about artificially compliant material parameters.
5. RadarSplat's reference support was narrowed to radar noise, multipath, synthesis and geometry that the reopened primary abstract supports. No new occupancy claim is inferred from its name.
6. RoadVGGT's pose/depth, semantic pseudo-labels, common-valid-region metric mask and median Z alignment are retained alongside numbers. Instant NuRec's 140-scene/five-policy scope is retained.
7. Native 4D Gaussian temporal weights are not called semantic occupancy probabilities; motion interpolation is not called action-conditioned future prediction. GaussianWorld's state update explicitly uses current observations. GaussianFormer-2's farthest-point-sampling latency caveat remains.
8. No raw cross-paper FPS/PSNR superiority claim is added. Yang's questioned Table 3 average is not used. The large formal PDF could not be fully retrieved for a new visual cross-check; that limitation is reported to root.

## Search and count checks

- Immutable before snapshots retain old dates, queries, candidate dispositions and approval metadata. No historical audit file was rewritten.
- The reconstruction foundation family uses a versioned cumulative candidate pool: six historical candidates plus three newly traced foundations. Wu was already a historical candidate and moves from exclusion to inclusion. The current row explicitly distinguishes this count from raw Web results and retains `historicalRun`.
- Other external query families retain their actual historical dates. Actual topical discovery output is saved in `scoped-web-search.json`; the retrieval teammate's arXiv/OpenAlex/Semantic Scholar attempts remain separate. Directory/search hits outside individually read and independently selected scope are not called full-text candidates or invented exclusions.
- Current raw-corpus matching used the repository's `localCorpusSearchSnapshot` helper, which executes `rg -l -i`. Reconstruction: 39 raw files, 26 tagged canonical candidates. Dynamic representation: 30 raw files, 30 tagged canonical candidates. Snapshots include all candidates and original source identities.
- Candidate ledgers reconcile aliases, retained records and explicit deferred groups. Reconstruction has 30 references, 70 family occurrences and 57 deduplicated candidates. Dynamic representation has 38 references, 103 family occurrences and 78 deduplicated candidates.
- `sourceAttempts.acceptedCount` was recomputed from each reference's `sourceFamily`. The two dynamic foundation entries were discovered through newly authored local reports, with separate targeted primary-source revalidation. Historical external dates were not relabelled as current.

## Checks executed

- `git diff --check` for the two production files: passed.
- `npm run validate`: both authored reviews pass content/count/local-corpus checks; their expected remaining errors are the pending independent-review fields. Other concurrent release files also still had integration errors at this check. This is not a full validation PASS.
- Production build, browser checks, independent review, fingerprint binding, deployment and notification are owned by root and were not performed by this author.

## Remaining independent-review questions

- Confirm that the explicit cumulative foundation-query accounting is legible and does not imply nine raw hits from the new query.
- Confirm that the fresh primary-source reading depth supports the retained claim strength and the revised 2026-11-01 reconstruction review date.
- Review the actual final JSON, rather than this author's prose, before binding any fingerprint. Subsequent root edits invalidate author-only hashes.
