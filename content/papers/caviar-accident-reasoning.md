---
{
  "id": "caviar-accident-reasoning",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "agentic-driving"
  ],
  "title": "CAViAR: A Causal Video Dataset for Fine-Grained Accident Reasoning in Real-World Scenarios",
  "source": "ECCV 2026 DriveX Workshop (accepted; formal paper page unavailable at scan time) / arXiv:2608.19380 / https://arxiv.org/abs/2608.19380 / HTML: https://arxiv.org/html/2608.19380 / Code and annotations: https://github.com/nec-labs-ma/CAViAR / Fixed full text: https://arxiv.org/html/2608.19380v1",
  "authors": [
    "Sparsh Garg",
    "Yi-Wen Chen",
    "Vijay Kumar B G",
    "Abhishek Aich"
  ],
  "affiliations": [
    "NEC Laboratories America"
  ],
  "comment": "CAViAR 在事故视频上区分可见角色、受影响对象和规则行为；主要价值是揭示感知与责任叙述的落差。公开版本已含 Nexar 测试注释与评测工具，但未包含 CCD 训练注释。"
}
---

## 一句话定位

CAViAR 为真实 dashcam 片段增加“谁看起来发起了危险交互、谁受影响、可见动作违反哪类行为规则”的注释。它评估事后视频理解，并保留 apparent 限定：单视角证据不能直接决定法律责任，也不等于识别完整因果机制。

