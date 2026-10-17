import json,re,unicodedata,hashlib,pathlib,datetime,subprocess
root=pathlib.Path.cwd(); out=root/'docs/research-updates/2026-10-18'
a=json.load(open(out/'arxiv-retrieval.json')); b=json.load(open(out/'source-retrieval.json'))
selected={
'arxiv:2610.14544':('infraworld-roadside-occupancy-forecasting','区分稠密静态上下文与稀疏运动查询，含路侧/车端及等容量对照；主表收益需与GT占据输入和延迟代价一起读。',['S4','S5']),
'arxiv:2610.15577':('sign-mappo-imperfect-v2x','显式分开接收者状态图、意图消息和仲裁，通信扰动与复合HV负结果直接对应协同系统问题。',['S5','S6']),
'arxiv:2610.18686':('radargsocc-doppler-semantic-occupancy','雷达张量到语义占据的新基准，车辆类别退步与无真值天气代理使其有明确可讨论的证据边界。',['S4','S5']),
'arxiv:2610.18866':('autoagent0-runtime-recovery','运行时验证与反馈恢复形成真实agent循环；有预算匹配对照以及恢复碰撞、舒适度与延迟代价。',['S4','S5']),
'arxiv:2610.14871':('more-motion-oriented-registers','在预训练时塑造紧凑运动状态，消融区分寄存器存在、信息瓶颈与未来预测；同时给出修正评价器与HUGSIM结果。',['S4','S5']),
'arxiv:2610.17540':('tacitvla-reasoning-supervision','用注意力屏蔽比较推理监督与当前文本生成的作用，驾驶有同架构闭环和同硬件时延对照，保留私有数据与安全子项退步。',['S4','S5','S6','S7']),
'arxiv:2610.21741':('comfortably-stuck-bench2drive-protocol','直接检查闭环执行接口与舒适度实现，可用已有日志复算，并明确八模型及两个接口模型的覆盖范围。',['S3','S4','S5']),
'arxiv:2610.16634':('language2drive-paired-instruction-evaluation','成对可行指令区分单次完成和行为选择，公开多赛道评测资源；把接口混杂及固定seed与语言理解能力分开。',['S2','S3','S5','A4','A5:E.1-E.2','A10:discussion excerpts'])}
requested=json.load(open('/tmp/paper-digest-20261018/retrieval/root-requested-candidates.json'))
read_abstract={r['canonicalId'] for r in requested}
# These additional abstracts were displayed and read in full, beyond the 50 requested rows.
read_abstract.update('arxiv:'+x for x in ['2610.15359','2610.15491','2610.15740','2610.15846','2610.16478','2610.17339','2610.17540','2610.21034','2610.21132','2610.21207','2610.21225','2610.21888','2610.21912','2610.21984'])
# PAWA's excerpt was truncated; only its scope was screened, not counted as a complete abstract read.
read_abstract.discard('arxiv:2610.20240')
def normid(x):
 x=unicodedata.normalize('NFKC',x).lower().strip()
 x=re.sub(r'^doi:10\.48550/arxiv\.', 'arxiv:',x)
 if x=='pii:s0968090x26004109':x='doi:10.1016/j.trc.2026.105924'
 return x
def normtitle(t):
 t=unicodedata.normalize('NFKC',t).lower();t=re.sub(r'^\(pdf\)\s*','',t)
 t=re.split(r'\s+(?:\||- sciencedirect|:: ssrn)',t)[0]
 if t.startswith('collaboration-aware adversarial training for robust vehicle-to-everything cooperative perception by '):t=t.split(' by ')[0]
 return re.sub(r'[^\w]+','',t)
