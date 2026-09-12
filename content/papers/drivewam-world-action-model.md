---
{
  "id": "drivewam-world-action-model",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "DriveWAM: Video Generative Priors Enable Scalable World-Action Modeling for Autonomous Driving",
  "source": "arXiv:2605.28544 / https://arxiv.org/abs/2605.28544",
  "authors": ["Chen Shi", "Jinrui Xu", "Shaoshuai Shi", "Kehua Sheng", "Bo Zhang", "Li Jiang"],
  "affiliations": ["The Chinese University of Hong Kong, Shenzhen", "Voyager Research, Didi Chuxing"],
  "comment": "DriveWAM 把预训练视频生成模型改造成 video-action policy，用视频动态先验、VLM guidance 和 selective KV memory 支撑长时域 world-action 建模。"
}
---

## 一句话定位

DriveWAM 把视频生成 DiT 直接改造成驾驶策略：先预测下一段视频 latent，再用同一 Transformer 从该未来解码动作；冻结 VLM 每段提供语义指引，视频与动作分别保留有限容量 KV 记忆。它的价值是把生成先验、驾驶意图和历史压缩放进一个可分析的策略流程。

- **核心证据**：作者筛选的 PhysicalAI 1,000 个测试片段上，完整缓存为 0.83/2.47 m 的 4 秒 ADE/FDE；相同容量下选择性缓存为 0.89/2.52 m，优于 FIFO 的 1.40/3.47 m。[原文表 5](https://arxiv.org/html/2605.28544v1#S4.T5)
- **主要边界**：精度来自 20 秒片段，0.25 GB KV 和 1.44 GFLOPs 来自 300 秒资源剖析，不能合起来声称完成 300 秒安全闭环驾驶。默认单 H20 每 4 秒片段约需 1.262 秒推理，且路线指令由未来真值 yaw 的粗分类生成。[原文 §4.4；附录 B–C](https://arxiv.org/html/2605.28544v1#A3)

## 论文要解决的问题

### 问题与假设

静态图文预训练善于识别规则和场景语义，驾驶却还需要理解速度、运动连续性和场景演化。DriveWAM 假设视频基础模型的动态先验能够迁移到连续动作，但需要解决三个接口问题：视频任务如何变成策略、何时更新高层语义、长历史如何保留。

输入由截至当前片段的前视视频与动作历史、自车速度/加速度/曲率，以及下一段导航方向组成；输出是一段未来视频 latent 和相应自车平移、yaw 增量。模型先选择一个符合历史与语义意图的未来，再生成实现它的动作，不是枚举多个候选行动再用世界模型评分。[原文 §3.1](https://arxiv.org/html/2605.28544v1#S3.SS1)

例如曾短暂看见的行人被遮挡后，固定 FIFO 窗口可能删除有用信息；按当前注意力相关性与重复程度选缓存，理论上可以保留它。但“视觉上不重复”或“当前注意力高”不是安全相关性的真值，仍需要遮挡子集验证。

### 相关工作与差异

| 工作与一手来源 | 已有机制 | DriveWAM 的具体差异 |
| --- | --- | --- |
| Li 等，Causal World Modeling for Robot Control / LingBot-VA，2026 预印本（[v1 §3.2–3.3](https://arxiv.org/html/2601.21998v1#S3.SS2)） | Wan2.2 初始化的自回归视频/动作模型先生成未来 latent，再用逆动力学条件生成机器人动作，维护历史 KV 并接收新观测。 | DriveWAM 明确沿用其代码框架和 base checkpoint，迁移到驾驶动作/ego-state；新增逐片段道路语义指引和模态分池的缓存选择。视频先行的逆动力学结构不是本文独立新创。 |
| Ma 等，FlowCache，ICLR 2026（[正式入口](https://proceedings.iclr.cc/paper_files/paper/2026/hash/85dc8f85ff978b9c606d3b2f5b0da69a-Abstract-Conference.html)；[v1 §3.3](https://arxiv.org/html/2602.10825v1#S3.SS3)） | 对自回归视频按 attention importance 与 key redundancy 压缩 KV，保留固定预算，并研究分 chunk 去噪缓存复用。 | DriveWAM 借用相关性减冗余的准则，将视频、动作分别设置容量，保护数量少的动作历史。这里迁移的是 KV 选择思想，不应把全部 FlowCache 加速技术都算作已使用。 |
| Zhang 等，Epona，2025，机制按原始 arXiv v1（[§3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)） | 时空 Transformer 的历史表示分别条件化下一帧 DiT 和轨迹 DiT；视频可接外部动作，纯规划可关闭视频头。 | DriveWAM 保留视频基础 DiT 为共享策略核心，动作显式依赖先生成的未来 latent。两者的部署计算图不同，不能只按“都叫 WAM”比较成本。 |

## 方法和系统设计

### 输入输出与流程

每段时长 4 秒。视频由冻结的预训练 VAE 编成 latent，动作归一化为 ego 系平移/yaw 增量并经过 MLP，二者按时间组织成一个 token 流；自车状态通过独立 cross-attention 分支注入共享 Transformer。动作 encoder/decoder 的隐藏维度为 3072。[原文 §3.1、§4.2](https://arxiv.org/html/2605.28544v1#S3.SS1)

冻结的 Qwen3-VL-8B 读取最新前视图像、过去 4 秒轨迹的 BEV 图和下一段 straight/left/right 指令，输出简短的道路上下文与行为指引。训练时预计算并缓存这段文本，推理每个 chunk 边界查询一次；块对角 text mask 只允许目标 chunk 读取自己的 guidance，避免并行训练时看到后续 chunk 的描述。

Wan2.2-TI2V-5B 先对视频 latent 做三步 Euler 积分，再对动作做十步积分。特别是视频只从流时间 $\tau=1$ 走到 $0.6$，动作走到 $0$；规划使用的是这个中间噪声水平的未来表示，不应写成必须先获得完整、无噪声的未来视频。得到新的真实观测后，重新编码并加入历史，保持记忆与日志观测相连。[原文 §3.1、§4.2](https://arxiv.org/html/2605.28544v1#S4.SS2)

每层 KV 历史分为 video pool 和 action pool，容量分别为 448、160 tokens。超预算时删除低分旧 token，再写入新 chunk 的 KV；该步骤只在推理使用，不训练一个独立记忆网络。前视信息和有限缓存仍有遮挡边界，不能推断出全场景持续感知。

### 关键公式与直觉

第一组重排原文式 2–3，表示“先未来、后动作”，省略 token 投影的细节：

$$
\begin{aligned}
\widehat v^z_{k+1,\tau}&=T_\omega(z_{k+1,\tau};H_k,e_k,g_k,\tau),\\
\widehat v^a_{k+1,\tau}&=D_a\left(T_\omega(u_{k+1,\tau};\widetilde z_{k+1},H_k,e_k,g_k,\tau)\right),\\
\widetilde z_{k+1}&=
\begin{cases}
z_{k+1},&\text{teacher-forced training},\\
\widehat z_{k+1},&\text{inference}.
\end{cases}
\end{aligned}
$$

$H_k$ 是历史视频/动作 token，$e_k$ 是当前自车状态，$g_k$ 是该段语义指引；$z,u$ 分别是带噪视频和动作 token，$D_a$ 解码动作速度场。动作头训练时读取真实未来 latent，推理时读取模型预测，存在明确的 teacher-forcing 差异。作者用 noisy-history augmentation 缓解，但未单独量化该差异被消除了多少。[原式 2–3](https://arxiv.org/html/2605.28544v1#S3.SS1)

第二组为原式 4，视频与动作共同训练共享主干：

$$
\mathcal L=\mathbb E_{k,\tau}\left[
\lVert\widehat v^z_{k+1,\tau}-v^z_{k+1,\tau}\rVert_2^2+
\beta_a\lVert\widehat v^a_{k+1,\tau}-v^a_{k+1,\tau}\rVert_2^2
\right],\qquad\beta_a=1.
$$

$v^z,v^a$ 是从干净视频/动作样本与高斯噪声构成的线性 flow 路径目标；$\tau=1$ 是噪声端、$0$ 是数据端。第一项维持视频生成能力，第二项把共享表示转成驾驶动作。它是模仿/生成监督，没有加入碰撞或道路合规的直接奖励。真实未来仍可能有多种，而训练只有一条日志实现。[原式 4；实现设置](https://arxiv.org/html/2605.28544v1#S4.SS2)

第三组对应式 7–8，说明缓存选择没有“理解交通参与者”的显式标签：

$$
\begin{aligned}
s_j^m&=\lambda\rho_j^m-(1-\lambda)\eta_j^m,\qquad\lambda=0.07,\\
H_{k+1}^m&\leftarrow
\operatorname{Top}_{B^m-\lvert\Delta H_{k+1}^m\rvert}(H_k^m)
\cup\Delta H_{k+1}^m,\qquad m\in\{v,a\}.
\end{aligned}
$$

$\rho_j^m$ 是当前 query 分给历史 token $j$ 的平均 softmax attention，$\eta_j^m$ 是它与其他缓存 key 的平均余弦相似度；前者高希望保留，后者高表示重复。$B^m$ 是该模态容量，$\Delta H$ 是新 KV，Top 按 $s$ 选旧 token 为新片段腾位置。注意力与余弦不是同一数值尺度，$\lambda=0.07$ 是本文配置，不能理解成“安全权重只有 7%”；关键线索一旦被淘汰也没有自动恢复机制。[原式 6–8](https://arxiv.org/html/2605.28544v1#S3.SS3)

### 训练与推理

论文默认更新全部视频 DiT 以及新动作/ego-state 模块，冻结 VLM，图 1 标示 VAE 与文本 encoder 冻结。训练为 $256\times448$、48 张 H20、每卡 batch 1，AdamW 学习率 $10^{-5}$。NAVSIM 训练 100k iterations，每样本当前一帧、4 秒单 chunk；PhysicalAI 训练 50k iterations，从 20 秒片段随机裁 12 秒，视频 1 Hz、动作 10 Hz。NAVSIM 正文写未来采样 1 Hz，本次未检查提交给评价器时的重采样代码。[原文 §4.2](https://arxiv.org/html/2605.28544v1#S4.SS2)

整段训练用因果 teacher-forcing mask 并行处理所有 chunk，线上则逐 chunk 生成。**语义信息的边界尤其要注意**：VLM 的图像和历史轨迹不包含目标段未来图像，但附录 B 的路线指令来自该未来 4 秒的真值 yaw 变化，大于 15° 为左、小于 −15° 为右，否则直行。它是目标侧生成的粗方向标签，不是仅由历史传感器推断；实际部署需另有在线导航提供等价指令，且尚需验证该替换带来的差异。

## 关键图与可视化结果

![原论文图 1：共享视频动作主干、VLM guidance 与分模态 KV 记忆](https://arxiv.org/html/2605.28544v1/x1.png)

自下而上先看 VLM 生成下一段 guidance，再看视频/动作/ego 编码如何接入中间 DiT，最后看顶部旧 KV 选择与新 KV 写入。雪花表示冻结模块、火焰表示训练模块。图里的 Memory Selection 是预算内选择相关且不重复的历史，不是独立的危险检测器。[原图 1 与图注](https://arxiv.org/html/2605.28544v1#S3.F1)

![原论文图 3：query chunk 4 和 5 后保留的视频 tokens](https://arxiv.org/html/2605.28544v1/x3.png)

三行是历史 chunk，第二、三列分别表示新 query 4、5 到来后保留的区域，颜色表示高低分，黑色区域已删去。保留位置随当前 query 改变，不等同于只按时间删除；图中也能看到道路和背景被保留的片段，不能简单解释为所有静态背景都删除。原图号是 **3**，并非现有稿标的 2；它只展示视频缓存，不展示动作池的覆盖或遮挡行人重新出现后的决策表现。[原图 3 与图注](https://arxiv.org/html/2605.28544v1#S3.F3)

## 实验结论与证据

### 设置与指标

NAVSIM 采用 v1，约 103k trainval、12k test 样本，单前视相机；PDMS 越高越好，组合碰撞、可行驶区、TTC、舒适性与进展。这里是非反应式日志交通的轨迹评估，没有 v2 的 IDM 背景车，也没有连续闭环驾驶结果。[原文 §4.1；NAVSIM-v2 对 v1 的说明](https://arxiv.org/html/2506.04218v3#S2)

PhysicalAI 原始集合含 306,152 个 20 秒片段。本文使用 Qwen3-VL-8B 标签筛出训练 100k 及测试 1,000 片段：训练保留 interest score≥2 的片段，再采样一半低分片段；测试覆盖稀有事件、较高兴趣分数及 200 个普通场景。它是作者策划的测试子集，不能将结果等同于整个官方 test split 的表现。[附录 A](https://arxiv.org/html/2605.28544v1#A1)

ADE 是预测轨迹整个时域的平均位置误差，FDE 是末端位置误差，单位米、越低越好。它们衡量与记录行为的一致性，不直接测碰撞、安全回退或反应式交互。所有方法在该子集仅用前视输入、每次输出一条轨迹；这控制了推理输入形式，但没有抹平预训练数据、模型规模、指令输入和 checkpoint 适配的差异。

### 主要结果与比较

| 评测设置与原表位置 | 方法/配置 | 关键指标与方向 | 比较条件与边界 |
| --- | --- | --- | --- |
| NAVSIM-v1，表 1 | Epona / DriveWAM | PDMS ↑ 86.2 / 90.1 | 均单视角，骨干和训练目标不同 |
| 同上 | DriveVLA-W0，含多轨迹 anchor 监督 | PDMS ↑ 90.2 | 高于 DriveWAM 0.1 分，训练设置不同；不能宣称表内绝对最高 |
| PhysicalAI 策划测试子集，表 2 | Alpamayo-1.5 | ADE/FDE@3s ↓ 0.80/2.31 m；@4s ↓ 1.44/4.18 m | 10B 对照，作者按前视单轨迹评估 |
| 同上 | DriveWAM，完整缓存 | ADE/FDE@3s ↓ 0.47/1.35 m；@4s ↓ 0.83/2.47 m | 5B 策略加 8B VLM；模型总资源不能只写 5B |

4 秒 ADE 减少 0.61 m，按表值算相对减少约 42.4%；这是被筛选子集的误差改善，没有方差或置信区间，不写成显著提升。VaVAM 发布 checkpoint 只支持 3 秒，因此表 2 没有其 4 秒结果，也不能用缺失数字判断失败。[原表 2](https://arxiv.org/html/2605.28544v1#S4.T2)

附录 C 的单 H20 分解是 VLM 125 ms、视频 372 ms、动作十步 765 ms，合计 **1262 ms/4 秒 chunk**。动作五步变体为 125+372+374=871 ms，ADE/FDE 为 0.84/2.45 m。4 秒内能算完一段不等于可以 10 Hz 重规划；分段摊销也不消除突发事件出现后的响应延迟。论文没有目标车规硬件、p99、峰值总显存或动作异步执行失败统计。[原表 6](https://arxiv.org/html/2605.28544v1#A3.T6)

### 消融与证据边界

固定 50k iterations 时，SE guidance 的 4k/20k/100k 数据结果分别为 ADE 1.01/0.94/0.83 m、FDE 2.95/2.65/2.47 m；全局固定提示对应 ADE 1.21/0.95/0.92 m。三点趋势支持更多不同训练片段有益，但每个片段被重复看到的次数随规模变化，也不能据此拟合普适 scaling law。20k 时 ADE 只改善 0.01 m，收益并非随数据量单调放大。[表 3](https://arxiv.org/html/2605.28544v1#S4.T3)

在 100k、50k iterations 的表 4 中，不用预训练但保留视频监督为 1.10/3.26 m；保留预训练却移除视频监督为 1.23/3.79 m；两者都有为 0.83/2.47 m。它支持当前结构同时需要预训练和视频目标，但没有隔离 noisy-history augmentation、真实未来条件与生成未来条件之间的差异。

| 原表 5 缓存设置 | 20 秒片段 ADE/FDE@4s ↓ | 300 秒剖析 KV 内存 ↓ | 单因果注意力层 GFLOPs ↓ |
| --- | --- | --- | --- |
| 完整历史 | 0.83 / 2.47 m | 3.07 GB | 17.37 |
| FIFO | 1.40 / 3.47 m | 0.25 GB | 1.05 |
| 选择性缓存 | 0.89 / 2.52 m | 0.25 GB | 1.44 |

选择性缓存较 FIFO 的 ADE/FDE 少 0.51/0.95 m，但 FLOPs 高于 FIFO；相较完整缓存，误差仍增加 0.06/0.05 m。3.07/0.25≈12.28 与 17.37/1.44≈12.06 是 **KV 大小和一个注意力层**的比值，不是整个 13B 系统的显存或推理加速倍数。论文没有在 300 秒长度上测相同轨迹精度和安全性。[原文 §4.4](https://arxiv.org/html/2605.28544v1#S4.SS4)

## 应用场景与启发

- **作者主张**：用视频基础模型作为策略核心，VLM 提供随场景更新的意图，在有限历史缓存中扩展驾驶 world-action 建模。
- **我的判断**：最有用的可复用模块是保护动作历史的模态分池，以及将 guidance 与目标 chunk 一一对应的文本 mask。它们适合做受控消融；当前全套策略更接近可研究的高成本模型，尚不是已验证的实时车端控制器。
- **待验证假设**：选择性缓存的优势应来自保存会重新变得重要的旧证据。若在同容量下加入交通参与者持续性约束，能改善“曾可见、后遮挡、再出现”的片段，而非只改善背景稳定场景，才支持其安全相关的记忆价值。

## 局限与阅读风险

论文没有单设局限章节。首先，动作 teacher-forcing 用真实未来 latent，部署只生成至视频流时间 0.6；噪声增强能否覆盖这种差异，尚无独立数字。其次，“causal guidance”只保证没有读目标段未来图像；路线方向仍是该段真值运动的粗标签，部署在线导航是否提供等价语义需要另外验证。不能直接把它判成违规泄漏，也不能忽略它带来的方向先验。

同一个冻结 VLM参与测试片段选择与策略 guidance，可能造成筛选偏好；这种偏好是否影响结果应通过未经选择的官方子集检查。稀有事件标签覆盖交警手势、遮挡行人等，但作者没有公布这些类别的独立规划安全结果，不能凭入选标签宣称已解决相应任务。

资源版本也要分开。官方仓库 2026-07-19 公告修复 batch-size bug，并报告 8 张 H20、每卡 batch 6、100k steps 得到 89.9 PDMS；这与 v1 论文的 48 卡、90.1 分属于不同发布记录。本稿不将公告数字替换进论文表，也未核验 bug 对旧结果的具体影响。[官方仓库 News](https://github.com/chenshi3/DriveWAM#news)

## 后续跟进

### 最小验证与停止条件

- **当前资源（2026-09-12）**：官方 [GitHub](https://github.com/chenshi3/DriveWAM) 已有模型、训练/评测脚本与配置，本次打开了 PhysicalAI 配置及测试 prompts 文件页面；[Hugging Face](https://huggingface.co/chenchenshi/DriveWAM/tree/main) 可见 NAVSIM 和 PhysicalAI 两套 config.json、各约 12.5 GB safetensors，以及 4k/20k/100k clip CSV、训练 prompts 和 navtest metric cache。文件可见不等于已加载验证。本次没有下载权重或运行模型。
- **数据前置条件**：PhysicalAI 原始前视图像、ego-motion/calibration 需从官方数据页访问，页面要求账户接受数据条款；本次没有代为接受或下载。先锁定原始数据版本、发布权重和测试 clip IDs，再核对作者的未来 yaw 方向标签与实际可提供的导航指令。[官方数据页](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles)
- **最小实验**：先从已发布 1k test 列表固定抽取 100 段，使用同一权重、同 guidance、同 3/10 步求解器与随机种子，比较 Full、FIFO、Selective 的 448/160 token 预算。记录逐 chunk ADE/FDE、缓存淘汰时间、旧动态对象 token 覆盖和总时延；把“遮挡后再出现”样例单列，人工检查标签。只剖析资源的 300 秒运行另记，不能用它补精度结论。
- **成功信号**：在匹配内存下复现 Selective 优于 FIFO，且动态重现子集收益大于背景稳定子集；同时确认与 Full 的误差差距和实际 p99 开销。初筛有信号后扩到全部 1k 并做场景配对 bootstrap，不重新筛测试样例。
- **停止/转向条件**：若优势在同容量或准确输入对齐后消失，停止扩大训练；若错误来自 guidance 或真值方向替换为在线导航，则先修复输入接口，不能归咎缓存。若只能保住平均 ADE 而频繁删除旧危险对象证据，转向对象持续性或保守保留策略。

### 来源与核验记录

本稿按 [DriveWAM arXiv:2605.28544v1，2026-05-27](https://arxiv.org/html/2605.28544v1) 读取全文 §3–4、附录 A–D，核验日为 2026-09-12。关键位置为式 1–8、表 1–6、图 1 和图 3；两张图均逐张下载、打开并对照原图注，保留原有官方 URL。作者单位与名单由全文首页和项目页确认，维持现有元数据。

方法来源另核对 [LingBot-VA v1 §3.2–3.3](https://arxiv.org/html/2601.21998v1#S3.SS2)、[FlowCache v1 §3.3](https://arxiv.org/html/2602.10825v1#S3.SS3) 和 [Epona v1 §3.2–3.3](https://arxiv.org/html/2506.24113v1#S3.SS2)。资源检查单独读取项目页、GitHub News/配置/测试文件页及 Hugging Face 文件列表；没有对实现进行完整审计，没有复测榜单或时延。
