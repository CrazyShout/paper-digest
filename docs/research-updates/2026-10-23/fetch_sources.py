import concurrent.futures, contextlib, datetime, hashlib, importlib.util, io, json, pathlib, re, sys, time, urllib.parse, urllib.request, urllib.error, xml.etree.ElementTree as ET
try:
 import requests
except ImportError:
 try:
  import pip._vendor.requests as requests
  sys.modules['requests']=requests
 except ImportError:
  pass

ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest')
OUT=pathlib.Path('/tmp/paper-digest-20261023/sources')
PREV=json.loads((ROOT/'docs/research-updates/2026-10-18/source-retrieval.json').read_text())
CUTOFF='2026-10-17T18:31:01Z'
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def dump(name,x):
 p=OUT/name; p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n'); return str(p)
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def loadmod(name,p):
 s=importlib.util.spec_from_file_location(name,p); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); return m
def get(url,name):
 rec={'url':url,'executedAt':now()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PaperDigest-literature-audit/1.0'}),timeout=45) as r:
   body=r.read(); rec.update(httpStatus=r.status,status='success')
 except urllib.error.HTTPError as e:
  body=e.read(); rec.update(httpStatus=e.code,status='limited',error='HTTP '+str(e.code))
 except Exception as e:
  rec.update(status='limited',error=type(e).__name__); return rec,None
 p=OUT/name; p.write_bytes(body); rec.update(rawPath=str(p),rawSha256=sha(p)); return rec,body

queries=[
 ('cooperation','cooperative autonomous driving',['cooperative-autonomous-driving']),
 ('agentic','autonomous driving agent memory',['agentic-driving']),
 ('e2e','autonomous driving vision language action',['end-to-end-autonomous-driving']),
 ('scene','autonomous driving occupancy forecasting',['dynamic-scene-representation']),
 ('world','autonomous driving world model',['world-models']),
 ('reconstruction','autonomous driving Gaussian reconstruction',['3d-reconstruction']),
 ('radar','radar occupancy',['radar-occupancy-representation']),
 ('lidar-anomaly','LiDAR anomaly segmentation',['lidar-anomaly-segmentation']),
 ('testing','autonomous driving safety scenario testing',['autonomous-driving-testing']),
 ('security','autonomous driving adversarial attack',['autonomous-driving-security'])]

def academic():
 results=[]
 oa=loadmod('openalex_local','/Users/atlas/work/repo/Auto-claude-code-research-in-sleep/tools/openalex_fetch.py')
 s2=loadmod('semantic_local','/Users/atlas/work/repo/Auto-claude-code-research-in-sleep/tools/semantic_scholar_fetch.py')
 for source in ['openalex','semantic-scholar']:
  for slug,q,directions in queries:
   rec={'id':source+'-'+slug,'source':source,'query':q,'directionIds':directions,'executedAt':now(),'scope':'First bounded result page for publication year 2026. Dates require primary-source verification. No exhaustive or zero-progress claim. Retrieval role does not select or rank papers.'}
   if source=='openalex':
    client=oa.OpenAlexClient(); oldget=client.session.get
    def tracked(url,**kwargs):
     params={k:v for k,v in kwargs.get('params',{}).items() if k not in ('api_key','mailto')}
     rec.update(url=url+'?'+urllib.parse.urlencode(params),parameters=params)
     response=oldget(url,**kwargs); rec['httpStatus']=response.status_code
     p=OUT/(rec['id']+'-raw.json'); p.write_bytes(response.content); rec.update(rawPath=str(p),rawSha256=sha(p)); return response
    client.session.get=tracked
    try:
     with contextlib.redirect_stderr(io.StringIO()): rows=client.search_works(q,max_results=50,publication_year='2026',sort='publication_date:desc')
     rec.update(status='success',resultCount=len(rows),results=rows)
     raw=json.loads(pathlib.Path(rec['rawPath']).read_text()); rec['providerTotal']=raw.get('meta',{}).get('count'); rec['capped']=len(rows)>=50
    except Exception as e: rec.update(status='limited',error=type(e).__name__,resultCount=None)
   else:
    oldreq=s2._request_json
    def tracked2(url,**kwargs):
     rec.update(url=url,parameters=dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query)))
     raw=oldreq(url,**kwargs); p=dump(rec['id']+'-raw.json',raw); rec.update(rawPath=p,rawSha256=sha(p)); return raw
    s2._request_json=tracked2
    try:
     rows=s2.search(q,max_results=50,year='2026',fields_of_study='Computer Science,Engineering')
     rec.update(status='success',resultCount=len(rows['data']),providerTotal=rows.get('total'),results=rows['data'],capped=len(rows['data'])>=50)
    except Exception as e: rec.update(status='limited',error=str(e)[:1000],resultCount=None)
    finally: s2._request_json=oldreq
   results.append(rec); dump('academic-results.json',results); print(rec['id'],rec['status'],rec.get('resultCount'),flush=True); time.sleep(1)
 return results

