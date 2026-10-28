import fs from 'node:fs/promises';
import {getPapers} from '../../../src/lib/content.js';
import {categoryCoverageSnapshotFingerprint, CATEGORY_COVERAGE_SNAPSHOT_ALGORITHM} from '../../../src/lib/digest-audit.js';

const day = '2026-10-28';
const raw = await fs.readFile(`content/digests/${day}.md`, 'utf8');
const digest = JSON.parse(raw.split('---')[1]);
const papers = await getPapers();
const selected = digest.papers.map(id => papers.find(p => p.id === id));
if (selected.some(p => !p)) throw new Error('Missing report');
let ledger = await fs.readFile('content/reported-papers.md', 'utf8');
for (const paper of selected) {
  const arxiv = paper.source.match(/arXiv:(\d{4}\.\d{4,5})/i)?.[1];
  if (!arxiv) throw new Error(`Missing identity: ${paper.id}`);
  const row = `| ${paper.id} | ${paper.title} | ${arxiv} | ${day} |`;
  const previous = ledger.split('\n').find(line => line.startsWith(`| ${paper.id} |`));
  if (previous) ledger = ledger.replace(previous, row);
  else ledger += `${row}\n`;
}
await fs.writeFile('content/reported-papers.md', ledger);
const path = `content/digest-audits/${day}.json`;
const audit = JSON.parse(await fs.readFile(path, 'utf8'));
const config = JSON.parse(await fs.readFile('config/research-interests.json', 'utf8'));
const retrieval = JSON.parse(await fs.readFile(`docs/research-updates/${day}/arxiv-retrieval.json`, 'utf8'));
audit.scopeCoverage = config.interests.map(tag => {
  const query = retrieval.queryRuns.find(q => q.id.includes(tag.id));
  if (!query) throw new Error(`Missing direction query: ${tag.id}`);
  return {directionId: tag.id, priority: tag.priority, arxivQueryStatus: query.status,
    scope: 'Grouped seed query, six-directory difference, supplementary external discovery; not a new full review of every configured review query family.',
    selectedPaperIds: selected.filter(p => (p.tags || [p.tag]).includes(tag.id)).map(p => p.id)};
});
audit.categoryCoverage.snapshotAlgorithm = CATEGORY_COVERAGE_SNAPSHOT_ALGORITHM;
audit.categoryCoverage.snapshotFingerprint = categoryCoverageSnapshotFingerprint(audit.categoryCoverage);
await fs.writeFile(path, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Synchronized ${selected.length} reports and ${audit.scopeCoverage.length} directions.`);
