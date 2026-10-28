"""Assemble observed source hits; no quality ranking or selection is performed."""
import datetime, hashlib, html, json, pathlib, re, unicodedata
from urllib.parse import urlsplit, urlunsplit

ROOT = pathlib.Path.cwd()
DOC = ROOT / 'docs/research-updates/2026-10-28'
CACHE = pathlib.Path('/tmp/paper-digest-20261028/sources')
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()

def canon(doi=None, url='', external=None):
    external = external or {}
    aid = external.get('ArXiv') or external.get('arxiv')
    if aid:
        return 'arxiv:' + re.sub(r'v\d+$', '', aid)
    if doi:
        doi = re.sub(r'^https?://(?:dx\.)?doi.org/', '', doi).strip().lower()
        if doi.startswith('10.48550/arxiv.'):
            return 'arxiv:' + re.sub(r'v\d+$', '', doi.split('arxiv.', 1)[1])
        return 'doi:' + doi
    aid = re.search(r'/(?:abs|html|pdf)/(\d{4}\.\d{4,5})(?:v\d+)?', url)
    if aid: return 'arxiv:' + aid.group(1)
    doi = re.search(r'/(?:article/|doi/(?:abs/|full/|pdf/)?)?(10\.\d{4,9}/[^?#]+)', url)
    if doi: return canon(doi.group(1).rstrip('/'))
    nature = re.search(r'nature.com/articles/([^?#/]+)', url)
    if nature: return 'doi:10.1038/' + nature.group(1).lower()
    u = urlsplit(url)
    return 'url:' + urlunsplit((u.scheme, u.netloc.lower(), u.path.rstrip('/'), u.query, ''))

def primary(cid, url):
    if cid.startswith('arxiv:'): return 'https://arxiv.org/abs/' + cid[6:]
    if cid.startswith('doi:'): return 'https://doi.org/' + cid[4:]
    return url

existing = {}
existing_titles = {}
norm_title = lambda s: re.sub(r'[^\w]+', '', unicodedata.normalize('NFKC', re.split(r'\s+\|\s+', s)[0]).lower())
for p in (ROOT / 'content/papers').glob('*.md'):
    fm = json.loads(p.read_text().split('---', 2)[1]); identity = fm.get('revisionOf', fm['id'])
    if len(norm_title(fm['title'])) > 35: existing_titles.setdefault(norm_title(fm['title']), []).append(identity)
    for aid in re.findall(r'(?:arxiv\.org/(?:abs|html|pdf)/|arXiv:\s*)(\d{4}\.\d{4,5})', fm['source'], re.I):
        existing.setdefault('arxiv:' + aid, []).append(identity)
    for doi in re.findall(r'(?:doi.org/|DOI:\s*)(10\.\d{4,9}/[^\s)]+)', fm['source'], re.I):
        existing.setdefault(canon(doi), []).append(identity)

records, queries = {}, []
def add(row, qid):
    key = row['canonicalId']
    if key not in records:
        records[key] = {**row, 'queryIds': [], 'occurrences': [], 'readingDepth': 'metadata-only', 'qualityAssessed': False}
    record = records[key]
    record['queryIds'].append(qid)
    record['occurrences'].append({'queryId': qid, 'title': row['title'], 'url': row.get('url'), 'externalIds': row.get('externalIds', {})})
    matched = existing.get(key, []) + existing_titles.get(norm_title(row['title']), [])
    if matched: record['existingReportIds'] = sorted(set(matched))
    for field in ['abstract', 'publicationDate', 'authors', 'venue']:
        if not record.get(field) and row.get(field): record[field] = row[field]
    return key

academic = json.loads((CACHE / 'academic-results.json').read_text())
for q in academic:
    ids = []
    for r in q.get('results', []):
        ex = r.get('externalIds') or {}; doi = r.get('doi') or ex.get('DOI'); url = r.get('url', '')
        key = canon(doi, url, ex)
        row = {'canonicalId': key, 'title': r.get('title', ''), 'abstract': r.get('abstract'), 'publicationDate': r.get('publication_date') or r.get('publicationDate'), 'authors': r.get('authors'), 'venue': r.get('venue'), 'doi': doi, 'url': url, 'primaryUrl': primary(key, url), 'source': q['source'], 'externalIds': ex, 'type': r.get('type')}
        ids.append(add(row, q['id']))
    query = {k: v for k, v in q.items() if k != 'results'}
    query.update(resultIds=list(dict.fromkeys(ids)), resultCount=len(set(ids)), rawResultCount=len(ids))
    if q['status'] != 'success': query['resultCountMeaning'] = 'No usable returned records; failed query is not a zero-hit search.'
    queries.append(query)

