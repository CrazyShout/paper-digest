# -*- coding: utf-8 -*-
import json,pathlib,re,subprocess,collections,hashlib
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest');DOC=ROOT/'docs/research-updates/2026-10-18';P=ROOT/'content/reviews/dynamic-scene-representation.json'
r=json.loads(P.read_text());old=json.loads((DOC/'dynamic-prior.json').read_text());a=r['searchAudit'];qs=json.loads((DOC/'dynamic-query-results.json').read_text());qby={q['family']:q for q in qs}
refs=r['references'];refids={x['canonicalId'].lower():x for x in refs};alias={}
for ref in refs:
 c=ref['canonicalId'].lower();alias[c]=c
 for u in [ref['url']]+[x['url']for x in ref.get('links',[])]:
  for aid in re.findall(r'arxiv\.org/(?:abs|html)/(\d{4}\.\d{4,5})',u):alias['arxiv:'+aid]=c
old_alias={x['canonicalId'].lower():refids[next(y['canonicalId'].lower() for y in refs if y['id']==x['id'])]['canonicalId'].lower() for x in old['references']}
fams=a['queryFamilies'];sets={f:set() for f in fams};papers={}
for p in (ROOT/'content/papers').glob('*.md'):
 try:front=json.loads(p.read_text().split('---',2)[1]);papers[front['id']]=front
 except Exception:continue
pattern=old['searchAudit']['queryRuns'][0]['query'];cp=subprocess.run(['rg','-l','-i',pattern,'content/papers'],cwd=ROOT,capture_output=True,text=True);raw=sorted(cp.stdout.splitlines());local=[]
for p in raw:
 x=papers[pathlib.Path(p).stem]
 if r['id'] not in x.get('tags',[x.get('tag')]):continue
 pid=x.get('revisionOf',x['id'])
 if pid not in local:local.append(pid)
local=sorted(local);localcanonical={}
for pid in local:
 x=papers[pid];s=x['source'];aid=re.search(r'(?:arxiv(?:\.org/(?:abs|html|pdf)/|\s*:\s*))([0-9]{4}\.[0-9]{4,5})',s,re.I)
 if not aid:raise ValueError(pid+' lacks canonical arxiv')
 c=alias.get('arxiv:'+aid.group(1),'arxiv:'+aid.group(1));localcanonical[pid]=c;sets[fams[0]].add(c)
local_refs={x.get('localPaperId') for x in refs};deferred=[p for p in local if p not in local_refs];deferred_c={localcanonical[p]:p for p in deferred}
# Reopened retained references are an explicit seed expansion, not API hits.
seed_by_family={f:[]for f in fams}
for entry in old['searchAudit']['candidateLedger']:
 c=old_alias.get(entry['canonicalId'].lower())
 if c:
  for f in entry['queryFamilies']:
   if f!=fams[0]:sets[f].add(c);seed_by_family[f].append(c)
for ref in refs[-2:]:sets[fams[1]].add(ref['canonicalId']);seed_by_family[fams[1]].append(ref['canonicalId'])
selected={
 'temporal':['2610.14871','2610.09444','2609.26325','2609.18442','2608.15279','2607.24431','2606.30421','2606.27644','2605.17682','2604.00969','2603.28887','2602.08006','2601.06474','2510.16729','2507.09144','2503.24381'],
 'unified':['2610.20917','2610.15522','2610.09444'],
 'visibility':['2610.18670','2610.17279','2609.39166','2609.36543'],
 'identity':['2610.17279','2610.15522','2610.10382'],
 'utility':['2610.20917','2610.17688','2610.18670','2610.12431']
}
familykeys=['temporal','unified','visibility','identity','utility'];excluded={};screened=[];api_metadata={}
for key,f in zip(familykeys,fams[1:]):
 for x in qby[key]['entries']:
  aid=re.search(r'(\d{4}\.\d{4,5})',x['id']).group(1);c=alias.get('arxiv:'+aid,'arxiv:'+aid)
  inpool=aid in selected[key];screened.append({'family':f,'canonicalId':c,'title':x['title'],'url':'https://arxiv.org/abs/'+aid,'enteredCandidatePool':inpool,'screeningReason':'Related driving-state method or adjacent state/planning boundary candidate; retain for disposition.' if inpool else 'Outside the driving-state scope or only broad-keyword/referenced-term overlap in this retrieval family.'})
  if not inpool:continue
  sets[f].add(c);api_metadata[c]=x
  if c not in refids and c not in deferred_c:
   if aid in ['2610.18670']:reason='研究愿景而非独立方法实验；用于发现不完整观测问题，暂不作为方法效果证据。';code='research-vision-only'
   elif aid in ['2610.17279','2609.39166','2610.10382','2610.12431','2609.36543']:reason='涉及清扫机器人、室内导航、操作或一般机器人规划等相邻协议；本轮未完成向道路驾驶状态的协议对照，不纳入核心综合。';code='adjacent-robotics-protocol'
   else:reason='题录与摘要已核对，属于相关候选；本轮 34 条既有参考的实质复核及两篇已完成全文报告的综合之外，尚未完成该文机制、实验条件与资源的全文比较，留待后续阅读。';code='fulltext-comparison-pending'
   excluded[c]={'canonicalId':c,'title':x['title'],'url':'https://arxiv.org/abs/'+aid,'reasonCode':code,'reason':reason}
