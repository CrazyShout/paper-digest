import concurrent.futures,datetime,hashlib,json,pathlib,re,subprocess,time,urllib.parse,urllib.request,urllib.error,xml.etree.ElementTree as ET
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest')
OUT=pathlib.Path('/tmp/paper-digest-20261028/updates'); OUT.mkdir(parents=True,exist_ok=True)
PUB=ROOT/'docs/research-updates/2026-10-28'; PUB.mkdir(parents=True,exist_ok=True)
PREVPATH=ROOT/'docs/research-updates/2026-10-23/source-retrieval.json'; PREV=json.loads(PREVPATH.read_text())
CUTOFF='2026-10-23T00:00:00Z'
TOKEN=subprocess.check_output(['gh','auth','token'],text=True).strip()
NOW=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
SHA=lambda b:hashlib.sha256(b).hexdigest()
def dump(p,d): p.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
def get(url,name):
 rec={'url':url,'executedAt':NOW(),'attempts':[]}
 for attempt in range(2):
  headers={'User-Agent':'PaperDigest-literature-audit/1.0'}
  if url.startswith('https://api.github.com/'):headers['Authorization']='Bearer '+TOKEN
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as r:
    b=r.read();rec.update(status='success',httpStatus=r.status,retrievedAt=NOW(),responseHeaders={k:v for k,v in r.headers.items() if k.lower() in ['content-type','last-modified','etag','x-ratelimit-remaining','link']})
   p=OUT/name;p.write_bytes(b);rec.update(rawPath=str(p),rawSha256=SHA(b),bytes=len(b));rec['attempts'].append({'at':NOW(),'status':'success'});dump(OUT/(name+'.receipt.json'),rec);return rec,b
  except urllib.error.HTTPError as e:
   b=e.read();p=OUT/name;p.write_bytes(b);rec.update(status='limited',httpStatus=e.code,rawPath=str(p),rawSha256=SHA(b),bytes=len(b));rec['attempts'].append({'at':NOW(),'httpStatus':e.code})
   if e.code not in [429,500,502,503,504]:break
  except Exception as e:
   rec.update(status='limited',error=type(e).__name__);rec['attempts'].append({'at':NOW(),'error':type(e).__name__})
  time.sleep(3*(attempt+1))
 dump(OUT/(name+'.receipt.json'),rec);return rec,None

def versions():
 reports={};sources={};fixed={}
 for p in sorted((ROOT/'content/papers').glob('*.md')):
  d=json.loads(p.read_text().split('---')[1]);source=d.get('source','')
  for a,v in re.findall(r'(?:arxiv\.org/(?:abs|pdf|html)/|arXiv:\s*)(\d{4}\.\d{4,5})(v\d+)?',source,re.I):
   reports.setdefault(a,[])
   if d['id'] not in reports[a]:reports[a].append(d['id'])
   sources.setdefault(a,[])
   if source not in sources[a]:sources[a].append(source)
   if v:fixed.setdefault(a,set()).add(a+v)
 previous={e['canonicalId'].removeprefix('arxiv:'):e for e in PREV['priorVersionScan']['entries']}
 allids=sorted(reports);entries=[];queries=[];ns={'a':'http://www.w3.org/2005/Atom','x':'http://arxiv.org/schemas/atom'}
 for start in range(0,len(allids),50):
  part=allids[start:start+50];params={'id_list':','.join(part),'max_results':len(part)};url='https://export.arxiv.org/api/query?'+urllib.parse.urlencode(params)
  rec,b=get(url,f'prior-{start}.xml');rec.update(parameters=params,requestedIds=part,resultIds=[])
  if b:
   for e in ET.fromstring(b).findall('a:entry',ns):
    version=e.findtext('a:id',default='',namespaces=ns).rsplit('/',1)[-1];a=version.split('v')[0]
    if a not in reports:continue
    prev=previous.get(a);base=prev['versionId'] if prev else max(fixed.get(a,[]),key=lambda v:int(v.split('v')[1]),default=None)
    entry={'canonicalId':'arxiv:'+a,'versionId':version,'title':' '.join(e.findtext('a:title',default='',namespaces=ns).split()),'abstract':' '.join(e.findtext('a:summary',default='',namespaces=ns).split()),'published':e.findtext('a:published',namespaces=ns),'updated':e.findtext('a:updated',namespaces=ns),'primaryUrl':'https://arxiv.org/abs/'+version,'reportIds':reports[a],'sourceFrontmatter':sources[a],'fixedReportVersions':sorted(fixed.get(a,[])),'previousScanVersion':prev['versionId'] if prev else None,'comparisonBase':base,'comparisonBaseSource':'Oct23 frozen metadata scan' if prev else 'current report fixed-version source (new Oct23 reports)','changedSinceComparisonBase':base is not None and base!=version,'updatedAfterOverlapCutoff':e.findtext('a:updated',default='',namespaces=ns)>CUTOFF,'comments':e.findtext('x:comment',namespaces=ns),'doi':e.findtext('x:doi',namespaces=ns),'journalRef':e.findtext('x:journal_ref',namespaces=ns)}
    entries.append(entry);rec['resultIds'].append(entry['canonicalId'])
  rec['resultCount']=len(rec['resultIds']);queries.append(rec);print('version batch',start,rec['status'],rec['resultCount'],flush=True);time.sleep(3.2)
 result={'shardId':'prior-version-retrieval','role':'metadata retrieval, no selection','checkedAt':NOW(),'scope':'Primary source frontmatter identities from all current reports; metadata fetching does not count as paper reading. Compare frozen Oct23 scan, with fixed-report versions for eight reports added after that scan.','focusWindow':'2026-10-24/2026-10-28','cutoff':CUTOFF,'cutoffNote':'Overlap begins Oct23; version equality against actual prior snapshot determines changes.','priorSnapshot':{'path':str(PREVPATH.relative_to(ROOT)),'sha256':SHA(PREVPATH.read_bytes())},'reportFiles':len(list((ROOT/'content/papers').glob('*.md'))),'requestedCount':len(allids),'queries':queries,'entries':entries,'missingIds':sorted(set(allids)-{e['canonicalId'][6:] for e in entries})}
 dump(PUB/'prior-version-scan.json',result);dump(OUT/'prior-version-scan.json',result)
 changes=[e for e in entries if e['changedSinceComparisonBase']]
 dump(PUB/'version-update-candidates.json',changes);print('VERSION CHANGES',json.dumps([{k:e[k] for k in ['canonicalId','versionId','comparisonBase','updated','title']} for e in changes],ensure_ascii=False),flush=True)
 return result

