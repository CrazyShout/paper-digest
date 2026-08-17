---
{
  "id": "lgs-gaussian-structure-driving-reconstruction",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction"],
  "title": "Learning Gaussian Structure: Intervention-Guided Density Control for Feed-Forward Driving Reconstruction",
  "source": "arXiv:2608.11077 / https://arxiv.org/abs/2608.11077 / HTML: https://arxiv.org/html/2608.11077",
  "authors": ["Hang Li", "Jiahe Li", "Meiying Gu", "Jin Zheng", "Lina Yu", "Xiao Bai"],
  "affiliations": ["School of Computer Science and Engineering, Beihang University", "State Key Laboratory of Software Development Environment and Jiangxi Research Institute, Beihang University", "State Key Laboratory of Virtual Reality Technology and System, Beihang University", "AnnLab, Institute of Semiconductors, Chinese Academy of Sciences"],
  "comment": "LGS 让前馈 3DGS 不再被初始化 LiDAR 点数固定：训练时对 Gaussian 做 prune/add 干预，用邻域渲染梯度变化监督密度策略，推理时直接决定增删；同时显式检索跨帧邻居。Waymo 上 PSNR 28.04 dB、LPIPS 0.113。"
}
---

## 一句话定位

LGS 把 feed-forward driving reconstruction 的学习对象从“固定 Gaussian 集合的连续属性”扩展为“Gaussian 的组成与属性”：训练时用可控 prune/add 干预判断某个 primitive 是否值得保留或复制，推理时由 learned policy 一次前向调整密度，不再依赖逐场景 3DGS 优化。

## 论文要解决的问题

LiDAR-anchored 前馈 3DGS 常把每个输入点对应一个 Gaussian，后续只回归位置、尺度、颜色、透明度和速度。这个设计保留度量几何，但稀疏区域无法新增容量，冗余或错误点也不会删除；共享稀疏卷积虽混合多时间信息，却没有为单个 primitive 显式寻找其他帧证据。

传统优化式 3DGS 可根据长期累积梯度 densify/prune，前馈模型面对未见场景时没有这段优化历史。论文的切入点是：对一个候选做 add 或 prune 后，邻域渲染梯度是否下降，可以作为结构调整是否有益的直接训练信号。

## 方法和系统设计

- 训练时从同一预测 Gaussian 集合建立 original、prune 和 addition 三条干预分支；冻结表征网络，只改变被采样 primitive，比较邻域归一化渲染梯度响应。
- 将响应差构造成 Addition Score 与 Prune Score 监督，Point Transformer V3 根据位置、属性、密度和 decoder feature 学习 Densify Map；干预分支在推理时全部丢弃。
- Cross-Time Point Query 为每个 primitive 检索其他时间戳的 8 个欧氏近邻，均值池化后残差融合，显式补充跨帧状态证据。
- 三阶段训练先学 backbone/跨时查询，再冻结它们学 density policy，最后冻结 policy 微调 backbone，避免结构 target 随表征不断漂移。

## 关键图与可视化结果

![图 1：LGS 用跨时查询预测 Gaussian 属性，并由干预监督的 Densify Map 决定增删](https://arxiv.org/html/2608.11077v1/Method.png)

图 1 显示结构学习和属性学习是两条互补路径：Cross-Time Point Query 改进已有 primitive 的状态，Gaussian Densify Policy 改变集合容量。推理不需要重新渲染三条干预分支。

![图 2：Waymo 新视角合成中，LGS 相对 STORM/UniSplat 保留更清楚的动态车辆边界和静态细节](https://arxiv.org/html/2608.11077v1/Exp_1.png)

图 2 将数值收益落实到动态对象和细结构。它仍是 novel-view rendering 结果，不能直接证明对象运动、碰撞几何或规划策略在重建场景中保持一致。

## 实验结论与证据

Waymo 上，LGS 达到 28.04 dB PSNR、0.885 SSIM、0.113 LPIPS；UniSplat 为 26.28/0.818/0.150。仅加入 density policy，PSNR 从 26.55 升至 27.68；仅加入跨时查询升至 27.31；二者合用达到 28.04，支持结构容量和跨帧属性是互补因素。

固定相同增删率时，随机增删只从 27.31 提升到 27.52 dB，learned policy 达到 28.04，说明收益不只是 Gaussian 数量从约 519.8K 增至 584.2K。PandaSet 上动态区域 PSNR 22.43、DMAE 2.06，完整图像 PSNR 25.03、DMAE 1.52；质量代价是最终 refinement 时间从基础版本 0.37 s 增至 1.92 s，尚非实时渲染。

## 应用场景与启发

- 应用场景：前馈驾驶场景资产生成、仿真初始化、多片段 Gaussian 压缩与密度分配，以及新视角传感器合成。
- 方法启发：结构决策可以通过受控干预获得监督；同样思想可用于 occupancy query 的增删、地图 token 的保留和动态对象轨迹假设管理。
- 研究启发：密度分数不应只优化 PSNR，可加入 occupancy 边界、可见性、对象身份和下游策略一致性，让新增容量服务可验证场景状态。
- 讨论问题：梯度响应较低代表更好解释图像，但是否也会偏爱纹理丰富区域，忽视几何关键却外观简单的道路自由空间？

## 局限与阅读风险

固定 0.7 增删阈值不适合所有场景；背景仍依赖 LiDAR 对齐单目深度和采样天空点。跨时检索使用欧氏近邻，快速运动对象可能匹配到不同物理结构，并增加搜索开销。最终 1.90-1.92 s 级推理距离实时闭环很远。实验终点是渲染与深度误差，没有碰撞体、语义 occupancy、传感器一致性或驾驶策略闭环评价。

## 后续跟进

- 将阈值改为场景和预算自适应，绘制 Gaussian 数量、速度与策略相关质量的 Pareto 曲线。
- 用 scene flow 或对象轨迹替代纯欧氏跨时近邻，专门评测高速动态目标。
- 把增删监督从图像梯度扩展到 occupancy、LiDAR/radar 渲染误差和规划行为一致性。
