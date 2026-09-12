---
{
  "id": "care-adaptive-lidar-first-sightings",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "end-to-end-autonomous-driving"
  ],
  "title": "CARE: Camera-Residual Reserves for First Sightings in Adaptive LiDAR Sensing",
  "source": "arXiv:2608.24282 / https://arxiv.org/abs/2608.24282 / HTML: https://arxiv.org/html/2608.24282 / Fixed full text: https://arxiv.org/html/2608.24282v1",
  "authors": [
    "Jiachen Gong",
    "Yun Li",
    "Ehsan Javanmardi",
    "Wencan Mao",
    "Manabu Tsukada"
  ],
  "affiliations": [
    "The University of Tokyo",
    "National Institute of Informatics"
  ],
  "comment": "CARE 在固定 LiDAR ray-cell 预算中预留无法被历史轨迹解释的相机方向，改善新目标首次发现。增益存在预算代价，且回放点云、实车感知与 CARLA 检测代理是不同证据层。"
}
---

## 一句话定位

CARE 为自适应 LiDAR 增加一个简单但可检验的补丁：历史轨迹负责重看旧目标，当前相机只把“历史解释不了”的方向放入预留预算。它关心首次出现的行人或车辆，而非把大量重复观测平均后的检测指标当作全部安全证据。