records={};alias={};titlemap={};merges=[]
for r in a['candidates']+b['candidates']:
 rid=r['canonicalId'];key=normid(rid);t=normtitle(r['title'])
 if key not in records and len(t)>45 and t in titlemap and 'underreviewasaconferencepaper' not in t:
  target=titlemap[t];merges.append({'alias':rid,'primary':target,'reason':'Exact normalized title after removing platform suffix; original discovery records retained.'});key=target
 if normid(rid)!=rid:merges.append({'alias':rid,'primary':key,'reason':('Official Crossref DOI matched to publisher PII; reviewer also verified seven authors for the SSRN record.' if 's0968090x26004109' in rid.lower() else 'Canonical case/Unicode and explicit arXiv DOI normalization.')})
 alias[rid]=key;alias[normid(rid)]=key
 if key not in records:records[key]={'canonicalId':key,'title':r['title'],'urls':[],'queryFamilies':[], 'retrievalRecordIds':[], 'announcementDates':r.get('announcementDates',[])}
 c=records[key];c['retrievalRecordIds'].append(rid);c['urls']+=r.get('urls',[])
 if key.startswith('arxiv:'): c['urls'].append('https://arxiv.org/abs/'+key.split(':')[1])
 if r.get('submittedAt'):c['submittedAt']=r['submittedAt']
 if len(t)>45:titlemap[t]=key
# Query records contain only returned records; unavailable queries retain failure evidence, not claimed zero-result research.
queries=[]
catids=[r['canonicalId'] for r in a['candidates'] if r.get('catalogIndex') is not None]
queries.append({'family':'monthly-catalog-title-screen','sourceFamily':'arxiv','endpoint':'https://arxiv.org/list','searchQuery':a['catalogCoverage']['broadTitlePattern'],'executedAt':a['catalogCoverage']['retrievedAt'],'parameters':{'categories':a['catalogCoverage']['primaryCategories']+a['catalogCoverage']['supplementalCategories'],'month':'2026-10','comparison':'Oct12 category ID snapshot','scope':'mechanical broad-title retrieval of IDs absent from prior union; supplement has no same-category prior snapshot'},'resultIds':catids,'status':'success'})
for q in a['queryRuns']:
 p=q['pages'][0];queries.append({'family':q['id'],'sourceFamily':'arxiv','endpoint':p['endpoint'],'searchQuery':q['query'],'executedAt':q['executedAt'],'parameters':p['parameters'],'resultIds':q['resultIds'],'status':q['status'],'sourceArtifact':'docs/research-updates/2026-10-18/arxiv-retrieval.json','scopeRationale':q['scopeRationale']})
for q in b['queries']:
 endpoint={'web-discovery':'web.run.search_query','openalex':'https://api.openalex.org/works','semantic-scholar':'https://api.semanticscholar.org/graph/v1/paper/search'}[q['source']]
 queries.append({'family':q['id'],'sourceFamily':q['source'],'endpoint':endpoint,'searchQuery':q['query'],'executedAt':q['executedAt'],'parameters':{'commandArguments':q.get('commandArguments'), 'scope':q['scope']},'resultIds':q.get('resultIds',[]),'status':q['status'],'sourceArtifact':'docs/research-updates/2026-10-18/source-retrieval.json'})
rawocc=sum(len(q['resultIds']) for q in queries)
for q in queries:
 q['rawResultIds']=q['resultIds'];q['resultIds']=list(dict.fromkeys(alias.get(z,normid(z)) for z in q['resultIds']));q['resultCount']=len(q['resultIds'])
 for z in q['resultIds']:
  assert z in records,(z,q['family'])
  records[z]['queryFamilies'].append(q['family'])
existing={};existingTitles={}
files=subprocess.check_output(['git','ls-tree','-r','--name-only','378a229','content/papers'],text=True).splitlines()
for path in files:
 raw=subprocess.check_output(['git','show','378a229:'+path],text=True); fm=json.loads(raw.split('---',2)[1]);existingTitles[normtitle(fm['title'])]=fm['id']
 for x in re.findall(r'(?:arXiv:?\s*|arxiv\.org/(?:abs|pdf|html)/)(\d{4}\.\d{4,5})',fm['source'],re.I):existing['arxiv:'+x]=fm.get('revisionOf',fm['id'])
