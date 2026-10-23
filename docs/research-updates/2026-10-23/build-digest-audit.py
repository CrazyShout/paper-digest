"""Build this issue's audit from frozen retrieval and explicit selector reads."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import unicodedata

ROOT = pathlib.Path.cwd()
OUT = ROOT / 'docs/research-updates/2026-10-23'
BASE = 'f1fd1e68c76cc72298aa47d3a950e85f40941c17'
a = json.loads((OUT / 'arxiv-retrieval.json').read_text())
b = json.loads((OUT / 'source-retrieval.json').read_text())
reads = json.loads((OUT / 'selection-reading-ledger.json').read_text())
selected = {
    'arxiv:2610.30979': ('last-v2x-communication-failure-testing', '将通信故障与交通本身的失败分开归因，配对执行和故障约简可用于协同测试；明确112个CARLA场景与简化后端搜索的区别。'),
    'arxiv:2610.26390': ('cartender-counterfactual-language-driving', '同一场景的可行与不可行指令构成关系监督，成对行为评测和门控代价能区分听从指令与盲从指令。'),
    'arxiv:2610.29676': ('drivemlp-expert-guided-closed-loop', '对象级规划对照在固定架构下比较训练目标，闭环轨迹模仿和推理成本有明确实验；保留非反应训练、真值状态及训练成本。'),
    'arxiv:2610.23537': ('panobench-panoptic-occupancy-benchmark', '统一实例、时间可见性与体素/射线评测，实测排名差异有助于检查占据方法到底恢复了哪些结构。'),
    'arxiv:2610.30340': ('foundation4d-unified-perception-reconstruction', '统一多任务表示、标注及重建流程，有同预算任务组合对照和负迁移证据；公开基准微调结果与统一模型分开。'),
    'arxiv:2610.26816': ('streamrps-streaming-radar-panoptic', '针对旋转雷达的流式极坐标结构，包含手工标签校验与切扇区指标反例；将网络吞吐与传感器更新率分开。'),
    'arxiv:2610.26757': ('pia-simulation-prior-racing-adaptation', '仿真先验与少量真实赛车数据的渐进适配，给出真实失败和安全边界；区分目标赛道几何先验与未知几何泛化。'),
    'arxiv:2610.28184': ('perception-action-binding-gap', '用输入干预和固定生成器引导区分危险可读出与动作真正使用危险信息，保留真值几何和自动门控跨域失败。'),
}

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
            'parameters': {'categories': ['cs.RO', 'cs.CV', 'cs.AI', 'cs.LG', 'eess.IV', 'eess.SY'], 'month': '2026-10', 'comparison': '2026-10-18 frozen ID union', 'scope': 'Mechanical title recall among newly announced IDs; no paper-quality judgment'},
            'resultIds': catalog_ids, 'status': 'success'}]
for q in a['queryRuns']:
    page = q['pages'][0]
    queries.append({'family': q['id'], 'sourceFamily': 'arxiv', 'endpoint': page['endpoint'], 'searchQuery': q['query'], 'executedAt': q['executedAt'], 'parameters': page['parameters'], 'resultIds': q['resultIds'], 'status': q['status'], 'sourceArtifact': 'docs/research-updates/2026-10-23/arxiv-retrieval.json', 'scopeRationale': q['scopeRationale']})
for q in b['queries']:
    queries.append({'family': q['id'], 'sourceFamily': q['source'], 'endpoint': q.get('url') or {'web-discovery': 'web.run.search_query', 'openalex': 'https://api.openalex.org/works', 'semantic-scholar': 'https://api.semanticscholar.org/graph/v1/paper/search'}[q['source']], 'searchQuery': q['query'], 'executedAt': q['executedAt'], 'parameters': q.get('parameters') or {'scope': q['scope'], 'commandArguments': q.get('commandArguments')}, 'resultIds': q.get('resultIds', []), 'status': q['status'], 'sourceArtifact': 'docs/research-updates/2026-10-23/source-retrieval.json'})
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
manual = {
    'arxiv:2610.22450': '摘要明确全部性能主张仍待实验验证，尚不满足本期有实验证据的选文要求。',
    'arxiv:2610.23886': '目录本轮新增，但官方提交日期为9月26日；摘要所述反思机制需进一步核对memory与world-model评估控制，本期暂缓，不按编号推定10月新提交。',
    'arxiv:2610.23885': '质量轴候选生成相关；摘要同时报告oracle收益很小，需进一步核对候选预算与排序控制，本期保留为后续候选。',
    'arxiv:2610.22900': '真实越野动力学实验相关；本期系统适配选择PIA，SpatialBEV留待核对地形表征、困难样本挖掘与控制器对照。',
    'arxiv:2610.27310': '旋转雷达对卫星图定位相关，但不直接评价语义场景/占据状态；本期雷达选择StreamRPS。',
    'arxiv:2610.31427': '摘要实验为四个模拟机械臂任务，没有驾驶验证；不作为驾驶agent性能证据。',
    'arxiv:2610.25631': '前景高斯分配的三seed证据具体，但总体mIoU变化仍在seed波动内；本期先覆盖占据评测协议，后续可单独比较前景采样机制。',
    'arxiv:2610.27547': '标定数据捷径与合成外参直接相关，资源仍需核对；本期不以摘要接受其零样本泛化结论。',
    'arxiv:2610.28530': '开放词汇协同占据相关；摘要主要比较单车开放词汇方法，通信和误差对照尚未全文核查，暂缓。',
    'arxiv:2610.27714': '记忆与token匹配控制值得跟进，但当前只读完整摘要；不把单一HighwayEnv结果外推为所有驾驶记忆无效。',
    'arxiv:2610.28696': '跨仿真器执行接口有系统价值，但八模型可运行不等于驾驶表现可迁移；本期留待全文核对。',
    'arxiv:2610.27617': '鲁棒性与资源约束主要针对3D检测；不是未知物体异常分割，摘要未给下游规划效用。',
    'arxiv:2610.30319': '自博弈预训练与视觉适配直接相关；摘要的无演示条件仍需核对成对image-state与预训练数据，留待全文比较。',
    'arxiv:2610.25448': '多模态分支退化的配对冻结探针很有参考价值；本轮仅读摘要，下载全文不算阅读，后续再核对探针容量与训练预算。',
    'arxiv:2610.30953': '文本与动作反事实耦合相关；本期选择含动作侧干预和自动门控跨域失败的BindingGap，当前候选留待全文。',
    'arxiv:2610.29969': 'HIL故障生成相关，但未完整核对硬件注入与仿真代用边界，暂缓。',
    'arxiv:2610.27946': '摘要主要是手物交互视频迁移，无道路驾驶实验，不纳入本期驾驶世界模型报告。',
    'doi:10.1145/3795866.3848478': 'CooperScene相关Demo，Crossref created为10月21日而published-online为10月26日；现有数据集已收录，不能按聚合器日期称本周新发表或新数据集。',
    'doi:10.26599/etsd.2026.9190101': '一手URL虽HTTP200，页面正文为404，尚无可核对全文，不接受为新报告。',
    'doi:10.1007/s10791-026-10684-y': '正式页确认10月21日发表；已读摘要、§5讨论及Data availability，跨域和双模态退化有边界。方法/实验完整对照和作者可索取资源未复核，留待后续专题，不以已有章节阅读代替整篇深读。',
}
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
    if c.get('publicationDate') and c['publicationDate'] < '2026-10-16':
        c['reason'] = '聚合元数据日期早于本期重叠窗口，未核实窗口内版本或资源变化；不将本次检索日期当作发表日期。'
    if c.get('publicationDate') and c['publicationDate'] > '2026-10-23':
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
cov = {'queryOccurrences': sum(len(run['resultIds']) for run in runs), 'uniqueRecords': len(unique), 'runs': runs, 'screenedCandidates': len(catalog_ids), 'screenedOut': len(unique) - len(catalog_ids), 'screeningNote': 'Six continuing categories; broad title recall among IDs absent from the Oct18 union. Screened-out includes old IDs and mechanical nonmatches, not read/rejected papers.'}
counts = {'queryOccurrences': sum(q['resultCount'] for q in queries), 'deduplicatedCandidates': len(records), 'rawQueryOccurrencesBeforeAliasNormalization': raw_occurrences,
          'titleAbstractExcluded': sum(c['disposition'] == 'title-abstract-excluded' for c in records.values()), 'fullTextExcluded': sum(c['disposition'] == 'full-text-excluded' for c in records.values()), 'selected': len(selected),
          'fullTextCompared': sum(c['disposition'] != 'title-abstract-excluded' for c in records.values()), 'completeAbstractsRead': len(abstracts), 'arxivTitleRecordsRead': reads['arxivTitleRecordsRead'], 'sourceScopedTitleRecordsRead': len(scoped_sources), 'entirePaperReadsClaimedBySelector': 0}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
audit = {'digestId': '2026-10-23', 'auditedAt': now,
         'scanWindow': {'previousDigest': '2026-10-18', 'currentDigest': '2026-10-23', 'recentListWindow': 'Official recent announcements 2026-10-19 through 2026-10-23; six October category directories compared with Oct18 snapshot.', 'querySubmittedDateRange': '2026-10-16T00:00:00Z/2026-10-23T23:59:59Z; actual retrieval 2026-10-23 UTC, issue date Asia/Hong_Kong.', 'boundaryNote': 'Issue, retrieval, submission, version update and announcement dates are distinct. Earlier submissions newly appearing in this directory difference remain eligible; future publication metadata is not a completed publication event.'},
         'categoryCoverage': cov, 'queryRuns': queries, 'counts': counts, 'rubric': {'path': 'content/templates/paper-selection-rubric.md', 'policy': 'Eight first reports, primary-topic grouping with cross links; no per-direction quota.', 'independence': 'Two retrieval shards returned unranked records; root read scoped titles, complete abstracts and named primary sections before accepting reports.'},
         'candidates': list(records.values()), 'independentSelection': {'selectorAgentId': '/root', 'retrievalAgents': ['/root/retrieve_arxiv_oct23', '/root/retrieve_sources_oct23'], 'extractionAgent': '/root/extract_primary_oct23', 'completedAt': now, 'inputFingerprints': [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [OUT/'arxiv-retrieval.json', OUT/'source-retrieval.json', OUT/'selection-reading-ledger.json']], 'readDepthNote': 'Raw discovery includes nonpapers, old works and metadata errors. Machine retrieval is not reading. Eight authors subsequently read full method/evidence for authoring; selector claims only named primary sections.'},
         'sourceLimitations': a['limitations'] + b['limitations'], 'versionOrResourceUpdateNotes': json.loads((OUT/'version-updates.json').read_text()),
         'independentReview': {'finalOutcome': 'pending', 'reviewerAgentId': '', 'completedAt': now, 'finalFinding': 'Awaiting independent report/image and integration review.'}}
(ROOT/'content/digest-audits/2026-10-23.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
(OUT/'selection-aliases.json').write_text(json.dumps(merges, ensure_ascii=False, indent=2)+'\n')
(OUT/'selection-summary.json').write_text(json.dumps({'selected': selected, 'counts': counts, 'closedAt': now}, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(counts, indent=2))
print('Identity aliases:', len(merges))