- 核心证据：六个 VLM 微调后，昼夜判断平均准确率 98.7%，事故类型 macro-F1 仅 21.1%；规则违反的最好 judge 得分为 0.82/5。[表 4–5](https://arxiv.org/html/2608.19380v1#S4.T5)
- 主要边界：不同任务难度、类分布与生成预算不同，差距支持定位问题，不能单独证明错误只来自推理模块。

## 论文要解决的问题

### 任务与数据边界

2,249 个视频来自 CCD 的 1,500 段和 Nexar 的 749 段，覆盖碰撞与近失事件；训练用 CCD，测试用 Nexar。新增的是注释层，并非重新采集视频。两个来源隔离避免同片段泄漏，却同时引入设备、地域与类分布迁移。

### 相关工作与差异

| 一手工作 | 原任务与机制 | CAViAR 的差异 |
| --- | --- | --- |
| Moura 等，Nexar，CVPR 2025 WAD Workshop；[原文 v1](https://arxiv.org/html/2503.03848v1) | 标注碰撞/近失、事件时间与可预警时间，按事件前 0.5/1/1.5 s 的 AP 检验提前预测 | 复用筛选后视频，增加事后角色和规则回答；不能把 CAViAR 得分当提前预警能力 |
| Xu 等，SUTD-TrafficQA，CVPR 2021；[原文](https://openaccess.thecvf.com/content/CVPR2021/papers/Xu_SUTD-TrafficQA_A_Question_Answering_Benchmark_and_an_Efficient_Network_for_CVPR_2021_paper.pdf) | 交通视频六类推理 MCQ，含归因、反事实、反向推理；Eclipse 动态选择帧与特征粒度 | CAViAR 聚焦事故的开放式角色/规则注释；交通因果问答并非此前完全缺失 |

## 方法和系统设计

### 注释如何形成

四人团队中，两人主标、两人持续质检，并非每段都由四人独立标注。质检确认 caption、发起方、受影响方和规则描述指向同一对象与事件链；无法从画面确定的责任字段留空或排除，共同责任显式记录。GPT-4 仅规范语言，人工标签仍是依据。[§3.3](https://arxiv.org/html/2608.19380v1#S3.SS3)

九个问题归入八个任务族：两种 dense caption，四种环境/事故 MCQ，三种角色与规则开放问答。不是每段都有九个有效答案：

$$
2249\times9-133=20108.
$$

这由表 2 计数直接推得；8,996 条 MCQ 加 11,112 条开放问答构成总量。缺失字段不能用错误答案补齐再计算同一分母。当前公开 `test.json` 实际为 7,407 条 QA，包含 744 条额外 `Accident Reason` 问题；官方 schema 将它折入论文 T8，不单列为新任务。按论文九问题口径去掉该额外字段，才对应 Table 2 的 6,663 条测试 QA，不能直接对发布文件所有问题取平均。十一类规则行为采用确定性关键词顺序映射，63% 回答触发多个候选时由固定优先级决定，因此“规则覆盖”也受映射规则影响。

### 指标与模型适配

为了避免多数类掩盖失败，应同时读准确率和类平均指标。以论文所用定义整理：

$$
\mathrm{BalancedAcc}=\frac1C\sum_{c=1}^{C}\frac{TP_c}{TP_c+FN_c},\qquad
\mathrm{MacroF1}=\frac1C\sum_{c=1}^{C}\frac{2TP_c}{2TP_c+FP_c+FN_c}.
$$

$C$ 是测试中出现的类别数，$TP/FP/FN$ 分别是正确、误报和漏报计数。它们不随多数类样本数直接加权；开放回答另用 BERTScore-F1（表中乘 100）与 GPT-4o 的 0–5 评分，不能混成同一种百分比。

Cosmos-Reason2、Qwen3-VL、InternVL3 各测 2B/8B 的 base 与 LoRA SFT。vision encoder/projector 冻结，只适配语言注意力/MLP；LoRA rank 64、alpha 128、dropout 0.05，学习率为 2B 的 2e-5 与 8B 的 1e-5。InternVL3 训一轮，其他训三轮；每模型一次训练，没有验证集或早停，Nexar 只作最终评测。[§4.1](https://arxiv.org/html/2608.19380v1#S4.SS1)

名义输入 16 FPS，但 InternVL3 最多 64 帧；生成上限为 512 tokens，而另外两家为 4096 并剥离 think 内容。相同问题不代表相同视觉时域或算力。MCQ 取首个有效选项字母，无有效字母记错；选项顺序固定。

## 关键图与可视化结果

![原论文图 1：九个问题及八个任务族](https://arxiv.org/html/2608.19380v1/fig/qa_examples.png)

从事前、撞击、事后画面读到对象与规则回答。图里列的是人工注释例子，不能视为模型识别结果或完整事故证据。

![原论文图 2：六模型事故类别混淆矩阵](https://arxiv.org/html/2608.19380v1/fig/accident_type_confusion.png)

纵轴真值、横轴预测，每行归一；每种 regime 汇总 749×6=4,494 个预测。微调后不少质量从 Rear-End 移到 None，Side-by-Side 召回仍约 1%；不能只用整体准确率的小幅上升认定交互理解已改善。

## 实验结论与证据

### 任务分解比总分更有用

下表来自 Nexar 16 FPS 表 5，为六个模型平均，数值均为百分数。多数类基线揭示环境题也并非全部解决。

| 任务 | 多数类准确率 | Base→FT 准确率 | Base→FT macro-F1 |
| --- | ---: | --- | --- |
| 天气 | 73.0 | 58.4→62.6 | 49.3→50.3 |
| 昼夜 | 62.6 | 98.6→98.7 | 98.5→98.6 |
| 路面 | 89.3 | 65.3→74.0 | 59.8→65.8 |
| 事故类型 | 37.7 | 33.1→35.4 | 18.6→21.1 |

Qwen3-2B 的整体 MCQ 提高 11.49 点、BERTScore 提高 25.29 点；InternVL3-8B MCQ 则下降 0.23 点。测试样本 bootstrap 区间不代表训练种子方差；作者给出的约 ±1.7 点 MCQ 半宽覆盖全部 8B 改变量，不应称其稳定提升。[表 3](https://arxiv.org/html/2608.19380v1#S4.T3)

### 推理瓶颈的证据与混杂

45 个 Cosmos2-2B FT 样本的人类复核与 judge 平均分 Spearman 相关为 0.851，但两标注者的一致性 $\kappa=0.579$，仍非绝对真值。CCD 内部 1,200/300 holdout 的 BERTScore-F1 也只有 31.12–39.60，说明跨域差异不是唯一原因；不过未等化的帧数、训练轮次和生成预算仍影响解释。作者关于“冻结视觉侧造成 grounding 瓶颈”的分析是合理假设，尚缺解冻视觉侧的匹配消融。[§4.2、§5](https://arxiv.org/html/2608.19380v1#S5)

## 应用场景与启发

- 作者主张：为事故理解模型提供结构化角色与规则证据。
- 我的判断：适合分析错误发生在事件定位、对象关联还是规则映射，不能自动裁定责任。
- 待验证假设：在相同帧数与 token 预算下，先定位事件再关联轨迹的分阶段回答，可改善少数事故类别与规则评分，而非只学到标注措辞。

## 局限与阅读风险

单视角遗漏画外原因，排除歧义片段也可能让测试偏向较容易归因的样本。四人流程缺少全量独立多标注者统计；语言修订和模型 judge 都需人工抽查。跨域、类不平衡和固定选项顺序并存，不能将总体差距完全解释为因果推理能力。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[官方仓库](https://github.com/nec-labs-ma/CAViAR)实际提供 Nexar 的 `data/test.json`（749 视频、7,407 条发布 QA，任务映射见上文）、ontology、评测/推理脚本和示例 LoRA 配置；README 明确 CCD 训练注释不随公开包提供。原视频按各源获取，未核到本文微调权重。完整训练复现仍缺注释前提。
- 最小验证：先按论文任务清单映射公开注释，使用独立开发片段确定两阶段提示后锁定；在留出的测试注释上固定等长帧窗口与两阶段合计回答 token 预算，比较直接回答和事件→对象→规则两阶段流程；按类别、可见证据充分度、无答案字段分层，由盲审人类复核同一小样本。
- 成功信号：macro-F1 与人类规则评分同时改善，且不靠更长输入或改变缺失样本分母。
- 停止条件：收益只体现 judge 风格偏好，或少数类仍塌缩；先修复事件与对象 grounding，再扩大训练。

### 来源与核验记录

发布资源另固定到提交 `eb95faea`，核对 `docs/data_schema.md` 与评测任务列表；固定 arXiv:2608.19380v1；核验日期 2026-09-12，范围为 §3–5、表 2–5/7–8、原图 1–2及两篇相关原文。DriveX Workshop 录用沿用 arXiv 作者声明，未核到正式论文页面；未运行微调或基准评测。
