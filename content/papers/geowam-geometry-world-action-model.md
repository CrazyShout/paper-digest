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

GeoWAM 从三帧多视角历史图像预测未来 4 秒的稠密三维点图和几何 token，再让动作头读取未来几何生成单条轨迹；最值得研究的是把可度量的空间结构放在观察与规划之间，而非从未来视频像素中间接学习运动。

- **核心证据**：NAVSIM-v2 navtest 中，GeoWAM 为 90.2 EPDMS，本文列出的 DVGT-2 初始化对照为 89.6；navhard 双阶段总分分别为 36.6、31.7。两组计算差值为 0.6、4.9 分，但这不是只更改一个模块的消融。[原文表 2–3](https://arxiv.org/html/2608.23486v2#S4)
- **主要边界**：未来几何预测没有候选动作输入，属于从历史外推未来、再推断自车动作的设计；它不是对左转、直行、刹车分别想象后果的反事实世界模型。全文也未用消融单独验证未来几何、stop-gradient 或增加预训练的贡献。

## 论文要解决的问题

### 问题与假设

驾驶轨迹定义在空间里，而视频像素还混合纹理、光照与外观。视频看起来连贯，并不直接说明路沿位置、车辆距离和运动变换准确。GeoWAM 因此假设：把未来三维结构设为主预测目标，能为规划提供更直接、也更容易独立衡量的表示。

模型的输入是历史 RGB，而不是 LiDAR 点云；输出的点图为每个未来时刻、每个相机像素赋一个三维坐标。几何预训练使用从现成几何模型获得的稠密目标，规划阶段另用日志轨迹与相对位姿。免去人工 occupancy 标注不等于没有监督或不依赖教师模型误差。[原文 §2.1、§3](https://arxiv.org/html/2608.23486v2#S3)

作者称动作解码为 inverse-dynamics-like：先形成一个预测未来，再从它推断相容的自车运动。这要求预测未来保留规划所需的信息；若未来只对应日志中最常见的行为，模型没有显式接口去询问另一种行动会产生什么结果。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | GeoWAM 的具体差异 |
| --- | --- | --- |
| Zuo 等，DVGT-2，2026 arXiv 预印本（[v1 §3.2–3.3](https://arxiv.org/html/2604.00813v1#S3.SS2)） | 多视角图像和固定长度历史缓存联合预测当前 ego 系中的点图、相邻帧位姿及未来轨迹；轨迹采用 anchor-based diffusion head。 | GeoWAM 在其几何编码器基础上增加未来几何 decoder 和未来 ego decoder，再用确定性回归头输出单条轨迹。变化同时涉及预测目标、动作头和训练阶段。 |
| Zhang 等，Epona，2025，方法按原始 arXiv v1 核对（[§3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)） | 历史图像/动作经过时空 Transformer，分别条件化下一帧视频 DiT 与轨迹 DiT；视频生成可接模型动作或外部动作，纯规划可以关闭视频生成头。 | GeoWAM 的预测对象变为三维几何，且预测几何 token 在推理时直接供动作头读取。不能说所有视频 WAM 都必须先渲染视频；本文的 Epona+DVGT 几何对照还加入了后处理重建误差。 |

核对 DVGT-2 自身表 6 后可见，GeoWAM 表 2 标为“DVGT-2”的 89.6 实际对应 DVGT-2 原文的 **DVGT-2-NAVSIM** 专门微调版本；原始通用模型为 88.9。报告保留论文表中的数字，但明确这个变体身份，避免将差值误归为从零新增几何能力。[DVGT-2 原文表 6](https://arxiv.org/html/2604.00813v1#S4.T6)

## 方法和系统设计

### 输入输出与流程

DVGT-2 初始化的几何编码器将多视角历史变成两组多层表示：geometry tokens 表达各视角的空间结构，ego tokens 表达自车运动。训练时动态采样 2–8 路相机；NAVSIM 规划微调使用 8 路、3 帧历史。[原文 §3.1、§4.1](https://arxiv.org/html/2608.23486v2#S3.SS1)

未来几何查询由一个可学习 seed 加上未来时间、相机视角、二维位置编码构成。六层、1024 维、16 头的 decoder 先在未来时间轴上做因果自注意力，再查询历史记忆；它为 8 个未来时刻预测几何特征。Point DPT 把多层输出解码为点图和每像素 confidence。

点图 $\widehat P_{t+k}\in\mathbb R^{V\times H\times W\times3}$ 的坐标位于**各自未来时刻 $t+k$ 的 ego 坐标系**，而最终轨迹 $(x,y,\theta)$ 位于**当前自车坐标系**。两者都描述空间，但不能直接忽略坐标变换；这也是未来 ego tokens 和位姿学习有必要的原因。

未来 ego decoder 同时读取历史记忆和预测几何，再将预测 ego tokens 与历史 ego tokens 串接，用因果时间 Transformer 聚合。一个可学习 trajectory query 读取聚合结果，直接回归单条轨迹，没有轨迹 anchor、多模态分类或迭代采样。[原文 §3.2](https://arxiv.org/html/2608.23486v2#S3.SS2)

例如道路边停着一辆车时，未来点图可表示道路走廊与该车的空间关系，动作头再生成绕行轨迹；这是信息流的用途，不意味着点图准确就必然避免碰撞。

### 关键公式与直觉

第一组简写原文式 1–4，保留预测从历史到几何的顺序：

$$
\begin{aligned}
\mathcal Z_t&=\mathcal E_\theta(I_{t-K+1:t}),\\
\widehat{\mathcal U}_{t+1:t+F}&=\mathcal D_\phi(Q^{\mathrm{geom}},\mathcal Z_t),\\
(\widehat P_{t+k},\widehat C_{t+k})&=\mathcal G_\psi(\{\widehat X_{t+k}^\ell\}_{\ell=1}^{L}).
\end{aligned}
$$

$K=3$ 是历史帧数，$F=8$ 是未来步数，$\mathcal Z_t$ 汇总多视角、多层几何和 ego tokens，$Q^{\mathrm{geom}}$ 编码未来位置，$\widehat{\mathcal U}$ 是预测特征，$\widehat X^\ell$ 是为 Point DPT 各层投影后的版本。输入式中没有候选轨迹 $a$；所以预测出来的是从历史推断的未来，不是 $P(\mathrm{future}\mid\mathrm{history},a)$ 的显式多动作查询。[原式 1–4](https://arxiv.org/html/2608.23486v2#S3.SS1)

第二组对应式 5–7，将特征、未来点图与当前锚定放在一起：

$$
\begin{aligned}
\mathcal L_{\mathrm{feat}}&=\frac1{FL}\sum_{k=1}^{F}\sum_{\ell=1}^{L}
\left[1-\operatorname{cos}\left(\widehat X_{t+k}^{\ell},\operatorname{sg}(\overline X_{t+k}^{\ell})\right)\right],\\
\mathcal L_{\mathrm{pre}}&=\mathcal L_{\mathrm{feat}}+
\mathcal L_{\mathrm{point}}^{\mathrm{future}}+
\mathcal L_{\mathrm{point}}^{\mathrm{current}}.
\end{aligned}
$$

$\overline X$ 来自同一几何编码器对真实未来图像的编码，stop-gradient 使目标分支不直接接受该项梯度。点图损失包含欧氏点回归、confidence-aware 回归及多尺度表面法向一致性；当前帧也接受点图监督，避免预测训练使当前几何表征漂移。余弦相似度只约束特征方向，度量尺度主要依赖点图目标。原文没有逐项展开 confidence 损失和有效像素筛选参数，不能自行补出实现。[原式 5–7](https://arxiv.org/html/2608.23486v2#S3.SS1)

第三组重排原文式 9–11，说明几何到动作的接口与梯度边界：

$$
\begin{aligned}
\widehat E&=\mathcal D_\eta^{\mathrm{ego}}(Q^{\mathrm{ego}},\mathcal Z_t,
\operatorname{sg}(\widehat{\mathcal U})),\\
\widehat A_t&=\mathcal H_\omega(E_{t-K+1:t},\widehat E),\\
\mathcal L_{\mathrm{plan}}&=\mathcal L_{\mathrm{pre}}+5\mathcal L_{\mathrm{traj}}+5\mathcal L_{\mathrm{pose}}.
\end{aligned}
$$

$Q^{\mathrm{ego}}$ 是未来 ego 查询，$\widehat E$ 是预测运动 token，$\mathcal L_{\mathrm{traj}}$ 和 $\mathcal L_{\mathrm{pose}}$ 分别是专家轨迹、历史相对位姿的 L1 损失。两个权重 5 来自 §4.1。stop-gradient 切断轨迹损失经过预测未来特征分支的反传，但 $\mathcal Z_t$ 和历史 $E$ 仍参与规划，且全文明确联合微调预训练参数，因此不能解读为整个几何编码器完全不受轨迹训练影响。[原式 9–11；实现设置](https://arxiv.org/html/2608.23486v2#S3.SS2)

### 训练与推理

第一阶段用 OpenScene、nuScenes、Bench2Drive、Waymo、KITTI、Argoverse 2、DDAD 混合预训练 161 epochs；第二阶段在 NAVSIM navtrain 微调 40 epochs。新 decoder/动作头学习率 $10^{-4}$，预训练模块为 $2\times10^{-5}$，AdamW weight decay 0.05，5% warmup 后 cosine decay，bfloat16。没有公开各数据集样本数量、采样权重、batch size、GPU 型号/数量、总 GPU 时或端到端时延。[原文 §4.1](https://arxiv.org/html/2608.23486v2#S4.SS1)

训练目标分支可看真实未来图像，forecast 分支不可以。推理只需要历史多视角观测，保留未来几何和 ego decoder，再输出轨迹；Point DPT 可生成可视化点图，但轨迹头实际读取的是 geometry tokens，论文未报告跳过稠密解码时的实际运行配置和成本。也未给出显式路线指令在 GeoWAM 动作头中的注入位置，不宜从 DVGT-2 的实现默认继承所有接口。

## 关键图与可视化结果

![原论文图 2：历史几何记忆、未来几何预测与单轨迹动作头](https://arxiv.org/html/2608.23486v2/GeoWAM_pipeline.png)

从左侧三帧多视角图像读到中间历史 memory，再分别看绿色 geometry 路径与橙色 ego/pose 路径。绿色虚线的 Future Geometry K/V 表明动作分支读取未来几何特征，右下 Point DPT 生成点图；并没有候选动作反向进入未来几何 decoder 的箭头。正文式 9 进一步规定这条几何连接使用 stop-gradient。[原图 2 与图注](https://arxiv.org/html/2608.23486v2#S3.F2)

![原论文图 3：左转、直行和右转时聚合的预测点图与连续自车位姿](https://arxiv.org/html/2608.23486v2/GeoWAM_viz.png)

三列分别是左转、直行、右转，彩色框表示未来各时刻的自车位置；点图把多个未来时刻聚合，能看见道路标线、树木、杆体和车辆结构。它支持预测几何具有可读空间结构；图中没有同步真值、逐时刻误差或失败分布，不能据此判断运动身份是否持续准确、空间尺度是否校准，或他车是否会因不同自车行动而改变行为。[原图 3；§4.4](https://arxiv.org/html/2608.23486v2#S4.F3)

## 实验结论与证据

### 设置与指标

未来几何在 **nuScenes validation** 上评估，从 0.5 到 4 秒共八个时间点。每个三维点到该时刻 ego 原点的距离作为 ray depth，区别于相机光轴方向的深度。Abs Rel 是深度绝对误差除以真实深度后的平均，无量纲、越低越好；$\delta<1.25$ 是预测/目标比值的较大者小于 1.25 的比例，越高越好。表 1 的 mean 覆盖八帧，不能用表中仅列的 1/2/3/4 秒四项重新平均。[原文 §4.1–4.2](https://arxiv.org/html/2608.23486v2#S4.SS1)

规划在 navtrain 微调后，分别报告 NAVSIM-v2 navtest 与 navhard，均采用 human-penalty 协议和 EPDMS。navhard 的 36.6 是双阶段总分，不是 navtest 的同分布子项。基准原文的第二阶段图像预先渲染，再按第一阶段终点邻近程度加权；不能照本文的简述理解成每一时刻在线渲染、连续闭环交互。v2 背景车辆由 IDM 响应，行人等仍按日志运动。[NAVSIM-v2 §3](https://arxiv.org/html/2506.04218v3#S3)

### 主要结果与比较

| nuScenes validation，原表 1 | 八帧平均 Abs Rel ↓ | 八帧平均 $\delta<1.25$ ↑ | 1 秒 $\delta<1.25$ ↑ | 比较条件 |
| --- | --- | --- | --- | --- |
| Epona + DVGT | 0.274 | 0.655 | 0.732 | 先预测 RGB，再重建几何 |
| VGGT-World | 0.325 | 0.544 | 0.612 | 直接预测几何的外部基线 |
| GeoWAM | 0.257 | 0.754 | 0.708 | 直接预测未来几何 |

GeoWAM 较 Epona+DVGT 的平均 Abs Rel 少 0.017，按表值计算相对减少约 6.2%；阈值精度高 9.9 个百分点，但 1 秒时低 2.4 个百分点。比较共同输出的是几何，误差来源仍不同：Epona+DVGT 包含视频生成与后续重建两段误差，而不是纯粹与几何表示的单变量对照。[原表 1](https://arxiv.org/html/2608.23486v2#S4.T1)

| NAVSIM-v2 与原表位置 | 方法/变体 | EPDMS ↑ | 关键分项与边界 |
| --- | --- | --- | --- |
| navtest，表 2 | DVGT-2（对应 DVGT-2-NAVSIM） | 89.6 | EP 87.9，EC 77.0，DAC 97.9 |
| 同上 | GeoWAM | 90.2 | EP 87.0，EC 86.8，DAC 97.7；进展与道路合规未全面改善 |
| navhard，表 3 | DVGT-2 | 31.7 | S2 NC 77.8、TTC 73.2 |
| 同上 | EponaV2，带评分/RL 监督标记 | 36.1 | S2 NC 83.6、TTC 80.3 |
| 同上 | GeoWAM | 36.6 | S2 NC 80.4、TTC 76.2；高于其初始化对照，低于 EponaV2 的这两项 |

navtest 的综合提升伴随 EC 增加 9.8 分、EP 减少 0.9 分，不能概括为运动进展和安全一起提升。navhard 总分高于 EponaV2 0.5 分，但 S2 碰撞/TTC 分项分别低 3.2/4.1 分；较好总分没有抹平二阶段风险。不同模型的分项均值不能直接代入总分公式重算总分，因为规则在人/车配对及逐样本上组合。[原表 2–3](https://arxiv.org/html/2608.23486v2#S4.SS3)

### 消融与证据边界

本版本只有三张结果表，没有去除未来几何、移除特征对齐、改变 stop-gradient、替换轨迹头或控制额外预训练数据的消融。因此 0.6 分 navtest 和 4.9 分 navhard 增益支持整套方法有价值，但不能回答究竟来自未来预测、更多训练、确定性动作头还是其他实现差异。

尤其 DVGT-2 原文 NAVSIM 专用模型采用 4 帧、8 视角与扩散轨迹头，而 GeoWAM 为 3 帧、8 视角与直接回归。把二者称为“完全匹配、只多一个世界模型”的对照不准确。[DVGT-2 §4.2](https://arxiv.org/html/2604.00813v1#S4.SS2)

没有种子方差、置信区间、动态对象独立误差、confidence 校准或失败分层结果。几何预训练含 nuScenes，评估用其 validation，但未列各数据集 split/token 清单；这不是已经发现泄漏，而是无法仅凭全文独立审计隔离边界。教师点图的模型版本与筛选细节也影响误差解释。

## 应用场景与启发

- **作者主张**：以未来度量几何作为驾驶 WAM 的主要预测空间，并把学到的几何动态迁移到动作规划。
- **我的判断**：显式空间输出适合诊断“表征错了还是动作解码错了”；但当前方法没有多动作条件化，不能直接当作候选轨迹模拟器。点图几何也不自然包含红灯、交警手势等必须从外观读取的语义。
- **待验证假设**：真正有用的未来信息应在临近碰撞区域和动态对象附近，而不只是静态路面。固定 backbone 和未来头后，对不同空间区域的未来 tokens 做等算量扰动，若只有行动相关区域显著影响规划，才更支持几何动态在帮助决策。

## 局限与阅读风险

作者没有单设局限章节。下列是根据证据范围提出的限制：三维点图在不同未来自车坐标系中定义，ray-depth 精度不能单独证明全局位姿或运动身份一致；单条直接回归轨迹也没有显式表达多种合理行为的概率。没有用户给定动作的预测入口，不能据一个转弯案例断言学会了反事实响应。

正文和项目页把 navhard 描述成轨迹之后重新渲染并反馈的闭环式过程；基准原文明确使用预渲染候选观测与加权评估。本报告按基准说明限定为双阶段伪仿真，既保留 v2 的有限 IDM 反应，也不将其写成连续实车闭环。

原表 2 的 TransFuser 总分 84.0 与 DVGT-2 原文表 6 中同组子分对应的 76.7 不一致，原文未解释协议或变体差异；本稿不使用该行推导性能领先幅度。其余跨论文基线也应在复现时锁定 benchmark commit 和 human-penalty 配置。GeoWAM 没有时延、峰值显存或训练硬件，不能把删除 RGB 解码直接等同于已验证的部署提速。

## 后续跟进

### 最小验证与停止条件

- **当前资源（2026-09-12）**：官方项目页、v2 全文与原图可访问；项目页导航提供 Paper/arXiv，本次没有核实 GeoWAM 的训练代码、可运行配置、checkpoint 或预计算点图已开放。页脚的“source code”属于网站模板说明，不能当作模型开源。基础数据分别由各数据集发布，但本方法的混合比例与 split manifest 未公开。[项目页](https://yiren-lu.com/project_pages/geowam/)
- **最小实验**：以 GeoWAM checkpoint、教师点图制作规则和明确 split 为前置条件。在同一编码器、3 帧历史、8 视角和固定训练步数下，只改变动作头可读信息：当前/历史几何；真实预测未来几何；跨场景交换的预测未来几何。后两组保持 token 数和计算相同，保留同一个确定性轨迹头与几何辅助损失。首先比较 navtest，出现可重复信号后再跑 navhard。
- **成功信号**：真实未来 token 比历史-only 和交换组提高 EPDMS，并在动态交互子集改善 NC/TTC；记录几何误差与规划改变量的场景相关性，防止收益只来自 EC。至少三个种子、场景配对区间，另测推理时延和峰值显存。
- **停止/转向条件**：若交换未来仍不影响规划，先检查动作头是否忽略该分支；若几何更准而 NC/TTC 不改善，停止用几何平均误差代替规划价值，转向规划区域监督或动作条件预测。若同预算下收益不复现，不扩大七数据集训练规模。

### 来源与核验记录

本稿依据 [GeoWAM arXiv:2608.23486v2，2026-08-25](https://arxiv.org/html/2608.23486v2)，实际核验日为 2026-09-12。已读取全文 §1–5，核对式 1–11、表 1–3，并逐张打开原图 2 和图 3；作者名单与 Uber AV Labs、Case Western Reserve University 单位由全文首页和官方项目页交叉核对。

相关机制来自 [DVGT-2 v1 §3.2–3.3、§4.2、表 6](https://arxiv.org/html/2604.00813v1#S3.SS3) 和 [Epona v1 §3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)。评测解释另核对 [NAVSIM-v2 v3 §3](https://arxiv.org/html/2506.04218v3#S3)。本次未执行模型、下载权重或制作伪标签，内容核对不等于实验复现。
