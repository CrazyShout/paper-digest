---
{
  "id": "compact-va-planning-token-compression",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "world-models"
  ],
  "title": "Planning-aligned Token Compression for Long-Context Autonomous Driving",
  "source": "IEEE Robotics and Automation Letters 2026 (accepted; formal page unavailable at audit) / arXiv:2606.07464 / https://arxiv.org/abs/2606.07464",
  "authors": [
    "Zhixuan Liang",
    "Yuxiao Chen",
    "Yurong You",
    "Peter Karkus",
    "Wenhao Ding",
    "Boyi Li",
    "Alexander Popov",
    "Yan Wang",
    "Maximilian Igl",
    "Yiming Li",
    "Danfei Xu",
    "Nikolai Smolyanskiy",
    "Boris Ivanovic",
    "Ping Luo",
    "Marco Pavone"
  ],
  "affiliations": [
    "NVIDIA Research",
    "School of Computing and Data Science, The University of Hong Kong",
    "Stanford University",
    "Georgia Institute of Technology"
  ],
  "comment": "COMPACT-VA 关注端到端驾驶的长上下文瓶颈，用 planning intent 监督 token compression，让工作记忆优先保留会影响决策的历史信息。"
}
---

## 一句话定位

COMPACT-VA 用分层记忆压缩 5 s 多视角历史，再让“从历史预测驾驶意图”的任务约束压缩器保留什么。未来轨迹仅为训练后验提供监督，规划器在训练与推理都读取先验预测的 latent。它在记忆相关开环任务上提高 Go Success Rate，并在 A100 上将未压缩长上下文的 1253.52 ms 降到 377.08 ms；这两个结论来自不同评测协议。[固定 v3，2026-08-19，III–V 节](https://arxiv.org/html/2606.07464v3#S3)

## 论文要解决的问题

### 需要记住的是事件，不只是最近图像

在全向停车路口，当前画面可能看见横向车辆，却不能说明谁先到。更早的观察还可能记录后来被遮挡的对象。将全部历史送入 VA transformer 会增加注意力和显存成本；稀疏采样则可能错过事件。

本文基于 Alpamayo 的 vision-action 变体，不依赖文本指令。输入是多相机历史、时间和相机标识及自车历史轨迹，输出是量化后的未来轨迹 tokens。分层时间衰减仍是人工设定，学习的是各层压缩时保留的内容；不能概括为完全取消时间启发式。

### 与两项原始机制比较

| 一手来源 | 原有机制 | 本文的区别 |
| --- | --- | --- |
| Rae 等，Compressive Transformer，2019；[v1 §3、Algorithm 1–2](https://arxiv.org/html/1911.05507v1#S3) | 将 FIFO 中淘汰的旧隐藏状态压入第二级记忆；可通过重建原记忆或重建其 attention 输出训练压缩器，辅助梯度不进入主网络 | COMPACT 在视觉输入 token 层形成多级缓冲，并用未来意图预测与轨迹损失联合优化；前作已有任务相关的压缩目标，不能一概称为只按时间删帧 |
| van den Oord 等，VQ-VAE，2017；[v1 §3.1–3.3](https://arxiv.org/html/1711.00937v1#S3) | 最近码本项替代连续 latent，straight-through 传递 encoder 梯度，分别更新码本与 commitment；原设置训练后另学先验 | COMPACT 有读取未来轨迹的条件后验和读取压缩历史的先验，用 KL 对齐，且规划器始终采用先验 latent；离散意图承担驾驶任务监督 |

两篇均读取原文，比较的是记忆位置、监督信号与梯度边界；论文没有在驾驶任务中等预算重跑这两项通用方法。

## 方法和系统设计

### 层级记忆与数量核算

图像编码器将每幅图变成 160 tokens。当前设置有 20 个时间点、4 Hz 覆盖 5 s、每点 2 相机，总计 40 幅图。Q-former 将查询与输入 tokens、时间、相机及历史轨迹信息放在双向注意力中聚合，然后按时间顺序送入因果 policy transformer。[III-A–B](https://arxiv.org/html/2606.07464v3#S3.SS2)

原式 1–2 为：

$$
N_{\mathrm{raw}}=T N_{\mathrm{cam}}N_{\mathrm{img}},\qquad
N_{\mathrm{comp}}=\sum_{k=1}^{K}n_kN_{\mathrm{cam}}\left\lfloor N_{\mathrm{img}}/r_k\right\rfloor.
$$

$T$ 是时间点数，$n_k$ 是第 $k$ 层时间点数，$r_k$ 是相对原始图像的累计压缩率。三层用 $n=(4,5,11)$、$r=(1,16,80)$，因此由 6400 压到 $8\times160+10\times10+22\times2=1424$ 视觉 tokens，约减少 4.49 倍。表内的 8/10/22 是图像数，与正文 4/5/11 时间点相差两路相机，不能混成帧频。RoPE 的频率步长按压缩率调整。

### 意图 latent 的训练信息边界

后验把真值未来轨迹拟合为加速度、曲率控制序列，再量化并聚合成 4 个局部和 1 个全局 token，输出高斯分布。先验从压缩观测经 attention pooling 与 MLP 预测 latent。意图维度 32、共享 VQ 码本有 20 项；未来 64 个路点为后验产生 128 个控制 tokens。这与 policy 输出端采用的 FSQ 轨迹 tokenizer 是不同环节。[III-C、V-A](https://arxiv.org/html/2606.07464v3#S3.SS3)

将原文最近邻量化与式 3 并列：

$$
i^*=\arg\min_i\lVert z-c_i\rVert_2,\qquad z_{\mathrm{skill}}=c_{i^*},
$$

$$
\mathcal L=\mathcal L_{\mathrm{traj}}+\lambda_{\mathrm{KL}}D_{\mathrm{KL}}\!\left(q_\phi(z\mid o,\tau_{\mathrm{future}})\,\Vert\,p_\theta(z\mid o_{\mathrm{comp}})\right)+\lambda_{\mathrm{commit}}\mathcal L_{\mathrm{commit}}.
$$

$c_i$ 是码本项，$q$ 是训练后验，$p$ 是先验，轨迹项是未来 token 交叉熵。离散技能经过投影，作为额外 token 与压缩记忆一起进入 policy。**规划器训练时也用先验 $z_p$，不把后验真值 latent 当作部署输入**；测试仅保留先验、量化与轨迹生成路径。

### 仍缺少的实现细节

作者称 Q-former、先验/后验、码本和 policy 端到端更新，没有 RL 目标；文中“closed-loop coupling”描述训练信号的耦合，不能读成用闭环驾驶奖励训练。图 2 又把意图回送到压缩器，而文字推理顺序为先压缩再求先验，首次 latent 如何初始化、是否重复压缩未明确。码本更新、两项损失权重、优化器、完整训练时长与冻结视觉编码器的细节也未报告。

## 关键图与可视化结果

![原论文 Fig. 1：通过较早的车辆到达事件判断应否让行](../../assets/papers/compact-va-planning-token-compression-original-figure-1.png)

先比较 -3 s 与当前画面，再看左右两种保留历史的路径。图强调到达顺序这个记忆需求；它不证明每一个被保留 token 都编码了路权，也不应把图中概括百分比当作单个样例测量。[Fig. 1](https://arxiv.org/html/2606.07464v3#S1.F1)

![原论文 Fig. 2：Q-former、分层 FIFO、条件后验/先验和轨迹输出](../../assets/papers/compact-va-planning-token-compression-original-figure-2.png)

右上角 future trajectory 标注 train only；右下进入 policy 的 skill 应来自 prior。图中回送压缩器的箭头需要与实际执行顺序核对。两张 v3 官方 PNG 均单独打开，本次使用干净原图，使用新的本地原图资源路径。[Fig. 2](https://arxiv.org/html/2606.07464v3#S2.F2)

## 实验结论与证据

### 记忆任务是开环行为评测

作者从 Physical AI AV 数据筛选先减速、停住再加速的片段，约占原数据 16%；验证集为 20000 段 20 s 视频，10 Hz 共 200 帧，关键点在第 50 帧。剩余筛选数据训练，但完整训练段数未给。Go SR 衡量应离开时能否出发，Stop SR 衡量应停车时是否低于 0.5 m/s；roll-through 是未完全停下的比例，停车位置和时长误差分别对应空间及秒数。具体时间容差未列全。[IV-B、V-A](https://arxiv.org/html/2606.07464v3#S4.SS2)

| Table I，同开环筛选集 | 视觉 tokens | Go SR ↑，% | Stop SR ↑，% | Roll-through ↓，% |
| --- | ---: | ---: | ---: | ---: |
| 1 s / 8 图 Alpamayo | 1280 | 63.8 ± 0.1 | 86.8 ± 0.2 | 9.0 ± 0.1 |
| 5 s / 8 图稀疏采样 | 1280 | 62.0 ± 0.1 | 86.2 ± 0.1 | 9.3 ± 0.0 |
| 5 s / 40 图未压缩 | 6400 | 61.9 ± 0.1 | 85.8 ± 0.2 | 9.9 ± 0.1 |
| 同 40 图压缩，无规划对齐 | 1424 | 65.6 ± 0.2 | 87.5 ± 0.2 | 8.5 ± 0.1 |
| COMPACT-VA Disc. | 1424 | 68.2 ± 0.3 | 89.2 ± 0.1 | 7.0 ± 0.2 |
| COMPACT-VA Cont. | 1424 | 68.3 ± 0.2 | 88.5 ± 0.1 | 7.1 ± 0.3 |

68.3 相对标准 63.8 是 **4.5 个百分点**，相对稀疏基线 62.0 才是 6.3 个百分点；相对同压缩预算的 65.6 是 2.7 个百分点。Cont. 的最高 Go SR 与 Disc. 的最高 Stop SR 不属于同一配置。保留原表误差条，但其统计定义与每个配置的重复次数未说明；不能据此声称显著性。[Table I](https://arxiv.org/html/2606.07464v3#S4.T1)

### 模块与意图干预证据

Table IV 中，同样 40 图，纯压缩 Go SR 63.5，加入历史轨迹为 65.6，再加规划意图为 68.3；最后一行误差条写 ±2.1，与 Table I 的 ±0.2 不一致，不能自行选一个作为正确值。Table VII 的证据更明确：固定同一个 Disc. 检查点，只干预推理意图 token。

| Table VII，同检查点 | Go SR ↑，% | Stop SR ↑，% | Roll-through ↓，% |
| --- | ---: | ---: | ---: |
| 原意图 | 68.2 | 89.2 | 7.0 |
| 均值替换 | 64.7 | 87.5 | 8.2 |
| 样本间打乱 | 66.1 | 88.4 | 7.6 |
| 移除 | 60.3 | 86.3 | 9.2 |

这说明策略确实使用了样本相关意图。作者也承认移除会破坏已共同适配的 backbone，因此 60.3 不能直接等同重新训练无意图模型的 65.6。码本有 15–17 项活跃也不自动证明每项对应人类可解释技能。[V-D、Table VII](https://arxiv.org/html/2606.07464v3#S5.T7)

### 常规闭环与计算成本

闭环在 AlpaSim 的 910 个 NuRec 场景进行，两种策略都用通用驾驶数据训练；作者明确缺乏足够停车路口重建，主要检验常规驾驶。因此闭环结果不能替代上述记忆任务的闭环验证。Table II 的 collision_at_fault 为 0.04→0.05、progress 为 0.73→0.71，作者称整体相近，不能改写成所有安全指标均不退化；表中这些字段的精确聚合单位未说明。[V-C](https://arxiv.org/html/2606.07464v3#S5.SS3)

| Table III，A100，20 次运行 | 平均时间 ↓，ms | 时间标准差，ms | 峰值显存 ↓，GB |
| --- | ---: | ---: | ---: |
| 短上下文 2 s / 18 图 | 498.50 | 5.59 | 5.94 |
| 长上下文 5 s / 40 图 | 1253.52 | 27.99 | 10.51 |
| COMPACT，5 s / 40 图 | 377.08 | 12.85 | 3.95 |

相同历史范围下约 3.32 倍加速、2.66 倍显存缩减是可复算结果；这不是车端网络或全闭环控制时延，也不是任意分辨率和硬件上的保证。本文未提供运行 batch、精度及编译配置。

## 应用场景与启发

作者希望把历史记忆压缩为有界、规划相关的接口。我的判断是，最有启发的是在压缩器上引入“是否足以预测未来意图”的监督，而不是仅复制三层压缩率。对路口到达顺序、遮挡对象再出现等事件，应同时衡量该停和该走，防止保守停车掩盖记忆失败。

待验证假设：固定 1424 token 和训练预算，意图对齐对需要较早历史的场景更有帮助，对当前画面已足够的场景差别较小。用截掉关键历史、打乱历史时间和完整历史三种输入可将这个假设与一般正则化收益区分。

## 局限与阅读风险

主要记忆收益来自按专家停车—启动筛选的开环子集，不能外推到所有交互。Table VI 各行均为 5 s，只改变图像数量；不能据它声称增加到了更长秒数的历史。不同压缩率同时改变 token 数，也没有严格固定算力。

未来监督仅训练可用，先验的错误可能在罕见场景集中发生。算法描述仍缺少意图回馈的执行顺序、完整训练配置及 Disc./Cont. 与所有 tokenizer 的实现映射。最强风险不是“压缩必然丢信息”，而是尚未在记忆困难的真实闭环任务中验证是否丢掉了关键事件。

## 后续跟进

### 资源与最小验证

2026-09-12 已读取固定 v3 HTML 与 PDF，arXiv 声明 RA-L 2026 accepted；未核验正式出版页。未找到作者发布的 COMPACT 代码、配置、模型权重或 20000 验证片段清单。[AlpaSim 仓库](https://github.com/NVlabs/alpasim)公开可读，[NuRec 页面](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles-NuRec)显示访问文件需接受数据条款；本次未下载文件或接受条款。这些上游资源不等于 COMPACT 实现已发布。

取得实现与片段 ID 后，用一张 A100 先比较同 5 s / 40 图的“无规划对齐”和“完整模型”，固定 token 数、训练更新、数据与解码设置；训练显存与时长未公开，须从小批量资源测量开始。观察 Go/Stop SR、roll-through，并在关键事件早于最近 1 s 的样本单独统计。成功信号是对齐在等预算下改善这些事件，且没有以 roll-through 增加换进度；若效应仅在训练后验可见时存在，或去除关键历史后结果不变，就停止记忆能力解释，检查泄漏或捷径。

### 核验记录

依据 [2606.07464v3](https://arxiv.org/html/2606.07464v3) 的式 1–3、Tables I–VII、Figs. 1–2 和 8 页正式格式全文，未发现独立附录；相关原文为 Compressive Transformer v1 §3 与 VQ-VAE v1 §3。v3 首页明确 NVIDIA、HKU、Stanford、Georgia Tech，原机构信息保留。全文、图片和来源可用性已检查，不代表训练或仿真复现。
