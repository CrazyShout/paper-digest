---
{
  "id": "clap-v2x-prompt-optimization",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "cooperative-autonomous-driving", "autonomous-driving-testing"],
  "title": "CLAP: Contrastive Latent-space Prompt Optimization for End-to-end Autonomous Driving",
  "source": "arXiv:2605.17284 / https://arxiv.org/abs/2605.17284",
  "authors": ["Ruiyang Zhu", "Yuehan He", "Boyuan Zheng", "Zesen Zhao", "Ahmad Chalhoub", "Qingzhao Zhang", "Z. Morley Mao"],
  "affiliations": ["University of Michigan", "University of Arizona"],
  "comment": "CLAP 用 V2X 检索 per-roadblock soft prompts 来适配长尾道路片段，试图在不重训 VLA 的情况下改善施工区和复杂让行等困难场景。"
}
---

## 一句话定位

CLAP 是一篇面向端到端驾驶 VLA 长尾适配的 prompt optimization 论文。它不是继续扩大模型或数据集，而是为每个 roadblock 学习 soft prompts，并通过 V2X 按位置检索，让 frozen VLA 在特定长尾路段上改善规划。

## 论文要解决的问题

VLA driving model 在常规场景表现强，但在施工区、复杂让行、临时阻挡等长尾路段容易失效。单纯数据扩展或全模型微调成本高，也可能破坏正常场景表现。论文观察到同一路段在 VLA hidden-state space 中形成紧密簇，但长尾帧和正常帧混杂，直接优化容易相互干扰。CLAP 要解决的是：如何对 roadblock-specific hard scenes 做局部适配，同时不回退正常帧性能。

## 方法和系统设计

- 通过 crowdsourced data 学习 per-roadblock soft prompts，并在车辆行驶到对应位置时经 V2X 检索使用。
- 先用 supervised contrastive learning 找到 roadblock-specific hard-scene direction，再做 directionally regularized prompt optimization。
- 保持 VLA 主体冻结，减少部署时重新训练大模型的成本，并把改动限制在局部 prompt 空间。

## 关键图与可视化结果

![图 1：RecogDrive 在施工区和临停车辆场景中的长尾失败示例](https://arxiv.org/html/2605.17284v1/x1.png)

这张图说明论文关注的不是平均场景，而是局部道路片段里的特殊几何和临时规则。红色轨迹和绿色真值的偏差显示 frozen VLA 对长尾状态理解不足。

![图 2：CLAP 对不同 VLA backbone 的规划改善可视化](https://arxiv.org/html/2605.17284v1/x3.png)

这张图用于判断 soft prompt 是否真的改变了困难帧中的规划，而不是只在隐藏空间中产生可分离表示。

## 实验结论与证据

摘要报告 CLAP 在 NAVSIM 上对多种 VLA backbone 将 challenging scenario planning error 降低 24%，且不损害 normal frames。证据重点是 roadblock-specific prompts 对长尾场景的局部改进，以及 V2X 检索机制把 prompt 绑定到道路位置。

## 应用场景与启发

- 应用场景：固定路段长尾适配、施工区/临时管制区域、V2X 辅助 VLA planning。
- 方法启发：车路协同不一定只传感知信息，也可以传递位置相关的模型适配参数或 prompt。
- 讨论问题：roadblock prompt 如何版本管理、过期失效和安全认证，防止错误 prompt 影响正常驾驶。

## 局限与阅读风险

CLAP 依赖 roadblock-level 数据聚合和 V2X 检索，真实部署需要解决 prompt 发布、校验、隐私和攻击问题。论文展示不回退正常帧，但仍需看 prompt 在分布漂移、道路改造和多模型共存下是否稳定。

## 后续跟进

- 检查是否开放 prompt 优化代码和 NAVSIM 长尾划分。
- 与 ReasonBreak 形成正反两面：语言/prompt 通道既能改善长尾，也会引入新的安全面。
- 后续可以把 V2X 传 prompt 作为协同驾驶新方向，而不只传 objects 或 trajectories。
