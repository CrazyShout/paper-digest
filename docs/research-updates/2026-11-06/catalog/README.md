# 2026-11-06 arXiv catalog retrieval

Retrieval only: no quality ranking or acceptance. `retrieval.json` retains six categories across complete October, currently available November, and the recent listing; the prior October ID snapshot is checked against the published Oct28 digest audit. Latest observed announcement is Nov5; execution is Nov6 Asia/Shanghai. Submission API overlap is Oct26–Nov6.

The directory difference contains 3,977 unique IDs. The unchanged broad title regex mechanically recalls 380; it does not classify the remaining 3,597 as quality exclusions. Ten complete API queries produce 186 appearances / 142 unique IDs. Their union with title-recalled records has 471 candidates with abstracts acquired. Downloading and parsing count as zero reading; independent selection must record semantic reading and final dispositions.

`prior-version-scan.json` checks 194 arXiv identities in 202 report files, with two changed versions in `version-update-candidates.json`. `tracked-release-checks.json` checks 46 official GitHub repositories (45 successful, one limited). `verification.json` verifies preserved cache hashes and snapshot identities. Raw responses remain under `/tmp/paper-digest-20261106/`; paths and SHA-256 are recorded.

`early-query-pool.json` is an immutable early handoff snapshot of the 142 query records; use `retrieval.json` for the complete merged pool.
