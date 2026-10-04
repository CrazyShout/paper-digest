---
{
  "id": "v2x-wam-cooperative-world-action",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "end-to-end-autonomous-driving", "world-models", "dynamic-scene-representation"],
  "title": "V2X-WAM: A Cooperative World Action Model for End-to-End Autonomous Driving",
  "source": "arXiv 预印本 / arXiv:2609.37098v2 / https://arxiv.org/abs/2609.37098v2 / 固定全文 https://arxiv.org/html/2609.37098v2",
  "authors": ["Junwei You", "Weizhe Tang", "Can Wang", "Yan Zhao", "Jun Hua", "Haotian Shi", "Wei Zhang", "Lin Wang", "Bin Ran"],
  "affiliations": ["ITS Center, Research Institute of Highway Ministry of Transport", "State Key Lab of Intelligent Transportation System, Research Institute of Highway Ministry of Transport", "Department of Civil and Environmental Engineering, University of Wisconsin–Madison", "Intelligent Transportation Systems Research Center, Wuhan University of Technology", "Engineering Research Center of Transportation Information and Safety, Ministry of Education", "School of Transportation, Inner Mongolia University", "College of Transportation, Tongji University"],
  "comment": "把压缩路侧消息、动作条件占据预测和轨迹细化接成一个模型，观察协同信息怎样影响未来判断。优势来自 V2X-Seq-SPD 日志评测；98,400 B/s 是消息载荷核算，环境交互闭环仍待验证。"
}
---

## 一句话定位

V2X-WAM 先利用车端和路侧观测提出轨迹，再预测这条轨迹条件下的未来占据与运动，最后用预测结果修正轨迹。值得读的是协同信息如何同时进入当前场景编码和未来判断，以及通信压缩怎样与两种输出一起训练。

