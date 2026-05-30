---
{
  "id": "drivewam-world-action-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "DriveWAM: Video Generative Priors Enable Scalable World-Action Modeling for Autonomous Driving",
  "source": "arXiv:2605.28544 / https://arxiv.org/abs/2605.28544",
  "authors": ["Chen Shi", "Jinrui Xu", "Shaoshuai Shi", "Kehua Sheng", "Bo Zhang", "Li Jiang"],
  "affiliations": ["The Chinese University of Hong Kong, Shenzhen", "Voyager Research, Didi Chuxing"],
  "comment": "DriveWAM 把预训练视频生成模型改造成 video-action policy，用视频动态先验、VLM guidance 和 selective KV memory 支撑长时域 world-action 建模。"
}
---

## 一句话定位

DriveWAM 是一篇 driving world-action model 论文。它的核心想法是：视频生成基础模型已经学到时间动态和运动先验，比静态图文预训练更贴近驾驶；通过把视频和动作流组织成统一 temporal token sequence，可以把生成先验迁移到 action generation。

## 论文要解决的问题

端到端驾驶基础模型常依赖图文 VLM 或 imitation learning，能理解场景但未必学到足够强的连续动态。直接做长时域 video-action rollout 又会遇到历史记忆膨胀和推理成本问题。DriveWAM 要解决的是：如何保留 video diffusion transformer 的大规模动态先验，同时让模型输出驾驶动作，并在长 horizon 内保持可控记忆。

## 方法和系统设计

- 将 pretrained video diffusion transformer 适配为 autoregressive video-action policy，把 video tokens 和 action tokens 放进统一时序流。
- 用 joint flow-matching objective 同时训练视频和动作，保留视频生成架构并适配动作生成。
- 引入 frozen VLM 产生 chunk-specific scene-evolving guidance，并用 selective KV memory 控制长时域 rollout 的视频/动作记忆池。

## 关键图与可视化结果

![图 1：DriveWAM 将视频生成 backbone 改造成统一 video-action policy](https://arxiv.org/html/2605.28544v1/x1.png)

这张图说明 DriveWAM 的架构位置：它不是单独做视频预测后接 planner，而是把视频和动作建模放进同一个 autoregressive policy。

![图 2：selective KV memory 在长时域 rollout 中保留的视频 token 可视化](https://arxiv.org/html/2605.28544v1/x3.png)

这张图支撑 long-horizon efficiency 的主张。读者应关注模型如何选择保留历史，而不是无限增加上下文。

## 实验结论与证据

摘要报告 DriveWAM 在 NAVSIM 和 PhysicalAI-Autonomous-Vehicles benchmark 上取得强 planning performance，并用 4k 到 100k driving clips 的 scaling study 支撑 world-action modeling 的扩展潜力。证据重点是视频生成先验能否转化为动作生成收益，以及 selective memory 是否支撑长时域推理。

## 应用场景与启发

- 应用场景：可规划驾驶世界模型、视频生成先验迁移、长时域 action rollout。
- 方法启发：世界模型不必只服务感知预测，可以和 action policy 统一训练。
- 讨论问题：video-action 联合建模在真实闭环中如何避免生成好看但控制不安全的 rollout。

## 局限与阅读风险

DriveWAM 的结论仍依赖 NAVSIM 和特定 PhysicalAI 子集，真实闭环和硬实时约束需要进一步确认。视频生成 backbone 参数和推理成本可能较高，selective memory 的鲁棒性也需要在长尾交互场景中检验。

## 后续跟进

- 查看项目页和 checkpoint 是否开放。
- 与 SparseWorld 对照 dense video-action prior 与 sparse instance world model 的成本和安全差异。
- 关注 scaling study 的数据质量和标注策略，避免把性能提升简单归因于模型结构。
