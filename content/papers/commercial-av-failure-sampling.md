---
{
  "id": "commercial-av-failure-sampling",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "autonomous-driving-security"
  ],
  "title": "Importance Sampling and PCA for Finding Failures in Commercial Autonomous Vehicles",
  "source": "arXiv:2607.18106 / https://arxiv.org/abs/2607.18106 / Fixed full text: https://arxiv.org/html/2607.18106v1",
  "authors": [
    "Hailey Warner",
    "Duncan Eddy",
    "Shreya Parjan",
    "Caroline Cahilly",
    "Harrison Delecki",
    "Matthias Kleinstäuber",
    "Chaitanya Shinde",
    "Jerry Lopez",
    "Mykel J. Kochenderfer"
  ],
  "affiliations": [
    "Department of Aeronautics and Astronautics, Stanford University",
    "Torc Robotics"
  ],
  "comment": "论文把 AST/DiFS 接到商业卡车规划器的仿真接口，并用 PCA 提炼可复放失效模板。定向采样显著增加找到碰撞的机会，但不估计真实事故概率；计算成本、样本计数与概率口径仍须分开。"
}
---

## 一句话定位

这项工作把稀有失效搜索接到 Torc 商业卡车规划器，研究“能否找到碰撞”以及“能否把噪声轨迹压缩成可重复诊断”。AST 偏向高碰撞发现率，DiFS 学习更分散的失效分布；PCA 再从 AST 轨迹中提炼 eigenfailure 模板。

