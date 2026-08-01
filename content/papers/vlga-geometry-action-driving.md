---
{
  "id": "vlga-geometry-action-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "3d-reconstruction", "world-models"],
  "title": "VLGA: Vision-Language-Geometry-Action Models for Autonomous Driving",
  "source": "arXiv:2606.12396 / https://arxiv.org/abs/2606.12396 ; project: https://yaojin17.github.io/VLGA",
  "authors": ["Jin Yao", "Dhruva Dixith Kurra", "Tom Lampo", "Zezhou Cheng", "Danhua Guo", "Burhan Yaman"],
  "affiliations": ["Uber AV Labs", "University of Virginia"],
  "comment": "VLGA 给 VLA 驾驶模型增加独立 geometry expert，并用 LiDAR pointmap 重建监督，让语言、视觉、稀疏感知和稠密几何共同服务轨迹规划。"
}
---

## 一句话定位

VLGA 是端到端驾驶 VLA 里把 dense 3D geometry 放回 policy 的代表论文。它不是再加一个语言 prompt 或 perception head，而是在 Mixture-of-Transformers 中加入独立 geometry expert，并通过 per-pixel pointmap regression 监督，让 action expert 能读取更连续的空间结构。

## 论文要解决的问题

VLA 驾驶模型善于生成语言解释和理解场景语义，但规划本质上依赖连续 3D 空间。已有路线要么只给稀疏 3D boxes、lane、occupancy，要么把 3D foundation features 注入语言模型但没有专门几何容量，要么做 geometry-only policy 又丢掉语言推理。论文切入点是：如何同时保留语言、稀疏结构和稠密几何，并让它们都能被动作专家使用。

## 方法和系统设计

- VLGA 使用四个专家：understanding、perception、geometry 和 action。不同专家通过 masked joint attention 交互，action expert 可以同时读取语言、稀疏感知和 geometry token。
- Geometry expert 由 dense pointmap reconstruction 监督，目标来自 LiDAR，避免只用稀疏 box/map 监督导致空间细节不足。
- Perception expert 保留 agent、lane、occupancy 等结构化输出；geometry expert 则承担稠密空间重建，二者不是互相替代。
- 评测包含 nuScenes open-loop 和 Bench2Drive closed-loop，分别验证轨迹误差、碰撞率和闭环 driving score。

## 关键图与可视化结果

![图 1：VLGA 与三类既有 3D grounding VLA 范式的对比](../../assets/papers/vlga-geometry-action-driving-figure-1.png)

图 1 清楚说明论文的定位：稀疏 3D perception 有结构但不够 dense，feature injection 有 dense feature 但没有专门几何专家，geometry-only policy 没有语言。VLGA 试图同时满足 language reasoning、dense spatial grounding 和 dedicated geometry capacity。

![图 2：VLGA geometry expert 重建 pointmap 并叠加预测轨迹](../../assets/papers/vlga-geometry-action-driving-figure-2.png)

图 2 展示 geometry expert 学到的稠密点图。它的作用不是做可视化装饰，而是证明动作模块接收的几何信息包含路面、障碍和周围结构，预测轨迹在这些几何约束下更接近 ground truth。

## 实验结论与证据

论文报告 VLGA 在 nuScenes open-loop 中达到 VLA 方法里的强结果，平均 L2 为 0.50 m，3 秒 collision rate 为 0.18%。在 Bench2Drive closed-loop 中，VLGA 的 driving score 达到 79.08，比最强 prior VLA 高 0.71。定性轨迹图显示，在转弯和邻近车辆场景中，增加 geometry stream 后的轨迹横向漂移更少。

## 应用场景与启发

- 应用场景：需要 VLA reasoning 但又不能牺牲几何精度的端到端驾驶 policy。
- 方法启发：评估 VLA driving 时，可以把“几何是否真正进入 action expert”作为架构审查点，而不是只看是否接入 BEV feature。
- 讨论问题：dense pointmap supervision 是否可以替换为更便宜的 depth/occupancy/world-model latent，还是必须依赖 LiDAR 监督。

## 局限与阅读风险

VLGA 的提升幅度在 closed-loop 分数上不算巨大，说明 geometry expert 的收益仍受模型、数据和 benchmark 饱和度限制。论文没有充分展开 geometry supervision 的成本、LiDAR 可用性和跨数据集泛化。如果后续要复现，应关注监督信号和模型容量的性价比。

## 后续跟进

- 查看项目页是否开放代码、checkpoint 和 pointmap 监督构建流程。
- 与 VLADriveBench 结合，检查 geometry grounding 增强后 CoT/action 因果关系是否也更可靠。
- 复现时优先做 ablation：只加稀疏 perception、只加 dense geometry、同时加入两者。
