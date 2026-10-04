---
{
  "id": "maplightning-compact-map-tokens",
  "tag": "dynamic-scene-representation",
  "tags": ["dynamic-scene-representation"],
  "title": "MapLightning: Online Vectorized HD Map Construction with 1D Map Tokens",
  "source": "arXiv 预印本 / arXiv:2610.01905v1 / https://arxiv.org/abs/2610.01905v1 / 固定全文 https://arxiv.org/html/2610.01905v1 / Code and models will be released",
  "authors": ["Shen Zheng", "Anurag Ghosh", "Mani Ramanagopal", "Srinivasa Narasimhan"],
  "affiliations": ["Carnegie Mellon University"],
  "comment": "把密集 BEV 中间网格换成少量可学习地图 token，用图像与地图 token 的联合自注意力提取道路结构。地理隔离测试和轨迹预测结果较完整，但代码权重仍待发布，外参扰动实验也不等于真实相机移动。"
}
---

## 一句话定位

MapLightning 研究一个具体问题：输出只是车道分隔线、人行横道和道路边界，是否还需要先构造一整张密集 BEV 网格？它将多视角图像压缩成少量一维 map tokens，再由地图查询直接读出矢量要素。关键不是“一维”本身，而是在压缩前允许图像之间、地图 token 之间充分交换信息。

