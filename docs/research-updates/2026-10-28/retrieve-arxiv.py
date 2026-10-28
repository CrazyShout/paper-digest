#!/usr/bin/env python3
import urllib.request,urllib.parse,urllib.error,xml.etree.ElementTree as ET,json,re,html,time,hashlib,datetime,concurrent.futures
from pathlib import Path
ROOT=Path('/Users/atlas/work/repo/paper-digest'); OUT=Path('/tmp/paper-digest-20261028/arxiv'); OUT.mkdir(parents=True,exist_ok=True)
PRIOR=ROOT/'docs/research-updates/2026-10-23/arxiv-retrieval.json'
prior=json.loads(PRIOR.read_text()); cats=['cs.RO','cs.CV','cs.AI','cs.LG','eess.IV','eess.SY']; UA='PaperDigestResearch/1.0 (public-literature-metadata)'
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(b): return hashlib.sha256(b).hexdigest()
def write(name,obj): (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).strip()
def fetch(url,name):
 rec={'url':url,'executedAt':now(),'path':str(OUT/name),'attempts':[]}
 for n in range(3):
  stamp=now()
  try:
   req=urllib.request.Request(url,headers={'User-Agent':UA})
   with urllib.request.urlopen(req,timeout=90) as r:
    b=r.read(); status=r.status; resolved=r.url; headers=dict(r.headers)
   if b.strip()==b'Rate exceeded.': raise RuntimeError('Rate exceeded body')
   (OUT/name).write_bytes(b); rec.update(status=status,resolvedUrl=resolved,sha256=sha(b),bytes=len(b),responseHeaders=headers,retrievedAt=now());rec['attempts'].append({'at':stamp,'success':True});write(name+'.receipt.json',rec);return b,rec
  except Exception as e:
   rec['attempts'].append({'at':stamp,'error':str(e)});time.sleep(4*(n+1))
 rec.update(status='failed',completedAt=now());write(name+'.receipt.json',rec);return None,rec

def parse_catalog(b,cat,kind):
 s=b.decode(); items=[]; date=None
 for token in re.finditer(r'<h3[^>]*>.*?</h3>|<dt>.*?</dt>\s*<dd>.*?</dd>',s,re.S):
  block=token.group()
  if block.startswith('<h3'):
   d=re.search(r'\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(\d{1,2}\s+\w{3}\s+\d{4})',clean(block))
   if d: date=datetime.datetime.strptime(d.group(1),'%d %b %Y').date().isoformat()
   continue
  m=re.search(r'href\s*=\s*[\'"]/abs/([^\'"?]+)',block)
  if not m: continue
  aid=re.sub(r'v\d+$','',m.group(1)); fields={}
  for key,cl in [('title','list-title'),('authors','list-authors'),('comments','list-comments'),('subjects','list-subjects')]:
   f=re.search(r'<div class=[\'"][^\'"]*\b'+cl+r'\b[^\'"]*[\'"]>(.*?)</div>',block,re.S)
   v=f.group(1) if f else ''
   if key=='authors': fields[key]=[clean(x) for x in re.findall(r'<a[^>]*>(.*?)</a>',v,re.S)]
   else: fields[key]=re.sub(r'^(Title:|Comments:|Subjects:)\s*','',clean(v))
  items.append({'canonicalId':'arxiv:'+aid,'id':aid,**fields,'category':cat,'catalogKind':kind,'announcementDate':date,'primaryUrl':'https://arxiv.org/abs/'+aid})
 totals=re.findall(r'Total of\s+([\d,]+)\s+entries',s)
 total=int(totals[0].replace(',','')) if totals else None
 return items,total

