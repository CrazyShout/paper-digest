# -*- coding: utf-8 -*-
import json,pathlib,re,hashlib,datetime
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest');DOC=ROOT/'docs/research-updates/2026-10-18';SOURCES=pathlib.Path('/tmp/paper-digest-dynamic-20261018/sources')
r=json.loads((ROOT/'content/reviews/dynamic-scene-representation.json').read_text());old=json.loads((DOC/'dynamic-prior.json').read_text());oldby={x['id']:x for x in old['references']};manifest=json.loads((DOC/'dynamic-fetch-manifest.json').read_text());queries=json.loads((DOC/'dynamic-query-results.json').read_text());crossref={x['family']:x for x in queries if x['source']=='crossref'}
basis={
'cascadeocc-2026':'Abstract; Methods cascaded VQ/TimeMixer; experiment setup and Tables I–II on Occ3D/nuScenes.',
'geoup-2026':'Sections 3.1–3.3, 4.3 planning backbone comparison and Section 5 limitations; same decoder/training configuration does not establish frozen weights.',
'sparseworld-2026':'Abstract and methods sparse instances; experiment setup and planning metrics; official project heading confirms IROS 2026 acceptance.',
'usr-drive-2026':'Abstract; joint denoising method; conclusion/limitations and appendix efficiency: offline clip processing and no explicit long-term identity.',
'caad-2026':'Appendix datasets/metrics, NAVSIM non-reactive actor trajectories, Bench2Drive mini split and open-loop nuScenes comparison.',
'vadv2-2026':'Probabilistic planning vocabulary method; CARLA/NAVSIM/3DGS evaluations; OpenReview formal destination. Public-road deployment is not inferred from demonstrations.',
'geowam-2026':'v3 abstract; geometry pretraining and zero-shot nuScenes Tables 4–5; trajectory metrics and geometry pretraining data scale.',
'geoworldad-2026':'Present versus future geometry ablation Table 3; NAVSIMv1/v2 protocol; no reactive actor counterfactual ground truth in these tests.',
'rbft-net-2026':'Abstract and rectify-before-fuse method; datasets and experiment endpoint are depth completion, not occupancy forecasting.',
'monoscene-2022':'Single-image SSC method; SemanticKITTI in/out-FOV supplementary comparison and domain/camera-gap discussion.',
'tpvformer-2023':'Three-plane representation and sparse supervision description; nuScenes LiDAR segmentation and SemanticKITTI completion protocols.',
'scene-as-occupancy-2023':'Abstract; planning uses rasterized occupancy; supplementary Table 13 explicitly reports unsuccessful occupancy-feature pretraining transfer. CVF formal author order retained.',
'proxy-4d-occupancy-2023':'Factorization of sensor intrinsics/extrinsics; foreground/background evaluation and 1 s versus 3 s ray-tracing comparisons.',
'occworld-2024':'Spatial-temporal occupancy tokenizer; Section 4 separates O/D/T/S input settings; planning discussion records collision and long-horizon limits.',
'occupancy-survey-2025':'Method taxonomy by modalities/fusion/supervision; robustness, long-term forecasting and self-supervised generalization discussion. Publisher volume year remains 2025.',
'uniscene-2025':'Occupancy-to-video/LiDAR generation and downstream task metrics; distribution/quality scores do not measure probabilistic occupancy calibration.',
'gaussianworld-2025':'Conditioning on the current image; three evolution factors; nuScenes setup and temporal-model latency/memory comparison.',
'i2world-2025':'Intra/inter tokenization; forecasting/Waymo transfer protocols; controllability failure case under unseen reversing transformation.',
'fsf-net-2026':'BEV flow/VQ-Mamba/UQF mechanisms; limitations explicitly identify weak ego trajectory prediction and unavailable accurate future BEV flow.',
'drive-occworld-2025':'Semantic/motion conditional normalization; action conditioning and occupancy-based planning; nuScenes/nuScenes-Occupancy/Lyft experimental protocols.',
'cam4docc-2024':'Benchmark occupancy and backward centripetal flow definitions; time-horizon comparison; predicted instance association protocol and dataset-dependent outcomes.',
'occsora-2026':'4D tokenizer and trajectory-conditioned diffusion; nuScenes training setup; conclusion keeps closed-loop research as future work.',
'lmpocc-2026':'Current-Prior Fusion, visibility-masked map logit replacement, static-category gains and multi-vehicle map visualization; ICRA acceptance at official project.',
'panoocc-2024':'Panoptic voxel representation and temporal fusion; nuScenes/Occ3D evaluation and ablations do not establish persistent identity after long occlusion.',
'carlaocc-2026':'Dataset/ADMesh and instance-level mesh labels; >100K frames and 0.05 m confirmed in abstract/formal page; sim-to-real fine-tuning distinguished from real sensor ground truth.',
'beyondsight-2026':'Existence versus observability; nuScenes-Permanence label/evaluation construction; appendix explicitly states drift after >6 s and abrupt hidden-motion changes.',
'unsdrive-2026':'Unknown-aware occupancy, MineLoop, closed-loop ablations and conclusion explicitly state all experiments were in simulation.',
'mr-occ-2024':'HVFR/MOD/PVF-Net and occluded class; nuScenes-Occupancy/SemanticKITTI endpoints; temporal integration remains future work.',
'adaocc-2024':'ROI point reconstruction and occupancy; close-range evaluation and CONet cost/benefit limitation at fine grid resolution.',
'octreeocc-2023':'Octree queries, semantic initialization and iterative rectification; query-ratio ablation; NeurIPS 2024 official proceedings supplies DOI/year/status.',
'radar-occupancy-prediction-2022':'Radar/LiDAR visibility discrepancy; polar sliding-window training/inference and Oxford/self-collected experiments; 2D occupancy endpoint.',
'deep-radar-ism-2023':'Polar single-frame inverse sensor model and Doppler dynamic-grid construction; real-world highway comparison, same-type sensor mounting transfer.',
'gaussianformer2-2025':'Probabilistic multiplication/Gaussian mixture semantics; Section 4.4 says FPS initialization increases latency despite fewer Gaussians.',
'guide-2026':'Gaussian-to-voxel instance occupancy plus detection/tracking; nuScenes evaluation and memory comparison; AAAI official page.',
'roadocc-2026':'v2 Sections 3.5/4.2 and Tables 5–6; same-class rather than instance routing target; three-seed matched-budget control.',
'selectoccflow-2026':'SGS/SCTA/ESA method; OpenOcc occupancy/scene-flow and nuScenes-C evaluation; conclusion leaves downstream planning as future work.'}
rows=[]
for ref in r['references']:
 rid=ref['id'];sources=[x for x in manifest if x['id']==rid];t=(SOURCES/(rid+'-abstract.txt')).read_text();f=(SOURCES/(rid+'-fulltext.txt')).read_text();version=re.search(r'arXiv:(\d{4}\.\d{4,5}v\d+)',f);meta={'title':re.search(r'Title: (.*)\n',t).group(1),'authors':re.search(r'Authors: (.*)\n',t).group(1)}
 before=oldby.get(rid);changed={k:{'before':before.get(k),'after':v}for k,v in ref.items() if before and before.get(k)!=v}
 rows.append({'id':rid,'canonicalId':ref['canonicalId'],'recheckedAt':'2026-10-18','readingDepth':'abstract and targeted primary full-text method, experiment, limitation passages','primaryVersion':version.group(1)if version else None,'bibliographyCheck':{'titleAuthors':'Compared arXiv and available formal/publisher metadata; Scene as Occupancy follows formal CVF author ordering.','publicationStatus':ref['publicationStatus'],'venue':ref['venue'],'year':ref['year'],'crossrefMetadataAvailable':rid in crossref},'checkedPassages':basis[rid],'supportAssessment':ref['supports'],'limitationsChecked':ref['limitation'],'changes':changed,'retrievals':sources})
