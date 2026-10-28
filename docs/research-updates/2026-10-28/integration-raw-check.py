"""Review-only replay of raw discovery/metadata responses; no production writes."""
import ast
import datetime
import hashlib
import html
import json
import pathlib
import re
import subprocess
import unicodedata
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit, urlunsplit

ROOT = pathlib.Path.cwd()
DOC = ROOT / 'docs/research-updates/2026-10-28'
load = lambda p: json.loads(pathlib.Path(p).read_text())
hashfile = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
arxiv = load(DOC/'arxiv-retrieval.json')
source = load(DOC/'source-retrieval.json')
audit = load(ROOT/'content/digest-audits/2026-10-28.json')
verified = {}

def verify(p, expected):
    actual = hashfile(p)
    assert actual == expected, (str(p), actual, expected)
    verified[str(p)] = actual
    return pathlib.Path(p).read_bytes()

def clean(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()

catalog = {}
for run in arxiv['catalogCoverage']['catalogRuns']:
    ids = []
    for page in run['pages']:
        raw = verify(page['path'], page['sha256']).decode()
        blocks = re.findall(r'<dt>.*?</dt>\s*<dd>.*?</dd>', raw, re.S)
        parsed = []
        for block in blocks:
            m = re.search(r'href\s*=\s*[\"\']/abs/(\d{4}\.\d{4,5})(?:v\d+)?[\"\']', block)
            if not m: continue
            cid = 'arxiv:' + m.group(1)
            parsed.append(cid)
            if run['catalogKind'] == '2026-10':
                title = re.search(r'<div class=[\"\'][^\"\']*list-title[^\"\']*[\"\']>(.*?)</div>', block, re.S)
                catalog[cid] = re.sub('^Title:\\s*', '', clean(title.group(1)))
        assert len(parsed) == page['parsedEntries']
        total = int(re.search(r'Total of\s+([\d,]+)\s+entries', raw).group(1).replace(',', ''))
        assert total == page['totalReported']
        assert page['skip'] == len(ids)
        ids.extend(parsed)
    assert ids == run['resultIds'] and len(ids) == run['resultCount']
    assert len(ids) == len(set(ids)) == total and run['complete']

prior = arxiv['catalogCoverage']['priorSnapshot']
verify(prior['path'], prior['sha256'])
old = load(prior['path'])
old_ids = {cid for r in old['catalogCoverage']['catalogRuns'] if r['catalogKind']=='2026-10' for cid in r['resultIds']}
month_ids = set(catalog)
new = month_ids-old_ids
pattern = re.compile(arxiv['catalogCoverage']['broadTitlePattern'], re.I)
recall = {cid for cid in new if pattern.search(catalog[cid])}
assert len(month_ids)==14784 and len(month_ids&old_ids)==12641 and len(new)==2143
assert old_ids-month_ids=={'arxiv:2610.19388'}
assert len(recall)==228
assert new-recall=={v['canonicalId'] for v in arxiv['catalogCoverage']['newTitleExcluded']}
assert recall=={v['canonicalId'] for v in arxiv['candidates'] if v['catalogIndex'] is not None}

NS = {'a':'http://www.w3.org/2005/Atom', 'o':'http://a9.com/-/spec/opensearch/1.1/'}
def atom_entries(raw):
    root = ET.fromstring(raw)
    return root, root.findall('a:entry', NS)
def atom_id(e):
    return e.findtext('a:id', '', NS).split('/abs/')[-1]

seed_ids=set()
for run in arxiv['queryRuns']:
    ids=[]
    for page in run['pages']:
        root,entries=atom_entries(verify(page['path'],page['sha256']))
        parsed=['arxiv:'+re.sub(r'v\d+$','',atom_id(e)) for e in entries]
        assert len(parsed)==page['resultCount']
        assert int(root.findtext('o:totalResults','0',NS))==page['providerTotal']
        ids+=parsed
    assert ids==run['resultIds']
    seed_ids.update(ids)
assert recall|seed_ids=={v['canonicalId'] for v in arxiv['candidates']}
for page in arxiv['metadataQueryRuns']:
    _,entries=atom_entries(verify(page['path'],page['sha256']))
    assert ['arxiv:'+re.sub(r'v\d+$','',atom_id(e)) for e in entries]==page['resultIds']
for artifact in arxiv['artifacts']:verify(artifact['path'],artifact['sha256'])

# Read and invoke only the pure canonical-ID helper from the disclosed assembler.
tree=ast.parse((DOC/'assemble-source-retrieval.py').read_text())
function=next(x for x in tree.body if isinstance(x,ast.FunctionDef) and x.name=='canon')
exec(compile(ast.Module(body=[function],type_ignores=[]),str(DOC/'assemble-source-retrieval.py'),'exec'))
source_checks=[]
for q in source['queries']:
    if q['source']=='openalex':
        raw=load(q['rawPath']);verify(q['rawPath'],q['rawSha256'])
        ids=[canon(r.get('doi'),r.get('id','')) for r in raw['results']]
        assert list(dict.fromkeys(ids))==q['resultIds'],q['id']
        assert len(ids)==q['rawResultCount']==50
    elif q['source']=='semantic-scholar':
        assert q['status']=='limited' and '429' in q['error'] and q['resultIds']==[]
        if q.get('rawPath') and q.get('rawSha256'):verify(q['rawPath'],q['rawSha256'])
    else:
        raw=load(q['rawResultArtifact']);verify(q['rawResultArtifact'],q['rawSha256'])
        parsed=[]
        for block in re.split(r'-{15,}',raw['result']):
            m=re.match(r'\s*(.*?) \((https?://[^\n]+)\)\n',block,re.S)
            if not m:continue
            title,url=m.groups();body=block[m.end():];doi=None
            if 'ieeexplore.ieee.org/' in url:
                dm=re.search(r'\bDOI:\s*(10\.\d{4,9}/[^\s]+)',body)
                if dm:doi=dm.group(1).rstrip('.')
            parsed.append({'canonicalId':canon(doi,url),'title':title.strip(),'url':url})
        assert parsed==q['parsedEntries']
        assert list(dict.fromkeys(v['canonicalId'] for v in parsed))==q['resultIds']
    source_checks.append({'id':q['id'],'status':q['status'],'resultCount':q['resultCount']})

versions=load(DOC/'prior-version-scan.json')
verify(versions['priorSnapshot']['path'],versions['priorSnapshot']['sha256'])
prior_versions={e['canonicalId']:e['versionId'] for e in load(versions['priorSnapshot']['path'])['priorVersionScan']['entries']}
base='32aad21bba45b0b4defc46cbb8d59542e1466560'
base_files=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'content/papers'],text=True).splitlines()
base_reports={}
for file in base_files:
    original=subprocess.check_output(['git','show',base+':'+file])
    assert (ROOT/file).read_bytes()==original, file+' prior report changed'
    fm=json.loads(original.decode().split('---',2)[1])
    base_reports[fm['id']]=fm