manual={
'arxiv:2610.14090':'房产无人机环绕采集的PGO失败分析；尚无直接道路流式重建验证，本期暂缓。',
'arxiv:2610.15343':'物理纹理攻击在EPIC-KITCHENS/SSV2及打印回拍验证，未建立道路驾驶攻击证据。',
'arxiv:2610.18321':'主要为MP3D与四足平台语义导航，不作为STU道路LiDAR异常分割的新证据。',
'arxiv:2610.19883':'occupancy指折扣状态访问分布，非本项目三维语义占据任务。',
'arxiv:2610.20240':'已读摘要片段描述多人游戏世界模型，未确认道路驾驶证据。',
'arxiv:2610.22277':'主要实验是多船海事规则协调，暂不作为道路协同决策报告。',
'arxiv:2610.22143':'抽象已明确10Hz时限测试使用固定工作量代理，完整占据约1.3秒/帧；值得后续系统专题，本轮尚未核对全文与计时资产。',
'arxiv:2610.15112':'驾驶流式重建直接相关；本轮保留为后续候选，未读完整对齐协议及几何误差实验，不能仅依摘要排名入选。',
'arxiv:2610.17688':'占据与动作联合flow直接相关；本期先覆盖路侧预测与运行时机制，该候选仅摘要阅读，留待独立全文核查。',
'arxiv:2610.20609':'指令冲突与world-model dreaming直接相关；本期语言控制选入更直接的成对评测，不重复依据摘要接受方法收益。',
'arxiv:2610.22041':'冻结world-model的控制器适配值得跟进；仅摘要阅读，本期执行接口先选择协议核查工作。',
'arxiv:2610.19201':'跨传感器LiDAR生成与重仿真直接相关，但不是未知物体异常分割；当前仅摘要阅读，留作后续世界模型候选。',
'doi:10.1007/978-3-032-40108-3_15':'官方摘要和题录确认10月16日上线；组合安全的条件与证明尚未逐条阅读，暂缓完整报告。',
'doi:10.26599/etsd.2026.9190095':'10月16日发布的是法规需求推导的复现实验资源包，非期刊论文正式DOI；在资源附注记录，不作为新论文报告。',
'doi:10.1016/j.trc.2026.105924':'DOI8月18日已创建、最近deposit10月10日、期卷标12月，未核实本期新发布事件；不以抓取日期当发表日。'}
for key,c in records.items():
 c['queryFamilies']=sorted(set(c['queryFamilies']));c['urls']=list(dict.fromkeys(c['urls']));c['retrievalRecordIds']=list(dict.fromkeys(c['retrievalRecordIds']))
 c['readingDepth']='title+abstract' if key in read_abstract else 'title'
 c['disposition']='title-abstract-excluded';c['selectionDetail']='deferred-primary-verification' if key in read_abstract else 'title-scope-or-metadata-deferred'
 c['reason']=manual.get(key, '本轮题录筛查未形成足够直接、时间可核实的道路研究证据；未送入全文比较，保留线索，未评价论文质量。')
 if key in read_abstract and key not in manual:c['reason']='已读摘要；本期优先收录能形成明确机制与协议对照的八篇，该项仍需全文、资源及可比条件核查，留作后续候选。'
 if key in existing or normtitle(c['title']) in existingTitles:
  c['selectionDetail']='duplicate-existing';c['existingPaperId']=existing.get(key,existingTitles.get(normtitle(c['title'])));c['reason']='已在本库收录；不重复计作首次报告，版本变化由独立更新台账处理。'
 if key=='arxiv:2610.18030':
  c.update(disposition='full-text-excluded',selectionDetail='primary-section-deferred',readingDepth='title+abstract+primary-section',primarySectionsRead=['S6'],reason='已读§VI限制：模拟器绑定特定冻结编码器，结果主要是source-to-reference一致性；本期先选评测协议与语言控制，FlowSim留待完整方法/实验比较。此处仅具名章节阅读，非全篇精读。')
 if key in selected:
  slug,reason,sections=selected[key];c.update(paperId=slug,disposition='selected',selectionDetail='selected-first-report',reason=reason,readingDepth='title+abstract+primary-sections',primarySectionsRead=sections)
