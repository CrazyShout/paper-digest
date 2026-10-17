import pathlib,json,urllib.parse,concurrent.futures
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest')
s=(ROOT/'docs/research-updates/2026-10-18/dynamic-query.py').read_text();exec(s[:s.index('qs=')]);exec(s[s.index('def fetch(j):'):s.index('with concurrent.futures.ThreadPoolExecutor')])
qs=[('unified','all:"occupancy" AND (all:"Gaussian" OR all:"vectorized" OR all:"unified") AND (all:"autonomous driving" OR all:"driving scene")'),('visibility','all:"occupancy" AND (all:"unknown" OR all:"visibility" OR all:"occlusion") AND (all:"autonomous driving" OR all:"driving scene")'),('identity','all:"occupancy" AND (all:"mapping" OR all:"panoptic" OR all:"permanence") AND (all:"autonomous driving" OR all:"driving scene")'),('utility','all:"occupancy" AND (all:"planning" OR all:"calibration" OR all:"uncertainty") AND (all:"autonomous driving" OR all:"driving scene")')]
jobs=[(fam+'-refined','arxiv',q,'https://export.arxiv.org/api/query?'+urllib.parse.urlencode({'search_query':q,'sortBy':'submittedDate','sortOrder':'descending','start':0,'max_results':20})) for fam,q in qs]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:r=list(ex.map(fetch,jobs))
p=ROOT/'docs/research-updates/2026-10-18/dynamic-query-results.json';old=json.loads(p.read_text());p.write_text(json.dumps(old+r,ensure_ascii=False,indent=2)+'\n')
