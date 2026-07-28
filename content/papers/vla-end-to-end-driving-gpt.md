---
{
  "id": "vla-end-to-end-driving-gpt",
  "revisionOf": "vla-end-to-end-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "world-models"],
  "title": "OpenDriveVLA: Towards End-to-end Autonomous Driving with Large Vision Language Action Model",
  "source": "AAAI 2026 / https://doi.org/10.1609/aaai.v40i16.38386 / arXiv:2503.23463 / https://arxiv.org/abs/2503.23463",
  "authors": ["Xingcheng Zhou", "Xuyuan Han", "Feng Yang", "Yunpu Ma", "Volker Tresp", "Alois C. Knoll"],
  "affiliations": ["Technical University of Munich (TUM)", "LMU Munich / Siemens AG"],
  "comment": "[GPT改] 修正原版“无 arXiv HTML 图片”的判断，并补入训练阶段图、planning action 可视化和更具体的证据边界。"
}
---

## 一句话定位

OpenDriveVLA 是一个面向端到端自动驾驶的 Vision-Language-Action 模型探索。它试图把视觉场景表示、语言指令/问答能力和轨迹规划动作放进统一的多阶段训练框架中。

## 论文要解决的问题

传统端到端驾驶模型通常只从传感器到轨迹，语言理解和可解释性弱；通用 VLM 虽能描述图像，却缺少 3D scene、agent dynamics 和可执行轨迹规划能力。OpenDriveVLA 关注的问题是：如何在开源 VLM/LLM 基础上，加入 3D instance-aware 与 spatial-aware driving representation，并最终输出驾驶轨迹。

## 方法和系统设计

- 视觉侧采用 vision-centric pretraining，包含 3D object detection、tracking、BEV panoptic segmentation 等任务。
- 将 scene、agent、map tokens 投影到语言空间，做 hierarchical feature alignment。
- 训练分阶段推进：Hierarchical Feature Alignment、Driving Instruction Tuning、Agent-Env-Ego Interaction Modeling、Trajectory Planning Tuning。
- 使用 Qwen 2.5-Instruct 作为 LLM 基础，并评估不同 LLM scale 的推理效率。
- 任务覆盖 driving VQA/caption、agent motion prediction 和 instruction-conditioned trajectory planning。

## 关键图与可视化结果

![图 2：OpenDriveVLA 多阶段训练流程，包括层级特征对齐、驾驶指令微调、交互建模和轨迹规划微调](https://arxiv.org/html/2503.23463v2/sec_aaai/fig/drivevla-Training.jpg)

原版写“无 arXiv HTML 版图片”是不对的。arXiv HTML 中有训练流程、视觉预训练、VQA、agent motion prediction 和规划可视化等多张图。

![图 3：OpenDriveVLA-7B 在 keep forward 与 turn right 指令下的 planning action 可视化](https://arxiv.org/html/2503.23463v2/sec_aaai/fig/drivevla-result_vis.jpg)

这张图展示同一场景下语言指令对规划动作的影响，并同时包含 QA 预测示例和 agent motion prediction 可视化。

## 实验结论与证据

论文评估范围包括 nuScenes 相关的 caption/VQA、motion prediction 和 open-loop planning。结果表明，多阶段训练能逐步改善规划安全性和任务表现；消融中加入 hierarchical vision-language alignment 与 agent-environment-ego interaction modeling 后，collision rate 有更明显下降。论文也报告了不同 LLM 尺度下的推理性能，说明大模型路线需要关注延迟和显存。

## 应用场景与启发

- 面向可交互驾驶系统：用自然语言指令影响轨迹规划。
- 面向可解释驾驶：把 VQA/caption 和 planning 训练放在同一框架里。
- 面向端到端系统设计：把 scene token、agent token、map token 显式投影到语言空间，避免只用 2D image token 做空间推理。

## 局限与阅读风险

VLA 路线仍然有明显风险。论文中的 qualitative results 也提到 VQA/scene description 可能出现 hallucination 或视角定位不准；语言指令本身可能模糊或对抗；推理成本较高；实验以 open-loop planning 和离线数据集为主，距离真实闭环部署还有差距。

## 后续跟进

- 查看项目主页和 GitHub 的代码、权重、数据处理是否完整。
- 重点复查 collision rate、L2 error、VQA/caption 指标和推理效率表。
- 对比 DriveVLM、DriveGPT4、UniAD、VAD 等路线，判断 VLA 的真实收益来自语言能力还是结构化场景 token。
