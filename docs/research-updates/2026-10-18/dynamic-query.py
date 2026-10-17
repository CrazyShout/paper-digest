import concurrent.futures,datetime,json,pathlib,subprocess,urllib.parse,xml.etree.ElementTree as ET
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest');OUT=pathlib.Path('/tmp/paper-digest-dynamic-20261018/query-raw');OUT.mkdir(exist_ok=True)
qs=[('current','all:"semantic occupancy" AND (all:"driving" OR all:"scene completion")'),('temporal','(all:"occupancy forecasting" OR all:"scene memory") AND all:"driving"'),('unified','all:"occupancy" AND (all:"Gaussian" OR all:"vectorized" OR all:"unified")'),('visibility','all:"occupancy" AND (all:"unknown" OR all:"visibility" OR all:"occlusion")'),('identity','all:"occupancy" AND (all:"mapping" OR all:"panoptic" OR all:"permanence")'),('utility','all:"occupancy" AND (all:"planning" OR all:"calibration" OR all:"uncertainty")')]
jobs=[]
for fam,q in qs:jobs.append((fam,'arxiv',q,'https://export.arxiv.org/api/query?'+urllib.parse.urlencode({'search_query':q,'sortBy':'submittedDate','sortOrder':'descending','start':0,'max_results':20})))
for fam,host,params in [('semantic-scholar','https://api.semanticscholar.org/graph/v1/paper/search',{'query':'occupancy forecasting autonomous driving','limit':20,'fields':'title,authors,year,venue,externalIds,url'}),('openalex','https://api.openalex.org/works',{'search':'occupancy forecasting autonomous driving','per-page':20,'sort':'publication_date:desc'})]:jobs.append((fam,fam,params,host+'?'+urllib.parse.urlencode(params)))
p=json.loads((ROOT/'docs/research-updates/2026-10-18/dynamic-prior.json').read_text())
for r in p['references']:
 if r['canonicalId'].startswith('doi:'):jobs.append((r['id'],'crossref',r['canonicalId'],'https://api.crossref.org/works/'+urllib.parse.quote(r['canonicalId'][4:],safe='')))
def fetch(j):
 fam,source,q,url=j;stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();cp=subprocess.run(['curl','-L','--max-time','25','-sS','-w','\n%{http_code}',url],capture_output=True);raw,_,code=cp.stdout.rpartition(b'\n');(OUT/(fam+'-'+source+'.txt')).write_bytes(raw);r={'family':fam,'source':source,'query':q,'endpoint':url,'fetchedAt':stamp,'status':code.decode(),'exitCode':cp.returncode}
 try:
  if source=='arxiv':
   tree=ET.fromstring(raw);ns={'a':'http://www.w3.org/2005/Atom'};r['entries']=[{'id':x.findtext('a:id',namespaces=ns),'title':' '.join(x.findtext('a:title',namespaces=ns).split()),'published':x.findtext('a:published',namespaces=ns),'summary':' '.join(x.findtext('a:summary',namespaces=ns).split())} for x in tree.findall('a:entry',ns)]
  elif source=='crossref':
   x=json.loads(raw)['message'];r['metadata']={k:x.get(k) for k in ['title','author','DOI','URL','container-title','published','published-online','published-print','link']}
  else:r['response']=json.loads(raw)
 except Exception as e:r['parseError']=str(e)
 print(fam,source,r['status'],len(r.get('entries',[])),flush=True);return r
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:r=list(ex.map(fetch,jobs))
(ROOT/'docs/research-updates/2026-10-18/dynamic-query-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
