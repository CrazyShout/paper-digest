import json,pathlib,hashlib,re,gzip,subprocess,concurrent.futures,datetime,sys
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
root=pathlib.Path.cwd();dist=root/'dist';doc=root/'docs/research-updates/2026-10-18';mode=sys.argv[1] if len(sys.argv)>1 else 'local'
sha=lambda b:hashlib.sha256(b).hexdigest()
class Parse(HTMLParser):
 def __init__(self):super().__init__();self.ids=set();self.links=[];self.imgs=[];self.mathErrors=0
 def handle_starttag(self,t,a):
  d=dict(a)
  if d.get('id'):self.ids.add(d['id'])
  if t=='a' and d.get('href'):self.links.append(d['href'])
  if t=='img':self.imgs.append(d)
  if 'katex-error' in d.get('class',''):self.mathErrors+=1
htmls=sorted(dist.rglob('*.html'));parsed={}
for p in htmls:
 h=Parse();h.feed(p.read_text());parsed[p]=h
errors=[]
for p,h in parsed.items():
 if h.mathErrors:errors.append([str(p.relative_to(dist)),'math-errors',h.mathErrors])
 for href in h.links:
  u=urlsplit(href)
  if u.scheme or u.netloc:continue
  route=unquote(u.path)
  if route.startswith('/paper-digest/'):target=dist/route[len('/paper-digest/'):]
  elif route.startswith('/'):target=dist/route.lstrip('/')
  elif route:target=(p.parent/route).resolve()
  else:target=p
  if target.is_dir():target=target/'index.html'
  if not target.exists():errors.append([str(p.relative_to(dist)),href,'missing target']);continue
  if u.fragment and target in parsed and unquote(u.fragment) not in parsed[target].ids:errors.append([str(p.relative_to(dist)),href,'missing anchor'])
plain=(dist/'assets/notebook-search.json').read_bytes();compressed=(dist/'assets/notebook-search.json.gz').read_bytes();equal=gzip.decompress(compressed)==plain
if not equal:errors.append(['search','gzip mismatch'])
assets=sorted((dist/'assets/papers').glob('*'))+sorted((dist/'_astro').glob('*'))
assets=[p for p in assets if p.is_file()]
items=htmls+assets+[dist/'assets/notebook-search.json',dist/'assets/notebook-search.json.gz',dist/'assets/research-interests.json']
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'htmlPages':len(htmls),'originalFigureFiles':len(list((dist/'assets/papers').glob('*'))),'buildAssets':len([p for p in (dist/'_astro').glob('*') if p.is_file()]),'searchRecords':len(json.loads(plain).get('records',[])) if isinstance(json.loads(plain),dict) else len(json.loads(plain)),'searchGzipMatches':equal,'errors':errors,'resources':[{'path':str(p.relative_to(dist)),'sha256':sha(p.read_bytes())} for p in items]}
if mode=='live':
 base='https://crazyshout.github.io/paper-digest/';tmp=pathlib.Path('/tmp/paper-digest-20261018/live');tmp.mkdir(exist_ok=True)
 def check(p):
  rel=str(p.relative_to(dist));url=base+rel;path=tmp/sha(rel.encode());r=subprocess.run(['curl','-fLsS','--max-time','30',url,'-o',str(path)],capture_output=True)
  if r.returncode:return {'path':rel,'ok':False,'error':r.stderr.decode()[-200:]}
  a=p.read_bytes();b=path.read_bytes();kind='exact-bytes'
  if p.suffix=='.html':
   # Astro island IDs may differ between local and CI build; no content is removed.
   normalize=lambda x:re.sub(rb'(<astro-island\b[^>]*\buid=")[^"]+("[^>]*>)',rb'\1ASTRO_UID\2',x)
   a=normalize(a);b=normalize(b);kind='html-except-astro-island-uid'
  return {'path':rel,'ok':a==b,'comparison':kind,'localSha256':sha(a),'liveSha256':sha(b)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as e:checks=list(e.map(check,items))
 result['checks']=checks;result['passed']=sum(c['ok'] for c in checks);result['failed']=sum(not c['ok'] for c in checks)
 jp=tmp/sha(b'assets/notebook-search.json');gp=tmp/sha(b'assets/notebook-search.json.gz')
 result['liveSearchGzipMatches']=jp.exists() and gp.exists() and gzip.decompress(gp.read_bytes())==jp.read_bytes()
path=doc/('live-verification.json' if mode=='live' else 'build-verification.json')
if mode=='live':path=root/'docs/research-updates/2026-10-18-release/live-verification.json'
path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['checks','resources']},ensure_ascii=False,indent=2));
if result['errors'] or result.get('failed',0) or not equal:sys.exit(1)
