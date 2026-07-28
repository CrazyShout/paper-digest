---
{
  "id": "driving-world-model-video-gpt",
  "revisionOf": "driving-world-model-video",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "DrivingWorld: Constructing World Model for Autonomous Driving via Video GPT",
  "source": "arXiv:2412.19505 / https://arxiv.org/abs/2412.19505",
  "authors": ["Xiaotao Hu", "Wei Yin", "Mingkai Jia", "Junyuan Deng", "Xiaoyang Guo", "Qian Zhang", "Xiaoxiao Long", "Ping Tan"],
  "affiliations": ["The Hong Kong University of Science and Technology", "Horizon Robotics"],
  "comment": "[GPT改] 修正原版 Figure 2 图注错配：x2 是 vanilla GPT vs temporal-aware GPT 推理示意，不是生成质量对比；改用 Figure 1 和 Figure 4。"
}
---

## 一句话定位

DrivingWorld 是一个基于 Video GPT 的自动驾驶世界模型，用自回归 token prediction 生成可控的未来驾驶视频。它的重点是 temporal-aware tokenization、spatial-temporal fusion、masking/reweighting 策略和长时生成稳定性。

## 论文要解决的问题

驾驶世界模型需要预测未来道路场景，用于仿真、规划或策略学习。扩散式视频生成可以获得高质量图像，但长时一致性、动作可控性和推理效率仍有挑战。DrivingWorld 选择 GPT-style 自回归建模，把驾驶视频离散成 token 序列，再结合 ego pose/action 条件生成未来视频。

## 方法和系统设计

- 训练 temporal-aware VQVAE tokenizer，让视频 token 保留时间一致性。
- 用 temporal-multimodal fusion module 融合历史图像 token、ego orientation/location 等条件。
- 内部状态采用 autoregressive module，不是一次性预测整帧状态。
- 使用 masking strategy 缓解长时 autoregressive drifting。
- 使用 reweighting / balanced attention 等策略增强长期可控生成。

## 关键图与可视化结果

![图 1：DrivingWorld pipeline，展示 tokenizer、world model、decoder 和 ego 条件输入](https://arxiv.org/html/2412.19505v2/x1.png)

这张图展示论文的完整流程：先把前视图像序列离散化，再用 GPT-style world model 预测未来 token，最后解码为未来视频。

![图 4：长时视频生成样例，论文展示 640 frames at 5Hz，即 128 秒的视频片段](https://arxiv.org/html/2412.19505v2/x4.png)

原版把 `x2.png` 标成“生成结果对比”是不对的。`x2.png` 实际是 vanilla GPT 和 temporal-aware GPT 的推理机制示意；真正展示长时生成的是 Figure 4。

## 实验结论与证据

论文在 nuScenes validation set 上和多个视频生成/世界模型方法比较，并报告 FVD、FDE、action controllability 等指标。摘要和正文强调：DrivingWorld 可生成超过 40 秒的视频，超过当时 SOTA 驾驶世界模型两倍；Figure 4 进一步展示了 128 秒样例。消融显示 masking strategy 能缓解 10 帧后快速退化的内容漂移，内部 autoregressive module 对长时生成质量有明显影响。

## 应用场景与启发

- 用作自动驾驶策略训练或评估中的视觉未来预测器。
- 通过 ego action/pose 条件生成不同驾驶行为下的前视视频。
- 为世界模型路线提供一种非扩散、GPT-style 的长时生成方案。

## 局限与阅读风险

论文主要生成前视视频，不是完整多传感器闭环仿真；生成视频的视觉一致性不等于物理正确性或规划安全性。128 秒样例是展示性质，不能直接等同于所有场景都能稳定生成。自回归生成还会带来计算开销和误差累积风险。

## 后续跟进

- 复查代码仓库中 tokenizer、world model 和长时生成配置。
- 对比 Vista、GAIA-1、DriveDreamer、DWM 等驾驶世界模型。
- 关注从视频预测走向闭环规划时如何验证物理一致性和安全约束。