- **核心证据**：单帧、ResNet-50、共同解码框架下，自注意力压缩取得 nuScenes 30.1 mAP，BEV 投影为 26.7，普通交叉注意力压缩为 25.5；这个控制实验比多帧主表更接近隔离聚合机制。[表 1](https://arxiv.org/html/2610.01905v1#S4.T1)
- **主要边界**：本文仍需带矢量地图标签的训练；外参抗扰实验只改输入标定参数，模型本来就不读取这些参数，尚不能据此认定更换真实相机安装位置后仍能泛化。[附录 E–F](https://arxiv.org/html/2610.01905v1#A5)

## 论文要解决的问题

### 稀疏输出为何先经过密集网格

典型在线地图模型从环视图像提取特征，借助标定和深度分布投影为鸟瞰 BEV，再用查询预测点序列。BEV 的每个格子具有明确空间位置，适合密集占据等任务，但地图要素只占少部分区域。MapLightning 希望压缩中间表示，将算力留给相关结构与全局交互。

例如一个大路口，车道线在不同相机中被车辆遮挡。若 map token 只独立读取固定图像特征，图像之间缺少直接修正上下文的机会。作者让图像与 map tokens 进入同一个 self-attention 序列，先联合更新，再丢弃图像 token；剩余 map tokens 是供解码器查询的摘要，不对应固定 BEV 格子。[§1、§3](https://arxiv.org/html/2610.01905v1#S3)

### 相关工作与差异

| 工作与一手来源 | 已有机制 | MapLightning 改变的环节 |
| --- | --- | --- |
| Liao 等，MapTRv2，IJCV，2024 在线发表、2025 卷期；[正式页](https://link.springer.com/article/10.1007/s11263-024-02235-z)，机制按[arXiv v2 §4](https://arxiv.org/html/2308.05736v2#S4)核对 | 用置换等价点集表示地图，实例/点层次查询与匹配处理曲线；通过 one-to-many 分支、深度和 PV/BEV 分割辅助监督加速学习。 | 保留地图解码与 one-to-many 思路，替换 BEV 聚合、改用全交叉注意力；删除深度及 PV/BEV 辅助损失。主模型还从单帧变为四帧，不能视作只替换一个模块。 |
| Yuan 等，StreamMapNet，WACV 2024；[正式页](https://ieeexplore.ieee.org/document/10484447/)，[作者版 v2 §3.2–3.4、§4.1](https://arxiv.org/html/2308.12570v2#S3) | 以 BEV 编码、多点注意力、跨帧查询传播和位姿变换后的 BEV 记忆构建地图，并指出地理重叠导致测试偏乐观。 | MapLightning 在固定历史窗口内使用相机/时间嵌入和联合注意力，不做显式 ego-pose 对齐；地理隔离评测承接已有问题意识，不能归为本文首次发现。 |

MapLightning 还指出最接近的去 BEV 方法 SparseMeXt 没有可用代码和所需新 split 结果，故未进入主表；其原始 split、100 epochs 的数字只列在附录。主表较强不代表已经完成对全部无 BEV 路线的同条件比较。[§4.2](https://arxiv.org/html/2610.01905v1#S4.SS2)

## 方法和系统设计

### 图像先交流，再压缩成地图表示

共享 backbone 编码 $C$ 路相机、$T$ 个时刻的图像。展平后的 $N=TCHW$ 个特征 token 加上可学习的相机、时间、行列位置嵌入，与 $K$ 个可学习 map tokens 拼接。四层自注意力同时更新两类 token；最后只保留 map tokens，交给任务解码器。[§3.2–3.3](https://arxiv.org/html/2610.01905v1#S3.SS2)

默认 $T=4$，每相机每时刻 50 个 map tokens，因此 nuScenes 六相机为 $K=1,200$，Argoverse 2 七相机为 $K=1,400$。这里没有显式相机内参、外参、深度或跨时间 ego-pose 变换；几何对应要从带标签数据和相机身份嵌入中学出来。这省去了投影依赖，但也没有自动获得跨传感器配置的几何等变性。

### 关键公式与直觉

第一组重组原式 4–8，保留联合聚合的关键结构：

$$
\begin{aligned}
\widetilde x_{t,c,h,w}&=x_{t,c,h,w}+E_c^{\mathrm{cam}}
+E_t^{\mathrm{time}}+[E_h^{\mathrm{row}};E_w^{\mathrm{col}}],\\
Z^{(0)}&=[U^{(0)};X^{(0)}],\\
\widetilde Z^{(l)}&=Z^{(l-1)}+\operatorname{MSA}
\big(\operatorname{LN}(Z^{(l-1)})\big),\\
Z^{(l)}&=\widetilde Z^{(l)}+\operatorname{FFN}
\big(\operatorname{LN}(\widetilde Z^{(l)})\big).
\end{aligned}
$$

$X^{(0)}$ 是嵌入后的图像特征，$U^{(0)}$ 是 map tokens；$E$ 告诉网络“来自哪台相机、哪个时刻、哪个像素位置”。MSA 对拼接序列做多头自注意力，使图像也能接收其他图像和地图 token 的信息。相较之下，普通 cross-attention 压缩只让地图查询读取固定图像 keys/values，少了这些联合更新。[原式 4–8](https://arxiv.org/html/2610.01905v1#S3.E4)

第二组对应原式 10–12：

$$
\begin{aligned}
[U^{(L)};X^{(L)}]&=Z^{(L)},\qquad
U=\operatorname{LN}_{\mathrm{out}}(U^{(L)}),\\
\widetilde Q^{(l)}&=\overline Q^{(l)}+
\operatorname{MHA}(\overline Q^{(l)},U,U).
\end{aligned}
$$

$U$ 为 $K\times d$ 的中间表示；$\overline Q$ 是经过实例/点查询交互后的解码查询。由于 $U$ 没有固定二维坐标，解码器不用依赖 BEV 参考位置的 deformable attention，而让每个查询读取全部 map tokens。参考点仍用于坐标回归，并不是所有几何坐标都被删除。[原式 10–12、§3.4](https://arxiv.org/html/2610.01905v1#S3.E10)

压缩后的 1,200 tokens 对比 20,000 个 BEV tokens，约少 16.7 倍，但这是中间表示数量；聚合器仍要处理全部图像 token，自注意力计算随 $N+K$ 二次增长。FlashAttention 改善内存访问和显存占用，不能把 token 数缩减直接当作整网 FLOPs 缩减倍数。[§3.4](https://arxiv.org/html/2610.01905v1#S3.SS4)

### 训练监督与推理预算

地图解码器使用 50 个实例查询、每要素 20 个点、六层解码；分类、点回归、方向损失权重分别为 2、5、0.005。保留 300 个额外实例查询和六次真值复制的 one-to-many 训练分支，删除 MapTRv2 的深度及 PV/BEV 分割辅助目标。[附录 F.1](https://arxiv.org/html/2610.01905v1#A6.SS1)

训练使用 ImageNet 预训练 backbone、颜色扰动、AdamW，八张 RTX 3090、每卡 batch 4；nuScenes 训练 24 epochs，Argoverse 2 为 6 epochs，初始学习率 $6\times10^{-4}$、cosine decay、weight decay 0.01。nuScenes 图像为 800×450，AV2 先补到 2048×2048 再按 0.3 缩放。四帧间隔分别为 0.5 秒与 0.4 秒。推理缓存过去图像特征，只重新编码当前帧，因此 FPS 取决于缓存流程。[附录 F.1、§3.4](https://arxiv.org/html/2610.01905v1#A6.SS1)

## 关键图与可视化结果

![原论文图 3：自注意力第 1 层与第 4 层的图像 token 响应](../../assets/papers/maplightning-compact-map-tokens-figure-3.png)

每列紫色叉号指定一个图像查询点，上下两行为第 1、4 层；红色表示较高注意力。从左到右可以看平行车道线、向远处延伸的分隔线、人行横道和路沿。后层响应更贴近相关结构，说明图像 token 在聚合器里仍被更新。注意力热图是机制线索，不是对因果贡献的独立证明。[原图 3](https://arxiv.org/html/2610.01905v1#S4.F3)

![原论文图 4：BEV 投影、交叉注意力、自注意力与真值的矢量地图对照](../../assets/papers/maplightning-compact-map-tokens-figure-4.png)

从左到右比较三种表示与真值。橙、蓝、绿分别是车道分隔线、人行横道和道路边界；前三行来自 nuScenes，最后一行来自 AV2。自注意力样例中的路口结构通常更完整、杂散线更少，但仍存在与真值不一致的连接和边界。该图展示局部地图形状，不是拓扑正确率或闭环规划安全的统计测试。[原图 4](https://arxiv.org/html/2610.01905v1#S4.F4)

## 实验结论与证据

### 地理隔离与指标

默认使用 Near-Extrapolation split、60×30 米感知范围，模型需要泛化到较少地理重叠的区域。本文按 5 米邻近标准报告：nuScenes 原始 train–val 重叠为 79.4%，StreamMapNet split 为 2.1%，Near-Extrapolation 为 0.9%；AV2 近外推 split 为 0%。这些统计口径和旧工作定义不同，不应跨论文直接比较重叠比例。[§4.1、附录 D](https://arxiv.org/html/2610.01905v1#S4.SS1)

地图 mAP 使用 Chamfer 距离阈值 0.5、1.0、1.5 米匹配预测和真值要素，越高越好；不是逐像素占据 IoU。FPS 在 RTX 3090 上测量。除说明的例外，主表的公开实现基线重新在 Near-Extrapolation split 上训练；原始 split 的高分不与这里的数值混用。[§4.2](https://arxiv.org/html/2610.01905v1#S4.SS2)

### 先看单帧控制，再看完整模型

| 设置及原表 | 聚合方式 | nuScenes mAP ↑ | AV2 mAP ↑ | nuScenes FPS ↑ |
| --- | --- | --- | --- | --- |
| 表 1，ResNet-50，单帧，共同解码框架 | BEV 投影 | 26.7 | 53.1 | 14.1 |
| 同上 | 交叉注意力，0.3k tokens | 25.5 | 52.6 | 19.1 |
| 同上 | 自注意力，0.3k tokens | 30.1 | 58.3 | 19.2 |
| 表 2，ResNet-50，四帧 | 交叉注意力，1.2k tokens | 26.4 | 56.5 | 18.8 |
| 同上 | 自注意力，1.2k tokens | 35.3 | 63.3 | 18.9 |

单帧中，自注意力相较 BEV 提高 3.4/5.2 个 mAP 点；单纯换成交叉注意力压缩反而略降。四帧下，自注意力比同预算交叉注意力提高 8.9/6.8 点。主表相较单帧 MapTRv2 的 8.6/10.2 点差同时包含时间信息、聚合及监督变化，不能全归为删除 BEV。[表 1–2](https://arxiv.org/html/2610.01905v1#S4.T1)

MobileNetV3-Large 版本在表 6 为 30.6/59.9 mAP、40.2 FPS；对应 MapTRv2 为 20.5/43.7、23.3 FPS。摘要中的 +10.1/+16.2 和约 1.73 倍速度指这组轻量骨干，不是上表 ResNet-50。其已分配显存从 811.3 降至 383.4 MiB，按表值计算约减少 52.7%；ResNet-50 为 1,080.6→652.7 MiB，降幅不同。[表 6、10](https://arxiv.org/html/2610.01905v1#A2.T6)

### 下游收益与消融的负结果

加入不确定性头后，先预计算地图，再用相同设置分别训练 HiVT 轨迹预测器。表 3 中 MapTRv2 与自注意力模型的 minADE 为 0.435→0.406 米，minFDE 为 0.958→0.914 米，MR 为 0.1274→0.1167。前两者分别衡量候选预测中最佳轨迹的平均/终点距离误差，MR 是漏预测比例，均越低越好。这是离线轨迹预测，不是自车规划器闭环成功率。[表 3](https://arxiv.org/html/2610.01905v1#S4.T3)

交叉注意力模型的不确定性地图 mAP 已高于 MapTRv2（23.4 对 18.0），但其 minADE/minFDE/MR 为 0.438/0.979/0.1385，反而更差。这一行直接提醒：地图分数提高，并不保证下游每项指标都提高。加入不确定性头也令完整自注意力模型地图 mAP 从 35.3 降到 32.4，存在任务取舍。

表 11 中，1/2/4/6 帧的 nuScenes mAP 分别为 30.1/32.9/35.3/33.7；1.2k tokens 优于 0.9k 的 33.3 和 1.5k 的 34.9。更多历史与更大容量并非单调有益。作者没有报告独立训练种子方差或置信区间，因此小幅差异仍需重复实验验证。[表 11](https://arxiv.org/html/2610.01905v1#A3.T11)

## 应用场景与启发

- **作者主张**：紧凑地图表示能减少中间网格成本，同时改善地图、地图不确定性和下游预测。
- **我的判断**：它适合输出本来就是稀疏要素的任务；要接入依赖稠密 BEV 的占据或规划头，需要额外接口，不能假定直接替换即可。
- **待验证假设**：联合注意力的收益来自跨视角结构补全，而不是仅靠四帧冗余。固定四帧和 token 数，分别屏蔽图像—图像、地图—地图交互，并在遮挡/多相机重叠子集评价，可检验哪些连接真正有用。

## 局限与阅读风险

作者明确指出，一维 tokens 需要适配依赖 BEV 网格的端到端任务头，固定 token 预算也可能需要针对新任务重调。本文没有证明它可以直接作为通用三维场景状态，更没有未来占据或动态对象交互模型。[§5](https://arxiv.org/html/2610.01905v1#S5)

外参实验给旋转和平移参数加高斯噪声，模型不读取这些参数，所以分数保持 35.3/63.3 是符合结构的结果。真实相机移位会改变图像视野、遮挡和相机身份的几何含义；跨 rig、掉相机、变焦和新安装高度尚需单独评价。[附录 E](https://arxiv.org/html/2610.01905v1#A5)

主要实验依赖特定地理 split、历史缓存和重训基线；在代码尚未发布时，split 清单、缓存时延统计及完整 HiVT 配置仍难独立重现。最接近的已有方法未进入同 split 主表，也限制了方法族层面的领先结论。

## 后续跟进

### 最小验证与停止条件

- **资源状态，2026-10-05**：论文明确写代码和模型将发布；正文未给可运行仓库链接，公开仓库检索未找到可核验的官方 MapLightning 实现。模型权重、训练配置和精确 split manifest 均未核实公开。基础 nuScenes/AV2 有各自数据入口，官方数据入口可访问不等于本文预处理与划分已备齐。[论文](https://arxiv.org/abs/2610.01905v1)、[nuScenes](https://www.nuscenes.org/nuscenes)、[AV2](https://www.argoverse.org/av2.html)
- **最小实验**：以官方配置发布为前置条件，先固定 Near-Extrapolation split、ResNet-50、单帧、共同解码器和训练轮次，复现实验表 1 的 BEV/交叉注意力/自注意力三组。确认后才升到四帧并做交互屏蔽，不先复现所有轻量骨干。
- **成功信号**：三个训练种子中，自注意力在相同 token 数和训练步数下稳定优于交叉注意力；在遮挡路口的分隔线/边界 AP 上可解释收益。另测预热后缓存推理的 p50/p95 时延、显存和带不确定性地图的下游误差。
- **停止/转向条件**：若统一 split、监督和历史后增益消失，停止把性能归于 token 形式；若地图提高却使 HiVT 恶化，检查局部拓扑和不确定性校准；若真实相机位姿变化导致严重退化，考虑加入可控几何条件，而不沿用输入外参噪声实验的结论。

### 来源与核验记录

固定依据 [arXiv:2610.01905v1](https://arxiv.org/html/2610.01905v1)，核验日期 2026-10-05。读取主文 §1–5，重点核对式 4–12、表 1–3、6、9–11，以及附录 C–F 的消融、划分、扰动和训练设置；四位作者及 Carnegie Mellon University 单位由全文首页核对。原图 3、4 均逐张打开、对照图注后保存官方原字节。

相关工作分别读取 MapTRv2 作者版 v2 的方法与监督设计，并核对 IJCV 正式发表页；StreamMapNet 作者版 v2 §3–4 与 WACV 正式页面分别用于机制和出版状态。未下载数据、运行模型或独立重算论文结果。