run0=dict(old['searchAudit']['queryRuns'][0]);run0.update(executedAt='2026-10-18',resultCount=len(local),rawHitCount=len(raw),screenedOutCount=len(raw)-len(local),screeningNote=f'对当前原始 Markdown 执行同一 rg 查询；{len(raw)} 个文件命中，按正式方向标签与 revisionOf 归并后形成 {len(local)} 篇候选。核心参考保留 11 篇，其余逐篇列入暂缓组；不将正文提及或修订重复计作候选。',resultIdSample=sorted(sets[fams[0]]),localCandidateDisposition={'candidateLocalPaperIds':local,'deferredGroups':[{'reasonCode':'direct-scope-deferred','reason':'与方向相关，但本次核心综合未使用该文的论断；按现有单篇报告保留入口，新报告需完成全文与独立复核后再决定是否纳入。','localPaperIds':deferred}]})
run0['localCandidateDisposition']['deferredGroups']=[{'reasonCode':code,'reason':'本次核心综合未使用该文论断；保留本库入口，完成方法与协议比较后再决定是否纳入。','localPaperIds':[p for p in deferred if (papers[p]['tag']==r['id'])==direct]} for code,direct in [('direct-scope-deferred',True),('cross-direction-support',False)]]
run0['localCandidateDisposition']['deferredGroups']=[x for x in run0['localCandidateDisposition']['deferredGroups'] if x['localPaperIds']]
runs=[run0]
for key,f in zip(familykeys,fams[1:]):
 q=qby[key];seeds=[]
 for c in sorted(set(seed_by_family[f])):
  ref=refids[c];seeds.append({'canonicalId':c,'url':ref['url'],'arxivUrls':[x['url'] for x in ref.get('links',[]) if 'arxiv.org' in x['url']]})
 runs.append({'family':f,'sourceFamily':'arxiv','query':q['query'],'scopeRationale':'按该查询族执行近期 arXiv 检索并人工筛查范围；另逐条重新打开前次保留文献及本库已完成报告的原始来源。结果数为新检索范围内候选与明确列出的既有参考扩展的并集，不是 API 原始返回数。','executedAt':'2026-10-18','resultCount':len(sets[f]),'resultIdSample':sorted(sets[f]),'retrieval':{'provider':'arxiv-api-with-primary-reference-rechecks','endpoint':'https://export.arxiv.org/api/query','parameters':{'query':q['query'],'search_query':q['query'],'sortBy':'submittedDate','sortOrder':'descending','start':0,'max_results':20,'seedRechecks':seeds},'sort':'submittedDate-descending; reference rechecks in canonical-ID order','limit':20+len(seeds),'rawApiResultCount':len(q['entries']),'screeningEvidence':'docs/research-updates/2026-10-18/dynamic-screening.json'}})
allc=set().union(*sets.values());ledger=[]
for c in sorted(allc):
 fs=[f for f in fams if c in sets[f]]
 if c in refids:d='included'
 elif c in deferred_c:d='deferred'
 elif c in excluded:d='excluded'
 else:raise ValueError('unaccounted '+c)
 z={'canonicalId':c,'disposition':d,'queryFamilies':fs,'occurrences':len(fs)}
 if d=='deferred':z['localPaperId']=deferred_c[c]
 ledger.append(z)
