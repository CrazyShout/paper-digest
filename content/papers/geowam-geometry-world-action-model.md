---
{
  "id": "geowam-geometry-world-action-model",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving",
    "dynamic-scene-representation"
  ],
  "title": "GeoWAM: Visual Geometry World Action Models for Autonomous Driving",
  "source": "arXiv:2608.23486 / https://arxiv.org/abs/2608.23486 / HTML: https://arxiv.org/html/2608.23486v3 / Project: https://yiren-lu.com/project_pages/geowam/",
  "authors": [
    "Yiren Lu",
    "Xin Ye",
    "Jiaming Liu",
    "Philip Jacobson",
    "Jin Yao",
    "Yi-chung Chen",
    "Liam Merino",
    "Dhruva Dixith Kurra",
    "Min Cai",
    "Tom Lampo",
    "Yu Yin",
    "Danhua Guo",
    "Burhan Yaman"
  ],
  "affiliations": [
    "Uber AV Labs",
    "Case Western Reserve University"
  ],
  "comment": "GeoWAM 先预测未来三维几何，再生成轨迹。v3 新增几何消融和 PhysicalAI 数据扩展实验，navhard 从 36.6 提高到 39.6；增益仍限于伪仿真与开放环评测。"
}
---

## 一句话定位

GeoWAM 从历史多视角图像预测未来稠密三维点图和几何 token，再让动作分支读取预测几何、输出单条轨迹。它把可度量的空间结构放在观察与规划之间，便于分别检查几何预测和动作生成。

本页于 2026-10-05 更新至 v3：新增未来几何消融、预训练数据扩展和跨数据集规划实验；v2 的七数据集配方、几何结果与旧图 3 不再与新表混用。这是已收录论文的版本更新，不计作本期新论文。