coverage=a['catalogCoverage'];runs=[]
for q in coverage['catalogRuns']:
 if q['catalogKind']=='2026-10':runs.append({'category':q['category'],'searchQuery':q['pages'][0]['url'],'resultCount':len(q['resultIds']),'resultIds':q['resultIds'],'pages':q['pages'],'complete':q['complete']})
unique=set(z for q in runs for z in q['resultIds'])
cov={'queryOccurrences':sum(q['resultCount'] for q in runs),'uniqueRecords':len(unique),'runs':runs,'screenedCandidates':len(catids),'screenedOut':len(unique)-len(catids),'screeningNote':'Broad title match among IDs absent from prior union. Screened-out includes prior snapshot overlaps; it is not a quality rejection. Five continuing categories plus supplementary eess.SY.'}
counts={'queryOccurrences':sum(q['resultCount'] for q in queries),'deduplicatedCandidates':len(records),'titleAbstractExcluded':sum(c['disposition']=='title-abstract-excluded' for c in records.values()),'fullTextExcluded':1,'selected':8,'fullTextCompared':9,'rawQueryOccurrencesBeforeAliasNormalization':rawocc,'catalogTitlesRead':324,'sourceTitleRecordsRead':458,'extraSeedTitlesRead':23,'completeAbstractsRead':len(read_abstract),'entirePaperReadsClaimedBySelector':0}
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
audit={'digestId':'2026-10-18','auditedAt':now,'scanWindow':{'previousDigest':'2026-10-12','currentDigest':'2026-10-18','recentListWindow':'Official recent headings through2026-10-16; main update focus afterOct12. Month lists compared with prior issue snapshot.','querySubmittedDateRange':'2026-10-11T00:00:00Z/2026-10-18T23:59:59Z for ten arXiv seed queries; actual execution Oct17UTC/Oct18AsiaShanghai. Category difference also captures earlier submissions newly announced.','boundaryNote':'Issue date/collection/submission/announcement distinct. Latest announcement Oct16. eess.SY supplementary has no prior same-category snapshot; early-Oct results are catch-up candidates, not automatically new.'},'categoryCoverage':cov,'queryRuns':queries,'counts':counts,'rubric':{'path':'content/templates/paper-selection-rubric.md','policy':'Eight first reports; selected across priority1 topics, with cross-topic links, no quota filling.','independence':'Two retrieval shards provided unranked records; root performed title/abstract/primary-section selection.'},'candidates':list(records.values()),'independentSelection':{'selectorAgentId':'/root','retrievalAgents':['/root/retrieve_arxiv_oct18','/root/retrieve_sources_oct18'],'completedAt':now,'inputFingerprints':[{'path':str(f.relative_to(root)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [out/'arxiv-retrieval.json',out/'source-retrieval.json']],'readDepthNote':'Counts refer to displayed/read material; downloads and available abstracts do not count. Selected authors subsequently read mechanisms, equations and experiments for report authoring.'},'sourceLimitations':a['limitations']+b['limitations'],'versionOrResourceUpdateNotes':b['existingPaperUpdates'],'independentReview':{'finalOutcome':'pending','reviewerAgentId':'','completedAt':now,'finalFinding':'Awaiting independent scientific and integration review.'}}
(root/'content/digest-audits/2026-10-18.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
(out/'selection-aliases.json').write_text(json.dumps(merges,ensure_ascii=False,indent=2)+'\n')
(out/'selection-summary.json').write_text(json.dumps({'selected':selected,'counts':counts,'sourceScope':'Discovery contains resources and non-paper results; deduplicatedCandidates counts entities, not all scholarly papers.','closedAt':now},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(counts,indent=2));print('aliases',len(merges))
