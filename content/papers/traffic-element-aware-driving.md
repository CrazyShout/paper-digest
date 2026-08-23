---
{
  "id": "traffic-element-aware-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "Plug-and-Play Traffic Element Awareness for End-to-End Autonomous Driving",
  "source": "ECCV 2026 / https://eccv.ecva.net/virtual/2026/poster/3305 / arXiv:2608.18035 / https://arxiv.org/abs/2608.18035 / HTML: https://arxiv.org/html/2608.18035 / Project: https://zzongzheng0918.github.io/TE-Aware-E2E-AD/",
  "authors": ["Zongzheng Zhang", "Jijun Wang", "Saining Zhang", "Wang Shuo", "Yiru Wang", "Hai Yang", "Yang Chen", "Yuwen Heng", "Hao Sun", "Anqing Jiang", "Hao Zhao"],
  "affiliations": ["Institute for AI Industry Research, Tsinghua University", "Bosch Corporate Research, Shanghai"],
  "comment": "论文把交通灯、标志及其与 ego lane 的拓扑做成可插拔三维约束，在六类规划器和四个 benchmark 上持续改善规则遵守；Bench2Drive 中 VAD Driving Score 从 42.3 提升到 56.4，且只增加少量时延。"
}
---

## 一句话定位

这篇论文抓住了端到端规划中的一个低调但真实的缺口：模型可以拥有很强的 BEV、检测或语言能力，却仍不知道某盏灯、某块标志究竟约束 ego 正在走的哪条车道。作者把稀疏交通元素的三维位置和 ego-centric topology 直接送到规划接口，并在开环、伪闭环和 CARLA 闭环上验证，而不是只展示更准的交通灯检测。

## 论文要解决的问题

交通灯和标志面积小、长尾且极稀疏，在通用 BEV 分割或全局语义特征中容易被背景梯度淹没。只有类别也不够：同一视野里可能有多盏灯和多条车道，规划器必须知道 light/sign-to-lane 与 lane-to-lane 的关系。已有端到端方法常把这些规则信息隐式交给大模型学习，导致路口行为不稳定，也难解释安全收益来自哪里。

## 方法和系统设计

- 从前视图检测 2D traffic elements，用冻结 UniDepthV2 估深并结合 LiDAR 几何，构造 ego 坐标系中的稀疏 3D 元素中心。
- 为视觉骨干加入独立 TE auxiliary head，使用 focal loss处理极端前景/背景不平衡；局部 TE 信息通过 max pooling 与 BEV 特征对齐。
- TopoMLP 预测 light/sign-to-centerline 和 lane-to-lane adjacency，只保留 ego-relevant 关系，再将结构化拓扑文本送入冻结 BERT，和规划 query 交互。
- 模块分别接入 VAD、Orion、LTF、DiffusionDrive、DrivoR 和 DriveTransformer，覆盖传统感知规划与 VLM/VLA 范式。

## 关键图与可视化结果

![图 1：三维交通元素提取、拓扑编码及其接入端到端规划器的完整流程](https://arxiv.org/html/2608.18035v1/method.png)

图 1 显示方法不是把交通灯标签拼进末端，而是同时建立 metric location 与 lane-conditioned relation。真正可复用的设计是“稀疏规则对象单独监督、只把 ego 相关关系交给规划”，而非特定 BERT 编码器。

![图 2：NAVSIM-v2 路口中不同方法的前视交通元素和规划轨迹对比](https://arxiv.org/html/2608.18035v1/navsimv2_vis.png)

图 2 中，加入交通元素后轨迹在绿灯与直行标志约束下保持车道一致；它提供具体失败模式，但单个可视化不能证明闭环安全，关键证据仍来自跨 planner 的 Bench2Drive 与 NAVSIM 表格。

## 实验结论与证据

论文覆盖 nuScenes、NAVSIM-v1、NAVSIM-v2 navhard 和 Bench2Drive。nuScenes 上，VAD 平均 L2 从 0.72 降到 0.60 m，平均碰撞率从 0.22% 降到 0.17%；Orion 平均 L2 从 0.34 降到 0.26 m，碰撞率从 0.37% 降到 0.23%。NAVSIM-v2 多个规划器的 EPDMS 大致提高约 10 分，提升主要来自 NC、DAC、DDC 和 traffic-light compliance，而不是只提高进度。

更关键的是 CARLA 闭环 Bench2Drive：VAD Driving Score 由 42.3 提到 56.4，成功率 15.0% 到 21.3%，单步时延 278.3 到 282.5 ms；DriveTransformer-Large 由 63.46 提到 68.29，成功率 35.01% 到 39.61%，时延 211.7 到 216.5 ms。Efficiency 反而下降，作者将其解释为减少过激行为；这项负面变化应与安全收益一起保留。

消融显示，2D TE、全局 depth 或只建 traffic light 都弱于完整 3D TE；把稀疏 TE 当普通 BEV 类甚至使 EPDMS 下降 0.8。深度、漏检和假阳性扰动增大时得分平滑下降且仍高于基线，说明收益不是只在完美 TE 下存在。

## 应用场景与启发

- 应用场景：城市路口端到端规划、交通规则注入、闭环 planner retrofit，以及 simulator-real log 联合训练。
- 方法启发：小而关键的规则对象应拥有独立监督和明确规划接口，不能期待大特征图自动保留其语义与归属。
- 研究启发：把 ego-centric topology 扩展到可见性、临时施工、手势指挥和 V2X 路侧信号，并用 rule violation 作为训练与评测终点。
- 讨论问题：效率下降究竟是更安全，还是规划器过于保守？需要怎样的交互式闭环场景才能区分两者？

## 局限与阅读风险

三维 TE 仍依赖单目深度和预测拓扑，论文附录已经展示远处交通灯的 depth failure；虽然做了人工噪声敏感性，尚未覆盖强遮挡、夜间 glare 或错误灯车道关联的组合失效。Bench2Drive 是 CARLA 闭环，不等于真实道路；NAVSIM-v2 是两阶段伪闭环。不同 baseline 沿用各自训练设置，跨模型收益很有价值，但不等价于严格同算力排名。效率下降也表明主指标提升并非没有行为代价。ECCV 2026 官方论文页与 arXiv 已同时保留，后续应以正式版本更新为准而不删除预印本入口。

## 后续跟进

- 复现 VAD 与 DriveTransformer 两组闭环结果，并按红灯、让行、标志和无关车道分别统计。
- 增加 topology mis-association 攻击，而不只对点深度、漏检和假阳性单独加噪。
- 将规则元素表示接入 radar/camera occupancy，检查显式规则能否改变可行空间而非仅作为语义特征。
