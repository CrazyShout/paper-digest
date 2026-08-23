---
{
  "id": "driving-world-model-video",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "DrivingWorld: Constructing World Model for Autonomous Driving via Video GPT",
  "source": "ICPR 2026 / https://doi.org/10.1007/978-3-032-31583-0_19 / arXiv:2412.19505 / https://arxiv.org/abs/2412.19505 / HTML: https://arxiv.org/html/2412.19505v3",
  "authors": ["Xiaotao Hu", "Mingkai Jia", "Xiaoyang Guo", "Qian Zhang", "Xiao-xiao Long", "Wei Yin"],
  "affiliations": ["The Hong Kong University of Science and Technology", "Horizon Robotics", "Nanjing University"],
  "comment": "DrivingWorld 提出基于 GPT 风格视频生成的驾驶世界模型，引入时空融合机制实现高保真长时视频生成（40 秒+），为自动驾驶仿真提供了新的范式。"
}
---

## 一句话定位

DrivingWorld 提出基于 GPT 风格自回归生成的驾驶世界模型，通过时空融合的 token 预测策略实现高保真、可控的长时驾驶视频生成，视频时长超过 40 秒，是当前 SOTA 驾驶世界模型的两倍。

## 论文要解决的问题

自动驾驶世界模型需要生成高保真、时序一致且可控的未来驾驶视频，用于仿真和规划验证。现有方法在长时生成中面临两大挑战：一是随时间推移产生的漂移（drifting）导致视频质量退化，二是对驾驶动作（如转向、刹车）的精确控制能力不足。核心问题在于如何像语言模型处理文本序列那样，用统一的框架同时建模帧间的时间连贯性和帧内的空间细节。

## 方法和系统设计

DrivingWorld 的核心设计理念是将视频生成建模为 GPT 风格的自回归 token 预测任务，而非扩散模型去噪过程：

- **GPT 风格自回归架构**：采用 Video GPT 架构，将视频离散化为 token 序列，通过自回归方式逐个预测下一个 token 来生成视频帧，与扩散模型本质不同。
- **下一状态预测（Next-state Prediction）**：建模连续帧之间的时间连贯性，确保相邻帧在语义和视觉上保持一致，捕捉驾驶场景的时间演变规律。
- **下一 token 预测（Next-token Prediction）**：在单帧内部逐 token 生成空间细节，捕获每帧图像内的精细空间信息（如车辆外观、道路标线、交通标志）。
- **新型掩码策略（Novel Masking Strategy）**：针对 token 预测设计专门的掩码方案，有效缓解长时自回归生成中的误差累积和漂移问题，使模型在 40 秒以上的生成过程中保持稳定。
- **重加权策略（Reweighting Strategy）**：对不同位置的 token 预测赋予不同权重，使模型在保持全局一致性的同时对关键控制信号（如自车动作）更加敏感，实现精确可控的未来视频生成。

## 关键图与可视化结果

![图 1：DrivingWorld 整体架构——基于 Video GPT 的自回归驾驶世界模型](https://arxiv.org/html/2412.19505v2/x1.png)

该图展示了 DrivingWorld 的核心架构，包括视频 token 化、GPT 风格自回归生成、以及时空融合的预测策略。注意其与扩散模型方法的本质区别：生成过程是 token-by-token 的自回归预测。

![图 2：生成结果对比——DrivingWorld 与其他方法的驾驶视频生成质量比较](https://arxiv.org/html/2412.19505v2/x2.png)

该图展示了生成视频的视觉质量和时序一致性。DrivingWorld 能够生成超过 40 秒的高保真视频，在视觉质量和可控性方面均优于现有方法。

## 实验结论与证据

论文通过实验验证了以下核心结论：

- **长时视频生成**：DrivingWorld 能够生成超过 40 秒的高保真且时序一致的视频片段，时长达到当前 SOTA 驾驶世界模型的两倍。
- **视觉质量优越**：在视觉质量指标上优于现有的驾驶世界模型方法。
- **可控性显著提升**：通过重加权策略，未来视频生成的可控精度显著高于对比方法。
- **缓解长时漂移**：新型掩码策略有效减轻了自回归生成中的长期漂移问题。

代码已开源：https://github.com/YvanYin/DrivingWorld

## 应用场景与启发

- **自动驾驶仿真**：生成长时、高保真、可控的驾驶场景视频，用于闭环仿真测试。
- **训练数据增广**：为规划器和感知模型提供多样化的合成训练数据。
- **方法启发**：GPT 风格自回归生成在驾驶视频领域展现了强大的潜力，将视频生成统一到 "next-token prediction" 框架下是一条值得关注的技术路线。时空融合的预测策略为其他需要长时一致性生成的任务提供了参考。
- **讨论问题**：自回归 token 预测的计算效率如何权衡；token 化过程是否会损失对驾驶安全至关重要的精细信息。

## 局限与阅读风险

- 长时自回归生成的计算开销较大，实时性可能受限。
- 论文中超过 40 秒的生成结果是否在所有场景类型（如极端天气、高密度交通）下均保持稳定，需要进一步验证。
- GPT 风格 token 预测依赖于 tokenizer 的离散化质量，对驾驶场景中细粒度变化（如远距离小目标）的保真度需要关注。
- 可控性虽显著提升，但控制信号的精度上限（如亚米级轨迹跟踪）论文未明确讨论。

## 后续跟进

- 代码已开源，可关注 https://github.com/YvanYin/DrivingWorld 进行复现和实验。
- 跟进 GPT 风格世界模型与端到端驾驶规划器的结合方式。
- 对比扩散模型和自回归模型在驾驶视频生成中的各自优势与局限。
- 关注后续工作是否进一步扩展到多视角、多模态（融合 LiDAR）的场景。
