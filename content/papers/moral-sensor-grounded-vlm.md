---
{
  "id": "moral-sensor-grounded-vlm",
  "tag": "radar-occupancy-representation",
  "tags": ["radar-occupancy-representation"],
  "title": "MoRAL: Sensor-Grounded BEV Reasoning for Compact VLMs toward Edge-Oriented Autonomous Driving",
  "source": "arXiv:2608.02449 / https://arxiv.org/abs/2608.02449 / Official model and artifacts: https://huggingface.co/AmbarishGK/moral-v4-nuscenes",
  "authors": ["Ambarish Govindarajulu Kaliamurthi", "Kaikai Liu"],
  "affiliations": ["San Jose State University"],
  "comment": "MoRAL 把 LiDAR 距离、对象形态和雷达 Doppler 显式编码为 BEV 视觉词汇，让 2B VLM 在 8 GB GPU 上读取物理量。它的价值在于展示低成本结构化接口，也暴露了 LLM 裁判、教师生成推理和紧急制动高误报等可靠性问题。"
}
---

## 一句话定位

MoRAL 不让 VLM 自己从原始点云学习三维感知，而是把 LiDAR 距离画成颜色环、对象类别画成簇形状、雷达 Doppler 画成方向楔形，再分两阶段教 2B 模型读取和推理；它在 8 GB RTX 4070 Laptop GPU 上达到 42 token/s，但紧急制动召回 47.8% 仍伴随明显过度反应。

## 论文要解决的问题

紧凑 VLM 的语言能力不等于度量空间能力。零样本模型面对工程化 BEV 往往输出空白或模板答案，即使模型扩大到 8B，也无法自动理解颜色、形状和速度符号的含义。论文因此把感知计算外置为确定性 BEV renderer，把模型任务收窄为读取明确的物理视觉词汇并回答八类驾驶问题。

## 方法和系统设计

- 确定性 renderer 将 nuScenes LiDAR 和雷达融合成 896 x 896 BEV，颜色带编码距离，簇形态编码类别，楔形编码速度方向和接近速度，10 到 50 m 距离环提供度量参考。
- 第一阶段只训练视觉编码器，使用 60,000 条 grounding 记录学习 BEV 词汇；第二阶段以 Cosmos-Reason2-8B 生成的 57,696 条思维链训练完整模型，实际可训练参数为 52M。
- 评测覆盖 2,304 条记录和 2,042 个独立帧，主裁判是经小样本人评校准的 Gemma 4 31B，并补充人工 pilot、退化率、紧急制动召回和设备吞吐。

## 关键图与可视化结果

![图 1：MoRAL 的确定性 BEV、视觉词汇学习和驾驶推理两阶段流程](https://arxiv.org/html/2608.02449v1/x1.png)

图 1 说明模型并不接收原始雷达 tensor，雷达信息在进入 VLM 前已经被人工设计成楔形符号。因而这项工作测的是“结构化雷达提示能否被小模型读取”，不是端到端雷达感知。

![图 2：颜色距离环、对象簇和雷达速度楔形组成的 BEV 表示](https://arxiv.org/html/2608.02449v1/x2.png)

图 2 是方法最可复用的部分：速度与距离有明确视觉语法，能够被单独遮蔽和扰动。它也暴露上限，任何 renderer 的检测、关联或速度错误都会被 VLM 当作已确定事实。

## 实验结论与证据

MoRAL 在八类问题中的七类胜过零样本 8B 基线，综合裁判分为 0.565，对比零样本 8B 的 0.439。紧急制动召回从 10.8% 提升到 47.8%，输出退化率从 94.1% 降至 20.8%；但论文同时报告模型出现过度反应倾向，47.8% 仍意味着多数关键样本漏检。完整模型占约 4.3 GB VRAM，在 RTX 4070 Laptop 上约 42 token/s，未计入 CPU 侧 BEV 渲染端到端延迟。

## 应用场景与启发

- 应用场景：边缘设备上的场景问答、驾驶状态摘要和雷达速度提示，不适合直接替代低层紧急控制。
- 方法启发：Radar Occupancy 可以把连续场切成可审计 query token，但应保留原始证据和不确定性，避免 renderer 把错误硬编码为事实。
- 讨论问题：同等延迟预算下，结构化 BEV 加小 VLM 是否真的优于一个直接读取 occupancy/velocity 的轻量任务网络？

## 局限与阅读风险

主指标依赖另一 LLM 评分，人工校准只覆盖很小样本；训练推理又来自同系列大型教师，可能放大格式和语言偏好。输入中的类别簇需要上游对象信息，论文没有把 renderer 误差、雷达关联误差和 VLM 误差分离。47.8% 的紧急制动召回与过度制动倾向都远未达到部署水平，42 token/s 也不包含完整传感器到答案延迟。

## 后续跟进

- 用规则可判定的距离、速度和碰撞答案替代 LLM judge，建立完全确定的核心评测。
- 注入 renderer 漏检、错速和错关联，绘制输入误差到答案风险的传播曲线。
- 与同参数量的 occupancy/velocity 直接头做等算力对照，确认语言解码是否增加独立价值。