def releases():
 repos={r['repo'] for r in PREV['trackedReleaseChecks']}
 for p in (ROOT/'content/papers').glob('*.md'):
  d=json.loads(p.read_text().split('---')[1]);repos.update(m.rstrip('.').removesuffix('.git') for m in re.findall(r'https://github\.com/([\w.-]+/[\w.-]+)',d.get('source','')))
 def each(repo):
  pages=[];rows=[];page=1
  while True:
   url=f'https://api.github.com/repos/{repo}/releases?per_page=100&page={page}';rec,b=get(url,'release-'+repo.replace('/','--')+f'-{page}.json');pages.append(rec)
   if not b:break
   batch=json.loads(b);rows.extend(batch)
   if len(batch)<100:break
   page+=1
  record={'repo':repo,'pages':pages,'status':'success' if all(p['status']=='success' for p in pages) else 'limited','returnedCount':len(rows),'cutoff':CUTOFF,'scope':'GitHub Releases plus asset updated timestamps, not arbitrary commits or external hosts','windowReleases':[{'id':r['id'],'tagName':r['tag_name'],'publishedAt':r.get('published_at'),'createdAt':r.get('created_at'),'url':r['html_url'],'body':r.get('body'),'assets':r.get('assets',[])} for r in rows if (r.get('published_at') or '')>CUTOFF],'windowAssetUpdates':[{'releaseId':r['id'],'url':r['html_url'],'asset':a} for r in rows for a in r.get('assets',[]) if a.get('updated_at','')>CUTOFF]}
  return record
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:records=list(ex.map(each,sorted(repos)))
 result={'shardId':'official-release-retrieval','checkedAt':NOW(),'scope':'Tracked repositories retained from prior scan, plus GitHub repositories linked in current primary source frontmatter. Not all commits or dataset hosts.','cutoff':CUTOFF,'requestedRepositoryCount':len(records),'successCount':sum(r['status']=='success' for r in records),'limitedCount':sum(r['status']!='success' for r in records),'records':records}
 dump(PUB/'tracked-release-checks.json',result);print('RELEASE SCAN',json.dumps({k:v for k,v in result.items() if k!='records'}),flush=True);print('RELEASE EVENTS',[(r['repo'],len(r['windowReleases']),len(r['windowAssetUpdates'])) for r in records if r['windowReleases'] or r['windowAssetUpdates']],flush=True);return result

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
  futures=[ex.submit(f) for f in [versions,releases]]
  for f in futures:f.result()
