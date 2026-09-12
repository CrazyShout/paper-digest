---
{
  "id": "perspective-shift-optical-sensor-attack",
  "tag": "autonomous-driving-security",
  "tags": [
    "autonomous-driving-security"
  ],
  "title": "Perspective-Shift Attacks Against Optical Perception Sensors: A Novel Attack Vector on LiDAR and Camera",
  "source": "VehicleSec 2026: https://www.usenix.org/conference/vehiclesec26/presentation/calipari / DOI: https://doi.org/10.5281/zenodo.20395591 / Official PDF: https://zenodo.org/records/20395591/files/DTF_Vehiclesec2026.pdf",
  "authors": [
    "Marco Calipari",
    "Michael Kühr",
    "Dominik Kulmer",
    "Maximilian Luedecke",
    "Mohammad Hamad",
    "Sebastian Steinhorst"
  ],
  "affiliations": [
    "TUM School of Computation, Information and Technology, Technical University of Munich",
    "TUM School of Engineering and Design, Technical University of Munich"
  ],
  "comment": "光学视场偏移会让检测分数仍正常而几何位置失真；论文有数字与真实传感器证据，但研究车由人工驾驶，尚不能称已验证自动驾驶闭环事故。"
}
---

## 一句话定位

Perspective-Shift 研究光学视场整体偏移：对象仍可能被高置信度识别，方向和位置却不再可信。论文结合数字仿真、实验室传感器与人工驾驶研究车数据，证明几何链路会受影响；没有展示自动驾驶车辆因攻击实际驶入对向车道。

## 论文要解决的问题

### 威胁前提与相关工作

本文假设攻击者有一次物理接近目标传感器的机会，改变其外部光路，但不需要模型梯度。DTF 是固定光学偏转材料，部署后不能任意在线调整。它与远程查询或仅修改环境物体的威胁模型不同。

