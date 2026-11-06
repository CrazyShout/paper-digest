# 2026-11-06 bounded resource check

Window: 2026-10-29 00:00:00 UTC through retrieval on 2026-11-06; end-date upper bound 2026-11-07 00:00:00 UTC. This is a retrieval record, not paper selection or resource usability validation.

- **No new release/assets event observed.** Main scan: 46 GitHub release endpoints, 45 successful, one 404 (`SmallWorldLab/SceneFactory_3D`). Follow-up AuRaSim endpoint also succeeded with an empty release list: **47 total, 46 successful, one limited**. Successful responses contain no release `published_at` or asset `updated_at` inside the window. All returned release IDs/timestamps/assets and exact requests are in `resource-event-audit.json` and hashed raw responses.
- **Drive2Gauss:** one window commit, `5ff9c2b6f8573cac8e6bb288331f47d946b56ca5` at 2026-11-05T03:05:13Z, only shortens README license advice. It does not release an implementation, dataset or checkpoint. The existing mini-sample predates the window. Dataset/checkpoint documentation and links remain visible; Google Drive bytes were not obtained or verified.
- **AuRaSim:** the current page says “Code (Not Released)” and links `Wangzhaoze/aurasim`. That repository holds the project website/template, media and demos; this is not verified simulator code. The Oct28 report's statement that every button points to the template is now stale, but the date of the change is not established. This supports a current-state correction only.
- **DriveOSS:** current default-branch response identifies `3ec53dc85cedfeca021bfb9c4cc4ad6337db2390`, matching the fixed report; README still says dataset and pretrained models will be released later. No window commit.
- **DriveMind:** two-file placeholder repository, README still “Code coming soon”; no window commit.
- **DriveMLP / StreamRPS:** tree identifiers unchanged against Oct28; respectively two files and one placeholder README. No window commit.
- **RIDE-Splat:** fixed identifier remains `48720b128f767341bce3b8adfd6c8143430fa73e`; no window commit/release/asset update. Existing dataset-v0.1 is not a new event.
- **4DGaussians / native 4DGS:** no window commits in checked default branches; README distinguishes runnable source/data entry points from pretrained scene weights. Nothing was run.
- **LAST-V2X:** exact project HTML SHA256 unchanged against Oct28; Code still marked soon.
- **Foundation4D:** dataset API sha `14a99e36aa9b9db3f19d9be68389c0d565343e40`, lastModified 2026-10-21T08:36:57.000Z and 2509 siblings unchanged; gated=auto. No gated asset access.
- **SplatFlux:** current official project page has no verified code or weight download entry.

This check does not cover all commits/branches or every external resource channel. It does not newly establish global resource absence for AWCR, DriveUniTok, planner-surrogate or SRP, whose reports did not supply an official implementation URL. Raw reads are not scientific reproduction, byte validation of datasets/weights, or proof of usability.

Evidence: `resource-event-audit.json`; `raw/` stores the HTTP response bytes. Main repeatable retrieval script: `check-resources.py`; follow-up URLs/requests are fully recorded in `followupRequests`. No production content edited.