def versions():
 ids={}; sources={}
 for p in sorted((ROOT/'content/papers').glob('*.md')):
  d=json.loads(p.read_text().split('---')[1]); source=d.get('source',''); found=set(re.findall(r'(?:arxiv\.org/(?:abs|html|pdf)/|arXiv:)(\d{4}\.\d{4,5})(?:v\d+)?',source,re.I))
  for i in found: ids.setdefault(i,[]).append(d['id']); sources[i]=source
 previous={e['canonicalId'][6:]:e for e in PREV['priorVersionScan']['entries']}
 allids=sorted(ids); records=[]; entries=[]; ns={'a':'http://www.w3.org/2005/Atom','x':'http://arxiv.org/schemas/atom'}
 for start in range(0,len(allids),55):
  part=allids[start:start+55]; pars={'id_list':','.join(part),'max_results':len(part)}; url='https://export.arxiv.org/api/query?'+urllib.parse.urlencode(pars)
  rec,body=get(url,'prior-'+str(start)+'.xml'); rec.update(requestedIds=part,parameters=pars)
  if rec['status']=='success':
   for e in ET.fromstring(body).findall('a:entry',ns):
    version=e.findtext('a:id',namespaces=ns).rsplit('/',1)[-1]; i=version.split('v')[0]
    if i not in ids: continue
    prior=previous.get(i); cur={'canonicalId':'arxiv:'+i,'versionId':version,'title':' '.join(e.findtext('a:title',default='',namespaces=ns).split()),'abstract':' '.join(e.findtext('a:summary',default='',namespaces=ns).split()),'updated':e.findtext('a:updated',namespaces=ns),'published':e.findtext('a:published',namespaces=ns),'primaryUrl':'https://arxiv.org/abs/'+version,'reportIds':ids[i],'previousScanVersion':prior['versionId'] if prior else None,'changedSincePreviousScan':prior is not None and prior['versionId']!=version,'updatedAfterCutoff':e.findtext('a:updated',namespaces=ns)>CUTOFF,'sourceFrontmatter':sources[i],'comments':e.findtext('x:comment',namespaces=ns),'doi':e.findtext('x:doi',namespaces=ns)}
    entries.append(cur)
   rec['resultCount']=sum(i['canonicalId'][6:] in part for i in entries)
  records.append(rec); time.sleep(3.1)
 result={'scope':'Metadata-only official arXiv version comparison against frozen Oct18 scan. New Oct18 report IDs not in that pre-authoring scan use current source frontmatter only. No full-text change conclusions.','cutoff':CUTOFF,'requestedCount':len(allids),'queries':records,'entries':entries,'missingIds':sorted(set(allids)-{e['canonicalId'][6:] for e in entries})}
 dump('prior-version-scan.json',result); print('version scan',len(entries),'changes',[(e['canonicalId'],e['versionId']) for e in entries if e['changedSincePreviousScan'] or e['updatedAfterCutoff']],flush=True)
 return result

def releases():
 repos={r['repo'] for r in PREV['trackedReleaseChecks']}
 for p in (ROOT/'content/papers').glob('*.md'):
  d=json.loads(p.read_text().split('---')[1]); repos.update(m.rstrip('.').removesuffix('.git') for m in re.findall(r'https://github\.com/([\w.-]+/[\w.-]+)',d.get('source','')))
 def run(repo):
  url='https://api.github.com/repos/'+repo+'/releases?per_page=100'; rec,body=get(url,'release-'+repo.replace('/','--')+'.json'); rec.update(repo=repo,scope='GitHub Releases and attached asset timestamps only; not arbitrary commits, external data or weights.',cutoff=CUTOFF)
  if rec['status']=='success':
   rows=json.loads(body); rec.update(returnedCount=len(rows),capped=len(rows)>=100,windowReleases=[{'id':r['id'],'tagName':r['tag_name'],'publishedAt':r.get('published_at'),'createdAt':r.get('created_at'),'url':r['html_url'],'body':r.get('body'),'assets':r.get('assets',[])} for r in rows if (r.get('published_at') or '')>CUTOFF],windowAssetUpdates=[{'releaseId':r['id'],'url':r['html_url'],'asset':a} for r in rows for a in r.get('assets',[]) if a.get('updated_at','')>CUTOFF])
  return rec
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex: records=list(ex.map(run,sorted(repos)))
 dump('tracked-release-checks.json',records); print('releases',len(records),'window',[(r['repo'],len(r.get('windowReleases',[]))) for r in records if r.get('windowReleases') or r.get('windowAssetUpdates')],flush=True); return records

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  jobs=[ex.submit(f) for f in [academic,versions,releases]]
  for f in jobs:
   try: f.result()
   except Exception as e: print(type(e).__name__,str(e)[:1000],flush=True)
