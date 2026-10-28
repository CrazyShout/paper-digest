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
OUT=pathlib.Path('/tmp/paper-digest-20261028/sources'); OUT.mkdir(parents=True,exist_ok=True)
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

if __name__=="__main__":
 academic()
