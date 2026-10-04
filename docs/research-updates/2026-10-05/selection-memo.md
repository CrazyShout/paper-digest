# 2026-10-05 Paper Digest 独立选题结论

选择者：`/root/select_digest_oct05`，本轮唯一独立编辑选择者。状态：**same-family provisional**。本结论是选题决策，不是待写报告的事实复核通过，也不是实验复现或上线完成。

冻结输入：`selection-input.json`，SHA-256 `e1784d178ceeaf179f67cfcf89f9eb5eed8ed69c839bf2904bbdfd3f5aacae10`。最终逐条去向见同目录 `selection.json`，本次完成时 SHA-256 `76ee42369965a4c1d200e3371ed7ebf48810724828e41b3c5bbf9643e645beb7`。

## 实际阅读范围与口径

- 冻结候选集有 50 个检索组、846 次候选出现、597 个规范化候选。它们来自机械合并，没有使用 scout 的接受/排序结论。
- 分 1–150、151–300、301–450、451–597 四批读完全部标题。383 个在标题阶段因范围不符排除。
- 214 个进入摘要目标集。实际读了 200 份冻结输入中的完整首份摘要；另从官方 ScienceDirect 搜索结果补读 1 份缺失摘要，共 **201 份实际摘要阅读**。13 项仍缺摘要，逐条标为来源缺口；574 是“输入可用摘要数”，绝不是阅读数。
- 20 篇新候选比较了固定版本的原文方法、实验和范围章节，8 篇入选、12 篇暂缓。`shortlistComparisons` 保存每篇实际阅读的节号、原件路径、派生阅读文本与 SHA。没有声称将这 20 篇从头到尾读完。
- 另比较了 2 篇既有论文的版本原文，单独统计，不挤入 20 篇首报短名单，也不计入 8 篇首报。
- 用本地报告 frontmatter 的主来源 ID 和规范化标题重新查重，并核对 `content/reported-papers.md`；6 个既有身份分别是 Instant NuRec、MomADv2、GeoWAM、TrackFlood、SemRD-V2X 和 Metric Validity。

逐条去向合计：标题排除 383；摘要排除 99；较早记录暂缓 9；既有重复 4；既有版本更新 2；全文后暂缓 12；摘要后暂缓 37；范围待核实 20；一手来源缺口 22；资源条目暂缓 1；首次入选 8。合计 597。

## 最终 8 篇首次收录

| 论文 | 稳定 paperId | 主方向 | 固定版本 |
| --- | --- | --- | --- |
| V2X-WAM | v2x-wam-cooperative-world-action | cooperative-autonomous-driving | 2609.37098v2 |
| FFBL-Coop | ffbl-coop-association-decoupled-tracking | cooperative-autonomous-driving | 2610.01750v1 |
| AD-Memo | ad-memo-language-driving-memory | agentic-driving | 2609.38641v1 |
| World4Scorer | world4scorer-outcome-grounded-planning | end-to-end-autonomous-driving | 2609.36438v1 |
| PhysWAM | physwam-geometry-coupled-world-action | world-models | 2609.37970v1 |
| DyRAD | dyrad-dynamic-radar-view-synthesis | radar-occupancy-representation | 2609.39841v2 |
| TrafficSignBench | traffic-sign-bench-rule-compliance | autonomous-driving-testing | 2609.38463v1 |
| MapLightning | maplightning-compact-map-tokens | dynamic-scene-representation | 2610.01905v1 |

选择的是互补机制：协同消息如何服务未来状态与规划、远端证据与持久身份如何分离、可读驾驶记忆、候选结果监督、深度—运动几何耦合、动态雷达信号渲染、可执行规则评测、紧凑地图状态。7 个主方向，协同 2 篇，其余各 1 篇；没有用配额硬补新异常分割或攻防论文。

8 篇的官方公告均落在 9 月 30 日至 10 月 2 日。FFBL-Coop 与 MapLightning 的公告从 `catalogs/all-records.json` 核实；它们没有命中根代理机械标题缓存正则，但被其他检索组保留。提交日期、公告日期和本库首收录日期必须分开写。FFBL-Coop 的 ICLR 2027 under review 不能写成已录用。

## 写作必须保留的证据限制

**V2X-WAM** 的关键增量是动作条件占据/流和世界反馈轨迹细化；它在 V2X-Seq-SPD 验证集报告，模型选择也用验证集。其内部反馈不是车辆闭环，日志未来重合率不是部署碰撞率，98,400 B/s 是消息核算。未发现系统性时延/丢包/标定压力测试。

**FFBL-Coop** 有两个序列数据集、标定扰动、延迟和压缩对照，比本期检测专用候选提供更完整的时序状态证据。必须保留压缩后 IDS 49→70、200 ms 时 AP 下降而 AMOTA 相对稳定、主要评估汽车、payload 不含协议头等代价；完整系统与文献基线训练配方不同。

**AD-Memo** 确实使用可持续更新的语言记忆，因此符合 Agentic 方向；但 Da Capo 是“记忆闭环、控制开环”，观察和过去轨迹仍回放真值。报告不能把 stop/go 轨迹匹配或 VQA 结果写成真实闭环驾驶安全。约 10 秒记忆、无同架构向量记忆比较以及 action expert 未纳入，均须交代。

**World4Scorer** 的固定候选、标签配对和重排序对照比单纯刷分更有阅读价值。但 Bench2Drive 73.27 是加入 20 m 路点、route reranking、命令保持和模拟器 ego 状态的系统结果，与文献基线输入/训练条件不匹配，不能归因于世界模型单模块。代码仍承诺发表后发布。

