---
{
  "id": "roadocc-persist-transport-refresh",
  "tag": "dynamic-scene-representation",
  "tags": ["dynamic-scene-representation"],
  "title": "RoadOcc Learns When to Persist, Transport, or Refresh Memory for Roadside Occupancy Prediction",
  "source": "arXiv 预印本 / arXiv:2609.27677v1 / https://arxiv.org/abs/2609.27677v1 / 固定全文 https://arxiv.org/html/2609.27677v1",
  "authors": ["Xiaokai Bai", "Lei Yang", "Songkai Wang", "Lianqing Zheng", "Siyuan Cao", "Hui-liang Shen"],
  "affiliations": ["College of Information Science and Electronic Engineering, Zhejiang University", "School of Mechanical and Aerospace Engineering, Nanyang Technological University", "School of Automotive Studies, Tongji University"],
  "comment": "把历史搬到正确位置之后，还要决定是否相信它。RoadOcc 用运动与同类支持监督 Persist／Transport／Refresh 路由，在固定预算下改善路侧动态占据；结果不涉及实测 V2X 通信或车辆闭环。"
}
---

## 一句话定位

RoadOcc 面向固定路侧相机，把时序占据拆成三个决定：哪里需要补证据、去历史的哪里读取、这份历史是否应该参与融合。最值得读的是最后一个决定：运动补偿解决了地址偏移，却不保证搬来的内容仍然有效。