| 相关原文 | 作用对象 | 本文区别 |
| --- | --- | --- |
| Cao 等，CCS 2019，[LiDAR 感知攻击 §3/5](https://arxiv.org/pdf/1907.06826v2) | 伪造回波，诱导近处障碍物感知。 | 改变传感器可见方向，不以伪造某个障碍类别为目标。 |
| Eykholt 等，CVPR 2018，[RP2 §3](https://arxiv.org/pdf/1707.08945v5) | 约束物体表面的扰动，使分类错误跨视角保持。 | 薄膜位于传感器侧，对整片可见几何起作用；不是针对同一模型和预算的强弱比较。 |

## 方法和系统设计

### 几何解释

原文式 5 用水平角范围表示视场变化：

$$
\mathrm{HFoV}_{\mathrm{PSA}}=[\theta_{\min}+\Delta,\theta_{\max}+\Delta].
$$

$\Delta$ 是光学偏转角，不是模型输出误差。传感器仍按原标定解释光线，因此输出位置可能系统性错位。本文主要测试 20° 水平偏移；它是所选材料和实验条件，未证明是最小有效角度。

数字 LiDAR 实验基于 KITTI odometry，以 150° 水平视场比较偏移前后 KISS-ICP；基准是相同裁剪视场下无偏移的算法输出，不能把其差值当作相对 GNSS 的绝对定位误差。相机从球面图重投影，再用 HybridNets 检查车道几何。[官方全文 §4](https://zenodo.org/records/20395591/files/DTF_Vehiclesec2026.pdf)

### 训练、实测与防御

主要检测器使用既有权重，未训练一个新的攻击神经网络。实验室先验证实际光路偏转；道路数据由人工持续控制的研究车在低交通区域以 10–50 km/h 采集，随后分析传感器输出。LiDAR、相机和同时受影响的双模态分别评估，并非独立多模态冗余一定失效的完整系统证明。

LiDAR 防御利用反射率频谱的高频能量比，按式 8 整理为：

$$
\mathrm{HFR}=\frac{\sum_{f>f_c}|R(f)|^2}{\sum_f|R(f)|^2}.
$$

$R(f)$ 是空间反射率序列的 FFT，$f_c$ 是选定截止频率；低于正常参考阈值时报警。相机方案检查固定车身部件的几何形状。两者利用所选材料的物理伪影，仍缺乏跨传感器误报率、检测延迟和阈值迁移的完整评估。[§6](https://zenodo.org/records/20395591/files/DTF_Vehiclesec2026.pdf)

## 关键图与可视化结果

![原论文图 1：视场变化对里程计和车道几何的影响示意](../../assets/papers/perspective-shift-optical-sensor-attack-figure-1.png)

先看传感器光路，再比较上、下方里程计与车道输出。它说明高置信度识别与正确几何可能分离，不是事故成功率统计。

![原论文图 2：20° 视场偏移的数字仿真样例](../../assets/papers/perspective-shift-optical-sensor-attack-figure-2.png)

上方是 KITTI 点云的数字处理，下方是球面道路图的重投影。左右偏移与中间基准支持仿真机制，不能用这张图证明实物薄膜已改变真实传感器；物理证据另见原图 5/6，研究车结果见图 8/9。

## 实验结论与证据

### 哪些量真正测过

| 官方原表/图及条件 | 结果 | 解释边界 |
| --- | --- | --- |
| 图 8：研究车 LiDAR，120° FoV、20° 偏移 | 相对 GNSS 的估计轨迹横向偏差约 100 m | 是估计位姿漂移，不是车辆实际横移 100 m。 |
| 表 2：PointPillars 的 Car 平均置信度 | 68.39% → 68.90% | 位置受影响时分数仍可能保持。 |
| 表 3：相机 Car 平均置信度 | Faster R-CNN 95.33% → 95.10%；YOLOv10 79.69% → 78.30% | 两模型检测阈值分别为 0.8、0.5。 |
| 表 4：YOLOv10 的限速 30 标志 | 87.34% → 72.28% | 不是所有类别只轻微变化。 |

表 2 中 PointPillars 的 Bike 为 69.39% → 0%，因此不能把“平均置信度变化小”推广为所有对象均保留。不同视场中出现的对象数量也不同；对已检出对象求平均置信度，不能代替固定真值集合的召回、AP或定位误差。原文图 9 显示车道消失点错位，但未报告完整规划闭环后的碰撞统计。

## 应用场景与启发

- 作者主张：视场完整性应作为传感器安全的独立验证项。
- 我的判断：适合外罩、维护及标定后的验收；应联合几何一致性和检测置信度，而非只检查是否还能识别汽车。
- 待验证假设：固定车身参考与 IMU/轮速的几何残差联合检测，可能比单独 HFR 更能区分光学异常和普通照明变化；这仍需验证。

## 局限与阅读风险

作者指出真实薄膜会带来材料相关伪影，所提防御也可能依赖这些伪影。覆盖面积、外壳、传感器波段和有限 FoV 会改变结果。实验中的人工驾驶保障了数据采集安全；潜在对向车道侵入是风险推断，不是已经观察到的自动驾驶行为。缺少跨材料阈值和完整误报统计时不能称防御已解决问题。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[作者仓库](https://github.com/tum-esi/PSA) 有 LiDAR/相机数字仿真和检测代码；README 链接 [参考测量数据 DOI](https://doi.org/10.14459/2026mp1852693)。已核实代码树和数据入口，未下载测量包或模型权重，未验证全部环境可运行。
- 最小验证：先使用发布的正常/偏移记录，固定帧同步与检测阈值，复算共同可见对象的位置误差和召回，再对比置信度阈值、HFR 与车身几何残差。
- 成功信号：几何检测在不同正常照明下仍能提前识别偏移，且召回统计不依赖视场中对象的更换。
- 停止条件：报警主要依赖特定薄膜纹理，或正常遮挡造成同等误报；先校准传感器条件，不进入车辆控制验证。

### 来源与核验

依据 [VehicleSec 2026 正式页面](https://www.usenix.org/conference/vehiclesec26/presentation/calipari) 及 [官方 PDF](https://zenodo.org/records/20395591/files/DTF_Vehiclesec2026.pdf)，2026-09-12 阅读 §3–8、表 2–4、式 5/8，核对 PDF 首页并逐张打开保留图 1/2。相关比较依据两篇攻击原文；本次仅文献整理。