- 核心证据：V2X-Seq-SPD 验证集上，表 2 的平均 L2 为 0.97 m、平均碰撞率为 0.01%，对应 UniMM-V2X 的 1.49 m、0.12%；消息载荷为 98,400 B/s。[表 2](https://arxiv.org/html/2609.37098v2#S4.T2)
- 主要边界：这些是固定日志上的轨迹与未来状态评测。模型内部的动作→世界→动作反馈，并不是车辆执行后重新接收环境观测的闭环实验。

## 论文要解决的问题

### 问题与假设

在遮挡路口，路侧相机和 LiDAR 能看见自车暂时看不见的横向车辆。只把这部分信息融合成“当前有哪些车”，仍留下一个问题：自车准备通过路口时，未来哪些区域可能被占用，原先的轨迹是否需要调整？

模型接收两端当前相机图像、历史 LiDAR 鸟瞰图、自车历史位置和运动状态、路线指令、两端相对位姿与时间差，以及可行驶区域地图。输出包括自车轨迹、未来占据图和相邻未来时刻之间的二维位移场。输入要求已标定传感器和可用地图；协同对象是一辆自车与一个配对路侧单元。[§3.1](https://arxiv.org/html/2609.37098v2#S3.SS1)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | 本文改变与比较边界 |
| --- | --- | --- |
| Yu 等，UniV2X，AAAI 2025：[正式论文页](https://ojs.aaai.org/index.php/AAAI/article/view/33040)，[原文方法](https://arxiv.org/html/2404.00717v3#Sx2) | 传输稀疏对象／车道 query 与稠密占据概率，做时间同步、空间变换和跨视角融合，再联合优化规划 | V2X-WAM 将选出的自车动作显式送入未来世界解码，并把世界特征送回轨迹细化；两者传输的表示、传感器和网络配置不同 |
| Song 等，UniMM-V2X，AAAI 2026：[正式论文页](https://ojs.aaai.org/index.php/AAAI/article/view/37870)，[原文方法](https://arxiv.org/html/2511.09013v1#Sx3) | 感知层交换 track／map query 与占据，预测层交换 motion query；BEV 编码器和运动解码器使用 MoE | 本文强调动作条件的占据—流预测与返回规划的路径；表 2 沿用 UniMM-V2X 的基准口径，没有将两个系统改造成同传感器、同算力的模块对照 |

两篇原文都已涉及未来信息。因此本文的差异应落在“自车候选动作作为世界预测条件，预测后再细化自车轨迹”的具体连接上，而不是概括为此前协同方法完全不预测未来。

## 方法和系统设计

### 从配对观测到一次轨迹细化

两端历史 BEV 先变换到当前自车坐标系。编码器同时处理历史帧、相邻帧差分和局部相关性，提取位置及运动线索。相机语义补充 LiDAR 几何；路侧特征经压缩、量化后送到自车。融合器根据两端特征估计空间可靠性，并按时间差衰减路侧消息的权重。

融合结果压成 96 个场景 latent token，规划器并行生成六条轨迹。每条轨迹由匀速先验加有界残差构成；模式评分选出一条初步轨迹，其相邻点增量作为动作条件。世界分支由此生成每个未来时刻的占据和位移场。最后，初步规划 token 与世界结果 token 一起预测局部轨迹修正。[§3.2–3.5](https://arxiv.org/html/2609.37098v2#S3.SS2)

这里先选轨迹再细化，并没有对六个候选逐一完整模拟后搜索最优解。未来占据监督来自日志中的周围交通参与者，而不是另一个能响应任意自车动作的交互模拟器。

### 三个关键计算

**发送的是量化消息。** 原文式 7 对路侧消息每个通道采用对称 INT8 量化：

$$
s_c=\frac{\max_{h,w}\lvert C^i_{c,h,w}\rvert}{127},\qquad
\bar C^i_{c,h,w}=s_c\,\operatorname{clip}
\left(\operatorname{round}(C^i_{c,h,w}/s_c),-127,127\right).
$$

$C^i$ 为压缩路侧特征，$s_c$ 是通道尺度，$\bar C^i$ 是接收端重建值。训练通过 straight-through estimator 传递梯度。消息为 $12\times64\times64$ 个一字节值，加 12 个尺度，共 49,200 bytes／次；每秒发送两次才得到 98,400 B/s。[式 7–8、§4.1.2](https://arxiv.org/html/2609.37098v2#S3.E7)

**占据既直接预测，也沿运动场搬运。** 原文式 33–34：

$$
\hat O_\tau^{\mathrm{tr}}
=\mathcal W\!\left(\operatorname{sg}(\hat O_{\tau-1}),\hat V_\tau\right),
\qquad
\hat O_\tau=\mu_\tau\hat O_\tau^{\mathrm{dir}}
+(1-\mu_\tau)\hat O_\tau^{\mathrm{tr}}.
$$

$\mathcal W$ 是双线性 BEV warp；$\hat V_\tau$ 表示相邻未来状态之间的米制位移，不能直接读成 m/s 速度；$\mu_\tau$ 是学习到的混合系数。直接分支能补新出现的物体，搬运分支保持时间连续性。$\operatorname{sg}$ 停止向前一时刻占据反传梯度，限制跨时刻误差耦合；它不保证预测物理正确。[式 33–34](https://arxiv.org/html/2609.37098v2#S3.E33)

**世界特征只允许有界修正轨迹。** 将原文式 36–37 合写：

$$
\Delta\hat p_\tau=s_{\mathrm{ref}}h_\tau^{\gamma_r}
\odot\tanh f_{\mathrm{ref}}([q_{k^*,\tau};w_\tau]),
\qquad
\hat p_\tau=\operatorname{clip}
(\hat p_\tau^{(0)}+\Delta\hat p_\tau,-s_p,s_p).
$$

$q_{k^*,\tau}$ 是已选轨迹的规划 token，$w_\tau$ 汇总同一未来时刻的占据与流特征，$h_\tau=\tau/T$ 是归一化时域。$s_{\mathrm{ref}}$ 限制修正幅度，$s_p$ 限制规划范围。该约束保存原计划的大致机动趋势；修正依据是学习特征，并非对整条轨迹求解具有安全保证的优化问题。

### 训练与推理

训练单阶段联合优化规划、碰撞／道路约束和未来世界损失。专家轨迹用于选择监督模式与回归目标，未来物体标注提供占据和位移监督；自车 footprint 从世界目标中剔除。碰撞惩罚还区分预测新增的风险与日志专家本身已有的重叠。[式 39–53](https://arxiv.org/html/2609.37098v2#S3.E39)

共享特征到规划、动作到世界、世界到动作的反向梯度分别乘 0.03、0.05、0.05，前向数值保持不变。AdamW、batch 8、最多 40 epochs；基础学习率为 $2\times10^{-4}$，世界分支乘 1.25，连续八个 epoch 的联合验证指标不改善便停止。论文给出这些配置，但未报告 GPU 型号、训练总耗时、推理延迟或独立训练种子方差。

推理仍保留量化、可靠性融合、世界预测和轨迹细化。训练中的未来专家点与物体标注不作为部署输入；路线指令由序列导航终点离散化，论文说明没有用未来规划点构造该输入。

## 关键图与可视化结果

![原论文图 2：协同编码、量化通信与动作—世界—轨迹细化](../../assets/papers/v2x-wam-cooperative-world-action-figure-2.png)

先看上半部：两端相机与 LiDAR 历史经编码，路侧消息通过量化通信和可靠性门控进入融合。再看下半部：多模式规划先做 Top-1 选择，未来世界解码器接收该动作，再把结果送回左侧细化模块。三个最终输出分别是轨迹、占据和流。这张结构图解释计算连接，没有展示车辆执行后的反馈回路。[官方图 2](https://arxiv.org/html/2609.37098v2#S3.F2)

![原论文图 5：固定动作时，路侧消息对未来占据时空切片的影响](../../assets/papers/v2x-wam-cooperative-world-action-figure-5.png)

每行从左向右是两端图像、地图采样走廊、屏蔽路侧消息、完整协同。后两列横轴为未来时间，纵轴为沿走廊的有符号距离；蓝色深浅表示占据概率，红轮廓为真值。作者固定初步规划表示与动作，只屏蔽进入世界分支的解码路侧消息。完整消息使部分真值区域响应更清楚，支持该分支确实利用路侧证据；这是两个固定模型案例，不能替代动作反事实或安全统计。[官方图 5、§4.5.2](https://arxiv.org/html/2609.37098v2#S4.F5)

## 实验结论与证据

### 日志、时域与指标

V2X-Seq-SPD 包含 95 个真实交通场景、超过 15,000 帧，原始频率为 10 Hz；论文使用官方 train／validation 划分，量化结果在 validation 上报告。四帧历史 BEV 每隔五个源帧采样；未来十步以 0.5 s 为间隔，最长预测 5 s，主表只报告 1／2／3 s。BEV 为 $128\times128$，相机图像缩为 $224\times224$。[§4.1](https://arxiv.org/html/2609.37098v2#S4.SS1)

L2 的每个时域列计算从当前到该时域的平均 waypoint 距离，不是终点 FDE；最后 Avg. 再平均三个时域列。碰撞率统计预测自车框与未来物体重叠，并排除专家轨迹也发生的重叠。Occupied IoU 衡量有效标注区域的占据交并比，Flow EPE 衡量动态物体有效格点上的二维位移误差。不同指标的样本筛选与分母不能混用。

### 规划收益与世界预测的取舍

| V2X-Seq-SPD validation，原表 | 方法 | 平均 L2，m，↓ | 平均碰撞率，%，↓ | 载荷，B/s，↓ |
| --- | --- | ---: | ---: | ---: |
| 表 2 | UniV2X | 2.23 | 0.25 | 809,000 |
| 表 2 | UniMM-V2X | 1.49 | 0.12 | 932,000 |
| 表 2 | V2X-WAM | 0.97 | 0.01 | 98,400 |

按表中数值计算，较 UniMM-V2X 的平均 L2 少 0.52 m、约 34.9%；碰撞率少 0.11 个百分点；分析消息载荷少约 89.4%。基线行沿用既有统一基准结果，不能将上述系统差异全部归因于单个反馈模块。V2X-WAM 还额外使用 LiDAR 历史及其运动构造，与图像型基线的观测条件并不完全相同。

| 未来世界预测，表 3 | 平均 Occupied IoU，%，↑ | 平均 Flow EPE，m，↓ |
| --- | ---: | ---: |
| StreamingFlow，按同一目标表示复现 | 20.61 | 1.06 |
| V2X-WAM | 23.07 | 1.08 |

占据提高 2.46 个百分点，但平均 flow 误差反而大 0.02 m。3 s 单点 flow 为 1.16 m，略低于 StreamingFlow 的 1.18 m；据此适合讨论任务联合优化的取舍，而不是称所有未来指标都更好。[表 3](https://arxiv.org/html/2609.37098v2#S4.T3)

### 消融检验了什么

表 4 的变体按相同训练与评测协议重训。去掉可靠性机制，L2 从 0.97 升至 1.22 m；去掉历史建模，flow EPE 从 1.08 升至 1.46 m，支持时序输入对运动预测的作用。去掉 Action→World 条件，L2 升至 1.15 m，而占据 IoU 仅从 23.07 降至 23.02%；该对照说明规划收益与平均占据精度并不等价。[表 4](https://arxiv.org/html/2609.37098v2#S4.T4)

去掉 flow transport 后，L2 为 1.02 m，但碰撞率从 0.01% 升到 0.24%。它提示时间一致性可能影响安全敏感的局部区域；缺少多次独立训练与事件计数时，还不能确认这么小的基线碰撞率下增益有多稳定。

## 应用场景与启发

- 作者希望协同感知提供的遮挡补充继续服务于未来预测与规划，而不止改善当前检测。
- 从现有证据看，值得借鉴的是同时检查通信载荷、时序状态和规划输出，并使用固定动作、屏蔽消息的控制实验追踪信息流。
- 待验证假设：在固定传感器、模型容量和消息预算后，正确的自车动作条件应比动作打乱更有利于安全相关的未来区域判断；若只改善轨迹回归而没有这种条件敏感性，世界分支可能主要发挥辅助表征作用。

## 局限与阅读风险

世界分支由日志中的一个实际未来监督。结构上的动作条件与重训消融并未识别“同一交通场景换一个动作，其他参与者将怎样反应”的真实因果响应。作者也把更丰富的多主体交互、长时域和闭环评测留作后续工作。

49,200 bytes／次包含量化特征与尺度，不包含协议头、重传、排队及真实空口调度。论文的轻度 BEV 噪声和随机路侧消息移除是训练增强，不能替代系统性的丢包、长尾延迟、位姿漂移测试。模型选择与最终主表都依赖验证集，另一个独立测试集上的泛化尚未给出。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-10-05）：固定全文与原图可访问；官方摘要、正文和精确题名检索没有定位到本文实现仓库。论文列出了架构与损失超参数，独立配置文件、处理后的规划／占据／流目标和权重未核实可下载。[V2X-Seq 官方仓库](https://github.com/AIR-THU/DAIR-V2X-Seq) 有数据说明、样例及完整数据入口，但它不提供本文全部预处理或 checkpoint。
- 最小实验：取得官方实现与权重后，先固定 100 个验证样本、传感器输入和初步轨迹，比较正确动作、跨样本打乱动作、屏蔽世界→规划返回三种条件。分别记录安全邻域占据、flow、轨迹 L2、碰撞事件数、实际消息字节与推理 p95；100 个样本是本报告提出的起步规模。
- 成功信号：正确条件稳定改善安全邻域与最终计划，且收益在同消息、同计算预算下存在；再扩到完整验证集和独立训练种子。
- 停止／转向条件：若打乱动作仍保持相同表现，暂停反事实世界建模主张，检查网络是否忽略动作；若收益仅来自更多传感器或算力，先建立匹配基线。资源未齐时只做目标构造与协议核对。

### 来源与核验记录

依据 [arXiv:2609.37098v2](https://arxiv.org/abs/2609.37098v2)，于 2026-10-05 核对全文、式 7–8／33–38／39–53、表 1–4 与 §4.5。九名作者及七条单位对照官方 PDF 首页；图 2、图 5 已逐张打开并对照图注，保存官方原文件，未改绘。相关工作另读 UniV2X v3、UniMM-V2X v1 的方法和各自 AAAI 正式页。PDF 的 Elsevier 投稿模板不构成出版证明。没有运行训练、测量无线链路或完成实验复现。