def catalog_cat(cat):
 records=[]; allitems=[]
 for kind in ['2026-10','recent']:
  pages=[]; items=[]; skip=0; total=None; complete=False
  while True:
   url=f'https://arxiv.org/list/{cat}/{kind}?skip={skip}&show=2000';name=f'{cat}-{kind}-{skip}.html'
   b,rec=fetch(url,name)
   if b is None: pages.append(rec);break
   parsed,total=parse_catalog(b,cat,kind);rec.update(skip=skip,show=2000,parsedEntries=len(parsed),totalReported=total);pages.append(rec);items+=parsed
   if total is not None and len(items)>=total: complete=len(items)==total;break
   if not parsed:break
   skip+=len(parsed);time.sleep(3)
  r={'category':cat,'catalogKind':kind,'resultCount':len(items),'uniqueCount':len(set(x['canonicalId'] for x in items)),'resultIds':[x['canonicalId'] for x in items],'pages':pages,'complete':complete};records.append(r);allitems+=items
  write(cat+'-catalog.json',{'runs':records,'entries':allitems});print(cat,kind,len(items),total,complete,flush=True);time.sleep(3)
 return records,allitems

def catalogs():
 allruns=[];allitems=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  for runs,items in ex.map(catalog_cat,cats):allruns+=runs;allitems+=items
 priorIds=set(x for r in prior['catalogCoverage']['catalogRuns'] if r['catalogKind']=='2026-10' for x in r['resultIds'])
 month={};recent={}
 for e in allitems:
  dst=month if e['catalogKind']=='2026-10' else recent
  x=dst.setdefault(e['canonicalId'],{**e,'categoriesSeen':[],'announcementDates':[]})
  if e['category'] not in x['categoriesSeen']:x['categoriesSeen'].append(e['category'])
  if e['announcementDate'] and e['announcementDate'] not in x['announcementDates']:x['announcementDates'].append(e['announcementDate'])
 for cid,e in month.items():
  if cid in recent:e['announcementDates']=recent[cid]['announcementDates']
 pattern=prior['catalogCoverage']['broadTitlePattern'];pat=re.compile(pattern,re.I)
 new=[e for cid,e in month.items() if cid not in priorIds]; titlec=[e for e in new if pat.search(e['title'])]; excluded=[{'canonicalId':e['canonicalId'],'title':e['title'],'categoriesSeen':e['categoriesSeen'],'announcementDates':e['announcementDates']} for e in new if not pat.search(e['title'])]
 pri=set(x for r in allruns if r['catalogKind']=='2026-10' and r['category']!='eess.SY' for x in r['resultIds'])
 count={'monthCategoryOccurrences':sum(r['resultCount'] for r in allruns if r['catalogKind']=='2026-10'),'monthUniqueIds':len(month),'primaryFiveCategoryOccurrences':sum(r['resultCount'] for r in allruns if r['catalogKind']=='2026-10' and r['category']!='eess.SY'),'primaryFiveUniqueIds':len(pri),'supplementalOnlyUniqueIds':len(set(month)-pri),'recentCategoryOccurrences':sum(r['resultCount'] for r in allruns if r['catalogKind']=='recent'),'recentUniqueIds':len(recent),'alreadyInPreviousSnapshot':len(set(month)&priorIds),'notInPreviousSnapshot':len(new),'priorIdsMissingNow':len(priorIds-set(month)),'broadTitleCandidates':len(titlec),'newTitlePatternExcluded':len(excluded)}
 days=sorted(set(x for e in recent.values() for x in e['announcementDates']))
 cov={'issueDate':'2026-10-28','retrievedAt':now(),'shardId':'arxiv-catalog-retrieval','role':'retrieval only; no ranking or acceptance','window':{'focus':'2026-10-24/2026-10-28','submissionOverlap':'2026-10-21/2026-10-28','latestObservedAnnouncement':days[-1] if days else None,'observedAnnouncementDates':days,'dateBoundary':'Monthly listings establish occurrence, not precise announcement. Recent h3 headings supply announcement dates. Submission/version dates come from Atom.'},'priorSnapshot':{'path':str(PRIOR.relative_to(ROOT)),'sha256':sha(PRIOR.read_bytes()),'uniqueIds':len(priorIds),'categories':cats},'primaryCategories':cats[:5],'supplementalCategories':['eess.SY'],'catalogRuns':allruns,'counts':count,'broadTitlePattern':pattern,'screeningBoundary':'Mechanical broad title recall; not abstract reading, scope rejection or quality ranking. Unmatched records retained separately; query search may rediscover them.','priorIdsMissingNow':sorted(priorIds-set(month)),'newTitleExcluded':excluded,'newTitleExcludedReason':'No broad title pattern match; not an assessed paper exclusion.','announcementDateById':{k:v['announcementDates'] for k,v in recent.items()}}
 focus={k for k,v in recent.items() if any('2026-10-24'<=d<='2026-10-28' for d in v['announcementDates'])}
 new_ids={e['canonicalId'] for e in new}
 cov['focusRecordsOutsideMonthlyDifference']=[{**recent[k],'presentInPreviousMonthlySnapshot':k in priorIds,'presentInCurrentMonthlySnapshot':k in month,'broadTitlePatternMatch':bool(pat.search(recent[k]['title']))} for k in sorted(focus-new_ids)]
 cov['focusVsDifferenceNote']='Recent announcement headings can contain earlier identities. The focus-window recent union is not identical to the current-month ID difference; extra identities are retained individually and are not counted as new monthly candidates.'
 write('catalog-coverage.json',cov);write('catalog-candidates.json',titlec);write('catalog-new-all.json',new);print('CATALOG DONE',json.dumps(count),flush=True)