**PhysWAM** 同时报告 NAVSIM、HUGSIM 和几何消融，适合解释为何约束未来深度和运动的关系。其 CPP 受记录未来 LiDAR 支持，反事实一致性仍未充分验证；单配置单训练。4.4–9.4 GPU 秒/计划，仿真时间闭环不证明实时。文中 GeoWAM 36.6 是旧版本/预算；最新 v3 的 39.6 不能遗漏，也不能无条件横比。

**DyRAD** 把动态几何与雷达 PSF 分开，优于只看 PSNR 的叙事。当前地平面实现没有高程，不是完整 3D 语义占据；真实离轨结果是循环一致性，直接离轨真值来自合成场景。目标命中率 90.7% 与联合 F1 0.179 应同时解读。依赖对象标注，尚无下游规划闭环。

**TrafficSignBench** 同时满足本期系统/闭环与批判性评测要求。它给规划器结构化标志信息，排除了识别误差；单目标规则为主；特权专家与普通基线必须分组。SCD 是规则合规与到达联合量，宏平均和 pooled episode 数据不能混写。

**MapLightning** 采用地域重叠更低的 Near-Extrapolation split，并有地图不确定性到他车预测的连接。默认模型 18.9 FPS 与轻量配置 40+ FPS 分开报告。“外参噪声不掉分”源于模型不读取该元数据，不等于真实相机移动鲁棒性。仅标动态场景表征主方向，不因他车轨迹预测追加端到端 ego 规划标签。

## 20 篇短名单的横向取舍

除最终 8 篇，还独立比较了下列 12 篇原文章节。它们的逐条理由和节号均在 JSON，不将“未入选”等同于低质量：

| 暂缓候选 | 本期主要取舍 |
| --- | --- |
| AD-E2E-JEPA | 零样本任务给定未来真值图像；剔除安全乘子后的 EPDMS-dagger 必须分开。投影器迁移有价值，但证据范围较窄。 |
| RefineDrive | 训练期失败修正明确；NAVSIM v2 仍是单阶段原场景，和本期策略主题重叠。 |
| VehicleArena | 具备工具与持续任务状态；SUMO 高层动作、期限和车内任务混合使能力比较依赖 harness。 |
| RoXDrive | 逆动力学筛选具体，但 ego 动作一致性并不验证全场景与他车反应，短循环/自有世界模型评估边界较强。 |
| ExceptionDrive | 编辑后几何安全评估有用，但未使用几何多视图一致模块，人工抽查仅 168 个批准样本，无反应式闭环。 |
| doPlan | 长期意图数据重要，但回看视频后写指令，未标注自然说出/可执行时点，不能把所述时差解释为真实响应延迟。 |
| DrivingBench | 真实车辆工具接口案例有价值，但每系统仅 1 个独立 trial、尝试依赖、固定顺序及单个低速锥桶场地不足以稳定排名。 |
| ReWAM | Level-k 学习有意思，但当前他车状态来自标注，非反应式 NAVSIM 不验证因果博弈响应，也不是显式 V2X 协作。 |
| TACTIC | 上下文攻击调度具体，但单 CARLA town、简化 IDM/AEB victim；280 是多组消融总量，不能当 280 次 full-policy 成功。 |
| RADP | 反应式 nuPlan 有安全—进度取舍；归因是规则梯度压力，干预验证仍待做。作为高优先级 reserve。 |
| EgoRefine | 两个真实数据集与 0–400 ms 支持对齐增益，但仍为检测专用；FFBL 提供更完整的身份状态/通信权衡。 |
| CLRE | 同 VAD 的 126-route 闭环对照有价值，但额外前雷达、依赖预测的可行性及仅 11-route 跨模型检查需保留。作为 reserve。 |

## 既有版本与资源更新

**MomADv2 v1→v2**：原文 NAVSIM v1 数字改为 NC 98.7、DAC 96.8、TTC 95.4、EP 84.5；此前是 99.0、97.1、95.5、83.2，PDMS 均为 89.9。应订正旧报告并写简短更新说明，不作为新论文。

**GeoWAM v2→v3**：新增 PhysicalAI 0/100/496/832 h scaling，navhard 36.6→39.6，nuScenes zero-shot 碰撞指标 0.24%→0.12%，L2 并非单调。v3 表 6 新增去未来几何、无 PAI、full 和 2/4/6/8 帧预测时域消融；旧报告“没有未来几何消融”须订正。图 3 已改成 PWM/VGGT/Kabsch ego-motion recovery 对比，旧聚合点图说明不能沿用。原文训练语料描述也有变化，应作为实质版本更新说明，不计首报。

根代理的 `tracked-release-checks.json` 22 行 release/asset 元数据均访问成功且窗口事件为零；本选择者检查了这些行，没有独立重新抓取全部仓库。这不覆盖非 GitHub 数据/权重，也不证明完全没有资源进展。BSMAttacker 是元数据更正且结果修订中的资源条目，不接受为新论文或稳定性能结果。

## 未解决的一手来源缺口

13 个目标仍没有读到摘要，名单完整保存在 JSON；主要为 DOI/出版社入口无法访问。另有已读摘要但原文未核实的正式论文候选：MG-Fuzz、WaitWatch、Poirot、Neude、InvarGen、R2SGEN，以及协同评测审计等。它们保留为来源缺口，不作质量否决。

WaitWatch 作者主页的 preprint 链接实际打开 2025 年的 STCLocker v1，其标题、作者、ADS 数量和结果比例均与正式摘要不同，不能拿旧版 2 ADS/3.39× 代替新版 3 ADS/2.28×。Infrastructure-Assisted Cooperative Decision Model 的元数据摘要提到实车，但 DOI 入口失败，全文和首次发布日期仍未证实。

后续撰写仍需逐篇打开官方图片、作者单位、资源内容和相关工作原文。完成后交给新的独立报告复核者；本次选择不预先批准这些尚未写出的报告。
