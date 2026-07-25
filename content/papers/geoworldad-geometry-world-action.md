---
{
  "id": "geoworldad-geometry-world-action",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "world-models", "3d-reconstruction", "agentic-driving"],
  "title": "GeoWorldAD: Geometry World Action Model for Autonomous Driving",
  "source": "arXiv:2607.17521 / https://arxiv.org/abs/2607.17521",
  "authors": ["Songyan Zhang", "Jinyuan Tian", "Hanbing Li", "Daqi Liu", "Hao Chen", "Wenhui Huang", "Fang Li", "Guang Chen", "Hangjun Ye", "Long Chen", "Kuiyuan Yang", "Chen Lv"],
  "affiliations": ["Nanyang Technological University", "Xiaomi EV", "Zhejiang University"],
  "comment": "把当前 4D 几何、未来深度世界模型和迭代轨迹规划接成同一条世界动作链；它的价值不是再加一个视觉 latent，而是检验显式三维约束能否同时提高安全与通行进度。"
}
---

## 一句话定位

GeoWorldAD 试图修复视觉动作模型的空间落地问题：纯视觉 latent 可以扩展，但不明确表示可行驶区、动态目标与未来自由空间，容易在安全和进度之间失衡。论文以 ego-aligned 4D 几何表征当前场景，以 latent future geometry 预测短时未来，再让规划器逐层聚合多尺度几何并迭代修正轨迹，构成 geometry-world-action 一体化链路。

## 论文要解决的问题

端到端 Vision/Video-Action 模型通常把未来建模压缩在隐空间中，几何监督与动作生成之间缺少稳定接口。只看当前深度会让规划过于保守，只预测视频又可能抓不住细小但关键的空间约束。论文的关键问题是：能否让当前几何负责“哪里不能走”，未来几何负责“哪里即将可走或被占用”，再直接服务轨迹而不是只做辅助重建。

## 方法和系统设计

- EgoStreamVGGT 将连续图像转换为 ego 对齐的 4D 点/深度表征，避免普通视频几何模型在相机与车辆运动叠加时坐标漂移。
- geometry world model 在当前几何上预测短时未来深度 latent，为动态目标和自由空间变化提供前视信息。
- geometry-oriented action model 从粗到细聚合多层当前/未来几何 token，并进行多轮轨迹 refinement，使安全约束与驾驶进度共同进入动作生成。

## 关键图与可视化结果

![图 1：GeoWorldAD 的视频几何、几何世界模型与动作模型](../../assets/papers/geoworldad-geometry-world-action-figure-1.png)

图 1 来自官方源码。当前几何、未来几何和规划并非三个独立头：ego 对齐表征先支撑 4D 重建，未来模型预测短时空间变化，规划器再迭代读取多尺度几何。这个结构提供了可以分别消融的中间证据。

![图 2：不同驾驶场景下的未来深度预测可视化](../../assets/papers/geoworldad-geometry-world-action-figure-2.png)

图 2 展示世界模型预测的未来深度。它可帮助检查模型是否真正追踪车辆、道路边界和可行空间，但深度外观正确仍不等于轨迹因果正确，必须与规划消融一起阅读。

## 实验结论与证据

NAVSIM v1 navtest 上，GeoWorldAD 以单相机获得 91.0 PDMS，No Collision 99.0、Ego Progress 85.9；高于 EponaV2 的 90.4 PDMS 和 DVGT-2 的 90.3。NAVSIM v2 上 EPDMS 为 90.4，Ego Progress 89.1，也高于表中对比方法。

几何表征消融更有解释力：从头训练为 84.2 PDMS，普通 StreamVGGT 预训练为 84.8，改成 ego-aligned 表征升至 87.3，再加入 4D 重建监督达到 89.3。规划器只做一次 refinement 为 87.6，四次 refinement 但只用单层几何为 88.2，使用四层几何并四次 refinement 为 89.3，说明收益来自表征对齐与渐进聚合的组合。

## 应用场景与启发

- 应用场景：单目端到端规划、短时世界模型、驾驶日志的 4D 几何预训练和几何约束轨迹生成。
- 方法启发：世界模型不必只生成 RGB；未来深度/占据等可审计几何可能更容易连接安全约束和规划消融。
- 讨论问题：当未来几何预测错误时，规划器能否识别不确定性并退回只依赖当前几何，而不是被错误未来放大？

## 局限与阅读风险

NAVSIM 指标是非反应式 pseudo-simulation，不等同于真实交互闭环。模型依赖稠密几何与未来监督，训练数据和算力成本没有与纯视觉模型充分对齐比较。当前规划只处理固定长度 clip，论文也承认尚未用 KV cache 做连续流式推理；没有报告真实车辆时延、恶劣天气或跨城市结果。PDMS 提升证明 benchmark 内有效，尚不能证明世界模型具有现实物理可迁移性。

## 后续跟进

- 在同一视觉骨干上分别消融当前深度、未来深度和未来不确定性，检查收益是否被训练监督量掩盖。
- 用世界模型准入阶梯审查未来几何的动作响应、可信时域和失败拒绝能力。
- 将固定 clip 改为流式缓存，并报告延迟、显存和长时漂移对闭环轨迹的影响。
