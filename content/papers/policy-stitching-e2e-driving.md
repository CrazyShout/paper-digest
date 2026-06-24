---
{
  "id": "policy-stitching-e2e-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "autonomous-driving-testing"],
  "title": "A Stitch in Time Saves Nine: Preserving Policy Compatibility Under Perception Updates in End-to-End Autonomous Driving",
  "source": "arXiv:2606.21509 / https://arxiv.org/abs/2606.21509",
  "authors": ["Yueyuan Li", "Yifei Xiao", "Mingyang Jiang", "Xiang Zuo", "Songan Zhang", "Ming Yang"],
  "affiliations": ["Shanghai Jiao Tong University"],
  "comment": "这篇论文把端到端驾驶中的感知模块升级问题形式化为 model stitching，目标是在不重训下游策略的情况下保持 latent-policy 兼容性。"
}
---

## 一句话定位

这篇论文讨论的是端到端驾驶系统的维护问题，而不是再提出一个新 planner。端到端模型把感知和决策紧耦合在 latent representation 上，感知模型一升级，后面的 policy 可能因为 latent 分布变化而性能下降。论文提出用轻量 stitcher 对齐 latent 空间，使冻结的下游策略继续可用。

## 论文要解决的问题

真实系统里感知模块会持续迭代：换初始化、换传感器、换训练域、换数据版本都很常见。传统做法是重训或微调整个端到端系统，但这会带来高计算成本和高验证成本。对安全关键系统而言，每次 perception update 都重新做完整策略验证并不现实。论文要解决的问题是：能否用低复杂度 latent alignment，在感知更新后保持下游驾驶策略行为兼容。

## 方法和系统设计

- 问题定义：把更新后的 perception module 和冻结的 policy module 之间的接口看作 stitching 问题。
- Stitcher 设计：测试线性和卷积 stitcher，在 latent feature 层做轻量映射，而不是改动 policy 或做全模型微调。
- 更新类型：覆盖随机初始化变化、传感器配置变化、训练域变化等不同 perception shift。
- 评估重点：看 downstream driving score 是否保持，而不仅是 latent feature 相似度。

## 关键图与可视化结果

![图 1：model stitching 在更新后的感知表征和冻结下游策略之间学习轻量映射](https://arxiv.org/html/2606.21509v1/imgs/diagram/model-stitching.png)

这张图说明论文的工程动机：端到端并不意味着系统不能模块化维护，但模块边界需要显式处理 latent compatibility。

![图 2：卷积 stitcher 在 BEV object detection 监督下恢复目标局部线索的可视化结果](https://arxiv.org/html/2606.21509v1/imgs/stitch_visualization/detection_model1_transform.png)

这张图对应论文的定性证据：stitcher 的价值不只是让 latent 距离更近，而是让冻结策略还能接收到目标位置等 policy-relevant cues。尤其是跨域设置下，论文报告卷积 stitching 能以更短适配时间保留大部分无分布偏移分数。

## 实验结论与证据

论文在多种 perception update 下比较 retraining、fine-tuning 和 stitching。摘要中最强的数字是 nuScenes 到 CARLA 的跨域设置：卷积 stitcher 保留超过 91% 的 no-shift driving score，同时把适配时间从 22.18 小时降到 0.91 小时。这个证据直接对应工程部署问题：当感知栈需要频繁升级时，stitching 可以作为低成本兼容层。

## 应用场景与启发

- 应用场景：端到端驾驶系统持续迭代、传感器替换、感知 backbone 升级、快速回归验证。
- 方法启发：端到端系统也需要“接口稳定性”设计，否则任何上游小改动都会放大成策略级验证成本。
- 讨论问题：stitcher 应该只是临时兼容层，还是可以成为长期维护端到端系统的标准接口。

## 局限与阅读风险

Stitching 解决的是 latent 分布迁移下的兼容性，不保证新感知模型引入的语义错误不会传给策略。跨域实验虽有说服力，但真实道路中的传感器退化、标定误差和极端天气更复杂。论文还需要进一步说明 stitcher 失败时如何被检测，以及其对安全关键长尾场景的影响。

## 后续跟进

- 检查代码开放后能否在现有 BEVFormer/UniAD 类模型上复现。
- 把它和 Bench2Drive-Robust、COMPACT-VA 一起看，形成“部署扰动、上下文压缩、模块兼容”三个工程问题。
- 关注是否能扩展到 V2X 多源感知更新或多传感器缺失场景。