a['queryRuns']=runs;a['candidateLedger']=ledger;a['excludedCandidates']=list(excluded.values());a['retainedCanonicalIds']=[x['canonicalId']for x in refs];a['searchedAt']='2026-10-18';a.pop('incrementalLocalAuditAt',None);a.pop('refreshMode',None);a.pop('localRefreshNote',None)
a['counts']={'candidates':sum(x['occurrences']for x in ledger),'deduplicated':len(ledger),'included':len(refs),'excluded':len(excluded)+len(deferred)}
counts=collections.Counter(x['sourceFamily']for x in refs)
notes={
 'local-corpus':run0['screeningNote'],
 'arxiv':'34 条既有引用和 RoadOcc、SelectOccFlow 的摘要及正文均重新获取；正文实际阅读方法、实验或限制相关段落。6 个初始 API 查询各返回 20 条；4 个收窄查询返回 429，保留失败记录，未伪造结果。',
 'publisher-and-venue':'重开 DOI、CVF、Springer、AAAI、NeurIPS 与 OpenReview；部分 IEEE DOI 返回空 202，改用出版方提交的 Crossref 元数据核对书目，方法论断回到 arXiv 原文。OctreeOcc 正式 NeurIPS 页面与 DOI 已核对。',
 'semantic-scholar':'HTTP 200，检索返回 20 条；只用于发现与 DOI/标题交叉核对，未将聚合器作为论断来源，未进入主查询族候选计数。',
 'openalex':'HTTP 200，返回 20 条，全文匹配排序包含较多非本方向结果与未来卷期元数据；只用于发现和交叉核对，未进入主查询族候选计数。',
 'official-project':'重开 GeoUP、SparseWorld、BeyondSight、LMPOcc、VADv2、GeoWAM、UniScene 等作者项目；SparseWorld 的录用会议按项目纠正为 IROS 2026。'}
for attempt in a['sourceAttempts']:
 fam=attempt['sourceFamily'];attempt.update(status='success',executedAt='2026-10-18',acceptedCount=counts[fam],note=notes[fam])
 if fam=='arxiv':attempt.update(query='Six occupancy/state query families; see dynamic-query-results.json',limit=120)
 elif fam in ['semantic-scholar','openalex']:attempt.update(query='occupancy forecasting autonomous driving',limit=20)
a['openSearchGaps']=['当前核心参考尚未共同检验现实射线级 occupied/free/unknown/conflict、长期身份、来源与年龄，以及固定 planner 下的状态干预。','RoadOcc 验证语义支持条件的来源选择，SelectOccFlow 验证当前占据与流；实例身份、未来多模态和车辆闭环仍是分开的终点。','新发现的世界模型、Gaussian 表示和机器人长期记忆候选尚未全部完成全文比较；已在排除台账标明阅读深度，不据此声称领域不存在相关工作。','单日志未来不能为替代动作提供反事实真值；动作条件方法仍需模拟器配对 rollout 或其它明确协议。']
a['sourceLimitations']=['逐条重开 34 条既有引用以及两篇新增核心参考，完成书目与所引用方法/实验段落复核；这不是重跑原作者实验，也不是每篇全文逐句复现。','arXiv 主检索按 submittedDate 取前 20 条，并未穷尽全部历史结果；收窄重试遇到 429，原始宽查询包含跨领域命中，逐项范围筛查另存。','Semantic Scholar 与 OpenAlex 成功返回，本轮仅作补充发现/元数据交叉核对；其原始返回数不计入主候选池。','若正式入口暂不可读，出版元数据通过出版社提交的 Crossref 记录和可访问正式页交叉核对；没有新确认正式出版页的录用稿仍标 accepted。']
a['refreshEvidencePath']='docs/research-updates/2026-10-18/dynamic-verification.json'
P.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');(DOC/'dynamic-screening.json').write_text(json.dumps({'executedAt':'2026-10-18','note':'Initial current-state API query and aggregator returns were discovery-only; the five external production families below combine screened API candidates with explicit reopened reference seeds. Prior snapshot preserved separately.','rows':screened,'local':{'query':pattern,'rawFiles':raw,'candidateLocalPaperIds':local}},ensure_ascii=False,indent=2)+'\n')
print(a['counts']);print('Local',len(raw),len(local),'retained',len(local_refs),'deferred',len(deferred),'external excluded',len(excluded))
