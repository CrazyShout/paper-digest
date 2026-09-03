---
{
  "id": "geowam-geometry-world-action-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving", "dynamic-scene-representation"],
  "title": "GeoWAM: Visual Geometry World Action Models for Autonomous Driving",
  "source": "arXiv:2608.23486 / https://arxiv.org/abs/2608.23486 / HTML: https://arxiv.org/html/2608.23486v2 / Project: https://yiren-lu.com/project_pages/geowam/",
  "authors": ["Yiren Lu", "Xin Ye", "Jiaming Liu", "Philip Jacobson", "Jin Yao", "Yi-chung Chen", "Liam Merino", "Dhruva Dixith Kurra", "Min Cai", "Tom Lampo", "Yu Yin", "Danhua Guo", "Burhan Yaman"],
  "affiliations": ["Uber AV Labs", "Case Western Reserve University"],
  "comment": "GeoWAM 不再预测未来 RGB，而把多视图图像解码成未来稠密点图，再让轨迹头读取预测几何；它在 NAVSIM v2 达到 90.2 EPDMS，但缺消融、真实闭环和公开实现。"
}
---

## 一句话定位

GeoWAM 把驾驶世界模型的预测空间从像素改成 metric geometry：模型先预测未来 4 秒的稠密点图和几何 token，再让 ego action head 读取这些未来几何生成轨迹。它最值得关注的不是 0.6 分榜单增益，而是提出一个更直接的场景表示接口：如果 planner 的动作发生在三维空间，world model 是否也应该先预测显式三维变换，而不是让规划头从未来 RGB latent 中重新解几何。

## 论文要解决的问题

视频世界模型可以生成外观连贯的未来，但像素同时混合几何、运动、纹理和光照。即使视频 FVD 很低，planner 仍需从二维变化中恢复距离、道路边界和对象运动，生成质量与可行动性之间没有直接保证。现有 WAM 再接一个 action head，也不代表预测状态已经与轨迹空间对齐。

GeoWAM 的问题定义因此是：能否用视觉输入直接学习未来三维场景变化，并让同一几何预测成为轨迹解码的条件。这样可把世界预测误差写成点图深度与法向误差，也能检查预测结构是否随转弯、直行和动态车辆合理演化。

## 方法和系统设计

- 几何编码器由 DVGT-2 初始化，把三帧历史、最多八路相机转换为多层 geometry tokens 与 ego tokens；未来解码器使用时间、视角和二维位置嵌入，通过因果时间注意力和历史交叉注意力预测 8 个未来步骤。
- Point DPT 将未来 token 解码为 ego 坐标系中的稠密三维 point map 与 confidence map。训练同时使用未来特征余弦对齐、点回归、置信度回归和多尺度表面法向损失，并对当前帧保留几何锚定损失。
- action branch 让 future ego queries 同时读取历史记忆和预测未来几何，随后直接回归单条 `(x, y, heading)` 轨迹；stop-gradient 阻止轨迹损失反向改写已学到的几何预测。
- 几何预训练混合 OpenScene、nuScenes、Bench2Drive、Waymo、KITTI、Argoverse 2 和 DDAD，训练 161 epochs；NAVSIM `navtrain` 再微调 40 epochs。

## 关键图与可视化结果

![图 1：视频世界模型通过像素隐式表达三维运动，GeoWAM 则直接预测未来点图](https://arxiv.org/html/2608.23486v2/GeoWAM_teaser.png)

Figure 1 准确概括论文的表示主张：同样的场景变化，在 RGB 中表现为外观和像素位移，在几何中表现为显式空间变换。它提供的是研究动机，不足以证明几何一定优于像素，因为后续基线比较仍受不同重建管线影响。

![图 2：历史几何记忆、未来点图预测、future pose 解码和轨迹头的完整 GeoWAM 架构](https://arxiv.org/html/2608.23486v2/GeoWAM_pipeline.png)

Figure 2 显示 world model 与 action head 的真正接口是预测 geometry tokens，而非最终渲染图。stop-gradient 也是关键：规划可以消费几何，但不会为了榜单分数任意扭曲几何预训练目标。

![图 3：左转、直行和右转时聚合的未来点图与连续 ego pose](https://arxiv.org/html/2608.23486v2/GeoWAM_viz.png)

Figure 3 展示道路标线、树木、杆体和其他车辆在 4 秒预测中的结构保持。它说明点图具备可读性，但只有三个定性案例，没有失败样例、动态对象分项误差或点图不确定性校准。

## 实验结论与证据

nuScenes 几何预测中，GeoWAM 在 1-4 秒的 Abs Rel 为 0.228、0.245、0.256、0.297，八帧均值 0.257；Epona 先生成 RGB、再经 DVGT 恢复几何的均值为 0.274。GeoWAM 的 `δ<1.25` 均值为 0.754，对照为 0.655，但 1 秒时 Epona+DVGT 的 0.732 仍高于 GeoWAM 的 0.708，说明优势不是每个时域、每个指标都成立。

NAVSIM v2 `navtest` 上，GeoWAM 达到 90.2 EPDMS，较同一 DVGT-2 初始化的 89.6 提高 0.6 分；EP 为 87.0，低于 DVGT-2 的 87.9，而 EC 从 77.0 提高到 86.8。`navhard` 两阶段 pseudo-closed-loop 得分 36.6，略高于 EponaV2 的 36.1。证据支持未来几何可改善综合规划分，增益主要来自哪些行为仍需要机制消融。

视频基线必须先生成 RGB 再通过 DVGT 重建点图，因此其数字同时包含视频预测误差和重建误差，不能把差距完全归因于“像素状态不如几何状态”。当前稿没有移除 future geometry、替换 action conditioning、不同预训练数据量等消融，也没有随机种子、置信区间或显著性检验。

## 应用场景与启发

- 应用场景：planning-oriented world model、未来 occupancy/point-map forecasting、候选轨迹条件化场景预测和闭环重规划。
- 方法启发：世界模型中间状态应能被独立解码和校准；点图比视频 latent 更容易接到距离、可行驶区和碰撞检查。
- 雷达启发：可把未来 geometry token 改造成 radar-conditioned occupied/free/unknown 与 velocity field，让 Doppler 直接约束动态变换，而不是先补成 RGB。
- 讨论问题：若未来几何预测准确但 planner 得分没有提高，问题在状态表达、action conditioning，还是 NAVSIM 的评价函数？

## 局限与阅读风险

`navhard` 是 3DGS 重渲染形成的两阶段 pseudo-closed-loop，不是反应式交通或真实车辆闭环。几何预训练没有公开各数据集样本量、混合权重和 split 边界，无法从论文独立确认 nuScenes validation 是否完全隔离。点图监督依赖既有几何系统和稠密目标，其噪声也会被模型继承。

论文没有消融、方差、失败案例或端到端延迟，榜单增益只有 0.5-0.6 分。官方项目页内容完整，但核验时没有公开代码、配置、checkpoint 或预计算点图；页面中的实现仓库入口不可访问，不能写成代码已开放。当前版本只有 arXiv v2，没有正式 venue 或 accepted 证据。

## 后续跟进

- 等实现发布后，优先复现 DVGT-2、只做 future geometry、再接 action head 的严格增量消融。
- 分别测静态表面、动态对象、道路拓扑和 ego pose 的几何误差，检查哪些误差真正决定 EPDMS。
- 在反应式 simulator 中让候选动作改变他车响应，验证预测点图是否对 action 具有因果敏感性，而不只是日志未来外推。