- **核心证据**：v3 表 6 中，保留当前几何但移除未来几何时，navtest/navhard 为 89.2/31.7 EPDMS；加上未来几何后为 90.2/36.6，再加 PhysicalAI 预训练为 90.7/39.6。[原表 6](https://arxiv.org/html/2608.23486v3#S4.T6)
- **主要边界**：未来几何 decoder 不接收候选动作，因此不能直接查询“左转或刹车各会发生什么”。navhard 采用双阶段伪仿真，nuScenes 为开放环；本文没有连续实车闭环证据。

## 论文要解决的问题

### 问题与假设

驾驶轨迹定义在空间里，而视频像素还混合纹理、光照与外观。视频看起来连贯，并不直接说明路沿位置、车辆距离和运动变换准确。GeoWAM 因此假设：把未来三维结构设为主预测目标，能为规划提供更直接、也更容易独立衡量的表示。

模型的输入是历史 RGB，而不是 LiDAR 点云；输出的点图为每个未来时刻、每个相机像素赋一个三维坐标。几何监督使用 MoGe-2 生成的稠密点图和有效掩码，规划阶段另用日志轨迹与相对位姿。免去人工 occupancy 标注不等于没有监督或不依赖教师模型误差。[原文 §2.1、§3](https://arxiv.org/html/2608.23486v3#S3)

作者称动作解码为 inverse-dynamics-like：先形成一个预测未来，再从它推断相容的自车运动。这要求预测未来保留规划所需的信息；若未来只对应日志中最常见的行为，模型没有显式接口去询问另一种行动会产生什么结果。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | GeoWAM 的具体差异 |
| --- | --- | --- |
| Zuo 等，DVGT-2，2026 arXiv 预印本（[v1 §3.2–3.3](https://arxiv.org/html/2604.00813v1#S3.SS2)） | 多视角图像和固定长度历史缓存联合预测当前 ego 系中的点图、相邻帧位姿及未来轨迹；轨迹采用 anchor-based diffusion head。 | GeoWAM 在其几何编码器基础上增加未来几何 decoder 和未来 ego decoder，再用确定性回归头输出单条轨迹。变化同时涉及预测目标、动作头和训练阶段。 |
| Zhang 等，Epona，[ICCV 2025 正式版](https://openaccess.thecvf.com/content/ICCV2025/html/Zhang_Epona_Autoregressive_Diffusion_World_Model_for_Autonomous_Driving_ICCV_2025_paper.html)，方法按原始 arXiv v1 核对（[§3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)） | 历史图像/动作经过时空 Transformer，分别条件化下一帧视频 DiT 与轨迹 DiT；视频生成可接模型动作或外部动作，纯规划可以关闭视频生成头。 | GeoWAM 的预测对象变为三维几何，且预测几何 token 在推理时直接供动作头读取。不能说所有视频 WAM 都必须先渲染视频；本文的 Epona+DVGT 几何对照还加入了后处理重建误差。 |

核对 DVGT-2 自身表 6 后可见，GeoWAM 表 2 标为“DVGT-2”的 89.6 实际对应 DVGT-2 原文的 **DVGT-2-NAVSIM** 专门微调版本；原始通用模型为 88.9。报告保留论文表中的数字，但明确这个变体身份，避免将差值误归为从零新增几何能力。[DVGT-2 原文表 6](https://arxiv.org/html/2604.00813v1#S4.T6)

## 方法和系统设计

### 输入输出与流程

DVGT-2 初始化的几何编码器将多视角历史变成两组多层表示：geometry tokens 表达各视角的空间结构，ego tokens 表达自车运动。图 2 展示三帧历史；v3 方法用 $K$ 表示历史长度，但没有重新列出完整输入采样和训练配置。[原文 §3.1、§4.1](https://arxiv.org/html/2608.23486v3#S3.SS1)

未来几何查询由一个可学习 seed 加上未来时间、相机视角、二维位置编码构成。未来几何 decoder 先在未来时间轴上做因果自注意力，再查询历史记忆；它为 8 个未来时刻预测几何特征。几何 head 把多层输出解码为点图和每像素 confidence。

点图 $\widehat P_{t+k}\in\mathbb R^{V\times H\times W\times3}$ 的坐标位于**各自未来时刻 $t+k$ 的 ego 坐标系**，而最终轨迹 $(x,y,\theta)$ 位于**当前自车坐标系**。两者都描述空间，但不能直接忽略坐标变换；这也是未来 ego tokens 和位姿学习有必要的原因。

未来 ego decoder 同时读取历史记忆和预测几何，再将预测 ego tokens 与历史 ego tokens 串接，用因果时间 Transformer 聚合。一个可学习 trajectory query 读取聚合结果，直接回归单条轨迹，没有轨迹 anchor、多模态分类或迭代采样。[原文 §3.2](https://arxiv.org/html/2608.23486v3#S3.SS2)

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

$K$ 是历史帧数，$F=8$ 是未来步数，$\mathcal Z_t$ 汇总多视角、多层几何和 ego tokens，$Q^{\mathrm{geom}}$ 编码未来位置，$\widehat{\mathcal U}$ 是预测特征，$\widehat X^\ell$ 是为 几何 head 各层投影后的版本。输入式中没有候选轨迹 $a$；所以预测出来的是从历史推断的未来，不是 $P(\mathrm{future}\mid\mathrm{history},a)$ 的显式多动作查询。[原式 1–4](https://arxiv.org/html/2608.23486v3#S3.SS1)

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

$\overline X$ 来自同一几何编码器对真实未来图像的编码，stop-gradient 使目标分支不直接接受该项梯度。点图损失包含欧氏点回归、confidence-aware 回归及多尺度表面法向一致性；当前帧也接受点图监督，避免预测训练使当前几何表征漂移。余弦相似度只约束特征方向，度量尺度主要依赖点图目标。点图目标和掩码由 MoGe-2 生成；原文没有逐项展开 confidence 损失和有效像素筛选参数，不能自行补出实现。[原式 5–7](https://arxiv.org/html/2608.23486v3#S3.SS1)

第三组重排原文式 9–10，说明几何到动作的接口与梯度边界：

$$
\begin{aligned}
\widehat E&=\mathcal D_\eta^{\mathrm{ego}}(Q^{\mathrm{ego}},\mathcal Z_t,
\operatorname{sg}(\widehat{\mathcal U})),\\
\widehat A_t&=\mathcal H_\omega(E_{t-K+1:t},\widehat E),\\
\mathcal L_{\mathrm{plan}}&=\mathcal L_{\mathrm{pre}}+\lambda_{\mathrm{traj}}\mathcal L_{\mathrm{traj}}+\lambda_{\mathrm{pose}}\mathcal L_{\mathrm{pose}}.
\end{aligned}
$$

$Q^{\mathrm{ego}}$ 是未来 ego 查询，$\widehat E$ 是预测运动 token，$\mathcal L_{\mathrm{traj}}$ 和 $\mathcal L_{\mathrm{pose}}$ 分别是专家轨迹、历史相对位姿的 L1 损失。两个 $\lambda$ 控制规划监督的权重；v3 未列出它们的取值，不沿用旧版超参数来补齐。stop-gradient 切断轨迹损失经过预测未来特征分支的反传，但 $\mathcal Z_t$ 和历史 $E$ 仍参与规划，且全文明确联合微调预训练参数，因此不能解读为整个几何编码器完全不受轨迹训练影响。[原式 9–10](https://arxiv.org/html/2608.23486v3#S3.SS2)

### 训练与推理

v3 将几何训练数据写为 NAVSIM navtrain 和 NVIDIA PhysicalAI-Autonomous-Vehicles 的训练集，规划微调只使用 navtrain；nuScenes validation 用于几何与零样本规划评估。表 5 比较额外使用 0、100、496、832 小时 PAI 数据，832 小时为论文所称完整训练集。v2 的七数据集、161/40 epoch 描述已经改变，不能与 v3 结果合并为同一配方。[v3 §4.1、§4.5](https://arxiv.org/html/2608.23486v3#S4.SS1)

训练目标分支读取真实未来图像，预测分支只能读取历史；第二阶段联合微调几何与动作模块。推理保留未来几何与 ego decoder，动作头读取几何 token，点图 head 另用于稠密输出。v3 未给出完整的优化器、batch、GPU 时数或端到端时延；本文参数量写为 1.9B，但正文所指附录在本次取得的 13 页 PDF 和 HTML 中未出现，无法据此补全训练预算。

## 关键图与可视化结果

![原论文 v3 图 2：历史几何、未来几何与轨迹生成的信息流](../../assets/papers/geowam-geometry-world-action-model-v3-figure-2.png)

从左向右看多视角历史 memory、绿色未来几何和橙色运动分支。几何预测一方面解码成点图，另一方面把特征送给运动分支；右侧展示两个 decoder 的时间自注意力和交叉注意力结构。没有候选动作进入几何预测的箭头，式 9 还对送入动作分支的预测几何使用 stop-gradient。[v3 图 2](https://arxiv.org/html/2608.23486v3#S3.F2)

![原论文 v3 图 3：从预测视频与预测点图恢复自车运动](../../assets/papers/geowam-geometry-world-action-model-v3-figure-3.png)

每行是一段场景：左侧为 PWM 未来视频，中间为 GeoWAM 点图，右侧把恢复的轨迹与日志真值对齐。PWM 分别经对极几何、VGGT 恢复运动；GeoWAM 对静态三维关键点做 Kabsch 对齐。两例中蓝色几何恢复轨迹更接近黑色真值，但恢复算法不同，也没有样本级统计。这张新图检验表示能否显露运动，不是动作头规划成功率；它已替换 v2 的左转、直行、右转点图展示。[v3 §4.7、图 3](https://arxiv.org/html/2608.23486v3#S4.SS7)

## 实验结论与证据

### 设置与指标

未来几何在 nuScenes validation 评估，点到对应时刻自车原点的距离定义为 ray depth，区别于相机光轴深度。Abs Rel 是归一化绝对误差，越低越好；$\delta<1.25$ 是预测与目标比值落入阈值的比例，越高越好。v3 §4.2 将本组比较描述为未在 nuScenes 训练，并说明 Epona 使用 navtrain checkpoint；这里记录的是该版声明的实验设置，不能与 v2 的混合训练表直接拼接。[v3 §4.1–4.2](https://arxiv.org/html/2608.23486v3#S4.SS1)

NAVSIM-v2 navtest 使用 EPDMS；navhard 把原始观察与预生成的后续观察分两阶段评估。每段四秒轨迹由控制器执行，段内没有新传感器反馈给规划器；背景车辆采用 IDM，行人等仍沿日志运动。因此这里的 EPDMS 是指定伪仿真协议下的综合分数，不是实车安全概率。[NAVSIM-v2 §3](https://arxiv.org/html/2506.04218v3#S3)

nuScenes 规划另报 1、2、3 秒 L2 位移误差和碰撞率，表中的 Avg. 是论文聚合值。零样本指没有 nuScenes 专用轨迹微调，不代表全部初始化都未接触过 nuScenes。GeoWAM 使用 DVGT-2 初始化，而 DVGT-2 的原始混合训练包含 nuScenes；公开材料尚未提供足以隔离这部分影响的初始化清单。[DVGT-2 §4.1–4.2](https://arxiv.org/html/2604.00813v1#S4.SS1)

### 主要结果与比较

| v3 nuScenes 几何，表 1 | 平均 Abs Rel ↓ | 平均 $\delta<1.25$ ↑ | 4 秒 Abs Rel ↓ | 条件 |
| --- | --- | --- | --- | --- |
| Epona + DVGT | 0.274 | 0.655 | 0.310 | 生成视频后重建几何 |
| VGGT-World | 0.325 | 0.544 | 0.357 | 直接预测几何的外部基线 |
| GeoWAM，无 PAI 预训练 | 0.208 | 0.789 | 0.245 | v3 的训练设置 |
| GeoWAM，有 PAI 预训练 | 0.202 | 0.802 | 0.276 | 加入额外几何预训练 |

PAI 预训练改善平均误差，但 4 秒 Abs Rel 从 0.245 增至 0.276，阈值精度也从 0.716 降至 0.704；远期几何没有同步改善。视频基线还包含后续重建误差，不能把全部差距解释为预测空间的单一影响。[原表 1](https://arxiv.org/html/2608.23486v3#S4.T1)

| v3 设置与原表 | 无 PAI → 有 PAI | 关键分项与取舍 |
| --- | --- | --- |
| navtest，表 2 | EPDMS 90.2 → 90.7 | EP 87.0 → 86.7，EC 86.8 → 87.8；总分增加没有带来所有分项提升。 |
| navhard，表 3 | EPDMS 36.6 → 39.6 | S2 NC 80.4 → 84.1、TTC 76.2 → 80.2；EP 88.9 → 84.0、DAC 76.3 → 76.0。 |
| nuScenes 零样本，表 4 | Avg. L2 1.28 → 0.89 m；碰撞率 0.24% → 0.12% | 碰撞减少 0.12 个百分点，按舍入表值相对减少 50%；1 秒和 2 秒碰撞分别从 0.00%/0.10% 升至 0.02%/0.12%。 |

navhard 增加 3.0 分，按表值计算相对增加约 8.2%，不能写成安全提高 8.2%。最新 39.6 对应额外 PAI 数据，若其他论文引用 GeoWAM 的 36.6，应保留旧版本和训练预算。综合分数和风险分项都需报告，且跨模型没有统一训练预算或种子区间。[原表 2–4](https://arxiv.org/html/2608.23486v3#S4.SS3)

### 消融与证据边界

v3 新增了此前缺少的机制消融，旧报告的“未隔离未来几何贡献”判断据此修正：

| v3 表 6(a) | navtest EPDMS ↑ | navhard EPDMS ↑ |
| --- | --- | --- |
| 保留当前几何、去除未来几何 | 89.2 | 31.7 |
| 当前与未来几何，无 PAI 预训练 | 90.2 | 36.6 |
| 当前与未来几何，有 PAI 预训练 | 90.7 | 39.6 |

这组对照比直接比较 DVGT-2 更接近未来几何的贡献。表 6(b) 又把预测长度设为 2/4/6/8 帧，对应 1/2/3/4 秒，navhard 为 30.7/32.2/34.3/36.6。只预测 1 秒的 30.7 低于无未来几何的 31.7，说明添加预测分支本身未必有益；比较还需控制查询数量和算量。[原表 6](https://arxiv.org/html/2608.23486v3#S4.SS6)

表 5 随 PAI 数据 0/100/496/832 小时增加，navhard 为 36.6/37.8/38.2/39.6；nuScenes Avg. L2 为 1.28/0.92/0.86/0.89 m，末一步变差，而平均碰撞率为 0.24/0.19/0.16/0.12%。这些是数据量扩展结果，未报告固定总更新次数、种子方差或置信区间；数据多样性与训练量的贡献仍未完全分离。[原表 5](https://arxiv.org/html/2608.23486v3#S4.T5)

## 应用场景与启发

未来几何与动作之间的显式接口适合做故障定位：几何已经错误时先修预测，几何合理但轨迹仍危险时检查动作头与规则语义。它也提供一种无需人工 occupancy 标注的预训练目标，但教师点图仍是一种监督。

值得验证的问题是：未来分支的规划收益究竟来自行动相关区域，还是静态路面和更长预测带来的额外信息。v3 已有去除分支的对照，下一步应在相同 token 数和预算下，分别扰动动态对象、行驶走廊和无关背景，并同时测量几何误差与 NC/TTC 的变化。这个区域性假设尚未由论文验证。

## 局限与阅读风险

点图在各自未来自车坐标系中定义，平均 ray-depth 精度不能单独证明全局位姿、对象身份或语义规则正确。输出单条轨迹且没有候选动作条件，也限制了对多种合理行为和反事实后果的表达。

v3 补上未来几何消融，但 stop-gradient 的独立作用、教师误差、confidence 校准及完整计算代价仍缺结果。正文称在附录比较参数与更多可视化，本次官方 v3 PDF 为 13 页、以参考文献结束，HTML 也没有对应附录；因此不把未取得的材料视为已核验。

预训练扩展同时改变数据规模，源数据 split 清单、采样比例和总更新预算需要公开后才能独立复核。这里没有据材料缺口认定数据泄漏。表 2 沿用的 TransFuser 84.0 与 DVGT-2 原文同组分项对应的 76.7 仍存在差异，本页不利用该行推导相对领先幅度；复现实验应锁定 benchmark commit 与 human-penalty 设置。

## 后续跟进

### 最小验证与停止条件

- **当前资源（2026-10-05）**：官方 v3 论文、项目页和图片可访问。项目页已含 [GeoWAM 仓库链接](https://github.com/vulab-AI/GeoWAM)，但本次 GitHub 公开仓库、tree 和 README API 均返回 404，因此未核实方法代码、可运行配置或权重已公开。数据来自 NAVSIM/OpenScene 与 PhysicalAI 各自发布渠道；方法专用 split、点图与混合清单未取得，未下载大型数据或权重。
- **最小实验**：以可用 checkpoint、MoGe-2 目标制作规则和清晰 split 为前提，先复核表 6 的无未来几何与完整分支。随后固定编码器、预测长度、训练步数、token 数和动作头，对比真实未来 token、跨场景交换 token，以及仅扰动动态/静态区域的 token。先跑 navtest，有稳定信号后再跑 navhard。
- **成功信号**：真实未来相对交换组在多个种子与配对场景上改善 EPDMS 和 NC/TTC，且行动相关区域的扰动影响更大；同时报告几何误差、EP、时延和显存，避免只保留有利分项。
- **停止/转向条件**：交换未来仍不影响轨迹时先检查动作头是否读取该分支；几何更准但风险分项不改善时停止用几何平均误差代替规划价值。若等预算下收益消失，先检查数据和训练差异，不继续扩大预训练规模。

### 来源与核验记录

本页首次按 v2 于 2026-09-12 核对，现于 2026-10-05 重开 [v3 HTML](https://arxiv.org/html/2608.23486v3) 和 [13 页官方 PDF](https://arxiv.org/pdf/2608.23486v3)，阅读方法、表 1–6、图 2–3及结论，逐张打开两张新版本原图并核对 PDF 首页作者与单位。arXiv v3 记录为 9 月 29 日，PDF 首页另印 10 月 1 日；两种日期保留各自含义。原 v2 配方与图像仅作为版本历史，不再代表最新实验。

相关机制本次重开 [DVGT-2 v1 §3–4](https://arxiv.org/html/2604.00813v1#S3)、[Epona v1 §3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)，评测协议另核对 [NAVSIM-v2 v3 §3](https://arxiv.org/html/2506.04218v3#S3)。本页解释的是论文证据和可检验设想，未运行模型或独立复现结果。
