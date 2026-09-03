---
{
  "id": "star-vlm-radar-supervision",
  "tag": "radar-occupancy-representation",
  "tags": ["radar-occupancy-representation"],
  "title": "STAR-VLM: Spatiotemporal Grounding Vision-Language Models for Motion and Velocity Estimation via Automotive Radar Supervision",
  "source": "arXiv:2608.01535 / https://arxiv.org/abs/2608.01535",
  "authors": ["Pou-Chun Kung", "Aryaman Rao", "Utkrisht Sahai", "Hemanth Murali", "Yi Liu", "Rui-Yu Lin", "Katherine A. Skinner"],
  "affiliations": ["University of Michigan, Ann Arbor"],
  "comment": "STAR-VLM 不要求推理时继续输入雷达，而是用同步 radar range 与 Doppler 自动生成约 90 万点级监督，让相机 VLM 学习运动状态和径向速度。它展示了雷达作为低成本物理教师的潜力，也暴露了径向观测、投影遮挡和 ego-motion 混淆的根本边界。"
}
---

## 一句话定位

STAR-VLM 把车载雷达从“推理时融合模态”改成“训练时物理教师”：将 range、Doppler 和 ego velocity 投影到图像，以视觉标记和像素坐标查询对象运动及径向速度，使 4B VLM 在测试时只看相机也能输出公制运动判断。

## 论文要解决的问题

驾驶 VLM 可以生成合理的动态描述，却常缺少 m/s 级别的公制运动能力。人工速度标注昂贵，仿真监督又有 sim-to-real 缺口；相机光流只能提供投影变化，难以直接分离 ego motion 与目标真实运动。雷达天然给出距离和 Doppler，但点稀疏、只测视线方向速度，并且穿透回波可能来自相机中被遮挡的目标。

## 方法和系统设计

- 在 nuScenes 上把同步前视雷达投影到相机，构建 STAR-Bench-radar；训练约使用 34K 图像和约 900K 雷达点，mini split 约 400 图像用于评测。
- 同时提供像素坐标和红色箭头视觉标记，向 Qwen3-VL-4B 询问运动/静止、相对径向速度与 ego velocity，保持标准文本 SFT，不增加专用回归头。
- 用邻近像素和深度阈值过滤被遮挡雷达点；将径向速度与 ego velocity 联合训练，帮助模型区分观察到的图像运动究竟来自自车还是目标。

## 关键图与可视化结果

![图 1：STAR-VLM 用汽车雷达监督相机 VLM 的运动分类和公制速度推理](https://arxiv.org/html/2608.01535v1/figures_/teaser_figure.png)

图 1 展示论文的核心差异：雷达只在数据构造和训练时提供物理标签，部署时仍可使用相机 VLM；因此结果衡量的是跨模态监督能否进入视觉表征，而不是传感器融合带来的额外输入信息。

![图 2：雷达投影、视觉查询、遮挡过滤和联合运动监督组成的训练流程](https://arxiv.org/html/2608.01535v1/figures_/overview.png)

图 2 同时揭示风险：雷达点到像素的关联本身就是监督接口，任何标定、时序或遮挡错误都会变成语言标签噪声。

## 实验结论与证据

论文报告 motion classification 在人工标注/雷达评测上的准确率约为 0.80/0.94，比较的 SegAnyMo 为 0.73/0.77；径向速度 MAE 约为 1.94/1.37 m/s，比较的 Any4D 为 2.31/3.60 m/s。模型在 TADBench 的 VQA/MCQ 还报告约 0.81/0.72，说明专项公制监督没有完全破坏一般时序问答能力。

消融显示加入 ego-velocity 监督能改善运动分类与速度估计，但某些运动和速度任务的联合训练也会退化，说明“更多物理标签”并非单调有益。证据支持雷达可成为相机 VLM 的自动化公制教师，不支持相机已经恢复完整 3D 速度向量，也不证明这些文本答案能直接安全控制车辆。

## 应用场景与启发

- 应用场景：相机 VLM 的运动自动标注、公制动态问答、雷达辅助预训练，以及低成本动态场景表征。
- 方法启发：4D Radar Occupancy 可把 Doppler 监督拆为可观测径向分量和不可观测切向分量，对后者输出集合或不确定性，而不是回归单一伪真值。
- 研究问题：把点级 QA 换成连续时空 occupancy-flow 监督后，雷达教师能否改善动态边界而不把投影噪声复制到稠密空间？

## 局限与阅读风险

雷达只提供相对径向速度，完整运动仍需 ego-motion 和视觉线索推断；相机遮挡过滤是启发式规则，不能保证所有穿透回波被正确剔除。训练与评测都来自 nuScenes，mini split 约 400 图像，跨雷达规格、天气和标定误差尚未验证。运动问答准确率与下游轨迹、occupancy 或闭环安全没有直接等价关系。

## 后续跟进

- 在不同雷达、不同天气与人为时序偏移下重新标定监督噪声和速度置信区间。
- 用 radial-only、ego-compensated 和 full-vector 三类目标分开报告，避免把不可观测切向速度写成雷达真值。
- 将雷达教师接到 occupancy-flow head，并用 RayIoU、动态占据、速度校准与规划效用联合评价。