NS={'a':'http://www.w3.org/2005/Atom','ar':'http://arxiv.org/schemas/atom','o':'http://a9.com/-/spec/opensearch/1.1/'}
def parse_atom(b):
 root=ET.fromstring(b);entries=[]
 for e in root.findall('a:entry',NS):
  raw=e.findtext('a:id','',NS);ver=raw.rsplit('/abs/',1)[-1];aid=re.sub(r'v\d+$','',ver)
  if not re.match(r'\d{4}\.\d{4,5}$',aid):continue
  entries.append({'canonicalId':'arxiv:'+aid,'id':aid,'versionedId':ver,'title':clean(e.findtext('a:title','',NS)),'abstract':clean(e.findtext('a:summary','',NS)),'authors':[x.findtext('a:name','',NS) for x in e.findall('a:author',NS)],'submittedAt':e.findtext('a:published','',NS),'updatedAt':e.findtext('a:updated','',NS),'categories':[x.get('term') for x in e.findall('a:category',NS)],'doi':e.findtext('ar:doi','',NS),'journalRef':e.findtext('ar:journal_ref','',NS),'comment':e.findtext('ar:comment','',NS),'links':[x.attrib for x in e.findall('a:link',NS)],'primaryUrl':'https://arxiv.org/abs/'+aid})
 total=root.findtext('o:totalResults',None,NS)
 return entries,int(total) if total is not None else None

def queries():
 runs=[];candidate={}
 for old in prior['queryRuns']:
  q=re.sub(r'submittedDate:\[[^\]]+\]','submittedDate:[202610210000 TO 202610282359]',old['query']);direction=old['direction'];pages=[];entries=[];start=0;total=None;complete=False
  while True:
   params={'search_query':q,'start':start,'max_results':200,'sortBy':'submittedDate','sortOrder':'descending'};url='https://export.arxiv.org/api/query?'+urllib.parse.urlencode(params)
   b,rec=fetch(url,f'query-{direction}-{start}.xml');rec['endpoint']='https://export.arxiv.org/api/query';rec['parameters']=params
   if b is None:pages.append(rec);break
   try: es,total=parse_atom(b);rec.update(resultCount=len(es),providerTotal=total)
   except Exception as e:rec['parseError']=str(e);pages.append(rec);break
   pages.append(rec);entries+=es
   for e in es:
    x=candidate.setdefault(e['canonicalId'],{**e,'queryFamilies':[],'metadataSources':[]})
    if direction not in x['queryFamilies']:x['queryFamilies'].append(direction)
    x['metadataSources'].append({'path':rec['path'],'sha256':rec['sha256'],'evidenceKind':'original Atom response bytes'})
   if (total is not None and len(entries)>=total) or len(es)<200:complete=True;break
   start+=len(es);time.sleep(3)
  runs.append({'id':'arxiv-seed-'+direction,'family':'arxiv seed: '+direction,'direction':direction,'sourceFamily':'arxiv','query':q,'scopeRationale':'All ten configured directions; overlapping submission window Oct21–28, retaining every response for separate selection, including false positives.','executedAt':pages[0]['executedAt'],'status':'success' if complete else 'partial-or-failed','resultCount':len(entries),'resultIds':[x['canonicalId'] for x in entries],'pages':pages,'complete':complete})
  write('query-runs.json',runs);write('query-candidates.json',list(candidate.values()));print('QUERY',direction,len(entries),total,complete,flush=True);time.sleep(3)
 print('QUERIES DONE',len(runs),len(candidate),flush=True)

