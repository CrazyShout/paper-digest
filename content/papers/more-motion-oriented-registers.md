---
{
  "id": "more-motion-oriented-registers",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "world-models"],
  "title": "MORE: Learning Motion-Oriented Registers for Driving World Models and Planning",
  "source": "arXiv 预印本 / arXiv:2610.14871v1 / https://arxiv.org/abs/2610.14871v1 / 固定全文 https://arxiv.org/html/2610.14871v1",
  "authors": ["Yingdong Gu", "Haoyu Wang", "Shaocheng Yan", "Zhenjun Zhao", "Hao Han", "Pengcheng Shi", "Xianfei Li", "Qinghua Tan", "Wenlong Liao", "Tao He", "Jiayuan Li", "Pai Peng"],
  "affiliations": ["Wuhan University", "CowaRobot Co. Ltd.", "University of Zaragoza"],
  "comment": "MORE 在视频预训练时就学习带自车运动条件的少量寄存器，用同一状态完成未来预测、轨迹生成与评分。其平均规划分数和推理成本较有竞争力，但 HUGSIM 最难场景仍落后于多项基线，代码与模型尚待发布。"
}
---

## 一句话定位

MORE 把规划要用的紧凑状态提前放进视频预训练：图像块的信息必须经过少量寄存器，寄存器本身也要学会补全缺失状态。完整三相机模型在修正评测器下取得 NAVSIM-v2 EPDMS 92.5，并在 HUGSIM 反应式闭环中取得平均 HD-Score 39.4；这两类结果分别检验日志场景中的轨迹质量和动作影响后续观测时的驾驶表现。[表 1–2](https://arxiv.org/html/2610.14871v1#S4.T1)

## 论文要解决的问题

### 视觉特征怎样变成可预测的规划状态

视觉预训练通常保留大量空间 patch 特征，下游再学习哪些信息与自车运动、未来状态和决策有关。这样的中间表示既大，也未必适合预测：图像纹理变化、相机移动和其它车辆运动都混在其中。MORE 希望在预训练阶段就让少量 token 同时具备视觉信息和运动敏感性，再将它们直接交给世界模型与规划器。

这里的 register 是可学习的潜在 token，不是有固定语义的车辆框或占据格。主配置把前左、前、前右三路图像拼接为 256×1024，在线分支观察 2 Hz 的四帧及对应自车运动，生成后续四秒的候选轨迹。它预测的是未来寄存器，而非未来 RGB 或显式三维占据。[第 3 节、附录 B](https://arxiv.org/html/2610.14871v1#S3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | MORE 改变的环节 |
| --- | --- | --- |
| Assran 等，V-JEPA 2，2025 arXiv 版本；[动作条件模型原文](https://arxiv.org/html/2506.09985#S3) | 先学习视频 patch 表征，再以动作和历史状态预测未来 patch 特征；V-JEPA 2-AC 使用块因果预测器 | MORE 在预训练中就加入自车运动条件和寄存器瓶颈，下游预测同一套紧凑状态。两者的任务与动作空间不同，不直接比较机器人成功率和驾驶分数 |
| Kirby 等，DrivoR，CVPR 2026；[正式论文页](https://openaccess.thecvf.com/content/CVPR2026/html/Kirby_Driving_on_Registers_CVPR_2026_paper.html)、[方法](https://arxiv.org/html/2601.05083v2#S3) | 用相机专属寄存器压缩 ViT 特征，两个轻量 decoder 分别生成轨迹和学习 oracle 子分数 | MORE 延续紧凑状态供规划使用的思路，增加运动条件预训练及未来寄存器预测；它的关键对照是“怎样训练寄存器”，而非是否用了 register 这一名字 |

## 方法和系统设计

### 两个预训练任务共用一组寄存器

视频先被切为时间跨度两帧、空间大小 16×16 的 tubelet。每个时间块添加八个寄存器；十二帧预训练片段共有六个时间块、48 个寄存器。

第一条训练分支遮住部分图像 patch。编码器让可见 patch 与寄存器交互，随后丢弃编码后的 patch，只允许预测器从寄存器恢复被遮位置的特征。这样，稠密视觉监督必须经过紧凑状态，不能沿 patch 到 patch 的路径绕过它。

第二条分支保留全部 patch，却在“时间块×寄存器槽位”网格中遮住连续块。预测器仅从剩余寄存器恢复被遮寄存器，使下游将要预测的状态在预训练时就成为学习目标。两条分支共享在线编码器、预测器和以指数移动平均更新的目标编码器。[第 3.2 节](https://arxiv.org/html/2610.14871v1#S3.SS2)

### 关键公式与直觉

式 2–3 把相邻帧的自车运动注入对应时间块。将两式合写为：

$$
\mathbf a_t=(\Delta x_t,\Delta y_t,\Delta\psi_t)^\top,\qquad
\mathbf R^0_{k,r}=\mathbf E^{\rm reg}_{k,r}+\widetilde{\mathbf a}_k^\top\mathbf W_a.
$$

平移和航向变化在当时的自车坐标系中定义；$k$ 是时间块，$r$ 是寄存器槽位，$\mathbf W_a$ 将三维运动映射到特征维度。默认两帧一个块，对应两帧间的运动。它让表征知道相机为何发生位移，尚不赋予每个寄存器固定的物理含义。[式 2–3](https://arxiv.org/html/2610.14871v1#S3.E2)

预训练的两个目标由式 15 直接相加：

$$
\mathcal L_{\rm pretrain}=
\frac{\lVert\widehat{\mathbf H}^{p}_{\mathcal M_p}-\mathbf H^{p}_{\mathcal M_p}\rVert_1}{\lvert\mathcal M_p\rvert}
+
\frac{\lVert\widehat{\mathbf H}^{r}_{\mathcal M_r}-\mathbf H^{r}_{\mathcal M_r}\rVert_1}{\lvert\mathcal M_r\rvert}.
$$

$\mathcal M_p$ 和 $\mathcal M_r$ 分别是被遮 patch 与寄存器的位置，带帽变量是在线预测，目标来自完整片段的 EMA 编码器并停止梯度。第一项要求寄存器保留足够信息，第二项要求寄存器空间本身能够预测；二者都在匹配潜在特征，而非恢复像素。[式 15](https://arxiv.org/html/2610.14871v1#S3.E15)

下游世界模型使用式 12 的非自回归预测：

$$
\widehat{\mathbf Z}_f=F_\psi(\mathbf Z_o,\mathbf Q_f,\widetilde{\mathbf A}^{o},\mathbf S_o),\qquad
\mathbf Z=[\mathbf Z_o;\widehat{\mathbf Z}_f].
$$

$\mathbf Z_o$ 是四帧对应的 16 个观测寄存器，$\mathbf Q_f$ 是后续八帧对应的 32 个未来查询，$\mathbf S_o$ 是当前自车状态。所有未来查询一次共同预测，结果与观测拼成规划记忆。$\widetilde{\mathbf A}^{o}$ 仅含已观测运动，未来位置补零；未来图像与运动只进入训练目标。该未来记忆由全部轨迹候选共享，并未对每个候选动作分别做反事实 rollout。[式 10–14](https://arxiv.org/html/2610.14871v1#S3.E10)

### 联合训练与实际推理

轨迹 decoder 从共享记忆生成 64 条候选，另一个 scorer 预测 NAVSIM/PDM 的质量子分数。轨迹使用 minimum-over-64 损失，评分器使用 oracle 子分数监督；评分损失对候选轨迹停止梯度，但仍可更新共享状态。未来特征、轨迹和评分三项损失权重均为 1。部署时只运行在线编码器、未来预测和生成/评分模块，选择最高分轨迹。

预训练从 V-JEPA 2 初始化 ViT-L，在总体约 120 小时的 OpenScene 中仅使用 trainval 日志，未单独报告该 split 的小时数；32 张 A100、全局 batch 256、22,000 步。第二阶段只继承编码器，世界模型与规划器从头训练；NAVSIM navtrain 过滤后有 103,288 个样本，8 张 RTX 4090、batch 128、10 epochs。论文因此同时涉及新的预训练目标和可观的额外训练预算。[第 3.4、4 节及附录 B](https://arxiv.org/html/2610.14871v1#S3.SS4)

## 关键图与可视化结果

![原论文图 2：运动条件寄存器的双分支预训练与未来状态规划](../../assets/papers/more-motion-oriented-registers-figure-2.png)

先看上半部分：蓝色是寄存器，粉色是 patch，红框分支补寄存器、绿框分支补 patch；两条分支的预测器都只读取寄存器。下半部分再把观测寄存器和预测未来寄存器交给轨迹生成器及评分器。右上目标编码器和下方未来目标属于训练路径。[官方图 2](https://arxiv.org/html/2610.14871v1#S3.F2)

![原论文图 6：遮挡停车与弱车道引导场景中的失败轨迹](../../assets/papers/more-motion-oriented-registers-figure-6.png)

绿色为日志参考轨迹，红色为 MORE。左右两例的参考车几乎不动，模型却继续向前；附录说明参考位移不超过约 0.85 m，而预测前进 9.9–11.7 m。中间无标线分岔的误差较小，ADE 为 0.46 m、FDE 为 1.80 m。它们把平均分背后的问题具体化为停车时长和道路分支判断，而非笼统的“复杂场景困难”。[官方图 6、附录 F.3](https://arxiv.org/html/2610.14871v1#A6.F6)

## 实验结论与证据

### 两类评测与两版 EPDMS

NAVSIM v1/v2 都使用 12,146 个 navtest 场景，车辆执行预测轨迹，背景参与者保持日志未来，属于非反应评测。PDMS/EPDMS 综合碰撞、可行驶区、进度、TTC 与舒适等指标。表 1 特别区分旧评测器的 EPDMS* 与修正人类行为过滤后的 EPDMS；MORE 的 92.5 属于后者，不能与旧列的数值直接相减。

HUGSIM 则在 436 个重建场景中交互闭环执行：Easy 80、Medium 157、Hard 96、Extreme 103。MORE 未在 HUGSIM 上再训练或微调。RC 是路线完成比例，HD-Score 同时计入完成度和行驶质量；表 2 使用修正航向计算等问题后的评测器。[附录 C–D](https://arxiv.org/html/2610.14871v1#A3)

### 主要结果与代价

| 原表与设置 | 对照 | MORE | 解读 |
| --- | --- | --- | --- |
| 表 1，修正 NAVSIM-v2 EPDMS ↑ | NTR 90.9；DrivoR 90.3 | 92.5 | 分别高 1.6、2.2 点；论文列举的方法，非统一预训练预算重训 |
| 表 2，HUGSIM 平均 RC / HD-Score ↑ | Latent-WAM 45.9 / 28.9 | 51.6 / 39.4 | 平均路线完成和质量均提高 |
| 表 2，Extreme HD-Score ↑ | Latent-WAM 18.1；UniAD 14.3；DrivoR 13.9 | 11.1 | 最难组明显落后，平均收益未覆盖所有难度 |
| 表 6，RTX 4090，batch 1，延迟 ↓ | DriveLaW 1,167.0 ms；Drive-JEPA 73.3 ms | 110.0 ms | 比 DriveLaW 快，但比无显式未来状态模型的 Drive-JEPA 慢 |
| 表 6，参数 / 峰值显存 ↓ | DriveLaW 3,301.6 M / 6.89 GB | 642.7 M / 6.18 GB | 模型大小减少明显，显存降幅相对有限 |

延迟采用单卡串行执行、预热后的同步 CUDA 计时，报告每样本中位数；显存包含常驻权重，但排除磁盘 I/O、数据解析及 PDM 仿真。各方法的图像尺寸、历史帧数和相机数不同，因此这张表比较完整模型配置，不能单独将全部差值归于寄存器。[表 1–2、附录 E](https://arxiv.org/html/2610.14871v1#A5.T6)

### 哪项对照支持寄存器的作用

表 4 的消融全部使用单前相机，完整模型是 EPDMS 91.8，不能与三相机主表 92.5 混用。仅让寄存器与 patch 交互为 85.6；强制从寄存器预测 patch 后为 88.5；再遮蔽并预测寄存器为 89.1；加入寄存器运动条件后为 91.8。这组结果支持训练路径的重要性。只在联合训练时临时引入寄存器为 85.7，收益很小。

去掉未来预测、只用观测记忆时为 91.1，保留未来记忆为 91.8，增加 0.7 点。未来分支在这个配置中有用，但增益小于整个预训练方案的变化。每时间块 4/8/16/32 个寄存器分别为 91.4/91.8/91.6/91.5；更多 token 没有持续增益。论文未为这些消融提供重复训练方差，不能把细小差值写成统计显著。[表 4–5](https://arxiv.org/html/2610.14871v1#S4.T4)

## 应用场景与启发

对已经有视频编码器的驾驶系统，这篇最有价值的设计是让部署要读取的状态在预训练时承担明确任务。把 patch 压缩成几个 token 只是接口变化；强制信息通过该接口、再要求它预测缺失状态，才直接改变学习目标。

另一项值得跟进的问题是未来分支的收益来自新增监督，还是来自推理时实际读取预测状态。MORE 的消融改变了整个分支，尚未完全拆开这两种作用。可以在同一寄存器预训练与相近训练预算下补做这项对照，尤其观察停车和遮挡子集，避免只追求更高的平均进度。

## 局限与阅读风险

预测状态学习自日志中的一个未来；64 条自车候选共享同一未来记忆，尚未验证不同自车动作下其它车辆会如何响应。模型可能在停车时长不明确时产生过于积极的轨迹，图 6 和 Extreme 分组已给出实际反例。

110 ms 是特定 GPU 和输入配置的模型推理结果，车端传感器、调度与控制全链路延迟未测。32 张 A100 的额外预训练成本也应计入采用决策。目前主要障碍是方法代码、训练配置和权重尚未发布，无法核对数据过滤、随机种子及评测器的具体提交。

## 后续跟进

### 最小验证与停止条件

- **资源状态（2026-10-18）**：官方 [MORE 仓库](https://github.com/Cyril-gyd/MORE)的树快照 `177045105d31168a7d7c0c272989c978ded9540b` 仅有 README 和流程图，README 写明代码与模型正在准备。方法代码、可执行配置、MORE 权重均未发布。[OpenScene](https://github.com/OpenDriveLab/OpenScene)与 [NAVSIM](https://github.com/autonomousvision/navsim)有公开数据/工具入口；MORE 的过滤后样本清单尚未核验。
- **最小实验**：取得代码与 checkpoint 后，先固定单相机、8 个寄存器、同一 corrected evaluator，复测“观测记忆”“观测+未来记忆”两组；补一组保留未来预测训练损失、部署只读取观测状态的模型。分别报告整体与停车/遮挡子集的 EPDMS、碰撞、进度和端到端延迟。
- **成功信号**：未来记忆在重复种子下保留收益，且停车错误不随进度上升而增加；需要排队和控制时的时延也在预算内。
- **停止/转向条件**：若保留训练监督但省略推理未来记忆已经达到相同表现，则优先精简在线路径；若收益主要来自扩大视野或额外预训练数据，收窄寄存器机制的贡献判断。

### 来源与核验记录

依据 [arXiv:2610.14871v1](https://arxiv.org/abs/2610.14871v1)，首投 2026-10-10，2026-10-18 核验。全文核对第 3–5 节和附录 B–F，作者及三家单位核对原文首页；未找到正式录用来源，按预印本记录。公式对应式 2–3、12、15；数字对应表 1–6。图 2、6 下载自该固定版本并实际打开，保持官方字节。相关工作分别打开 V-JEPA 2 第 2–3 节与 DrivoR 第 3 节及 CVF 页面。本次未下载基准数据、训练权重或运行实验。
