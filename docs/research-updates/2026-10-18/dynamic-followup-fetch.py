import pathlib,concurrent.futures,json
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest')
exec((ROOT/'docs/research-updates/2026-10-18/dynamic-fetch.py').read_text().split('jobs=[]')[0])
urls=[('scene-as-occupancy-2023','cvf','https://openaccess.thecvf.com/content/ICCV2023/html/Tong_Scene_as_Occupancy_ICCV_2023_paper.html'),('octreeocc-2023','neurips','https://papers.nips.cc/paper_files/paper/2024/hash/9149fc44c95ce58e3ca529a1e34c2691-Abstract-Conference.html'),('sparseworld-2026','project-new','https://wryzju.github.io/SparseWorld/'),('beyondsight-2026','project-new','https://beyondsight-eccv.github.io/'),('lmpocc-2026','project-new','https://ss-yuan.github.io/LMPOcc/')]
for rid,aid in [('roadocc-2026','2609.27677'),('selectoccflow-2026','2610.04356')]:
 urls.extend([(rid,'abstract','https://arxiv.org/abs/'+aid),(rid,'fulltext','https://arxiv.org/html/'+aid)])
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:r=list(ex.map(fetch,urls))
p=ROOT/'docs/research-updates/2026-10-18/dynamic-fetch-manifest.json';old=json.loads(p.read_text());p.write_text(json.dumps(old+r,ensure_ascii=False,indent=2)+'\n')