- 核心证据：同一切入场景下，Monte Carlo 2,000 次未碰撞，AST 的 300 次评测报告 94.6%，DiFS 报告 3.1%。[表 IV](https://arxiv.org/html/2607.18106v1#S3.T4)
- 主要边界：这是商业规划器在 Object Sim 中的结果，不是实车事故率或真实传感器故障分布。

## 论文要解决的问题

### 失败发现与风险估计的区别

对可靠规划器随机采样，预算可能耗尽仍无事故；但定向找到的碰撞又可能高度重复。这里把被测规划器视作黑箱，只给最近周车的感知位置加时序噪声；真实周车运动未被任意改写。输出包括噪声、车辆轨迹、碰撞及严重度，支持离线回归，而非证明自然分布的事故概率。

### 相关工作与差异

| 一手工作 | 原始机制 | 本文变化 |
| --- | --- | --- |
| Koren 等，AST，IV 2018；[arXiv v1](https://arxiv.org/pdf/1902.01909v1) | 把环境随机量作为动作，用 MCTS/深度 RL 寻找高似然失败 | 换成商业卡车意图规划器与 SAC 求解，并分析噪声结构 |
| Delecki 等，DiFS；[2024 原文 v1](https://arxiv.org/html/2406.14761v1) | 按低 robustness 分位数逐轮训练条件扩散提议分布，在多类仿真任务上评估模式覆盖 | 商业接口、切入噪声与成本约束；当前论文引用其 2025 发表版本，不混用两版数值 |

## 方法和系统设计

### 黑箱接口与噪声假设

商业规划器先按规则层级选择长时路径，再作二次规划，并有安全覆盖逻辑；ROS 连接 Object Sim，ZeroMQ 连接搜索器。噪声标准差随相对纵/横距离线性变化，原式 2–3 给出 $\sigma_x=0.02x+1$、$\sigma_y=0.00625y+0.2$，以米坐标设置。它是人为规格模型，非真实传感器拟合；高斯无界，不能据此断言所有合规传感器都获得更强安全保证。

### 搜索目标与 PCA

$$
p^*(x\mid\mathrm{fail})\propto\mathbf1[\mathrm{collision}]p(x),\qquad
R=\begin{cases}0,&\text{terminal collision},\\-\alpha-c_d d_{\min},&\text{terminal non-collision},\\\log p(a_t),&\text{otherwise}.\end{cases}
$$

分段依次对应终止且碰撞、终止未碰撞、其余步骤。原式 1、4 中，$x$ 为整条噪声轨迹，$a_t$ 为单步扰动，$d_{{\min}}$ 为最近车辆距离。终止罚项促使 AST 找到碰撞，似然项偏向更常见扰动，但该 reward 并未给出对真实事故概率的无偏估计。原文式 4 后一句称系数惩罚碰撞，与分段式不一致；这里按公式解释。

DiFS 反复采样、按最近距离挑选最低 30% robustness 样本，再训练去噪分布；其目标是失败分布而非单一最大回报策略。

$$
D_c=D-\mu,\quad D_c=U\Sigma V^\top,\quad Z=D_cV_k,\qquad \widehat D=ZV_k^\top+\mu.
$$

这是原式 5–6 的显式中心化重写。$D$ 的每行是噪声时间序列，$V_k$ 保留主成分；聚类低维表示，再反投影得到代表轨迹。大 loading 只说明噪声方差集中在哪些时刻，不能单独证明该时刻是失败的因果根源，需要复放干预支持。

### 训练与评测预算

SAC 单因素参数扫各训练 300 episodes，主配置包括 batch 16、buffer $10^4$、学习率 3e-4、目标网络系数 0.001。主训练表 III 各计 1,000 episodes。DiFS 文字说明先取 500 MC 样本、再取 500 更新，另称最终评测 500；表 IV 实际列 300，因此不能把这些阶段合并成一个确定总预算。推理阶段冻结商业规划器，仅运行训练后的搜索器；完整商业依赖不公开。

## 关键图与可视化结果

![原论文图 1：Object Sim 中的卡车切入场景](../../assets/papers/commercial-av-failure-sampling-figure-1.png)

绿色是真实周车轮廓，灰框为规划器感知位置；它说明搜索入口在感知接口，不是直接操控卡车控制器。

![原论文图 8：三个聚类对应的 eigenfailure 噪声轨迹](../../assets/papers/commercial-av-failure-sampling-figure-2.png)

图片文件名沿用站内资产，原论文编号为 8，已对照官方 PDF 第 6 页。横纵噪声分列、三聚类分行；时间轴按原图保留，不能无依据当成秒。模板复现碰撞并不证明 PCA loading 是唯一根因。

## 实验结论与证据

### 主结果及成本口径

表 IV 的严重度为碰撞相对速度平方，单位 $(\mathrm{m/s})^2$，不是能量或伤害程度；log-probability 为到碰撞前的逐步累积值，不同终止长度会影响比较。

| 评测方法 | episodes | 碰撞率（%） | 时间 | 平均 log-probability | 平均严重度 |
| --- | ---: | ---: | --- | ---: | ---: |
| MC | 2,000 | 0.0 | 26:14:29 | 未报告 | 未报告 |
| AST | 300 | 94.6 | 05:32:08 | -2870.26 | 164.75 |
| DiFS | 300 | 3.1 | 03:53:10 | -1490.71 | 115.21 |

按 T4 每小时 1.20 美元折算，表中每个碰撞的 GPU 成本为 AST 0.023 美元、DiFS 0.518 美元，只覆盖云实例，未含商业软件与工程成本。较高 log-probability 也不能直接推出自然事故更常见。

### 可复放性与原文不一致

表 VI 与正文给出 DiFS 9/300 次碰撞，即 3.0%，与表 IV 的 3.1% 不一致；另有 10 次非碰撞近失。作者用 MinTTC<1.5 s、DRAC>7 m/s² 分类，九次碰撞中四次为超出制动能力、五次为规划器失败。这是所选指标下的归类，不是全面责任认证。

AST 迁移到切入距离 ±5 m 的两个变体，各 100 次均碰撞。PCA 使用另外表述的 300 条 AST 失败轨迹，不应与表 IV 全部评测样本混为一谈；前三主成分对纵向噪声只解释约 40% 方差。代表模板复放仍碰撞，支持有限场景回归，但未给出更广泛模式覆盖和修复后测试。

## 应用场景与启发

- 作者主张：把失效发现推进到低维、可复现的诊断模式。
- 我的判断：价值在商业接口和回放资产；高定向碰撞率不意味着系统自然运行危险。
- 待验证假设：逐段删除 PCA 模板中的大幅噪声并重新计算结果，可区分必要触发段与 reward 造成的无用前置偏差。

## 局限与阅读风险

单类切入及两种距离变体不足以证明跨场景泛化；真实噪声的偏置、相关性、漏检没有建模。商业规划器与仿真器限制复现。样本数、概率累积时长和表格计数尚需作者统一；论文未验证仿真到真实迁移，也未实证某种修复消除了故障机制。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：固定论文与官方原图可访问；未核到本文商业栈、场景配置、搜索权重和 PCA 数据的完整公开包。[DiFS 上游](https://github.com/sisl/DiFS)有通用代码，但不包含 Torc/Object Sim 实验。
- 最小验证：先取得可授权复放的噪声/轨迹，固定初始场景、规划器版本与随机种子，比较完整模板、零噪声、逐段移除和等幅随机噪声；记录碰撞、MinTTC、DRAC 和逐步似然。
- 成功信号：只有可定位的必要噪声片段持续触发失败，模板作用在 ±5 m 条件下可重复。
- 停止条件：结果仅由重置或轨迹长度差异造成，或模板与等幅随机噪声无区别；此时不能宣称已找到根因。

### 来源与核验记录

固定 arXiv:2607.18106v1（2026-07-20），2026-09-12 阅读全文、式 1–6、表 II–VI、图 1/8及官方 PDF 第 6 页，并核对 AST/DiFS 原始方法。未执行搜索、驾驶或训练实验。