- 核心证据：nuScenes 10% ray-cell 预算下，首次发现召回比 history 高 5.2 点，95% 区间为 [4.3,6.2] 点；整体召回却低 0.8 点。[§5.2、表 1](https://arxiv.org/html/2608.24282v1#S5.T1)
- 主要边界：主实验用已有点云模拟发射选择，尚未实测可转向 LiDAR 的物理扫描与能耗。

## 论文要解决的问题

### 什么是首次发现

新目标没有轨迹，预测旧框再密集扫描也无法给它分配优先级。论文把 first sighting 定为 50 m 内标注对象第一次进入场景的 keyframe，排除场景开头已有对象；标注间断后的再次出现不另计。检测用同类 2 m 中心距离匹配，TTFD 截断于 6 个 keyframes，即 3 s。这套诊断与完整 nuScenes 指标分开。[§3](https://arxiv.org/html/2608.24282v1#S3)

### 相关工作与差异

| 一手工作 | 原有机制 | CARE 的差异及比较限制 |
| --- | --- | --- |
| Shoouri 等，Adaptive LiDAR Scanning，[2025 v1](https://arxiv.org/html/2508.01562v1) | 历史 query 预测 ROI，Gumbel-Softmax 掩码、可微体素化与 CVaR 支持端到端学习 | CARE 加入无历史目标的相机方向；history 基线只是策略层重实现，不是原模型完整复现 |
| Ancha 等，Active Perception using Light Curtains，ECCV 2020；[原文](https://www.cs.cmu.edu/~ILIM/light_curtains/papers/eccv20_pdfa.pdf) | 用检测不确定性与物理约束图、动态规划选择光幕，再迭代更新检测 | CARE 按新相机证据分配角度单元；文中的 uncertainty reserve 是同预算概念对照，不是完整光幕硬件系统 |

## 方法和系统设计

### 先选方向，再看点云

冻结 YOLOX 产生六相机框；旧轨迹作常速度预测并投影；同类预测中心落在某相机框内，就把该框视为已解释。剩余框反投影成无需深度的角度 wedge。共享分配器先保护旧轨迹 hull，再分配 residual reserve，最后用共享种子的随机 floor 补满预算。所有掩码在当前 LiDAR 回波可用之前固定，并保持到下一 keyframe。[算法 1–2](https://arxiv.org/html/2608.24282v1#alg1)

### 预算与残差公式

$$
\lvert S_t\rvert\le B=\operatorname{round}(\beta AE),\qquad
R_t=\{d\in D_t:\operatorname{match}(d)=0\}.
$$

这里 match 为同类匹配指示量：有预测中心落入检测框时为 1，否则为 0。原式 1–2 中，$A=512,E=32$，$β$ 为 10%/20%/35%；$S_t$ 是发射角度单元，不是已返回点的固定比例。预留率 $ρ=0.3$，旧轨迹先占至多 $(1-ρ)B$；相机为空时剩余预算回到 floor，退化为相同 history 策略。匹配用完整预测框，避免遗忘模块人为制造 residual。

$$
d_{\mathrm{guard}}=k_{\mathrm{safe}}(s_0+v_{\mathrm{ego}}T_h),\qquad
m_{\mathrm{unc}}=\left\lceil\frac{\sigma_{\mathrm{pos}}/r}{\Delta\theta}\right\rceil.
$$

原式 3–4 的安全遗忘 SBF 只缩小 guard 之外、正在远离或近静止的 hull。$s_0=2$ m、$T_h=2$ s、默认 $k_{{\mathrm{safe}}}=2$；第二项保留由位置不确定性折算的角度裕量。它是预设保护规则，不是闭环无碰撞保证。

### 训练与因果边界

CARE 本身不训练；YOLOX 阈值 0.25、CenterPoint 十扫输入及边距均冻结。20 个独立场景只训练 learned-scorer 对照。主结果允许同步相机输入，另测延迟一个 keyframe 的严格因果版本，不能把“先于 LiDAR”写成相机处理天然零时延。主要三类策略平均三个 floor seeds，其他基线、官方指标与消融多为单 seed。[§5.1](https://arxiv.org/html/2608.24282v1#S5.SS1)

## 关键图与可视化结果

![原论文图 1：历史、相机 residual 与共享预算](https://arxiv.org/html/2608.24282v1/fig_architecture_care_crop.png)

沿相机与历史两路向右读，掩码先于 retained points，检测结果再更新下一轮记忆。相机框是分配线索，未替代 3D 检测真值。

![原论文图 4：实车与分开采集的相机、点云画面](https://arxiv.org/html/2608.24282v1/figures/fig_vehicle_accv.png)

实车图支持系统曾运行，不能证明可转向 LiDAR 已按掩码物理发射；相机和点云子图来自单独行程。

![原论文图 5(a)：遮挡行人与拥挤背景车辆](https://arxiv.org/html/2608.24282v1/figures/fig_carla_scene.png)

这是场景子图，而非图 5(b) 的距离曲线。卡车后行人解释为何扫描所有已有相机框会稀释稀缺预留预算，统计证据仍见正文实验。

## 实验结论与证据

### 设置与主要结果

150 个 nuScenes validation 场景、6,019 keyframes、4,148 次新进入事件，按场景配对 bootstrap 10,000 次。表中首次召回差值为 CARE−history；mAP/NDS 是原表 2 的原始 0–1 数值。

| 预算 | 首次召回差（百分点；95% CI）↑ | 整体召回差（点） | mAP：history→CARE | NDS：history→CARE |
| --- | --- | ---: | --- | --- |
| 10% | +5.2 [4.3,6.2] | -0.8 | 0.076→0.068 | 0.131→0.124 |
| 20% | +5.2 [4.3,6.2] | -0.5 | 0.097→0.091 | 0.164→0.149 |
| 35% | +4.3 [3.5,5.1] | +0.6 | 0.110→0.111 | 0.169→0.164 |

检测头只输出十类协议中的五类，绝对 mAP/NDS 不能与标准十类榜单直接比较。CARE 与 all-camera 的首次召回统计持平，residual 的主要价值是拥挤场景下释放重复覆盖，而不是额外制造首次发现增益。

### 消融与系统证据

38 场景消融中，10% 预算的无 guard 遗忘使 20 m 内召回下降 1.8 点；默认 guard 为 -0.5 点且区间跨零，但 20% 时仍下降 3.1 点。SBF 因此不是免费改进。相机滞后一帧仍改善首次召回，但深度未知的同类门可能错误解释新目标。[§5.4](https://arxiv.org/html/2608.24282v1#S5.SS4)

真实行程的 104 次新进入中，CARE 更早 17 次、更晚 8 次；车库 p99 97.9 ms 来自 1,000 帧稳态计算，因相机故障使用合成 2D 输入，且不含采集传输。CARLA 共 245 episodes、五 seeds，采用真值相机框和点数检测代理；3% 密集场景中 CARE 首检 15.1 m、all-camera 10.3 m。所有 episode 均未碰撞，不能声称事故率降低。[§5.5–5.6](https://arxiv.org/html/2608.24282v1#S5.SS5)

## 应用场景与启发

- 作者主张：修补历史驱动扫描对未知对象的预算盲点。
- 我的判断：可借鉴事件级首次发现协议以及共享分配器的公平对照；现有证据尚不能核算真实节能。
- 待验证假设：在相同首次召回下，按相机证据年龄降低 reserve 置信度，能减少旧帧误引导而保住拥挤场景覆盖。

## 局限与阅读风险

仅一个冻结检测器组合，前端五类限制与点数门槛影响召回上限；首次事件定义也遗漏重现目标。实车近似标定、相机失效时的合成时延输入、CARLA 的理想检测代理不能拼成完整部署证明。全局 NDS 退步是实际代价，不能被首次召回掩盖。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[固定全文](https://arxiv.org/html/2608.24282v1)与 nuScenes 可访问；定向检索未核到 CARE 官方代码、配置或权重包。检测器有各自上游资源，但不等于本工作完整实现；ACCV 排版不作录用证据。
- 最小实验：取得实现或按算法重建后，固定 10% 预算、相同 floor seeds 和冻结检测器，先用 history、all-camera、CARE 核对基线，再加入一个明确标为本报告提议的年龄降权组：旧轨迹优先级与保护预算不变，相机证据越旧，允许占用的 residual reserve 越小，释放的 ray cells 全部回到同种子的 floor，保持总预算不变。在相同相机延迟 0、0.5、1 s 下，与原 CARE 逐场景配对；降权曲线只在独立校准场景选择，使首次召回落在原 CARE 的预设容忍范围，留出集只评估，不再调参。单列新进入、近场、拥挤场景和全部对象。
- 成功信号：在匹配首次召回的条件下，年龄降权减少过时方向占用，提高近场或拥挤场景召回，且没有增添 ray cells；若首次召回代价越过预设容忍值，就不支持该假设。随后才评估物理发射约束。
- 停止条件：收益来自当前点云泄漏、不同检测器或额外 ray cells；此时先修复协议，不继续报告感知收益。

### 来源与核验记录

固定 arXiv:2608.24282v1；2026-09-12 核对 §3–5、式 1–4、算法 1–3、表 1–2与原图 1、4、5(a)，并阅读两篇相关工作的原始机制。未运行扫描、驾驶或训练实验。