checks=[{'code':x,'authorCheck':'completed; final semantic acceptance awaits an independent reviewer'}for x in r['searchAudit']['qualityChecksApplied']]
record={'date':'2026-10-18','authorAgent':'/root/refresh_dynamic_review_oct18','role':'author/source verification, not independent final review','assurance':'same-family provisional','priorSnapshot':'docs/research-updates/2026-10-18/dynamic-prior.json','priorSha256':hashlib.sha256((DOC/'dynamic-prior.json').read_bytes()).hexdigest(),'existingReferencesReopened':34,'newCoreReferencesReopened':2,'readingBoundary':'Each source was reopened and cited method/experimental claims checked. This does not mean all papers were read sentence-by-sentence, or training/inference reproduced.','selectionBoundary':'Parent selected inclusion of RoadOcc and SelectOccFlow separately from retrieval; new issue reports remain local-corpus candidates until full author/reviewer checks.','evidenceStorage':'Raw source HTML/text held in /tmp/paper-digest-dynamic-20261018/sources; durable manifest retains URL/status/timestamp/sha256.','rows':rows,'authorChecklist':checks,'pending':['Independent reviewer must read this record, current review and relevant primary passages, then bind current fingerprint.','After new issue reports are written, rerun dynamic-audit.py to refresh local-corpus candidates and invalidate/review final snapshot.']}
(DOC/'dynamic-verification.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
(DOC/'dynamic-fact-corrections.json').write_text(json.dumps({'date':'2026-10-18','corrections':[{'id':'sparseworld-2026','before':'ECCV 2026 accepted','after':'IROS 2026 accepted','url':'https://wryzju.github.io/SparseWorld/','basis':'Official author project heading.'},{'id':'octreeocc-2023','before':'2023 arXiv preprint','after':'NeurIPS 2024 peer-reviewed; DOI 10.52202/079017-2528','url':'https://papers.nips.cc/paper_files/paper/2024/hash/9149fc44c95ce58e3ca529a1e34c2691-Abstract-Conference.html','basis':'Official proceedings title, author list, conference/year and DOI.'}], 'retainedDiscrepancy':[{'id':'scene-as-occupancy-2023','note':'arXiv lists Chonghao Sima first, CVF/DOI formal metadata lists Wenwen Tong first. Formal order is already stored and remains unchanged.'}]},ensure_ascii=False,indent=2)+'\n')
print('Verification ledger rows',len(rows))