def complete():
 config_path=ROOT/'config/research-interests.json'
 config=json.loads(config_path.read_text())
 cov=json.loads((OUT/'catalog-coverage.json').read_text())
 qr=json.loads((OUT/'query-runs.json').read_text())
 assert {x['direction'] for x in qr}=={x['id'] for x in config['interests']}
 tc=json.loads((OUT/'catalog-candidates.json').read_text())
 qc=json.loads((OUT/'query-candidates.json').read_text())
 candidates={}
 for index,row in enumerate(tc):
  candidates[row['canonicalId']]={**row,'queryFamilies':['monthly-catalog-title-screen'],'abstractAvailable':False,'readingDepth':'metadata-available-not-semantically-reviewed','catalogIndex':index,'metadataSources':[]}
 for row in qc:
  key=row['canonicalId']
  if key in candidates:
   previous=candidates[key]
   families=previous['queryFamilies']+row['queryFamilies']
   candidates[key]={**previous,**row,'queryFamilies':list(dict.fromkeys(families)),'catalogIndex':previous['catalogIndex']}
  else:
   candidates[key]={**row,'catalogIndex':None,'announcementDates':cov['announcementDateById'].get(key,[]),'readingDepth':'metadata-available-not-semantically-reviewed'}
  candidates[key]['abstractAvailable']=bool(candidates[key].get('abstract'))
 metadata_runs=[]
 missing=[x['id'] for x in candidates.values() if not x.get('abstractAvailable')]
 for start in range(0,len(missing),40):
  ids=missing[start:start+40]
  params={'id_list':','.join(ids),'start':0,'max_results':len(ids)}
  url='https://export.arxiv.org/api/query?'+urllib.parse.urlencode(params)
  b,rec=fetch(url,f'metadata-{start//40}.xml')
  rec.update(endpoint='https://export.arxiv.org/api/query',parameters=params,requestedIds=ids)
  if b is not None:
   parsed,total=parse_atom(b)
   rec.update(providerTotal=total,resultCount=len(parsed),resultIds=[x['canonicalId'] for x in parsed])
   for row in parsed:
    key=row['canonicalId']
    if key not in candidates: continue
    old=candidates[key]
    candidates[key]={**old,**row,'abstractAvailable':bool(row.get('abstract')),'metadataSources':old.get('metadataSources',[])+[{'path':rec['path'],'sha256':rec['sha256'],'evidenceKind':'original Atom response bytes'}]}
   rec['missingIds']=[x for x in ids if 'arxiv:'+x not in {e['canonicalId'] for e in parsed}]
  metadata_runs.append(rec)
  write('metadata-query-runs.json',metadata_runs)
  print('METADATA',start,len(ids),rec.get('resultCount'),flush=True)
  time.sleep(3.1)
 rows=list(candidates.values())
 for row in rows:
  text=(row.get('title','')+' '+row.get('abstract','')).lower()
  row['topicHints']=[x['id'] for x in config['interests'] if any(term.lower() in text for term in x['includeKeywords'])]
  row['drivingContextHint']=bool(re.search(r'\b(driv\w*|vehicle\w*|automotive|road\w*|traffic|V2X|LiDAR|radar|street\w*)\b',text,re.I))
  row['scopeHintBoundary']='Mechanical keyword hints from configured includeKeywords; not relevance scores, quality ranking or acceptance.'
  row['normalizedTitle']=re.sub(r'[^\w]+','',row['title'].lower())
  row['dedupKey']=row['canonicalId']
  row['dedup_key']=row['canonicalId']
  row['readingDepth']='metadata-available-not-semantically-reviewed'
  row['abstractAvailable']=bool(row.get('abstract'))
 counts={**cov['counts'],'seedQueryCount':len(qr),'seedSuccessfulQueries':sum(x['complete'] for x in qr),'seedFailedQueries':sum(not x['complete'] for x in qr),'seedOccurrences':sum(x['resultCount'] for x in qr),'seedUniqueIds':len({z for x in qr for z in x['resultIds']}),'mergedCandidateRecords':len(rows),'candidatesWithAbstractAvailable':sum(x['abstractAvailable'] for x in rows),'abstractReadCount':0,'primarySectionReadCount':0,'qualityRankedCount':0,'acceptedCount':0}
 paths=[p for p in OUT.iterdir() if p.suffix in ['.xml','.html']]
 result={'shardId':'arxiv-catalog-retrieval-oct28','issueDate':'2026-10-28','completedAt':now(),'role':'retrieval only; no ranking or acceptance','catalogCoverage':cov,'queryRuns':qr,'metadataQueryRuns':metadata_runs,'counts':counts,'candidates':rows,'limitations':['Catalog novelty is a change from the Oct23 snapshot, not necessarily a first submission or a publication date.','Monthly directory dates can differ from Atom submission dates. Recent headings establish observed announcement windows only.','Broad title pattern and seed terms yield false positives; this shard performs no semantic reading, quality ranking or acceptance.','Original Atom and listing responses are preserved in a local temporary cache. Metadata acquisition and parsing do not count as abstract or full-text reading.','Journal references and author comments are not independently verified venue acceptance evidence.','Ten configured query families cover lexical recall, not an exhaustive proof of no other progress.'],'artifacts':[{'path':str(p),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(paths)],'configuration':{'path':'config/research-interests.json','sha256':sha(config_path.read_bytes()),'queryAdaptation':'Retained prior issue lexical families covering the same ten current direction IDs; only submission bounds updated.'}}
 focus_ids={k for k,days in cov['announcementDateById'].items() if any('2026-10-24'<=v<='2026-10-28' for v in days)}
 for destination in [counts,cov['counts']]:
  destination['focusAnnouncementUniqueIds']=len(focus_ids)
  destination['focusAnnouncementCategoryOccurrences']=sum(sum(x in focus_ids for x in r['resultIds']) for r in cov['catalogRuns'] if r['catalogKind']=='recent')
 missing_check=ROOT/'docs/research-updates/2026-10-28/arxiv-prior-missing-investigation.json'
 if missing_check.exists():
  checked=json.loads(missing_check.read_text())
  cov['priorMissingRecordChecks']=[{'canonicalId':r['canonicalId'],'primaryUrl':r['primaryUrl'],'currentVersion':r['versionedId'],'currentCategories':r['categories'],'withdrawn':'withdrawn' in r.get('comment','').lower(),'interpretation':checked['finding'],'evidenceArtifact':str(missing_check.relative_to(ROOT))} for r in checked['entries']]
  result['limitations'].append('One Oct23 ID is absent from the current six-category union; official metadata lists it as withdrawn and only cs.CL. The directory-change time is not established, and the raw prior snapshot remains unchanged.')
 output=ROOT/'docs/research-updates/2026-10-28/arxiv-retrieval.json'
 output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 index={'shard_id':'arxiv-catalog-retrieval-oct28','role':'retrieval-only','sourceArtifact':str(output.relative_to(ROOT)),'entries':[{'dedup_key':r['canonicalId'],'payload':{'candidateIndex':i,'title':r['title'],'primaryUrl':r['primaryUrl'],'queryFamilies':r['queryFamilies']}} for i,r in enumerate(rows)]}
 (output.parent/'arxiv-shard-index.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
 assert counts['notInPreviousSnapshot']==counts['broadTitleCandidates']+counts['newTitlePatternExcluded']
 assert counts['monthUniqueIds']==counts['alreadyInPreviousSnapshot']+counts['notInPreviousSnapshot']
 assert len(rows)==len({r['canonicalId'] for r in rows})
 print('COMPLETE',json.dumps(counts),flush=True)

if __name__=='__main__':
 import sys
 command=sys.argv[1] if len(sys.argv)>1 else 'all'
 if command=='catalogs':catalogs()
 elif command=='queries':queries()
 elif command=='complete':complete()
 elif command=='all':
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
   futures=[ex.submit(f) for f in [catalogs,queries]]
   for future in futures:future.result()
  complete()
 else:raise ValueError('Expected catalogs, queries, complete or all')
