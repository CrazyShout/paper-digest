---
{
  "id": "driveteach-vla-trajectory-guided-prompts",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "cooperative-autonomous-driving"],
  "title": "Teaching Vision-Language-Action Models What to See and Where to Look",
  "source": "arXiv:2607.01658 / https://arxiv.org/abs/2607.01658",
  "authors": ["Yuguang Yang", "Canyu Chen", "Zhewen Tan", "Yizhi Wang", "Zichao Feng", "Chunyang Liu", "Kehua Sheng", "Juan Zhang", "Linlin Yang", "Baochang Zhang", "Yan Wang", "Bo Zhang", "Xianbin Cao"],
  "affiliations": ["Beihang University", "Institute for AI Industry Research, Tsinghua University", "DiDi", "Communication University of China"],
  "comment": "DriveTeach-VLA 认为驾驶 VLA 不能只靠文字 CoT，要用驾驶视觉蒸馏和 2D 轨迹提示显式教模型看什么、看哪里。"
}
---

## 一句话定位

DriveTeach-VLA 是一篇端到端驾驶 VLA 训练论文。它的判断是：现有 VLA 过度依赖文本问答和语言式 chain-of-thought，容易获得语义解释能力，却没有真正学到动作相关的空间依赖。论文用 Driving-aware Vision Distillation 和 2D Trajectory-Guided Prompts，把“关键目标识别”和“轨迹空间注意力”变成训练信号。

## 论文要解决的问题

VLA 模型进入自动驾驶后，一个常见问题是语言推理看起来合理，但轨迹输出仍可能偏离可行空间。原因在于训练数据常强调物体描述、交通规则问答和文本解释，而不是让视觉 backbone 学到哪些区域与未来轨迹直接相关。DriveTeach-VLA 要解决的是视觉-动作对齐问题：模型需要先学会看与驾驶决策相关的对象和空间，再生成可执行轨迹。

## 方法和系统设计

- TGP-Prompter：从图像和 ego state 中预测 2D Trajectory-Guided Prompt，用于提示模型关注未来轨迹相关区域。
- TGP-Planner：以 2D-TGP 为条件生成轨迹，把视觉注意力和动作输出连接起来。
- Driving-aware Vision Distillation：用 critical-object bounding-box augmented images 监督学生 ViT，使视觉编码器更关注驾驶关键对象。
- 训练流程按 what to see、where to look、how to act 分层推进，包括 DVD pretraining、TGP-guided SFT 和 TGP-guided GRPO。

## 关键图与可视化结果

![图 1：DriveTeach-VLA 总体架构，包含 TGP-Prompter、TGP-Planner、DVD 和 2D-TGP 训练链路](../../assets/papers/driveteach-vla-pipeline.png)

这张图来自 arXiv source 中的官方 `pipeline.pdf`。它展示了论文的关键观点：VLA 的语言推理和轨迹 token 不是孤立生成，而应被显式的 2D-TGP 空间提示调节。

![图 2：DVD 预训练和 2D-TGP 可视化，把 BEV expert trajectory 映射到图像空间作为注意力监督](../../assets/papers/driveteach-vla-dvd-tgp.png)

这张图解释“where to look”的监督来源。它不是简单给模型看更多图像，而是把专家轨迹通过相机模型投影到图像平面，使视觉注意力和未来驾驶动作产生可训练关联。

## 实验结论与证据

论文在 NAVSIM 和 nuScenes 上报告 DriveTeach-VLA 达到 SOTA，并给出注意力可视化，显示模型相比 Qwen2.5-VL SFT baseline 更关注驾驶关键区域。这里的证据重点不是单一榜单分数，而是训练信号设计：DVD 改善“看什么”，2D-TGP 改善“看哪里”，GRPO 再面向动作质量优化。对端到端驾驶方向来说，它提供了一个比纯语言 CoT 更可控的 VLA 训练接口。

## 应用场景与启发

- 应用场景：驾驶 VLA 轨迹规划、NAVSIM/nuScenes 端到端评测、视觉注意力与轨迹可解释性分析。
- 方法启发：与其让 VLA 自己从语言里“悟出”驾驶空间关系，不如把轨迹投影、关键对象和注意力区域变成显式训练任务。
- 讨论问题：2D-TGP 是否会限制模型对不可见风险或 BEV 以外交互的推理能力。

## 局限与阅读风险

2D 图像空间提示依赖相机标定、轨迹投影和专家轨迹质量；当多视角遮挡、远距目标或非视觉线索决定安全时，2D-TGP 可能不足。论文强调 NAVSIM 和 nuScenes 上的性能，但真实闭环部署还需要延迟、失败案例和不同 ODD 下的稳健性验证。

## 后续跟进

- 检查 GitHub 代码是否开放完整训练流程和 2D-TGP 数据生成脚本。
- 与 X-Mind、LWDrive、DriveVer 对比，整理 VLA 中“视觉提示、世界模型、验证器”三种增强路径。
- 后续可尝试把 2D-TGP 和 BEV occupancy/world model supervision 结合。
