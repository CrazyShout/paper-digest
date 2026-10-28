import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {getPapers,getTags} from '../../../src/lib/content.js';
import {localCorpusSearchSnapshot,extractArxivIds,extractDois,normalizeCanonicalId} from '../../../src/lib/review-audit.js';
import {reviewSnapshotFingerprint} from '../../../src/lib/review-fingerprint.js';

// Independent read-only production check. Writes only this review's evidence.
const base='32aad21bba45b0b4defc46cbb8d59542e1466560';
const dir='docs/research-updates/2026-10-28';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const git=p=>{const r=spawnSync('git',['show',`${base}:${p}`],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;};
const uniq=v=>[...new Set(v)].sort();
const same=(a,b,label)=>assert.deepEqual(a,b,label);
const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const papers=await getPapers(), tags=await getTags(), byId=new Map(papers.map(p=>[p.id,p]));
const evidence=read(`${dir}/local-corpus-evidence.json`);
const workflow=read('config/literature-review-workflow.json');
const directionReviews=[];
for(const tag of tags){
  const file=`content/reviews/${tag.id}.json`,r=read(file),before=JSON.parse(git(file)),a=r.searchAudit;
  same(without(r,['searchAudit']),without(before,['searchAudit']),`${tag.id} narrative/references/date`);
  same(a.queryRuns.filter(q=>q.sourceFamily!=='local-corpus'),before.searchAudit.queryRuns.filter(q=>q.sourceFamily!=='local-corpus'),`${tag.id} external query immutability`);
  same(a.sourceAttempts.filter(q=>q.sourceFamily!=='local-corpus'),before.searchAudit.sourceAttempts.filter(q=>q.sourceFamily!=='local-corpus'),`${tag.id} external attempts immutability`);
  const mutable=['queryRuns','sourceAttempts','candidateLedger','counts','searchedAt','incrementalLocalAuditAt','refreshMode','localRefreshNote','independentReview'];
  same(without(a,mutable),without(before.searchAudit,mutable),`${tag.id} nonlocal audit immutable`);
  same(evidence.directions.find(x=>x.directionId===tag.id).before,before,`${tag.id} captured baseline`);
  same(uniq(a.queryRuns.map(q=>q.family)),uniq(workflow.directions[tag.id].queryFamilies),`${tag.id} configured families`);
  const includedLocal=r.references.filter(v=>v.localPaperId).map(v=>v.localPaperId);
  const allDeferred=[]; const queryEvidence=[];
  for(const q of a.queryRuns.filter(q=>q.sourceFamily==='local-corpus')){
    const old=before.searchAudit.queryRuns.find(v=>v.family===q.family);
    same(without(q,['executedAt','resultCount','rawHitCount','screenedOutCount','screeningNote','resultIdSample','localCandidateDisposition']),without(old,['executedAt','resultCount','rawHitCount','screenedOutCount','screeningNote','resultIdSample','localCandidateDisposition']),`${tag.id} local query unchanged`);
    const args=['-l','-i','--',q.query,'content/papers'];
    const raw=spawnSync('rg',args,{encoding:'utf8'});assert([0,1].includes(raw.status));
    const rawFiles=raw.stdout.trim().split('\n').filter(Boolean).sort();
    const rawIds=rawFiles.map(f=>path.basename(f,'.md')).sort();
    const manuallyScreened=uniq(rawFiles.map(f=>JSON.parse(fs.readFileSync(f,'utf8').split('---',3)[1])).filter(p=>[p.tag,...(p.tags||[])].includes(tag.id)).map(p=>p.revisionOf||p.id));
    const snap=localCorpusSearchSnapshot(papers,tag.id,q.query,{corpusPath:'content/papers'});
    same(snap.rawHitPaperIds,rawIds,`${tag.id} actual rg`);
    same(snap.candidateLocalPaperIds,manuallyScreened,`${tag.id} independent tag/revision screening`);
    same(q.localCandidateDisposition.candidateLocalPaperIds,manuallyScreened,`${tag.id} candidate closure`);
    assert.equal(q.rawHitCount,rawIds.length);assert.equal(q.resultCount,manuallyScreened.length);
    assert.equal(q.screenedOutCount,rawIds.length-manuallyScreened.length);
    const deferred=q.localCandidateDisposition.deferredGroups.flatMap(g=>{assert(g.reason&&g.reasonCode);return g.localPaperIds;});
    same(uniq([...deferred,...manuallyScreened.filter(id=>includedLocal.includes(id))]),manuallyScreened,`${tag.id} disposition closure`);
    assert.equal(deferred.length,new Set(deferred).size);assert(!deferred.some(id=>includedLocal.includes(id)));
    allDeferred.push(...deferred);
    queryEvidence.push({family:q.family,command:['rg',...args],rawHitCount:rawIds.length,resultCount:manuallyScreened.length,screenedOutCount:q.screenedOutCount,includedCount:manuallyScreened.length-deferred.length,deferredCount:deferred.length,rawHitPaperIds:rawIds,candidateLocalPaperIds:manuallyScreened,addedCandidateIds:manuallyScreened.filter(id=>!old.localCandidateDisposition.candidateLocalPaperIds.includes(id))});
  }
  const alias=new Map();
  function register(id,primary){id=normalizeCanonicalId(id);primary=normalizeCanonicalId(primary);assert(!alias.has(id)||alias.get(id)===primary,`${tag.id} alias conflict ${id}`);alias.set(id,primary);}
  for(const ref of [...r.references,...a.excludedCandidates]){
    const texts=[ref.url,...(ref.links||[]).map(v=>v.url),...(ref.localPaperId?[byId.get(ref.localPaperId).source]:[])];
    register(ref.canonicalId,ref.canonicalId);
    for(const id of extractArxivIds(...texts))register('arxiv:'+id,ref.canonicalId);
    for(const id of extractDois(...texts))register('doi:'+id,ref.canonicalId);
  }
  for(const row of a.candidateLedger.filter(v=>v.disposition==='deferred')){
    register(row.canonicalId,row.canonicalId);const p=byId.get(row.localPaperId);assert(p);
    for(const id of extractArxivIds(p.source))register('arxiv:'+id,row.canonicalId);
    for(const id of extractDois(p.source))register('doi:'+id,row.canonicalId);
  }
  const normIds=v=>uniq(v.map(x=>normalizeCanonicalId(x)));
  same(normIds(a.retainedCanonicalIds),normIds(r.references.map(v=>v.canonicalId)));
  same(normIds(a.candidateLedger.filter(v=>v.disposition==='included').map(v=>v.canonicalId)),normIds(a.retainedCanonicalIds));
  same(normIds(a.candidateLedger.filter(v=>v.disposition==='excluded').map(v=>v.canonicalId)),normIds(a.excludedCandidates.map(v=>v.canonicalId)));
  same(uniq(a.candidateLedger.filter(v=>v.disposition==='deferred').map(v=>v.localPaperId)),uniq(allDeferred));
  const ledgerById=new Map(a.candidateLedger.map(v=>[normalizeCanonicalId(v.canonicalId),v]));assert.equal(ledgerById.size,a.candidateLedger.length);
  for(const row of a.candidateLedger){
    assert.equal(row.occurrences,new Set(row.queryFamilies).size);
    if(row.occurrences>1){const samples=a.queryRuns.filter(q=>q.resultIdSample.some(id=>alias.get(normalizeCanonicalId(id))===normalizeCanonicalId(row.canonicalId)));assert(samples.length>=2,`${tag.id} duplicates invisible ${row.canonicalId}`);}
  }
  for(const q of a.queryRuns){
    assert.equal(q.resultCount,a.candidateLedger.filter(v=>v.queryFamilies.includes(q.family)).length);
    for(const id of q.resultIdSample){const row=ledgerById.get(alias.get(normalizeCanonicalId(id)));assert(row&&row.queryFamilies.includes(q.family),`${tag.id} alias sample ${id}`);}
  }
  for(const s of a.sourceAttempts)assert.equal(s.acceptedCount,r.references.filter(v=>v.sourceFamily===s.sourceFamily).length);
  same(uniq(a.sourceAttempts.map(v=>v.sourceFamily)),uniq(workflow.sourceFamilies));
  const counts={candidates:a.candidateLedger.reduce((n,v)=>n+v.occurrences,0),deduplicated:a.candidateLedger.length,included:r.references.length,excluded:a.excludedCandidates.length+uniq(allDeferred).length};same(a.counts,counts);
  const prompt=spawnSync('node',['scripts/review-workflow.mjs','prompt',tag.id],{encoding:'utf8'});assert.equal(prompt.status,0);same(prompt.stdout,fs.readFileSync(`${dir}/prompts/${tag.id}.txt`,'utf8'),`${tag.id} generated prompt`);
  directionReviews.push({directionId:tag.id,path:file,sha256:sha(file),reviewSnapshotFingerprint:reviewSnapshotFingerprint(r),status:'PASS',reviewedAtUnchanged:r.reviewedAt,allNonSearchAuditFieldsIdenticalToBase:true,referencesIdenticalToBase:true,externalQueryRecordsAndDatesIdenticalToBase:true,externalSourceAttemptsIdenticalToBase:true,remainingAuditFieldsIdenticalToBase:true,sourceAcceptedCountsMatchReferences:true,candidateLedgerCountsRecomputed:counts,rawRipgrepQueries:queryEvidence,rawCandidateDispositionClosed:true});
}
const audit=read('content/digest-audits/2026-10-28.json'), arxiv=read(`${dir}/arxiv-retrieval.json`), sources=read(`${dir}/source-retrieval.json`), reads=read(`${dir}/selection-reading-ledger.json`);
const aliases=read(`${dir}/selection-aliases.json`), rows=new Map(audit.candidates.map(v=>[v.canonicalId,v]));assert.equal(rows.size,audit.candidates.length);
const byRaw=new Map(), seenRows=new Set();
for(const c of audit.candidates){
  assert(c.reason&&c.urls.length&&c.queryFamilies.length);
  for(const rr of c.retrievalRows){const source=rr.source==='arxiv'?arxiv:sources;assert.equal(source.candidates[rr.index].canonicalId,rr.rawId);assert(!seenRows.has(`${rr.source}:${rr.index}`));seenRows.add(`${rr.source}:${rr.index}`);assert(!byRaw.has(rr.rawId)||byRaw.get(rr.rawId)===c.canonicalId);byRaw.set(rr.rawId,c.canonicalId);}
}
assert.equal(seenRows.size,arxiv.candidates.length+sources.candidates.length);
for(const v of aliases)assert.equal(byRaw.get(v.alias),v.primary);
for(const q of audit.queryRuns){same(q.resultIds,[...new Set(q.rawResultIds.map(id=>byRaw.get(id)))],q.family+' aliases');assert.equal(q.resultCount,q.resultIds.length);for(const id of q.resultIds)assert(rows.get(id)?.queryFamilies.includes(q.family));}
for(const c of audit.candidates)same(c.queryFamilies,uniq(audit.queryRuns.filter(q=>q.resultIds.includes(c.canonicalId)).map(q=>q.family)),c.canonicalId+' query closure');
const normReadId=id=>byRaw.get(id)||id;
for(const id of reads.completeAbstractsRead)assert(rows.get(normReadId(id))?.readingDepth.includes('abstract'));
for(const [id,sections] of Object.entries(reads.primarySectionsRead))same(rows.get(normReadId(id))?.primarySectionsRead,sections);
assert.equal(audit.candidates.filter(c=>c.readingDepth.includes('abstract')).length,reads.completeAbstractsRead.length);
const count={queryOccurrences:audit.queryRuns.reduce((n,q)=>n+q.resultCount,0),deduplicatedCandidates:rows.size,rawQueryOccurrencesBeforeAliasNormalization:audit.queryRuns.reduce((n,q)=>n+q.rawResultIds.length,0),titleAbstractExcluded:audit.candidates.filter(v=>v.disposition==='title-abstract-excluded').length,fullTextExcluded:audit.candidates.filter(v=>v.disposition==='full-text-excluded').length,selected:audit.candidates.filter(v=>v.disposition==='selected').length,fullTextCompared:Object.keys(reads.primarySectionsRead).length,completeAbstractsRead:reads.completeAbstractsRead.length,arxivTitleRecordsRead:arxiv.candidates.length,sourceScopedTitleRecordsRead:reads.scopedSourceTitleRecordIndices.length,entirePaperReadsClaimedBySelector:0};same(audit.counts,count);
const digestRaw=fs.readFileSync('content/digests/2026-10-28.md','utf8'),digest=JSON.parse(digestRaw.split('---',3)[1]);
same(uniq(digest.papers),uniq(audit.candidates.filter(v=>v.disposition==='selected').map(v=>v.paperId)));
const ledgerBase=git('content/reported-papers.md'),ledger=fs.readFileSync('content/reported-papers.md','utf8');assert(ledger.startsWith(ledgerBase));const newLines=ledger.slice(ledgerBase.length).trim().split('\n');assert.equal(newLines.length,8);
for(const id of digest.papers){const paper=byId.get(id);assert(paper);assert(newLines.some(v=>v.startsWith(`| ${id} |`)));assert(!ledgerBase.includes(`| ${id} |`));}
for(const scope of audit.scopeCoverage)same(uniq(scope.selectedPaperIds),uniq(digest.papers.filter(id=>byId.get(id).tags.includes(scope.directionId))),scope.directionId+' scope');
same(uniq(audit.scopeCoverage.map(v=>v.directionId)),uniq(tags.map(v=>v.id)));
same(without(read('content/idea-center.json'),['updatedAt']),without(JSON.parse(git('content/idea-center.json')),['updatedAt']));
const landscape=read('content/research-landscape.json');assert.equal(landscape.analysisWindowIssues,5);
const archiveDiff=spawnSync('git',['diff',base,'--','config/content-quality.json','src/lib/review-fingerprint.js','src/lib/review-corpus-snapshot.js'],{encoding:'utf8'});assert.equal(archiveDiff.stdout,'');
for(const bind of audit.independentSelection.inputFingerprints)assert.equal(sha(bind.path),bind.sha256);
const correction=read(`${dir}/review-correction-proof.json`);assert.equal(sha(correction.round1Artifact),correction.round1Sha256);
for(const c of correction.changedFiles){let text=fs.readFileSync(c.path,'utf8');assert.equal(sha(c.path),c.currentSha256);for(const r of c.replacements){assert(text.includes(r.after));text=text.replace(r.after,r.before);}assert.equal(hash(text),c.round1Sha256);}
for(const c of correction.unchangedFiles)assert.equal(sha(c.path),c.sha256);
const output={checkedAt:new Date().toISOString(),reviewerAgentId:'/root/integration_final_oct28',baseCommit:base,status:'PASS',directionReviews,digestCounts:count,queryRecords:audit.queryRuns.length,queryExpressions:audit.queryRuns.reduce((n,q)=>n+(q.parameters.queryExpressions?.length||1),0),all737RetrievalRowsClosed:seenRows.size===737,aliasRowsChecked:aliases.length,selectionAndLedgerClosed:true,scopeDirections:tags.length,ideaUpdatedAtOnly:true,archiveAndFingerprintAlgorithmUnchanged:true,correctionProofReconstructed:true,digestAuditContentFingerprint:hash(JSON.stringify(without(audit,['independentReview'])))};
fs.writeFileSync(`${dir}/integration-check-output.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({...output,directionReviews:directionReviews.map(v=>({directionId:v.directionId,counts:v.candidateLedgerCountsRecomputed,local:v.rawRipgrepQueries.map(q=>({raw:q.rawHitCount,candidates:q.resultCount,added:q.addedCandidateIds}))}))},null,2));
