import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeCanonicalId, extractArxivIds, extractDois } from '../../../src/lib/review-audit.js';

const root = process.cwd();
const folder = 'docs/review-foundations/2026-11-06';
const baseline = new Map(JSON.parse(fs.readFileSync(path.join(folder, 'baseline-reviews.local.json'))).map(r => [r.id, r]));
const plan = JSON.parse(fs.readFileSync(path.join(folder, 'selection.json')));
const workflow = JSON.parse(fs.readFileSync('config/literature-review-workflow.json'));
const names = process.argv.slice(2);
const normalizeTitle = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

for (const direction of plan.directions.filter(d => !names.length || names.includes(d.id))) {
  const file = `content/reviews/${direction.id}.json`;
  const current = JSON.parse(fs.readFileSync(file));
  const prior = baseline.get(direction.id);
  const aliases = new Map();
  const byId = new Map(current.references.map(r => [r.id, r]));
  const byTitle = new Map(current.references.map(r => [normalizeTitle(r.title), r]));
  for (const reference of current.references) {
    const canonical = normalizeCanonicalId(reference.canonicalId);
    aliases.set(canonical, canonical);
    const urls = [reference.url, ...(reference.links || []).map(link => link.url)];
    for (const id of extractArxivIds(...urls)) aliases.set(`arxiv:${id}`, canonical);
    for (const id of extractDois(...urls)) aliases.set(`doi:${id}`.toLowerCase(), canonical);
  }
  for (const reference of [...prior.references, ...prior.searchAudit.excludedCandidates]) {
    const match = byId.get(reference.id) || byTitle.get(normalizeTitle(reference.title));
    if (match) aliases.set(normalizeCanonicalId(reference.canonicalId), normalizeCanonicalId(match.canonicalId));
  }
  const canonical = id => aliases.get(normalizeCanonicalId(id)) || normalizeCanonicalId(id);
  const included = new Set(current.references.map(r => canonical(r.canonicalId)));
  const ledger = new Map();
  for (const row of prior.searchAudit.candidateLedger) {
    const id = canonical(row.canonicalId);
    const existing = ledger.get(id);
    const families = [...new Set([...(existing?.queryFamilies || []), ...row.queryFamilies])];
    ledger.set(id, {...row, canonicalId: id, queryFamilies: families, disposition: included.has(id) ? 'included' : row.disposition, occurrences: families.length});
  }
  const exclusions = new Map(prior.searchAudit.excludedCandidates.filter(r => !included.has(canonical(r.canonicalId))).map(r => [canonical(r.canonicalId), {...r, canonicalId: canonical(r.canonicalId)}]));
  const additionsByFamily = new Map();
  for (const item of direction.entries) {
    const reference = byId.get(item.referenceId);
    if (item.decision !== 'exclude' && !reference) throw Error(`Missing selected reference ${direction.id}/${item.referenceId}`);
    const id = canonical(reference?.canonicalId || item.canonicalId);
    for (const family of item.queryFamilies) {
      if (!workflow.directions[direction.id].queryFamilies.includes(family)) throw Error(`Unknown family ${family}`);
      if (!additionsByFamily.has(family)) additionsByFamily.set(family, []);
      additionsByFamily.get(family).push({...item, canonicalId: id});
    }
    const existing = ledger.get(id);
    const families = [...new Set([...(existing?.queryFamilies || []), ...item.queryFamilies])];
    ledger.set(id, {canonicalId: id, queryFamilies: families, disposition: item.decision === 'exclude' ? 'excluded' : 'included', occurrences: families.length});
    if (item.decision === 'exclude') exclusions.set(id, {canonicalId: id, title: item.title, url: item.primaryUrl, reasonCode: 'outside-focused-lineage', reason: item.reason});
    else exclusions.delete(id);
  }
  const audit = current.searchAudit;
  audit.queryFamilies = [...workflow.directions[direction.id].queryFamilies];
  audit.queryRuns = prior.searchAudit.queryRuns.map(previous => {
    const additions = additionsByFamily.get(previous.family) || [];
    const entries = [...ledger.values()].filter(row => row.queryFamilies.includes(previous.family));
    if (!additions.length && entries.length === previous.resultCount) return previous;
    const ids = entries.map(row => row.canonicalId).sort();
    return {
      ...previous,
      query: `${previous.query}; 综述引文追溯补检（具体查询及定位见 retrieval.foundationSupplement）`,
      scopeRationale: `${previous.scopeRationale} 本次追加经典工作与综述追溯，旧查询完整保留在 historicalRun；新增候选与已有候选再命中分别记录，不把宽泛 API 原始结果全部计为论文候选。`,
      resultCount: ids.length,
      resultIdSample: ids,
      retrieval: {
        ...previous.retrieval,
        limit: Math.max(previous.retrieval.limit, ids.length),
        priorLimit: previous.retrieval.limit,
        foundationSupplement: {
          executedAt: '2026-11-06',
          mode: 'primary-survey-reference-tracing-and-targeted-source-verification',
          evidencePacket: direction.evidencePacket,
          evidencePacketSha256: digest(direction.evidencePacket),
          selectedCanonicalIds: [...new Set(additions.map(item => item.canonicalId))],
          newCanonicalIds: additions.filter(item => !prior.searchAudit.candidateLedger.some(old => canonical(old.canonicalId) === item.canonicalId)).map(item => item.canonicalId),
          entries: additions.map(item => ({canonicalId: item.canonicalId, referenceId: item.referenceId, reason: item.reason, queryEvidence: item.queryEvidence}))
        }
      },
      historicalRun: previous
    };
  });
  for (const family of audit.queryFamilies.filter(f => !prior.searchAudit.queryRuns.some(q => q.family === f))) {
    const additions = additionsByFamily.get(family) || [];
    const rows = [...ledger.values()].filter(row => row.queryFamilies.includes(family));
    const surveyIds = new Set((audit.foundationsAudit?.surveyAnchors || []).map(item => item.referenceId));
    const surveys = current.references.filter(r => surveyIds.has(r.id));
    const query = `综述分类与引文追溯：${surveys.map(r => r.title).join('；')}；按引用定位打开原论文并核对身份与方法。`;
    audit.queryRuns.push({
      family, sourceFamily: 'publisher-and-venue',
      query,
      executedAt: '2026-11-06',
      scopeRationale: '围绕缺失的方法源头、关键转折和综述分类进行定向追溯。该族统计进入父流程范围判定的候选；API和Web宽泛返回只记录为发现，不作为本族已读或纳入数。原有语义族及本库rg审计保留。',
      resultCount: rows.length, resultIdSample: rows.map(row => row.canonicalId).sort(),
      retrieval: {
        provider: 'primary-survey-reference-tracing-with-targeted-source-verification',
        endpoint: surveys[0]?.url || direction.entries[0].primaryUrl,
        parameters: {query, surveyUrls: surveys.map(r => r.url), primaryUrls: direction.entries.map(item => item.primaryUrl), discoveryQueriesArtifact: direction.evidencePacket, supplementalEvidencePackets: direction.supplementalEvidencePackets || []},
        sort: 'survey branch and citation order; parent scope screening',
        limit: rows.length,
        limitMeaning: 'Frozen scoped candidate inventory; exact search engine/API caps and raw hits are retained in the evidence packet, not replaced by this inventory size.',
        evidencePacket: direction.evidencePacket, evidencePacketSha256: digest(direction.evidencePacket),
        entries: additions.map(item => ({canonicalId: item.canonicalId, referenceId: item.referenceId, reason: item.reason, queryEvidence: item.queryEvidence}))
      }
    });
  }
  audit.candidateLedger = [...ledger.values()].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
  audit.excludedCandidates = [...exclusions.values()];
  audit.retainedCanonicalIds = current.references.map(r => r.canonicalId);
  audit.counts = {candidates: audit.candidateLedger.reduce((sum, row) => sum + row.occurrences, 0), deduplicated: ledger.size, included: current.references.length, excluded: ledger.size - current.references.length};
  audit.sourceAttempts = prior.searchAudit.sourceAttempts.map(previous => ({
    ...previous,
    acceptedCount: current.references.filter(r => r.sourceFamily === previous.sourceFamily).length,
    foundationSupplement: {
      executedAt: '2026-11-06', evidencePacket: direction.evidencePacket,
      note: '本次真实补检调用及受限记录见来源包；acceptedCount 是最终全部引用中该来源族的核验数，不是本轮接口返回量。'
    },
    previousFoundationAttempt: previous
  }));
  audit.qualityChecksApplied = [...new Set([...audit.qualityChecksApplied, 'foundations-and-survey-coverage'])];
  audit.foundationRefresh = {date: '2026-11-06', baseCommit: plan.baseCommit, evidencePacket: direction.evidencePacket, selectionArtifact: `${folder}/selection.json`, scope: 'Targeted survey and missing-foundation supplement; earlier same-day primary checks remain separate.'};
  audit.independentReview = {status: 'pending', completedAt: '2026-11-06', reviewers: 0, rounds: 0, finalOutcome: 'pending', finalFinding: 'Awaiting independent review of the foundational/survey supplement and final audit.'};
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
  console.log(direction.id, JSON.stringify(audit.counts));
}
