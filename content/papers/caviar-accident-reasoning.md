---
{
  "id": "caviar-accident-reasoning",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "agentic-driving"],
  "title": "CAViAR: A Causal Video Dataset for Fine-Grained Accident Reasoning in Real-World Scenarios",
  "source": "ECCV 2026 DriveX Workshop (accepted; formal paper page unavailable at scan time) / arXiv:2608.19380 / https://arxiv.org/abs/2608.19380 / HTML: https://arxiv.org/html/2608.19380 / Code and annotations: https://github.com/nec-labs-ma/CAViAR",
  "authors": ["Sparsh Garg", "Yi-Wen Chen", "Vijay Kumar B G", "Abhishek Aich"],
  "affiliations": ["NEC Laboratories America"],
  "comment": "CAViAR 在 2,249 个真实事故/近失 dashcam 视频上增加可见证据约束的表面责任、受影响对象和规则违反标注；六个 VLM 即使微调后仍在事故类型和规则映射上明显低于感知任务，暴露了驾驶 VLM 的时序因果落差。"
}
---

## 一句话定位

CAViAR 不把“因果”包装成法律责任预测，而在真实 dashcam 片段上标注 apparent at-fault agent、affected agent 和可见的 rule-relevant behavior，并专门排除无法从视频判定的样本。它最有价值的结果是定位 perception-reasoning gap：模型几乎能读对昼夜，却不能把时序动作映射为事故类型、角色和规则违反。

## 论文要解决的问题

现有事故数据多做检测、提前预警或通用 VideoQA，常缺少“哪个可见对象发起了危险交互、谁受影响、违反了哪类规则”的结构化证据。没有这些字段，VLM 即使能描述天气和碰撞，也很难用于事故复盘、测试报告或 safety critic。反过来，若强迫单视角视频给出法律责任，又会把遮挡、视野外动作和辖区法规误当确定事实。

作者基于 CCD 与 Nexar 两个公共真实 dashcam corpus 构建注释层，训练用 CCD、测试用 Nexar，主动形成跨设备/地区域迁移；发布注释、split、prompt 和 frame index，而不重新分发受限原视频。

## 方法和系统设计

- 2,249 个视频中 CCD 1,500、Nexar 749，共 20,108 QA pairs，覆盖 dense caption、weather、lighting、road condition、accident type、apparent at-fault、affected agent 和 rule violation。
- 四人团队由两名主标注员和两名持续质检者组成，跨字段检查对象与因果顺序；歧义责任样本标记后不进入责任评价，共享责任则显式记录。
- 规则 ontology 使用 11 类 jurisdiction-agnostic 可见行为，而非具体法规条款；开放答案用 BERTScore 和 0-5 LLM-as-Judge，MCQ 同时报告 accuracy、balanced accuracy、macro-F1 和 majority/random baseline。
- 比较 Cosmos-Reason2、Qwen3-VL、InternVL3 的 2B/8B base 与 LoRA fine-tuning，并增加 CCD 同源 holdout 以区分 domain shift 与推理瓶颈。

## 关键图与可视化结果

![图 1：同一事故片段对应的九个问题与完整多任务标注](https://arxiv.org/html/2608.19380v1/fig/qa_examples.png)

图 1 展示从场景描述到角色、规则的证据层级。作者使用“apparent”限定词很重要：答案是视频可见线索下的责任判断，不是完整传感器证据或法律结论。

![图 2：六个模型在事故类型上的归一化混淆矩阵](https://arxiv.org/html/2608.19380v1/fig/accident_type_confusion.png)

图 2 显示 base 与 fine-tuned 模型都塌缩到 Rear-End，几乎不能恢复 Side-by-Side 和 Head-on。它把 aggregate accuracy 隐藏的类不平衡问题可视化出来，也说明微调不等于学会时序交互结构。

## 实验结论与证据

六个模型的平均 lighting accuracy 已达 98.6%/98.7% (base/FT)，但 weather 只有 58.4%/62.6%，低于 73.0% majority baseline；事故类型 accuracy 33.1%/35.4%，低于 37.7% majority，macro-F1 仅 18.6%/21.1%。责任开放任务更弱：所有模型的 rule-violation judge score 只有 0.42-0.82/5，显著低于 at-fault 与 affected agent。

2B 模型微调收益较大，例如 Qwen3-2B overall MCQ +11.49、BERTScore +25.29、judge +0.483；8B 提升很小，InternVL3-8B 的 MCQ 甚至 -0.23。作者将其归因于感知项已接近饱和、LoRA 只改语言模型而冻结 vision encoder/projector，以及剩余误差主要来自 grounding 与规则映射。

CCD 到 Nexar 的 accident-type TVD 为 0.362，域差异确实存在；但 1,200/300 的 CCD 同源 holdout 中 overall BERTScore-F1 仍只有 31.12-39.60，说明低责任推理不能只归咎于 domain shift。

## 应用场景与启发

- 应用场景：事故视频审计、驾驶 VLM 时序推理 benchmark、测试报告辅助和 safety critic 训练。
- 方法启发：责任推理必须拆成事件时间定位、角色关联、动作证据和规则映射，不能只让 VLM 直接生成一段因果叙述。
- 研究启发：把 dashcam 与对象轨迹、ego motion、地图规则或 radar velocity 对齐，检查显式时空 grounding 能否突破语言层微调瓶颈。
- 讨论问题：哪些“表面责任”标签能安全用于自动测试，哪些必须保留 abstention 并交给人类？

## 局限与阅读风险

原始视频来自既有 CCD/Nexar，地理、设备、采样和类分布不同；事故类型 majority 在两域翻转。四人标注流程不是每个样本的完全独立多标注员统计，LLM 还参与语言规范化；开放答案又依赖 LLM-as-Judge，因此不能把分数当法律或因果真值。单 dashcam 无法看到全部参与者，虽然作者排除歧义责任样本，仍可能存在 selection bias。数据集测的是事后视频理解，不是在线事故预测或车辆控制。DriveX Workshop 录用状态来自 arXiv 作者声明，扫描时未找到正式 workshop paper 页面，因此仍以 arXiv 为论文入口并明确标为 workshop-accepted，而不是已正式出版。

## 后续跟进

- 下载公开 annotation/schema，先复核 abstention、shared responsibility 和 rule ontology 的一致性。
- 建立 event localization、agent track、rule retrieval 三阶段 baseline，与直接 VLM 端到端回答比较。
- 用传感器级速度与地图上下文补充视频，再按可见证据充分度分层评估责任推理。