- 核心证据：InfraOcc 上动态 mIoU 从 STCOcc 的 27.66 提升到 32.37；在同容量、同稀疏预算的控制实验中，显式路由又把已完成运动补偿的 30.97 提到 32.37。[表 2、5、6](https://arxiv.org/html/2609.27677v1#S4.SS2)
- 主要边界：路由标签检查的是运动条件下的同类别支持，不是同一物体的身份；训练使用真值运动与离线构造的目标，推理才使用预测流。本文没有车路通信成本或闭环驾驶实验。

## 论文要解决的问题

### 问题与假设

输入是四台同步路侧相机的当前图像和缓存的历史特征，输出是三维语义占据与平面速度场。相机固定意味着道路、建筑和路边结构天然处于共同坐标系中，但车会移动：直接复用原坐标的特征，可能把上一帧的车留在路中央；一律丢弃历史，又会损失遮挡处的有效证据。

例如，一辆停着的公交可以读取原位置的历史，一辆行驶中的车需要按速度回到旧位置读取，刚驶入视野的车辆可能根本没有可靠历史。RoadOcc 让这些选择在同一个场景内并存。其假设是：运动状态和语义支持能构成有用的来源偏好；它没有把这种偏好证明成可靠的实例关联。[第 3.1、3.5 节](https://arxiv.org/html/2609.27677v1#S3.SS5)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | RoadOcc 改变的环节与边界 |
| --- | --- | --- |
| Yang 等，InfraOcc／ProSD-Occ，2026 预印本；[原文](https://arxiv.org/html/2608.30657v1) | 建立固定路侧占据基准；先解释静态布局，再用剩余证据恢复动态参与者，最后重组语义 | RoadOcc 在这一观测条件下研究历史地址和来源选择。InfraOcc 的标注会用车端 LiDAR 补静态背景，但不等于 RoadOcc 推理进行车路通信；本文主表未列 ProSD-Occ，不能据此宣称超过全部路侧方法 |
| Liao 等，STCOcc，CVPR 2025；[正式原文入口](https://openaccess.thecvf.com/content/CVPR2025/html/Liao_STCOcc_Sparse_Spatial-Temporal_Cascade_Renovation_for_3D_Occupancy_and_Scene_CVPR_2025_paper.html) | 用占据状态引导稀疏注意力、级联更新和长时动态交互，联合预测占据与场景流 | RoadOcc 继承稀疏、分尺度处理，再显式估计历史读取地址并监督 P/T/R；并不是首次使用时序记忆或动态占据 |
| Kim、Seong、Choi，CRT-Fusion，2024 arXiv 版本；[第 3 节](https://arxiv.org/html/2411.03013v1) | 在车载雷达—相机检测中估计 BEV 速度与占据，按运动递归对齐时序特征 | RoadOcc 进一步区分“地址已纠正”和“此处有可用历史”，且主任务是路侧相机占据。本文中的适配版比较不能等同于 CRT-Fusion 原始检测榜单 |

## 方法和系统设计

### 输入输出与流程

图像编码器和深度辅助的视图转换先建立多尺度体素特征。随后在 1/8、1/4、1/2 三个尺度依次执行 DCA、VVE 和 VDSF，再解码为完整占据。

**DCA，动态感知交叉注意力。** 它综合“当前语义与静态假设的差异”和“当前动态类概率”，决定哪些位置需要第二次从图像取信息。这不是直接把低分体素清空；没有入选采样点的位置仍保留残差路径。训练使用随机采样阈值，推理固定为 0.5。

**VVE，多尺度体素速度估计。** 先压缩体素高度，再在当前和历史 BEV 的局部 5×5 邻域建立相关性体，估计时序运动；当前外观、较粗尺度速度与时序对应共同产生动态流。序列开始没有历史时，历史门控为零。

**VDSF，速度引导的动态稀疏融合。** 根据动态候选与非空概率选择固定数量的位置，对这些位置使用较长历史；其余背景保留较短、固定坐标的记忆路径。三尺度分别取 2000、512、128 个 token，历史长度分别为 8、4、2。路由器在原位置历史、运动回溯历史和当前证据间产生一个归一化分布。[第 3.2–3.5 节](https://arxiv.org/html/2609.27677v1#S3.SS2)

### 关键公式与直觉

原文式 1 定义运动回溯的地址：

$$
\widetilde{\mathbf h}_{t-\Delta t}(\mathbf x)=\operatorname{Sample}\bigl(\overline{\mathbf h}_{t-\Delta t},\mathbf x-\Delta t\,\mathbf v_t(\mathbf x)\bigr).
$$

$\mathbf x$ 是当前体素位置，$\Delta t$ 是历史间隔，$\mathbf v_t$ 是平面速度，$\operatorname{Sample}$ 用三线性插值读取历史特征。若车向前行驶，当前位置的证据应向后回溯。这个式子只决定“读哪里”，没有保证所读内容属于当前对象。[式 1](https://arxiv.org/html/2609.27677v1#S3.E1)

式 7 的训练标签可写为：

$$
z_t(\mathbf x)=
\begin{cases}
P,&\lVert\mathbf v_t(\mathbf x)\rVert\leq\epsilon\ \land\ \operatorname{Supp}(\mathbf x),\\
T,&\lVert\mathbf v_t(\mathbf x)\rVert>\epsilon\ \land\ \operatorname{Supp}(\mathbf x-\Delta t\,\mathbf v_t(\mathbf x)),\\
R,&\text{其他情况}.
\end{cases}
$$

$\operatorname{Supp}$ 检查历史在同一高度、一个体素半径内是否存在同类别占据，$\epsilon=10^{-3}$ m/s。静止目标只检查固定地址，运动目标只检查回溯地址；指定地址没有支持就标为 Refresh，即使另一个地址碰巧存在同类也不改选。监督因此是“运动条件下的来源偏好”，而非三个来源之间任意挑一个有同类的地方。构造标签用 GT motion；未来占据仅用于离线目标构造，不能混入推理。[式 7](https://arxiv.org/html/2609.27677v1#S3.E7)

式 8 将三种候选组成软混合：

$$
\mathbf h_t^{\mathrm{PTR}}=\alpha_P\mathbf h^P+\alpha_T\mathbf h^T+\alpha_R\mathbf q_t,
\qquad(\alpha_P,\alpha_T,\alpha_R)=\operatorname{softmax}(\psi(\cdot)).
$$

$\mathbf q_t$ 是当前观测，即 Refresh 不取历史。三种权重彼此竞争；实际融合使用软概率，argmax 只用于诊断图。最近历史生成的来源标签还会被共享给有效记忆槽，不能保证每个较远历史地址都正确。[式 8](https://arxiv.org/html/2609.27677v1#S3.E8)

### 训练与推理

训练联合深度、语义、运动和路由目标；后两者分别监督“地址”和“来源”。路由损失只作用于有效动态体素。骨干为 ResNet-50，图像 256×704，AdamW 训练 24 epochs，初始学习率 $5\times10^{-4}$、weight decay $10^{-2}$，使用余弦退火。

推理接收当前图像、预测的动态流与历史缓存，不接收未来真值或 GT 路由。三尺度先粗后细更新；固定路侧坐标下无需逐帧处理自车坐标变化，训练时则会协调不同 BEV 增强变换。论文没有给出可直接验证的完整在线时延、峰值显存与部署硬件预算。[第 3.6、4 节](https://arxiv.org/html/2609.27677v1#S4)

## 关键图与可视化结果

![原论文图 4：四相机、多尺度DCA—VVE—VDSF与占据解码](../../assets/papers/roadocc-persist-transport-refresh-figure-4.png)

先沿上半部分从四相机读到多尺度体素，再看下方的三个问题：红框选择需要更新的位置，蓝框估计历史地址，绿框决定采用哪种来源。右下 Refresh 旁的叉表示不读取历史，不是删除当前目标。图展示的是固定路侧感知管线，没有车辆间消息传输。[官方图 4](https://arxiv.org/html/2609.27677v1#S3.F4)

![原论文图 7：在真值动态区域上显示预测Persist、Transport与Refresh](../../assets/papers/roadocc-persist-transport-refresh-figure-7.png)

上排给出 GT／预测占据、GT 流和融合特征，下排分别显示预测 P、T、R，再与最右的 GT 路由对照。蓝、橙、绿区域帮助理解三种来源偏好。但这些可视化已固定在真值动态支持上，未检测到的对象可能根本没有进入展示，因此不能用下排的干净颜色推断完整场景召回或可靠实例身份。[官方图 7、第 4.2 节](https://arxiv.org/html/2609.27677v1#S4.F7)

## 实验结论与证据

### 设置与指标

InfraOcc 含 290 个连续路侧序列，215 个训练、75 个评估，间隔 0.5 s。四相机预测 $[-64,64]\times[-64,64]\times[-4.8,1.6]$ m 内的占据，输出体素边长 0.4 m。协议映射到 18 个状态，但语义 mIoU 排除 construction vehicle、trailer、other flat 和 Free；Free IoU 单列。因此不能将 mIoU 描述为全部 18 类平均。

Dyn. 是六个动态类别的平均 IoU；Direct MAVE 是所有 GT 动态体素上的速度误差，越低越好。TP-MAVE 只统计语义匹配的体素，必须同时看动态语义召回 DSR，否则漏检困难对象也可能让条件误差变小。Nxt. 为下一帧动态 IoU；这些都属于感知／短期状态指标。[第 4 节](https://arxiv.org/html/2609.27677v1#S4)

### 主要结果与比较

| 位置与条件 | 对照／RoadOcc | 指标 | 比较边界 |
| --- | --- | --- | --- |
| 表 2，InfraOcc 统一 evaluator | STCOcc／完整模型 | 全部语义 mIoU 60.85／65.29；Dyn. 27.66／32.37 | 增加整条 DCA–VVE–VDSF–P/T/R 管线，不是仅替换一个门控 |
| 表 2，同一设置 | STCOcc／完整模型 | Pedestrian IoU 22.85／22.66 | 总体提升仍伴随行人类下降 0.19 点 |
| 表 3，速度与覆盖 | STCOcc／完整模型 | Direct MAVE 1.946／1.669 m/s；DSR 57.12／61.11% | 速度误差与动态恢复共同改善 |
| 表 6，同容量和预算，三种子 | 无 P/T/R／完整路由 | Dyn. $30.97\pm0.27$／$32.37\pm0.11$ | 单列来源路由的 1.40 点增益；误差条为种子间标准差 |
| 第 4.1 节，Occ3D-nuScenes | STCOcc／完整模型 | 全部 mIoU 44.60／45.01；Dyn. 39.01／39.80 | 对照值由原文给出的增益相减计算；属于完整模型迁移，未隔离路由贡献 |

主结论更适合表述为“这个固定路侧协议下的动态占据改善”。对 CRT-Fusion 加入 VDSF P/T/R 后，DSR 从 57.56 增至 59.45%，但 TP-MAVE 从 1.839 变为 1.958 m/s，说明覆盖变化与条件误差可能朝不同方向走，不能只选有利的一列。[表 3](https://arxiv.org/html/2609.27677v1#S3.T3)

### 消融与证据边界

表 5 保持容量和稀疏预算，固定地址改成 VVE 地址，Dyn. 30.10→30.97，Direct MAVE 2.146→1.690 m/s；再加来源选择后 Dyn. 达 32.37。这比整模型比较更能区分“位置纠正”与“是否复用”。

表 6 中，自适应混合 Gate 为 31.25，加入路由监督但不执行其概率的 State 为 31.88，真正执行软路由的 Full 为 32.37。去掉 Refresh 并重新归一化 P/T 后降至 32.05。三种子结果支持路由对占据的贡献；但 Direct MAVE 的 1.690→1.669 m/s 变化只有 0.021，和约 0.02 的种子标准差接近，不宜单独宣传显著的速度提升。

原文还在相同 1520 个锚点上将间隔从训练的 0.5 s 拉长到 1.5 s，报告 RoadOcc／STCOcc Dyn. 为 33.49／28.58；这不是与默认测试集直接比较，也不能说明间隔越长越好。

## 应用场景与启发

- 作者主张：固定路侧时序占据应显式管理来源，而非统一累加历史。
- 我的判断：最可借鉴的是把“寻找对应”和“判断支持是否存在”拆开，并用匹配预算的消融检验。P/T/R 概率可以成为解释陈旧记忆的接口，但还不是可信实例跟踪器。
- 研究启发，待验证：两辆同类车辆交错或一辆离开、另一辆进入时，同类支持可能错误延续旧证据。可以测试加入实例或观测不确定性后，是否减少同类交接误用，同时保住遮挡恢复收益；不能先假定更复杂路由必然有效。

## 局限与阅读风险

语义支持只检查邻域同类，未验证身份连续性；GT 动态区域上的图也不包含完整候选漏检。训练标签依赖真值运动和离线未来占据，需复核构造、划分与因果输入边界。

固定路侧坐标是方法的重要便利。Occ3D-nuScenes 提供了移动车端的补充结果，但没有证明长时域、多路口或传感器故障条件下普遍适用。本文也没有通信丢包、带宽、车辆规划和闭环评估。

公开 v1 正文称完整路由控制说明在 appendix，但所核 PDF／HTML 未提供独立的该附录入口；方法代码、原始种子结果与完整配置尚需补齐。InfraOcc 自带的 ProSD-Occ 没有出现在主比较表中，应作为复核基线覆盖时的一个问题。

## 后续跟进

### 最小验证与停止条件

- 当前资源：2026-09-30（UTC+8）核对固定 v1。RoadOcc 正文仍写代码将发布，未核实方法代码、配置或权重可下载。[InfraOcc 官方仓库](https://github.com/yanglei18/InfraOcc)有框架和说明，但在本轮固定提交 `1417c95f3b462319a188f99fb6dbfe7075a3e17e` 下，README 的数据准备文档、camera-only 配置及 checkpoint 链接均返回 404；不能把表格里的链接当成资源已经齐备。
- 最小实验：先取得有效数据、拆分清单与同一 checkpoint；固定五段连续评估序列、相同 token／历史预算，对比固定读取、VVE 读取、Gate、Full 和无 Refresh。按静止、移动、新出现及同类交接分别统计 Dyn.、Direct MAVE、DSR，并同时计入候选漏检。
- 成功信号：来源选择在不同种子下仍改善动态占据，且同类交接的陈旧残影没有增加；完整在线时间与显存也须可接受。
- 停止／转向条件：若收益只在 GT 候选上成立，或普通 Gate 在等预算和干净划分下已解释差异，就收窄路由贡献；资源未补齐前只做协议核对，不安排大规模训练。

### 来源与核验记录

依据 [arXiv:2609.27677v1](https://arxiv.org/abs/2609.27677v1)，首投 2026-09-23，实际核验于 2026-09-30（UTC+8）。作者单位核对 PDF 首页。PDF 页眉写有 ICLR 2027，但本轮未找到可核验的正式录用目的页，故仍按预印本记录。公式取自式 1、7、8；实验核对表 2–6、第 4.1–4.2 节；图 4、7 均实际打开并与图注核对，保留官方 PNG 原始字节。相关工作分别重开 InfraOcc、STCOcc 和 CRT-Fusion 自身来源；本次没有执行训练、推理或数据集评测。
