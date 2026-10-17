import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {getPapers,getTags} from '/Users/atlas/work/repo/paper-digest/src/lib/content.js';
import {localCorpusSearchSnapshot,extractArxivIds,extractDois} from '/Users/atlas/work/repo/paper-digest/src/lib/review-audit.js';
const day='2026-10-18', dir='docs/research-updates/2026-10-18';
const papers=await getPapers(), byId=new Map(papers.map(p=>[p.id,p]));const proofs=[];
await fs.mkdir(dir+'/prompts',{recursive:true});
for(const tag of await getTags()) {
 if(tag.id==='dynamic-scene-representation') continue;
 const file=`content/reviews/${tag.id}.json`;
 const raw=spawnSync('git',['show',`378a229:${file}`],{encoding:'utf8'});if(raw.status!==0)throw Error(raw.stderr);
 const r=JSON.parse(raw.stdout), before=structuredClone(r), a=r.searchAudit;
 const prompt=spawnSync('node',['scripts/review-workflow.mjs','prompt',tag.id],{encoding:'utf8'});if(prompt.status!==0)throw Error(prompt.stderr);
 await fs.writeFile(`${dir}/prompts/${tag.id}.txt`,prompt.stdout);
 const localFamilies=new Set(a.queryRuns.filter(q=>q.sourceFamily==='local-corpus').map(q=>q.family));
 const ledger=new Map(a.candidateLedger.map(v=>[v.canonicalId.toLowerCase(),{...v,queryFamilies:v.queryFamilies.filter(f=>!localFamilies.has(f))}]));
 const aliases=new Map();const included=new Set(r.references.map(v=>v.localPaperId).filter(Boolean));
 for(const ref of r.references){
  aliases.set(ref.canonicalId,ref.canonicalId);
  for(const id of extractArxivIds(ref.url,...(ref.links||[]).map(l=>l.url)))aliases.set('arxiv:'+id,ref.canonicalId);
 }
 const snapshots=[];
 for(const q of a.queryRuns.filter(q=>q.sourceFamily==='local-corpus')) {
  const snap=localCorpusSearchSnapshot(papers,tag.id,q.query,{corpusPath:'content/papers'});const ids=snap.candidateLocalPaperIds;
  const oldGroups=q.localCandidateDisposition.deferredGroups;
  const deferred=ids.filter(id=>!included.has(id));const assigned=new Set();const groups=[];
  for(const g of oldGroups){const keep=g.localPaperIds.filter(id=>deferred.includes(id));if(keep.length){groups.push({...g,localPaperIds:keep});keep.forEach(id=>assigned.add(id));}}
  const added=deferred.filter(id=>!assigned.has(id));
  for (const primary of [true,false]) { const groupIds=added.filter(id=>(byId.get(id).tag===tag.id)===primary); if(groupIds.length)groups.push({reasonCode:primary?'direct-scope-deferred':'cross-direction-support',reason:'2026-10-18新报告进入本库；单篇另有全文复核，本轮仅更新该综述本库候选闭合，未把新报告自动提升为既有核心综合论据。',localPaperIds:groupIds}); }
  const resultIds=[];
  for(const id of ids){
   const p=byId.get(id);const old=[...ledger.values()].find(v=>v.localPaperId===id);const ref=r.references.find(v=>v.localPaperId===id);
   const arxiv=extractArxivIds(p.source)[0];const doi=extractDois(p.source)[0];
   const canonical=ref?.canonicalId||old?.canonicalId||aliases.get('arxiv:'+arxiv)||(arxiv?'arxiv:'+arxiv:doi?'doi:'+doi:null);
   if(!canonical)throw Error('no identity '+id);resultIds.push(arxiv?'arxiv:'+arxiv:'doi:'+doi);
   const row=ledger.get(canonical.toLowerCase())||{canonicalId:canonical,disposition:included.has(id)?'included':'deferred',...(included.has(id)?{}:{localPaperId:id}),queryFamilies:[]};
   row.queryFamilies=[...new Set([...row.queryFamilies,q.family])];ledger.set(canonical.toLowerCase(),row);
  }
  q.executedAt=day;q.rawHitCount=snap.rawHitPaperIds.length;q.resultCount=new Set(resultIds).size;q.screenedOutCount=q.rawHitCount-q.resultCount;
  q.screeningNote=`${day} 对当前原始Markdown执行rg -l -i，共${q.rawHitCount}个文件命中；按方向标签与revisionOf归并得${q.resultCount}个候选，其余${q.screenedOutCount}个为其它方向、正文提及或修订重复。只更新本库审计，保留站外执行日期。`;
  q.resultIdSample=[...new Set(resultIds)];q.localCandidateDisposition={candidateLocalPaperIds:ids,deferredGroups:groups};
  snapshots.push({family:q.family,query:q.query,...snap,addedDeferredIds:added});
 }
 a.candidateLedger=[...ledger.values()].filter(v=>v.queryFamilies.length).map(v=>({...v,occurrences:v.queryFamilies.length}));
 a.counts={candidates:a.candidateLedger.reduce((n,v)=>n+v.occurrences,0),deduplicated:a.candidateLedger.length,included:r.references.length,excluded:a.candidateLedger.filter(v=>v.disposition!=='included').length};
 a.searchedAt=day;a.incrementalLocalAuditAt=day;a.refreshMode='incremental-local-corpus';
 a.localRefreshNote=`${day} 新简报入库后重跑当前本库候选检索；原站外queryRuns、cutoffDate、sourceRevalidation与实质reviewedAt保持原值。历史本库记录及审批另存本期local-corpus-evidence.json。`;
 for(const attempt of a.sourceAttempts.filter(v=>v.sourceFamily==='local-corpus')){attempt.executedAt=day;attempt.status='success';attempt.note=a.queryRuns.filter(q=>q.sourceFamily==='local-corpus').map(q=>q.screeningNote).join(' ');}
 a.independentReview={status:'pending',completedAt:day,reviewers:0,rounds:0,finalOutcome:'pending',finalFinding:'Awaiting independent review of current local-corpus refresh; substantive external review dates retained.'};
 await fs.writeFile(file,JSON.stringify(r,null,2)+'\n');
 proofs.push({directionId:tag.id,before,afterLocalQueries:snapshots,afterContentSha256:crypto.createHash('sha256').update(JSON.stringify(r,null,2)+'\n').digest('hex')});
}
await fs.writeFile(dir+'/local-corpus-evidence.json',JSON.stringify({date:day,baseCommit:'378a229e4eeb834e7091372225a4a2a8ab4182f8',directions:proofs},null,2)+'\n');
console.log(proofs.map(p=>[p.directionId,p.afterLocalQueries.map(q=>[q.rawHitPaperIds.length,q.candidateLocalPaperIds.length])]));
