# Independent editorial selection for issue 2026-10-12

Selection used frozen input v4 with SHA-256 `9c6e55f0e5f4244ebe192c34211d4cbe3b3fedc2145f0448b5ee8a85d8eb19e7`. Issue date remains October 12; selection and repository checks continued after midnight Shanghai time on October 13. Timestamps in the JSON are actual UTC times.

I independently inspected all 1,479 original retrieved-record titles, read 99 supplied abstracts, and compared named primary sections of 20 papers. After verified alias repair, the final ledger contains 1,467 candidate entities, including 20 explicitly excluded nonpaper resources. These counts must not be described as 1,467 research papers or 20 entire papers read. The input records 130 query records and 2,599 canonical query occurrences. The v1 count of 2,609 is superseded; raw originals remain preserved by the root task.

The ledger accounts for every final entity once, with actual reading depth, a concrete disposition, and source URL where supplied. Downloading, parsing or extracting the remaining sections does not count as reading them. I read extracted primary text including the named tables/captions; equation pixels and figure pixels are a later author/reviewer requirement, not claimed here.

## Selected eight

| Paper | Primary topic | Why it earns a slot |
| --- | --- | --- |
| Odyssey: A Closed-Loop Benchmark for Long-Horizon Real-World Driving with Explicit Navigation Routes (2610.06469v1) | autonomous-driving-testing | Continuous sensor-in-the-loop rollouts expose route preparation and ranking reversals that isolated NAVSIM scores miss; explicit routes and logged/reactive traffic permit concrete evaluation questions. |
| Radar2Plan: Benchmarking 4D Radar for End-to-End Open-Loop Ego-Trajectory Planning (2610.06121v1) | radar-occupancy-representation | A unified four-planner/seven-modality comparison tests whether 4D radar improves actual ego-trajectory prediction in adverse conditions, including two negative radar-addition cases. |
| FPD-Drive: Future Policy Distillation for End-to-End Autonomous Driving (2610.13232v1) | end-to-end-autonomous-driving | Separates future-privileged multi-target supervision from safety-score correction, with controlled teacher-target ablations and preliminary zero-shot HUGSIM support. |
| Do Better Visual Representations Always Lead to Better End-to-End Autonomous Driving? (2610.09695v1) | end-to-end-autonomous-driving | Uses random-target and auxiliary-supervision controls to test when frozen foundation-model representations help three different planners, with zero-shot HUGSIM checks and unchanged inference architecture. |
| SelectOccFlow: Selective Spatiotemporal Aggregation for 3D Occupancy and Scene Flow Prediction (2610.04356v1) | dynamic-scene-representation | State-specific temporal retrieval jointly improves occupancy and voxel motion, with component controls and a corruption breakdown that reveals weaker dark-condition performance. |
| Sparse2comm: Towards Robust Cooperative 3D Object Detection (2610.08573v1) | cooperative-autonomous-driving | Restores sparse semantics, temporal correspondence and pose alignment in sequence; mixed-disturbance tests across three datasets and feature-volume/latency accounting support a concrete communication-robustness study. |
| LR-V2X: Loss-Resilient Collaborative Perception under Low-Bandwidth Communication (2610.11264v1) | cooperative-autonomous-driving | Clean-trained latent-prior reconstruction retains useful cooperative features under severe packet loss, supported by equal128KB comparisons, denoiser controls and a correlated-loss extension. |
| SceneFactory-3D: Lifting 2D Traffic Scenes into 3D Physical Counterfactuals for Scalable Physically Grounded Safety Evaluation (2610.02874v1) | autonomous-driving-testing | Matched worlds propagate local road friction/height changes through per-wheel forces and interactive traffic; four-seed analysis, world-reset censoring and batch sensitivity make the safety evidence unusually inspectable. |

All eight were independently checked against the primary `source` and `title` frontmatter of 166 existing reports plus `content/reported-papers.md`. Body citations were not used as identities. No selected identity matched. All selected publication states are conservatively arXiv preprints until a writer independently verifies a formal destination.

The set has two cooperative-perception papers, two end-to-end planners/studies, two testing papers, one dynamic-scene paper and one radar-planning benchmark. All primary topics have configured priority 1. The two cooperative papers are intentionally complementary: Sparse2comm studies coupled loss, delay and pose corruption with robustness training; LR-V2X studies clean-trained generative reconstruction at a matched low-bandwidth interface. Their AP values must not be compared across paper protocols. There is no forced Agentic Driving, security, or LiDAR anomaly quota.

Secondary tags are conservative. Odyssey retains end-to-end driving and 3D reconstruction; Radar2Plan retains end-to-end driving and testing. The other six are primary-only. SceneFactory's shared controller parameters and interacting actors are not V2X information exchange. FPD-Drive's privileged future teacher is not itself a learned future-dynamics model. ViRA's internal visual alignment and the cooperative detectors are not sufficient by themselves to justify a separate dynamic-scene tag.

