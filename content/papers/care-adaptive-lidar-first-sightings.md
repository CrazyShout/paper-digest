---
{
  "id": "care-adaptive-lidar-first-sightings",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving"],
  "title": "CARE: Camera-Residual Reserves for First Sightings in Adaptive LiDAR Sensing",
  "source": "arXiv:2608.24282 / https://arxiv.org/abs/2608.24282 / HTML: https://arxiv.org/html/2608.24282",
  "authors": ["Jiachen Gong", "Yun Li", "Ehsan Javanmardi", "Wencan Mao", "Manabu Tsukada"],
  "affiliations": ["The University of Tokyo", "National Institute of Informatics"],
  "comment": "CARE 为历史驱动的自适应 LiDAR 预留相机 residual 预算，专门捕获尚未进入轨迹记忆的新目标；它在 nuScenes 和遮挡行人闭环中改善首次发现，但诚实显示整体 mAP/NDS 不一定同步提高。"
}
---

## 一句话定位

CARE 研究一个容易被平均检测指标掩盖的问题：自适应 LiDAR 会把有限射线预算集中到已有轨迹，因此越擅长跟踪旧目标，越可能错过第一次出现的新目标。论文不把所有相机框都加入扫描，而只为“当前相机看见、历史轨迹解释不了”的 residual 预留预算，并把首次发现、整体覆盖、近场安全和下游制动分别记账。

## 论文要解决的问题

历史驱动扫描可以压缩 LiDAR 数据量，但它依赖过去的 3D 检测和轨迹预测。被遮挡行人、刚进入视场的横穿目标或突然 cut-in 的车辆没有历史，随机 floor 又不知道应该把稀缺射线投向哪里。直接扫描所有相机检测虽然能发现新目标，却会重复覆盖已经被历史轨迹照顾的车辆，在拥挤场景中挤占其他区域预算。

因此真正的设计问题不是“相机能否帮助 LiDAR”，而是在固定 ray-cell 预算下，怎样识别相机提供的增量证据，并保证为旧轨迹释放预算时不会牺牲近场对象。评价也必须从整体 recall 拆出 first-sighting recall，否则新目标改善可能被大量重复观测淹没。

## 方法和系统设计

- LiDAR 视场被离散为 `512×32` 个角度 ray cells，在每个 keyframe 看到当前回波前先固定 10%、20% 或 35% 扫描 mask，避免用答案选择射线。
- 常速度轨迹投影形成历史 exploitation hull；当前 YOLOX 相机框若不能被同类轨迹投影解释，就形成 residual wedge。共享分配器依次保护历史区域、分配默认 30% residual reserve，再放置随机 floor。
- Safety-Bounded Forgetting 只缩小远离或静止、且位于速度相关 guard distance 之外的历史 hull。相机候选为空时 reserve 自动回流，CARE 退化为原 history policy。
- 主实验固定 YOLOX 与 CenterPoint，在 nuScenes validation 的 150 个场景、6,019 个 keyframes、4,148 个 first-sighting events 上做逐场景配对 bootstrap；另以实车序列和 CARLA 遮挡行人场景检查系统与闭环后果。

## 关键图与可视化结果

