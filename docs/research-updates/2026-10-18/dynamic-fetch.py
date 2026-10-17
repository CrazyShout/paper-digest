import concurrent.futures,datetime,hashlib,html,json,pathlib,re,subprocess,urllib.request
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest')
OUT=pathlib.Path('/tmp/paper-digest-dynamic-20261018/sources')
OUT.mkdir(parents=True,exist_ok=True)
p=json.loads((ROOT/'docs/research-updates/2026-10-18/dynamic-prior.json').read_text())
def fetch(job):
 rid,kind,url=job
 base=OUT/(rid+'-'+kind)
 stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
 cp=subprocess.run(['curl','-L','--max-time','35','--retry','1','--retry-delay','1','-A','PaperDigest literature review (source verification)','-sS','-w','\n%{http_code}\n%{url_effective}',url],capture_output=True)
 data=cp.stdout
 rec={'id':rid,'kind':kind,'url':url,'fetchedAt':stamp,'exitCode':cp.returncode}
 try:
  raw,status,final=data.rsplit(b'\n',2)
  rec.update(status=int(status),finalUrl=final.decode(),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
  (base.with_suffix('.html')).write_bytes(raw)
  text=raw.decode('utf-8','replace');text=re.sub(r'<(script|style)\b.*?</\1>','',text,flags=re.I|re.S);text=re.sub(r'</(?:p|div|h[1-6]|section|tr|li|article)>','\n',text,flags=re.I);text=html.unescape(re.sub('<[^>]+>',' ',text));text='\n'.join(' '.join(x.split()) for x in text.splitlines() if x.strip())
  base.with_suffix('.txt').write_text(text)
  rec['textPath']=str(base.with_suffix('.txt'))
 except Exception as e:rec['error']=str(e)
 if cp.stderr:rec['stderr']=cp.stderr.decode()[:400]
 print(rid,kind,rec.get('status'),rec.get('bytes'),flush=True)
 return rec
jobs=[]
for r in p['references']:
 urls=[r['url']]+[x['url'] for x in r.get('links',[])]
 aid=next((re.search(r'arxiv.org/abs/([^/?]+)',u).group(1) for u in urls if 'arxiv.org/abs/' in u),None)
 if aid:
  jobs += [(r['id'],'abstract','https://arxiv.org/abs/'+aid),(r['id'],'fulltext','https://arxiv.org/html/'+aid)]
 if 'arxiv.org' not in r['url']:jobs.append((r['id'],'formal',r['url']))
 for j,u in enumerate(urls[1:]):
  if 'arxiv.org' not in u:jobs.append((r['id'],'project'+str(j),u))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(fetch,jobs))
(ROOT/'docs/research-updates/2026-10-18/dynamic-fetch-manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