## Closest alternatives and evidence boundaries

- PlanWAM: useful future latent design, but overlaps FPD-Drive, has 342 ms reported inference and a modest within-backbone gain. ViRA gives the second E2E slot a distinct cross-planner, target-control question. Different HUGSIM protocol/baseline values preclude an across-paper leaderboard claim.
- CoCam4D: useful geometric cooperation, but the read text alternates between full and transmitted diagonal covariance, and 35-byte DOP versus full cached-scene communication. These deserve a dedicated verification before recommendation.
- Temporal Residual Bottleneck: clear severe-delay robustness trade-off and useful oracle-versus-causal transport diagnostic; deferred to keep two more complementary communication studies. Its stress drop is explicitly not a calibrated network channel.
- MeshBind and LighTROcc: useful dynamic representations, but mesh-derived supervision and supplemented occupancy ground truth respectively require extra independent-label scrutiny. SelectOccFlow has more direct joint motion/corruption controls for this issue.
- SIGMA: valuable decision-level cloud invocation, but limited routes, hand-placed unknown objects, fixed-period comparison and heuristic scheduling restrict broad conclusions.
- Context-conditioned HJ: impressive vehicle deployment, but the property is center-of-gravity lateral containment on two skidpads, excluding full footprint and traffic safety. Kept as control follow-up.
- Reflect-VLA: the 90% training-saving language describes the distillation stage versus GRPO per 10k samples, not total teacher/data costs; Bench2Drive comfort trades off against driving score.
- BridgeGuard: ideal continuous-time bridge arguments explicitly do not certify learned finite-step constrained curves; short horizon and fixed speed narrow correction.
- SLLCP: about 90% unsafe coverage coexists with 51.8% / 44.5% false alarms; video dependence violates exchangeability.
- CrashSim: more discriminative generated crash tests and crash-prior realism do not by themselves establish unbiased real crash risk or causal LLM diagnoses.
- Beyond the Snowflakes: valuable weather-bin confounding critique; physical causal explanation needs controlled validation distinct from point-count association.

All specific alternatives have their own ledger reasons and primary section paths/hashes when read. Scope-plausible title-only candidates remain `title-deferred`, not method-quality rejections. Missing-abstract publisher records remain `metadata-deferred`.

## Resource and announcement constraints for writers

- LR-V2X: official repository includes implementation, configs and three-stage instructions; pretrained weights are pending. No training was run.
- FPD-Drive: inference code/configs exist and README links Hugging Face weights; training-code checklist is unchecked. Selector did not open the weight files or run inference.
- ViRA: results/demo only; code and checkpoint checklists unchecked.
- SelectOccFlow: README/assets/demo; source, checkpoints and evaluation scripts coming soon.
- Sparse2comm: repository root contains only LICENSE and README.
- SceneFactory-3D: linked repository contents and README returned 404. Report resource-dependent follow-up as conditional.
- Odyssey: paper promises benchmark/adapted baseline release; writer must inspect actual project assets independently.
- Radar2Plan: no official implementation/weight link found in the read fixed-version text; external benchmark data are prerequisites, not downloaded artifacts.

Seven selected records have actual dated announcement headings in the saved rolling category map. SceneFactory-3D was submitted October 2 and appears in the October monthly catalog, but not the rolling October 6–12 map. Its exact announcement date is not proved here. Present it explicitly as overlap/catch-up, never invent an October 5 announcement.

Official figure URLs and captions are in `selector-primary/*-front-figures.json`; these are candidate figures, not completed pixel review. SceneFactory-3D has Figure 1 as a raster in HTML, but Figures 2–6 have missing graphic payloads there. Obtain a second actual official figure from the fixed-v1 PDF/source before publication. No placeholder graphic is acceptable.

## Reproducible artifacts

- `digest-selection.json`: complete 1,467-entity disposition ledger and detailed selected metadata.
- `selected-eight.json`: same selected metadata for writer dispatch.
- `selector-primary/*-manifest.json`: hashes of original official HTML and extracted named sections. Every recorded section hash has been rechecked.
- `selector-extra/manifest.json`: direct official full-text fetches for independently expanded candidates; failed 2610.01010v1 HTML attempt preserved.
- `selector-resources/manifest.json`: direct official repository contents/readme checks, with actual timestamps.
- `selector-existing-identities.json`: current primary-source/title identity snapshot.
- `build-selector-ledger.py`: deterministic bookkeeping over frozen input and explicit editorial reasons, not automatic quality ranking.

No production content, Git operations, messages outside the team, or experiments were performed. The full-text reading count means primary-section comparisons only. Final author/source and independent report review must still verify equations, figures, related-work originals, resource downloads and publication status.
