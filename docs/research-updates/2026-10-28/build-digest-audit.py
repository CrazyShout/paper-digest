"""Build this issue's audit from frozen retrieval and explicit selector reads."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import unicodedata

ROOT = pathlib.Path.cwd()
OUT = ROOT / 'docs/research-updates/2026-10-28'
BASE = '32aad21bba45b0b4defc46cbb8d59542e1466560'
a = json.loads((OUT / 'arxiv-retrieval.json').read_text())
b = json.loads((OUT / 'source-retrieval.json').read_text())
reads = json.loads((OUT / 'selection-reading-ledger.json').read_text())
selected = json.loads((OUT / 'selected-papers.json').read_text())

def normid(value):
    value = unicodedata.normalize('NFKC', value).strip().lower()
    value = re.sub(r'^doi:10\.48550/arxiv\.', 'arxiv:', value)
    if value.startswith('arxiv:'):
        value = re.sub(r'v\d+$', '', value)
    resource_aliases = {
        'url:https://waymo.com/intl/zh-cn/open/data/e2e': 'url:https://waymo.com/intl/jp/open/data/e2e',
        'url:https://112.cachefly.net/simom0/lido': 'url:https://github.com/simom0/lido',
        'url:https://112.cachefly.net/simom0/3pnet': 'url:https://github.com/simom0/3pnet',
    }
    value = resource_aliases.get(value, value)
    return value

def normtitle(value):
    value = unicodedata.normalize('NFKC', str(value or '')).lower()
    if value.startswith(('github -', 'under review as', 'anonymous authors')) or len(value) > 500:
        return ''  # Repository listings and malformed abstracts are not paper identities.
    value = re.sub(r'^\[(?:arxiv:)?\d{4}\.\d{4,5}(?:v\d+)?\]\s*', '', value)
    value = re.sub(r'^\(pdf\)\s*', '', value)
    value = re.split(r'\s+(?:\||·|— lacuna|- sciencedirect|- pmc|:: ssrn)', value)[0]
    value = re.sub(r'\s+-\s+rwth publications.*$', '', value)
    return re.sub(r'[^\w]+', '', value)

records, aliases, titlemap, merges = {}, {}, {}, []
for origin, rows in [('arxiv', a['candidates']), ('sources', b['candidates'])]:
    ordered = list(enumerate(rows))
    if origin == 'sources':
        ordered.sort(key=lambda item: 0 if item[1]['canonicalId'].startswith('doi:') else 1 if item[1]['canonicalId'].startswith('arxiv:') else 2)
    for index, row in ordered:
        rawid = row['canonicalId']
        key = normid(rawid)
        primary_ids = row.get('externalIds') or {}
        explicit_arxiv = primary_ids.get('ArXiv') or primary_ids.get('arxiv')
        if explicit_arxiv and re.fullmatch(r'\d{4}\.\d{4,5}(v\d+)?', explicit_arxiv):
            arxiv_key = normid('arxiv:' + explicit_arxiv)
            if arxiv_key in records:
                key = arxiv_key
        title = normtitle(row.get('title'))
        if key not in records and len(title) > 35 and title in titlemap:
            key = titlemap[title]
        if rawid != key:
            reason = ('Same resource at a language-specific or named repository mirror URL; raw discovery row retained.'
                      if '112.cachefly.net/' in rawid or 'waymo.com/intl/zh-cn/open/data/e2e' in rawid
                      else 'Explicit ID/DOI normalization or identical normalized paper title; raw discovery row retained.')
            merges.append({'alias': rawid, 'primary': key, 'reason': reason})
        aliases[rawid] = key
        aliases[normid(rawid)] = key
        if key not in records:
            records[key] = {'canonicalId': key, 'title': row.get('title') or '[来源元数据未提供题名]', 'urls': [], 'queryFamilies': [], 'retrievalRows': []}
        c = records[key]
        c['retrievalRows'].append({'source': origin, 'index': index, 'rawId': rawid})
        urls = row.get('urls') or []
        if row.get('url'): urls.append(row['url'])
        if row.get('primaryUrl'): urls.append(row['primaryUrl'])
        if key.startswith('arxiv:'): urls.append('https://arxiv.org/abs/' + key.split(':')[1])
        c['urls'].extend(urls)
        for field in ['submittedAt', 'updatedAt', 'announcementDates', 'publicationDate']:
            if row.get(field): c[field] = row[field]
        if len(title) > 35: titlemap[title] = key

catalog_ids = [row['canonicalId'] for row in a['candidates'] if row.get('catalogIndex') is not None]
coverage = a['catalogCoverage']
queries = [{'family': 'monthly-catalog-title-recall', 'sourceFamily': 'arxiv', 'endpoint': 'https://arxiv.org/list',
            'searchQuery': coverage['broadTitlePattern'], 'executedAt': coverage['retrievedAt'],
            'parameters': {'categories': ['cs.RO', 'cs.CV', 'cs.AI', 'cs.LG', 'eess.IV', 'eess.SY'], 'month': '2026-10', 'comparison': '2026-10-23 frozen ID union', 'scope': 'Mechanical title recall among newly announced IDs; no paper-quality judgment'},
            'resultIds': catalog_ids, 'status': 'success'}]
for q in a['queryRuns']:
    page = q['pages'][0]
    queries.append({'family': q['id'], 'sourceFamily': 'arxiv', 'endpoint': page['endpoint'], 'searchQuery': q['query'], 'executedAt': q['executedAt'], 'parameters': page['parameters'], 'resultIds': q['resultIds'], 'status': q['status'], 'sourceArtifact': 'docs/research-updates/2026-10-28/arxiv-retrieval.json', 'scopeRationale': q['scopeRationale']})
for q in b['queries']:
    queries.append({'family': q['id'], 'sourceFamily': q['source'], 'endpoint': q.get('url') or {'web-discovery': 'web.run.search_query', 'openalex': 'https://api.openalex.org/works', 'semantic-scholar': 'https://api.semanticscholar.org/graph/v1/paper/search'}[q['source']], 'searchQuery': q['query'], 'executedAt': q['executedAt'], 'parameters': q.get('parameters') or {'scope': q['scope'], 'commandArguments': q.get('commandArguments')}, 'resultIds': q.get('resultIds', []), 'status': q['status'], 'sourceArtifact': 'docs/research-updates/2026-10-28/source-retrieval.json'})
    if isinstance(q['query'], list):
        queries[-1]['searchQuery'] = '\n'.join(q['query'])
        queries[-1]['parameters']['queryExpressions'] = q['query']
raw_occurrences = sum(len(q['resultIds']) for q in queries)
for q in queries:
    q['rawResultIds'] = q['resultIds']
    q['resultIds'] = list(dict.fromkeys(aliases.get(z, normid(z)) for z in q['resultIds']))
    q['resultCount'] = len(q['resultIds'])
    for key in q['resultIds']:
        assert key in records, (q['family'], key)
        records[key]['queryFamilies'].append(q['family'])

existing, existing_titles = {}, {}
files = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE, 'content/papers'], text=True).splitlines()
for file in files:
    raw = subprocess.check_output(['git', 'show', BASE + ':' + file], text=True)
    fm = json.loads(raw.split('---', 2)[1])
    identity = fm.get('revisionOf', fm['id'])
    existing_titles[normtitle(fm['title'])] = identity
    for aid in re.findall(r'(?:arxiv\.org/(?:abs|pdf|html)/|arXiv:\s*)(\d{4}\.\d{4,5})', fm['source'], re.I):
        existing['arxiv:' + aid] = identity

scoped_sources = set(reads['scopedSourceTitleRecordIndices'])
abstracts = {aliases.get(key, normid(key)) for key in reads['completeAbstractsRead']}
sections = {aliases.get(key, normid(key)): val for key, val in reads['primarySectionsRead'].items()}
manual = json.loads((OUT / 'selection-reasons.json').read_text())

for key, c in records.items():
    c['queryFamilies'] = sorted(set(c['queryFamilies']))
    c['urls'] = list(dict.fromkeys(c['urls']))
    assert c['queryFamilies'], key
    title_read = any(v['source'] == 'arxiv' or v['index'] in scoped_sources for v in c['retrievalRows'])
    c['readingDepth'] = 'title+abstract' if key in abstracts else ('title' if title_read else 'metadata-scope-only')
    c['disposition'] = 'title-abstract-excluded'
    c['selectionDetail'] = 'deferred-primary-verification' if key in abstracts else 'scope-or-metadata-deferred'
    c['reason'] = ('题名/日期规则未进入本轮人工选文池；原始返回保留，没有作论文质量评价。' if not title_read else '题名范围或发布事件尚未形成足够直接的本期驾驶研究证据；未进入全文比较，保留线索。')
    if key in abstracts:
        c['reason'] = '已读完整摘要，尚待全文机制、实验条件与资源核验；本期选择形成互补对照的八篇，保留此候选。'
    if c.get('publicationDate') and c['publicationDate'] < '2026-10-21':
        c['reason'] = '聚合元数据日期早于本期重叠窗口，未核实窗口内版本或资源变化；不将本次检索日期当作发表日期。'
    if c.get('publicationDate') and c['publicationDate'] > '2026-10-28':
        c['reason'] = '聚合元数据为未来日期，未核实截至本轮已正式发表，暂缓。'
    if key in existing or normtitle(c['title']) in existing_titles:
        c['selectionDetail'] = 'duplicate-existing'
        c['existingPaperId'] = existing.get(key, existing_titles.get(normtitle(c['title'])))
        c['reason'] = '已收录身份；版本与资源变化另列，不重复计作首次报告。'
    if key in manual: c['reason'] = manual[key]
    if key in sections:
        c['primarySectionsRead'] = sections[key]
        c['readingDepth'] = 'title+abstract+named-primary-sections'
        c['disposition'] = 'full-text-excluded'
    if key in selected:
        slug, reason = selected[key]
        c.update(paperId=slug, disposition='selected', selectionDetail='selected-first-report', reason=reason)

runs = []
for run in coverage['catalogRuns']:
    if run['catalogKind'] == '2026-10':
        runs.append({'category': run['category'], 'searchQuery': run['pages'][0]['url'], 'resultCount': len(run['resultIds']), 'resultIds': run['resultIds'], 'pages': run['pages'], 'complete': run['complete']})
unique = set(z for run in runs for z in run['resultIds'])
cov = {'queryOccurrences': sum(len(run['resultIds']) for run in runs), 'uniqueRecords': len(unique), 'runs': runs, 'screenedCandidates': len(catalog_ids), 'screenedOut': len(unique) - len(catalog_ids), 'screeningNote': 'Six continuing categories; broad title recall among IDs absent from the Oct23 union. Screened-out includes old IDs and mechanical nonmatches, not read/rejected papers.'}
counts = {'queryOccurrences': sum(q['resultCount'] for q in queries), 'deduplicatedCandidates': len(records), 'rawQueryOccurrencesBeforeAliasNormalization': raw_occurrences,
          'titleAbstractExcluded': sum(c['disposition'] == 'title-abstract-excluded' for c in records.values()), 'fullTextExcluded': sum(c['disposition'] == 'full-text-excluded' for c in records.values()), 'selected': len(selected),
          'fullTextCompared': sum(c['disposition'] != 'title-abstract-excluded' for c in records.values()), 'completeAbstractsRead': len(abstracts), 'arxivTitleRecordsRead': reads['arxivTitleRecordsRead'], 'sourceScopedTitleRecordsRead': len(scoped_sources), 'entirePaperReadsClaimedBySelector': 0}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
audit = {'digestId': '2026-10-28', 'auditedAt': now,
         'scanWindow': {'previousDigest': '2026-10-23', 'currentDigest': '2026-10-28', 'recentListWindow': 'Official recent announcements 2026-10-24 through 2026-10-28; six October category directories compared with Oct23 snapshot.', 'querySubmittedDateRange': '2026-10-21T00:00:00Z/2026-10-28T23:59:59Z; actual retrieval 2026-10-28 UTC, issue date Asia/Hong_Kong.', 'boundaryNote': 'Issue, retrieval, submission, version update and announcement dates are distinct. Earlier submissions newly appearing in this directory difference remain eligible; future publication metadata is not a completed publication event.'},
         'categoryCoverage': cov, 'queryRuns': queries, 'counts': counts, 'rubric': {'path': 'content/templates/paper-selection-rubric.md', 'policy': 'Eight first reports, primary-topic grouping with cross links; no per-direction quota.', 'independence': 'Two discovery shards returned unranked records; a third shard checked historical versions/resources; root read scoped titles, complete abstracts and named primary sections before accepting reports.'},
         'candidates': list(records.values()), 'independentSelection': {'selectorAgentId': '/root', 'retrievalAgents': ['/root/retrieve_catalog_oct28', '/root/retrieve_sources_oct28'], 'completedAt': now, 'inputFingerprints': [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [OUT/'arxiv-retrieval.json', OUT/'source-retrieval.json', OUT/'selection-reading-ledger.json']], 'readDepthNote': 'Raw discovery includes nonpapers, old works and metadata errors. Machine retrieval is not reading. Report authors subsequently read full method/evidence for authoring; selector claims only named primary sections.'},
         'sourceLimitations': a['limitations'] + b['limitations'], 'versionOrResourceUpdateNotes': b['existingPaperUpdates'] + json.loads((OUT/'version-updates.json').read_text()), 'historicalUpdateScan': {'artifactPath': 'docs/research-updates/2026-10-28/additional-resource-events.json', 'arxivIdentitiesChecked': 182, 'versionChanges': 0, 'releaseEndpointsChecked': 40, 'releaseEndpointsSucceeded': 39, 'windowReleaseOrAssetEvents': 0},
         'independentReview': {'finalOutcome': 'pending', 'reviewerAgentId': '', 'completedAt': now, 'finalFinding': 'Awaiting independent report/image and integration review.'}}
(ROOT/'content/digest-audits/2026-10-28.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
(OUT/'selection-aliases.json').write_text(json.dumps(merges, ensure_ascii=False, indent=2)+'\n')
(OUT/'selection-summary.json').write_text(json.dumps({'selected': selected, 'counts': counts, 'closedAt': now}, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(counts, indent=2))
print('Identity aliases:', len(merges))
