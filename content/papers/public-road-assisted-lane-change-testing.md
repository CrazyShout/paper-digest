---
{
  "id": "public-road-assisted-lane-change-testing",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "autonomous-driving-security"],
  "title": "Beyond the Proving Ground: Independent Public-Road Testing of Assisted Lane Change Systems using LiDAR",
  "source": "arXiv:2608.26669 / https://arxiv.org/abs/2608.26669 / PDF: https://arxiv.org/pdf/2608.26669",
  "authors": ["Marcello Cellina", "Akos Kriston", "Antonio Migneco", "Davide Maggi", "Stefano Favelli", "Fabrizio Re", "Fabrizio Minarini", "Andrea Nuovo", "Riccardo Dona", "Biagio Ciuffo"],
  "affiliations": ["European Commission Joint Research Centre"],
  "comment": "JRC 团队用车载 LiDAR、RTK-GNSS 和三车协同，在法国 A31 公路独立测试量产 Assisted Lane Change 对 UNECE R79 临界距离的遵从性。27 次试验中出现 6 次潜在越界，考虑测量不确定性后 3 次仍达 99% 置信，但证据只覆盖一个匿名 VUT。"
}
---

## 一句话定位

这篇论文的贡献不是一个新的 ALC controller，而是一套不依赖厂商配合、能在量产功能真实 geofence 内执行的公共道路合规测试方法。测试车队用 LiDAR 估计 approaching vehicle 的距离和速度，用少量 RTK fixed 片段校准测量误差，再把每次 lane change 的实际轨迹放回 UNECE Regulation No. 79 的 critical-distance boundary；它把“证明场测试通过”与“真实 ODD 中每个边界组合都遵从规则”明确区分开。

## 论文要解决的问题

量产 ADAS 的 type approval 通常在封闭 proving ground 上运行少量、可重复的标准场景。Assisted Lane Change 又经常被 geofence 到指定高速路，独立机构若没有厂商协作，可能连功能都无法在试验场触发。与此同时，公共道路上 RTK-GNSS 会因隧道、峡谷和卫星可见性失效，传统高精度双车测量不具备持续可用性。

论文选择 R79 的 Suppression of Lane Change Procedure 作为可测责任：当后车在 lane crossing 时低于由双方速度、0.4 s reaction、3 m/s² deceleration 和 1 s final headway 共同定义的 critical distance，VUT 应拒绝或中止 ALC。问题因此是能否用独立 LiDAR instrumentation 在真实高速路上判断量产系统是否越过该边界。

## 方法和系统设计

- 三车编队包含一个匿名量产 VUT、一个从相邻车道接近的 Take-Over vehicle 和一个 support vehicle。support 通过 ACC 保持与 VUT 的间距，并作为触发 ALC 的相对位置标记，减少人工驾驶误差。
- TO 搭载 Ouster OS1 128-layer LiDAR、commercial vehicle detection/tracking 和相机；VUT、TO、support 搭载 GNSS/INS。LiDAR 以 10 Hz 输出目标位置、速度、航向和尺寸，RTK 只用于量化 LiDAR precision，不作为持续测试信号。
- 测试矩阵覆盖 VUT/TO 100-130 km/h、20-60 m 触发距离和不同 delta-v。turn indicator activation 为 TSP，VUT 跨线为 TSM；每次 TSM 的 bumper-to-bumper distance 与 R79 critical curve 比较。
- 测量不确定性来自 LiDAR position/velocity error 和人工跨线标注的 1 s resolution。作者用 RTK integer-fix 重叠片段估计标准差，再判断潜在 overshoot 是否达到 3-sigma。

## 关键图与可视化结果

![图 1：27 次 ALC 试验在 VUT/TO 速度、速度差和触发距离上的覆盖](../../assets/papers/public-road-assisted-lane-change-testing-figure-1.png)

Figure 3 说明这不是随机自然驾驶日志，而是受现实交通限制的 factorial test matrix。绿色/红色分别表示 completed 与 suppressed，蓝色表示 completed 后仍在 LiDAR range 内、可在 TSM 测量的样本；3 个 completed maneuvers 因超出 LiDAR range 没有 TSM measurement，这一缺失不能被忽略。

