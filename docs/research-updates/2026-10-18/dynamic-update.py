# -*- coding: utf-8 -*-
import json,pathlib,collections,subprocess,re,hashlib
ROOT=pathlib.Path('/Users/atlas/work/repo/paper-digest');P=ROOT/'content/reviews/dynamic-scene-representation.json';r=json.loads((ROOT/'docs/research-updates/2026-10-18/dynamic-prior.json').read_text());refs={x['id']:x for x in r['references']}
updates={
'geoup-2026':{'supports':'共享几何 latent 联合 metric depth、三维检测和 occupancy；在相同规划 decoder 架构与训练配置下替换视觉 backbone，检验几何预训练对 NAVSIMv2 规划的作用。','limitation':'规划 decoder 配置相同不等于权重冻结；任务头仍各自独立，视觉几何骨干计算较重。BMVC 2026 录用由 arXiv 确认，正式论文页尚未查到。'},
'sparseworld-2026':{'venue':'IROS 2026','publicationStatus':'accepted','supports':'以对象与地图实例的稀疏 latent 预测未来布局，报告 nuScenes 开环和 Bench2Drive 反应式闭环规划结果。','limitation':'预测对象与地图布局，不输出完整稠密 occupancy；规划增益仍与未来辅助任务和策略联合训练耦合。官方项目确认 IROS 2026 录用，正式出版页尚未查到。','links':[{'label':'项目页','url':'https://wryzju.github.io/SparseWorld/'}]},
'usr-drive-2026':{'limitation':'论文明确定位为离线估计，迭代去噪带来显著延迟；局部 Gaussian/框 token 尚无紧凑全局状态、长期实例身份或显式 free/unknown。'},
'caad-2026':{'limitation':'Bench2Drive 是反应式闭环，NAVSIM 是背景车辆跟随日志的非反应评测。补充 nuScenes 实验的 L2 降低但碰撞率略升；联合潜变量并未建立严格因果识别。'},
'geowam-2026':{'supports':'v3 以未来点几何预训练连接 ego 轨迹，报告 NAVSIMv2 与零样本 nuScenes 规划，几何状态是世界动作模型的中间接口。','limitation':'NAVSIMv2 和 nuScenes 日志评测不能验证其它参与者对替代动作的真实响应；跨规划器迁移和概率校准没有独立检验。'},
'geoworldad-2026':{'limitation':'当前几何与未来 token 在 NAVSIMv1/v2 非反应协议中联合规划；未独立评估长期身份、unknown 校准或反事实参与者响应。'},
'scene-as-occupancy-2023':{'limitation':'把占据结果交给规划器有收益，但补充表 13 的 occupancy 预训练特征迁移未改善规划；表示、读出形式与下游使用方式必须分开比较。'},
'proxy-4d-occupancy-2023':{'limitation':'背景射线与体素超过 90%，整体误差容易掩盖前景预测差；1 秒预测中简单静态/射线追踪基线仍很强，未观测体素也缺少完整真值。'},
'occworld-2024':{'limitation':'须区分输入 GT occupancy 的 OccWorld-O 与使用预测 occupancy 的 D/T/S 版本；论文同时报告长时域规划退化及部分碰撞率落后，日志未来不提供替代动作真值。'},
'gaussianworld-2025':{'supports':'在当前图像条件下按自车运动、局部动态运动和新观测区域更新 Gaussian，完成流式当前三维 occupancy。','limitation':'其 forecasting 受当前观测条件约束，不能等同于无未来图像的长时预测；协议未评估跨长遮挡实例身份或 free/unknown 概率校准。'},
'i2world-2025':{'limitation':'日志和体素标签限制多模态反事实验证；作者展示未见过的倒车变换导致参与者不现实地静止，效率数字也限定于其 token/预测设置。'},
'fsf-net-2026':{'limitation':'作者在局限部分报告 ego 轨迹预测较弱，BEV 流又受当前与未来流不可得限制；占据精度提升不能直接当成规划提升。'},
'lmpocc-2026':{'limitation':'收益主要集中在静态类别；历史 logit 的可见性遮罩更新不等于长期动态身份或错误先验已获可靠删除。ICRA 2026 录用可核验，正式论文页尚未查到。','links':[{'label':'项目页','url':'https://ss-yuan.github.io/LMPOcc/'}]},
'beyondsight-2026':{'limitation':'nuScenes-Permanence 标签由既有轨迹和可观测性扩展；作者报告超过 6 秒遮挡和遮挡后突然转向/停车会使持续假设漂移。规划指标仍来自日志。'},
'unsdrive-2026':{'supports':'在 MineLoop 模拟矿区显式建模 occupied、free、unknown，并将状态接入 flow-matching planner 和轨迹评分器。','limitation':'原文明确全部实验均在模拟中完成，尚无实体矿卡验证；表示、损失和 planner 联合变化。ACM Multimedia 2026 由 arXiv 期刊栏记录，正式论文页尚未查到。'},
'adaocc-2024':{'limitation':'高分辨率 CONet 上额外检测与表面重建的收益有限，部分配置不划算；论文不评估长期身份、来源或固定 planner 的状态价值。'},
'octreeocc-2023':{'year':2024,'venue':'NeurIPS 2024','publicationStatus':'peer-reviewed','canonicalId':'doi:10.52202/079017-2528','sourceFamily':'publisher-and-venue','url':'https://papers.nips.cc/paper_files/paper/2024/hash/9149fc44c95ce58e3ca529a1e34c2691-Abstract-Conference.html','links':[{'label':'arXiv','url':'https://arxiv.org/abs/2312.03774'},{'label':'代码','url':'https://github.com/4DVLab/OctreeOcc'}]},
'gaussianformer2-2025':{'limitation':'Gaussian 数量减少不代表延迟更低，原文指出 FPS 初始化使延迟高于 GaussianFormer；occupied 概率也未检验射线级 free/unknown 或教师冲突校准。'}
}
for k,v in updates.items():refs[k].update(v)
newrefs=[{'id':'roadocc-2026','title':'RoadOcc Learns When to Persist, Transport, or Refresh Memory for Roadside Occupancy Prediction','authors':'Xiaokai Bai, Lei Yang, Songkai Wang, Lianqing Zheng, Si-Yuan Cao, Hui-liang Shen','year':2026,'venue':'arXiv','publicationType':'method','publicationStatus':'preprint','canonicalId':'arxiv:2609.27677','sourceFamily':'local-corpus','supports':'固定路侧相机的时序占据分别学习原坐标历史、速度回溯历史和当前证据的软路由，在匹配容量及稀疏预算下区分地址修正与来源选择的收益。','limitation':'路由监督检查同类语义支持而非实例身份；GT 动态区域图不包含候选漏检，未评估 V2X 通信或车辆规划闭环。','url':'https://arxiv.org/abs/2609.27677','localPaperId':'roadocc-persist-transport-refresh','scopeRole':'core-temporal-source-selection'}, {'id':'selectoccflow-2026','title':'SelectOccFlow: Selective Spatiotemporal Aggregation for 3D Occupancy and Scene Flow Prediction','authors':'Yuhang Wang, Kai Luo, Yuanfan Zheng, Kailun Yang','year':2026,'venue':'arXiv','publicationType':'method','publicationStatus':'preprint','canonicalId':'arxiv:2610.04356','sourceFamily':'local-corpus','supports':'语义引导图像采样、状态条件历史读取和方向结构聚合联合预测当前三维占据与平面场景流；在 OpenOcc 与视觉扰动协议中分别检验几何、语义和运动。','limitation':'当前占据加场景流不是未来占据序列；尚无长期实例身份、V2X 通信或规划闭环实验，资源发布仍需另核。','url':'https://arxiv.org/abs/2610.04356','localPaperId':'selectoccflow-occupancy-scene-flow','scopeRole':'core-current-state-and-flow'}]
r['references'].extend(newrefs);refs.update({x['id']:x for x in newrefs})
r['reviewedAt']='2026-10-18';r['searchWindow']='2022-01-01 至 2026-10-18；重新核对 34 条既有引用及关键论断，补入 RoadOcc 与 SelectOccFlow；同时检索近期占据、时空记忆、未知状态与规划接口工作。'
s={x['id']:x for x in r['sections']}
s['evolution']['body']=s['evolution']['body'].replace('本库 2026 年工作','2026 年工作').replace('SparseWorld关注','SparseWorld 关注').replace('USR-Drive联合','USR-Drive 联合').replace('GeoWorldAD把','GeoWorldAD 把')+'\n\n近期状态更新更关注历史证据何时有效。RoadOcc 在固定路侧坐标下区分 Persist、Transport 与 Refresh，说明纠正历史地址后还需要决定是否复用；SelectOccFlow 则按体素状态选择历史，再联合预测当前占据与场景流。前者的同类支持不保证实例身份，后者的流输出也不构成未来占据序列。两者把时间更新变成可拆开检验的机制，但尚未测量这些改进对车辆闭环规划的作用。'
s['evolution']['referenceIds'] += ['roadocc-2026','selectoccflow-2026']
s['evidence']['body']='评估可以分为四层。当前状态先看 occupied/free/unknown、类别、距离和遮挡分层，平均 mIoU 容易掩盖危险的 false-free；时间一致性再看身份切换、对象出现/消失和状态年龄；概率质量需另测 NLL、Brier、ECE 或相同 coverage 下的 selective risk；规划价值则在固定下游中比较碰撞、进度、舒适和无谓制动。现有论文通常只报告其中一部分，缺失的层次应作为待测项。\n\n已有负结果说明这些层次不能互换。Scene as Occupancy 的占据结果作为规划输入有收益，但补充表 13 中直接迁移 occupancy 预训练特征没有改善规划。FSF-Net 提高占据预测质量，作者仍报告 ego 轨迹预测较弱。Point Cloud Forecasting as a Proxy for 4D Occupancy 指出背景占据主导总体指标，短时域中的静态或射线追踪基线很强。OccWorld 还需分清 GT occupancy 输入与预测输入，其长期规划和部分碰撞指标并不领先。\n\n表示的计算收益同样需要实测。GaussianFormer-2 减少 Gaussian 数量，却因初始化中的最远点采样增加延迟；USR-Drive 的联合去噪仍定位为离线场景估计。GeoUP 保持规划 decoder 架构和训练配置来比较 backbone，并非冻结全部下游权重。CaAD 的 Bench2Drive 反应式闭环与 NAVSIM 非反应评测须分别阅读，其补充 nuScenes 实验还出现 L2 改善而碰撞率略升的情况。\n\nRoadOcc 给出更细的状态更新对照：同预算下，纠正读取地址后再加来源路由，动态 mIoU 从 30.97 升至 32.37，三种子标准差分别为 0.27 和 0.11；该结果支持路侧感知里的来源选择，尚未验证实例对应或规划收益。SelectOccFlow 则同时报告占据和流指标，避免只以一个总分评价动态状态。\n\n未知状态已有直接先例：UnsDrive 在 MineLoop 模拟矿区显式输出 occupied/free/unknown 并连接规划，MR-Occ 设置 occluded 类；两者尚未提供独立于待测模型、同时标注传感器删失与来源冲突的现实射线级四态审计。UnsDrive 的全部实验均在模拟中完成，不能当作实体矿卡运行证据。'
s['evidence']['referenceIds']=list(dict.fromkeys(s['evidence']['referenceIds']+['proxy-4d-occupancy-2023','geoup-2026','usr-drive-2026','roadocc-2026','selectoccflow-2026']))
s['challenges']['body']=s['challenges']['body'].replace('当前瓶颈主要不是编码器容量','状态更新的难点').replace('本轮样本尚未发现统一的现实长期身份协议。','当前覆盖的论文还没有共同验证现实长期身份、来源、年龄与规划作用。').replace('USR-Drive的','USR-Drive 的').replace('GaussianWorld的','GaussianWorld 的').replace('I2-World的','I2-World 的')+'\n\n来源选择与对象身份还需分开：RoadOcc 的同类历史支持可在两辆同类车交接时产生歧义；BeyondSight 虽然持续维护被遮挡对象，但作者仍记录超过 6 秒遮挡及突然动作变化带来的漂移。后续实验应把“保住历史”与“及时删除错误历史”同时计分，避免只统计遮挡恢复成功的对象。'
s['challenges']['referenceIds']=list(dict.fromkeys(s['challenges']['referenceIds']+['roadocc-2026']))
s['challenges']['thesis']='难点在于判断哪些状态有观测支持、历史何时失效，以及动作改变后还有哪些结论可以验证。'
s['outlook']['body']=s['outlook']['body'].replace('最小对比分为无记忆、固定窗口、对象记忆、Gaussian/表面记忆、完整三态状态','最小对比分为无记忆、固定窗口、运动回溯、带来源选择的记忆和完整三态状态；对象身份单独作为一项干预').replace('只有','只有')
s['outlook']['referenceIds']=list(dict.fromkeys(s['outlook']['referenceIds']+['roadocc-2026','selectoccflow-2026']))
r['abstract']='动态场景表征连接感知与决策，需要定义占据、空闲、未知、语义、对象身份和时间有效性，并逐项检验其用途。MonoScene、TPVFormer 与 Scene as Occupancy 建立当前三维状态主线；OccWorld 和 I2-World 扩展到未来预测；GaussianWorld、USR-Drive 等工作探索连续或混合表示。近期 RoadOcc 与 SelectOccFlow 进一步拆开历史地址、证据选择和当前运动状态。精度、时间一致性、校准、延迟和规划收益仍须分别报告：更好的占据特征未必改善规划，更少的 Gaussian 也未必更快。后续可先冻结既有模型与规划器，比较简单窗口、运动回溯和来源选择，再判断是否需要更复杂的场景记忆。'
a=r['searchAudit'];a['independentReview']={'status':'pending','scope':'2026-10-18 substantive primary-source reference and claim refresh; independent review must read the final file and bind its fingerprint.','assurance':'same-family provisional'}
P.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('Updated references',len(r['references']))