for p in sorted(DOC.glob('web-sources-batch*.json')):
    q = json.loads(p.read_text()); ids = []; raw = q['result']; raw_entries = []
    for block in re.split(r'-{15,}', raw):
        m = re.match(r'\s*(.*?) \((https?://[^\n]+)\)\n', block, re.S)
        if not m: continue
        title, url = m.groups(); title = title.strip(); body = block[m.end():]
        doi = None
        # A DOI explicitly in a single publisher result is a record identity;
        # never take arbitrary DOI strings from a search/index page.
        if 'ieeexplore.ieee.org/' in url:
            dm = re.search(r'\bDOI:\s*(10\.\d{4,9}/[^\s]+)', body)
            if dm: doi = dm.group(1).rstrip('.')
        key = canon(doi, url)
        date = None
        dm = re.search(r'\bDate:\s*\w{3}\s+(\w{3})\s+(\d{1,2})\s+[\d:]+\s+(\d{4})', body)
        if dm:
            date = datetime.datetime.strptime(' '.join(dm.groups()), '%b %d %Y').date().isoformat()
        else:
            dm = re.search(r'(?:Published:|Date of Publication:)\s*(\d{1,2}\s+\w+\s+\d{4})', body)
            if dm:
                try: date = datetime.datetime.strptime(dm.group(1), '%d %B %Y').date().isoformat()
                except ValueError: pass
        row = {'canonicalId': key, 'title': title, 'url': url, 'primaryUrl': primary(key, url), 'source': 'web-discovery', 'publicationDate': date, 'dateMeaning': 'Extracted explicit publication/submission date from returned result, not crawl time; needs primary verification.', 'discoveryExcerpt': body[:1600], 'sourceResultArtifact': str(p.relative_to(ROOT))}
        ids.append(add(row, q['id'])); raw_entries.append({'canonicalId': key, 'title': title, 'url': url})
    directions = q.get('directionIds') or ['cooperative-autonomous-driving', 'agentic-driving']
    queries.append({'id': q['id'], 'source': 'web-discovery', 'query': [x['q'] for x in q['query']], 'directionIds': directions, 'executedAt': q['executedAt'], 'parameters': {'search_query': q['query'], 'response_length': 'long'}, 'endpoint': 'web.run.search_query', 'scope': 'Bounded discovery; requested date/domain filters do not guarantee result publication dates or relevance. Search/index pages are retained as resource records, not treated as individual papers.', 'resultIds': list(dict.fromkeys(ids)), 'resultCount': len(set(ids)), 'rawResultCount': len(ids), 'status': 'success', 'rawResultArtifact': str(p.relative_to(ROOT)), 'rawSha256': sha(p), 'parsedEntries': raw_entries})

for r in records.values(): r['queryIds'] = sorted(set(r['queryIds']))
manifest = json.loads((CACHE / 'primary-manifest.json').read_text())
evidence_path = DOC / 'source-primary-evidence.json'
evidence = json.loads(evidence_path.read_text()) if evidence_path.exists() else {'primaryReads': [], 'existingPaperUpdates': [], 'evidence': []}
result = {'shardId': 'source-fanout-oct28', 'issueDate': '2026-10-28', 'completedAt': now(), 'role': 'retrieval only; no ranking, selection or acceptance', 'window': {'primary': '2026-10-24 through 2026-10-28', 'overlap': '2026-10-21', 'timezone': 'UTC execution; issue date Asia/Hong_Kong', 'note': 'Academic retrieval uses bounded date-descending 2026 results; explicit primary dates must be independently checked before selection.'}, 'queries': queries, 'queryCounts': {'queryRuns': len(queries), 'individualQueryExpressions': sum(len(q['query']) if isinstance(q['query'], list) else 1 for q in queries), 'rawOccurrences': sum(q['rawResultCount'] for q in queries), 'normalizedQueryOccurrences': sum(q['resultCount'] for q in queries), 'canonicalRecords': len(records), 'openAlexQueries': 10, 'openAlexRawResults': sum(q['rawResultCount'] for q in queries if q['source']=='openalex'), 'semanticScholarQueries': 10, 'semanticScholarSuccessQueries': sum(q['source']=='semantic-scholar' and q['status']=='success' for q in queries), 'semanticScholarRawResults': sum(q['rawResultCount'] for q in queries if q['source']=='semantic-scholar'), 'semanticScholarRateLimitedQueries': sum(q['source']=='semantic-scholar' and '429' in q.get('error','') for q in queries)}, 'candidates': list(records.values()), 'primaryFetchManifest': manifest, **evidence, 'limitations': ['OpenAlex ten queries each returned first 50 date-descending records for publication year 2026. Broad words match unrelated fields, and source metadata may be wrong; this is not an exhaustive relevant-paper count.', 'Semantic Scholar all ten searches returned HTTP 429 after existing helper retries; no zero-progress or zero-hit conclusion is justified.', 'Web date/domain filters returned older papers, author-index pages and nonpapers. Crawl/compiled dates are not publication dates. Raw results and explicit metadata retained.', 'ACM CooperScene DOI page was unavailable (HTTP 403; web open also failed). Crossref deposited metadata and official MobiCom accepted-demo schedule provide bounded publication/program evidence.', 'Downloaded/parsing metadata and primary pages are not whole-paper reading. Parent selector independently screens source evidence; no quality ranking or acceptance by this retrieval shard.'], 'selectionBoundary': 'Mechanical canonical-ID dedup only. Source alias/title differences remain visible in occurrence rows. Primary-reading scope is declared separately; candidates default to metadata-only.'}
(DOC / 'source-retrieval.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['queryCounts'],ensure_ascii=False))