![图 2：VUT 115 km/h 时实际轨迹与 R79 critical-distance 曲线](../../assets/papers/public-road-assisted-lane-change-testing-figure-2.png)

Figure 4 的 115 km/h panel 把每次试验的 delta-v、纵向距离与时间轨迹放在同一合规平面。橙色阴影是低于 R79 critical distance 的区域；绿色 completed 轨迹若在 TSM 落入该区域，就是潜在 Critical Completed case。插图放大了低 delta-v 边界附近最难判断的样本。

![图 3：考虑不确定性后的 27 次试验最终分类](../../assets/papers/public-road-assisted-lane-change-testing-figure-3.png)

Figure 5 将证据压缩为最终 ledger：12 次 non-critical completed、6 次 critical completed，其中 3 次是 99% 置信 overshoot、3 次不显著；另有 2 次 non-critical suppressed 与 7 次 critical suppressed。它展示的是这辆 VUT 在该试验域的行为分布，不是市场总体失效率。

## 实验结论与证据

2026 年 3 月的 A31 French motorway campaign 共触发 27 次 ALC，18 次完成、9 次被系统抑制，速度范围 100-130 km/h、触发距离 20-60 m。18 次 completed 中有 6 次在 TSM 的测量距离低于 R79 critical distance，即 33% 的 completed sample 被标为 potential overshoot；其中 3 次在考虑误差后仍达到 3-sigma/99% confidence。

LiDAR 与 RTK fixed 重叠数据给出的 position standard deviation 为 0.83 m、velocity standard deviation 为 1.40 km/h。关键现实约束是两车同时拥有 RTK integer fix 的数据只占 2.3%，反而说明 LiDAR 的可用性高于 RTK；但 lane crossing 仍由人工相机标注，时间 resolution 只有 1 s。

六个 overshoot 都出现在较小 delta-v 区域，测试人员也没有主观感到危险。这意味着结果更接近“规则边界与量产实现的低相对速度 edge case”而非六次 imminent crash。现行 type-approval 只要求一个 VUT 低于 100 km/h 的 critical abort case，本研究覆盖的高速低 delta-v 组合正是 proving ground 程序没有充分覆盖的 ODD 区域。

## 应用场景与启发

- 应用场景：监管机构的 in-service monitoring、量产 ADAS market surveillance、geofenced function 的独立复测和 R79 revision evidence。
- 测试启发：把 regulation boundary 直接变成 scenario coverage coordinate；相比按道路片段收集日志，这更容易知道哪些组合尚未被验证。
- 工程启发：高可用 LiDAR 可以承担公共道路相对测量，稀疏 RTK fixed 片段只用于 uncertainty calibration，从而降低对连续高精度 GNSS 的依赖。
- 讨论问题：当规则在低 delta-v 区域给出保守边界而驾驶员主观风险很低时，应修订规则、改进实现，还是增加更接近伤害后果的独立 safety metric？

## 局限与阅读风险

研究只测试一个匿名 VUT 的一个 ALC implementation，27 次操作远不足以估计车队或市场 prevalence。试验发生在单条法国高速、有限天气和交通条件下，system version、车辆品牌和具体传感策略因商业/监管原因没有公开，难以跨产品复现。

LiDAR 位置误差为 0.83 m，人工 TSM 标注只有 1 s resolution；三次不显著 overshoot 对这些误差高度敏感。support vehicle 的 ACC、TO 对 VUT lateral motion 的提前减速，以及不固定的 TSP-to-TSM delay 都改变了目标 test matrix。论文没有开放原始轨迹、标注、VDT pipeline 或自动化 scenario controller，当前也只有 arXiv v1。

## 后续跟进

- 在多个 VUT、软件版本和国家高速路上复现同一 R79 boundary coverage map，避免把单车 edge case 外推为行业结论。
- 把 lane marking crossing 改为高帧率自动视觉/LiDAR event detection，显著降低 1 s temporal uncertainty。
- 公开去标识化的相对轨迹、sensor validity mask 和 uncertainty calculation，允许第三方重算 3-sigma 分类。
- 将规则越界与 TTC、required deceleration、driver intervention 和 near-miss 指标并列，区分形式不合规与实际风险。