![图 1：CARE 用历史轨迹 hull、无法解释的相机 residual、共享预算和安全遗忘形成扫描 mask](https://arxiv.org/html/2608.24282v1/fig_architecture_care_crop.png)

Figure 1 的重点是“增量相机证据”：只有未被同类轨迹投影覆盖的框才进入 reserve，而不是把相机检测无条件当成第二套感知真值。读者还应注意 mask 在 LiDAR 返回前生成，这保证 first-sighting 比较没有当前帧泄漏。

![图 4：CARE 使用的 drive-by-wire 实车、前视相机和 LiDAR 云](https://arxiv.org/html/2608.24282v1/figures/fig_vehicle_accv.png)

Figure 4 证明端到端感知链曾在真实车辆上运行，并支持相机时间陈旧度和路径延迟测量；它不等于 steerable LiDAR 硬件已经按 mask 物理发射射线，论文主实验仍是基于回放点云的 ray-cell 仿真。

![图 5：CARLA 中卡车后横穿行人与不同预算下的首次检测距离](https://arxiv.org/html/2608.24282v1/figures/fig_carla_scene.png)

Figure 5 展示密集场景为什么 residual 比 all-camera reserve 更有价值：预算只有 3% 时，把射线分给所有已有车辆会推迟对横穿者的首次发现；到 5% 后几条曲线收敛，说明优势依赖预算紧张程度。

## 实验结论与证据

相对 history policy，CARE 在 10%、20%、35% 预算下把 first-sighting recall 分别提高 5.2、5.2、4.3 个百分点，95% 区间均不跨零；但 overall recall 的差值为 -0.8、-0.5、+0.6 点。更重要的是，CARE 在 10% 和 20% 预算下的 mAP 低于 history，三个预算的 NDS 也都低于 history。论文支持的是“把有限预算移到新目标”，不是“所有检测指标普遍提升”。

消融同样保留代价：延迟一个 keyframe 的相机仍带来 4.6、5.3、2.6 点 first-sighting 增益；无 guard forgetting 在 10% 预算下让 20 m 内 recall 下降 1.8 点，默认 guard 将差异收窄到统计不显著，但在 20% 下默认 SBF 仍下降 3.1 点。深度未知的类别门还会误解释 32.5% 新目标，即便扫描了方向，冻结的 3D 检测器仍漏掉其中 85%。

实车序列包含 104 个新进入事件，CARE 比 history 更早 17 次、更晚 8 次，其余持平；感知路径 p99 为 97.9 ms/100 ms，但该延迟实验的相机失效，2D 阶段使用合成输入。CARLA 共 245 个 episode、5 个 seeds：10% 预算下相机策略约 15 m 检出遮挡行人并 5/5 制动，history 为 11.9 m 和 3/5；所有 episode 均无碰撞，车辆 cut-in 场景没有差异。

## 应用场景与启发

- 应用场景：可转向或稀疏扫描 LiDAR、事件相机、主动视觉，以及任何需要在跟踪旧目标与搜索新目标之间分配预算的感知系统。
- 方法启发：把“首次发现”作为单独事件集，并用当前传感器之间无法相互解释的 residual 定义探索预算，比随机补点更可审计。
- 雷达启发：4D Radar Occupancy 也可把历史 occupied hypothesis 与当前 Doppler/相机无法解释的观测分开，先维护存在性，再决定是否收紧空间 covariance。
- 讨论问题：下游 planner 更在意 first-sighting recall、整体 NDS，还是首次发现距离的尾部分布？不同答案会给出完全不同的最优 reserve。

## 局限与阅读风险

主实验使用一个冻结相机检测器和一个冻结 3D 检测器，且通过已有点云模拟 ray cells，没有真实 steerable LiDAR 的扫描动态、功耗和标定误差。CARLA 使用真值相机框和简化检测代理；实车延迟实验又因相机失效使用合成 2D 输入，因此各条证据不能拼成完整部署证明。

CARE 与 all-camera 在 first-sighting recall 上统计持平，主要优势是同等首次发现下保住更多整体覆盖；但 history 在部分 mAP/NDS 上仍更好。核验时没有发现作者代码、配置、数据包或项目页，ACCV 模板也不构成录用证据，当前只应标为 arXiv 预印本。

## 后续跟进

- 复现 10% 预算下 history、all-camera、CARE 三条 Pareto 曲线，并把规划最小通过距离作为第三个目标。
- 在真实可转向 LiDAR 上测量发射调度、机械/固态扫描约束、端到端尾延迟和相机失配，而不只回放 ray cells。
- 将 residual 扩展为带置信度和来源时间戳的 occupied/free/unknown 更新，检查新目标发现收益能否迁移到雷达中心占据表示。