actual_versions={}
for q in versions['queries']:
    _,entries=atom_entries(verify(q['rawPath'],q['rawSha256']))
    for e in entries:
        vid=atom_id(e);actual_versions['arxiv:'+re.sub(r'v\d+$','',vid)]=vid
assert len(actual_versions)==versions['requestedCount']==182
for e in versions['entries']:
    assert actual_versions[e['canonicalId']]==e['versionId']==e['comparisonBase']
    if e['canonicalId'] in prior_versions:
        assert e['comparisonBase']==prior_versions[e['canonicalId']]
    else:
        aid=e['canonicalId'].split(':',1)[1]
        fixed={v for report in e['reportIds'] for v in re.findall(re.escape(aid)+r'v\d+',base_reports[report]['source'])}
        assert e['comparisonBase'] in fixed
    assert not e['changedSinceComparisonBase']
assert not versions['missingIds']
releases=load(DOC/'tracked-release-checks.json')
successful=0;limited=[];release_events=[];asset_events=[]
for r in releases['records']:
    total=0
    for q in r['pages']:
        raw=json.loads(verify(q['rawPath'],q['rawSha256']))
        if r['status']=='limited':
            assert q['httpStatus']==404;limited.append(r['repo']);continue
        total+=len(raw)
        release_events += [e['id'] for e in raw if e.get('published_at') and e['published_at']>=r['cutoff']]
        asset_events += [a['id'] for e in raw for a in e.get('assets',[]) if a.get('updated_at') and a['updated_at']>=r['cutoff']]
    assert total==r['returnedCount']
    successful+=r['status']=='success'
assert successful==39 and len(limited)==1 and not release_events and not asset_events
for p in source['primaryFetchManifest']:
    if p.get('rawPath'):verify(p['rawPath'],p['sha256'])
crossref=load('/tmp/paper-digest-20261028/sources/cooperscene-crossref.txt')['message']
assert crossref['published-online']['date-parts']==[[2026,10,26]]
program=pathlib.Path('/tmp/paper-digest-20261028/sources/cooperscene-program.txt').read_text()
assert 'CooperScene' in program and '162' in program

result={'reviewerAgentId':'/root/integration_final_oct28','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'PASS','catalog':{'monthlyCategoryOccurrences':sum(r['resultCount'] for r in arxiv['catalogCoverage']['catalogRuns'] if r['catalogKind']=='2026-10'),'monthlyUniqueIds':len(month_ids),'retainedPriorIds':len(month_ids&old_ids),'newIds':len(new),'missingPriorIds':sorted(old_ids-month_ids),'broadTitleRecall':len(recall),'mechanicalNonmatches':len(new-recall),'seedOccurrences':sum(r['resultCount'] for r in arxiv['queryRuns']),'seedUniqueIds':len(seed_ids),'mergedArxivCandidates':len(recall|seed_ids),'allCatalogAndAtomResponsesReparsed':True},'sourceQueries':source_checks,'oldArxivIdentitiesReparsed':len(actual_versions),'versionChanges':0,'releaseEndpoints':len(releases['records']),'releaseSuccess':successful,'releaseLimitedRepositories':limited,'windowReleaseEvents':release_events,'windowAssetEvents':asset_events,'cooperscenePublishedOnline':crossref['published-online']['date-parts'][0],'verifiedRawArtifacts':[{'path':p,'sha256':h} for p,h in sorted(verified.items())]}
(DOC/'integration-raw-check-output.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['verifiedRawArtifacts','sourceQueries']},ensure_ascii=False,indent=2))
print('Raw artifact hashes verified:',len(verified))
