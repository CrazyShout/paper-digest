---
{
  "id": "qwen-drive-foundation-model",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "dynamic-scene-representation"],
  "title": "Qwen-Drive-1.0: An Initial Step towards a Vision-Language Foundation Model for Autonomous Driving",
  "source": "arXiv:2609.00111v1 / https://arxiv.org/abs/2609.00111；Qwen 官方技术报告与代码 https://github.com/QwenLM/Qwen-Drive-1.0",
  "authors": ["Xin Zhou", "Zongchuang Zhao", "Zhibo Yang", "Mingsheng Li", "Humen Zhong", "Shuai Bai", "Du Chu", "Ruizhe Chen", "Zhaohai Li", "Jun Tang", "Qiuyue Wang", "Mingkun Yang", "Jiazhao Zhang", "Dayiheng Liu", "Dingkang Liang", "Xiang Bai"],
  "affiliations": ["Qwen Team", "Huazhong University of Science and Technology"],
  "comment": "保留 Qwen3.5 的主干结构，接入可检查的三维感知头和独立规划专家；数据配方与开放接口值得读，但高 PDMS 不等于全面闭环领先，强化学习改善安全也降低了行进率。"
}
---

## 一句话定位

Qwen-Drive-1.0 尝试让同一套视觉语言表示同时支持驾驶问答、显式三维感知和轨迹规划：Qwen3.5-4B 旁接 BEV 感知头和约 1.1B 参数的 Planning Expert，经过分阶段训练获得驾驶能力，同时尽量保留通用视觉语言能力。核心价值是可复用的统一表示与数据工程，而不是某一张榜单的最高分。

- 核心证据：NAVSIM v1.1 单轨迹 PDMS 从 SFT 的 88.2 到 RL 的 90.7；916 个 AlpaSim 场景中越界率从 24% 降到 12%，但进度从 54% 降到 48%，at-fault 总分仍低于 Alpamayo-1.5。
- 时间边界：arXiv 首次提交是 2026-08-31 17:59:54 UTC，属于本期向前覆盖公告延迟的窗口；不能因为编号是 2609 就称为“9 月首次提交”。[固定 v1、表 6–7、提交记录](https://arxiv.org/abs/2609.00111v1)

## 论文要解决的问题

### 为什么保留通用 VLM，又加入显式三维输出

只有驾驶问答正确，不代表模型已经拥有可用于精确规划的几何表示。反过来，只优化轨迹或驾驶文本，也可能损失通用问答和空间理解能力。论文把问题拆成两步：先通过驾驶 VQA、通用 VQA 和三维监督共同适配表示，再在冻结表示上训练独立轨迹专家。

输入包括图像及相机布局描述、历史自车轨迹、导航指令和当前车辆状态；可选地加入文本规划理由。输出是未来 5 秒、10 Hz 的 50 个自车坐标系 waypoint，每点含纵向位置、横向位置与航向。BEV 分支另外输出检测、语义占据和地图。可检查的输出帮助分析几何能力，但不能据此假定 planner 必然使用了正确的几何证据。[§2.1–2.3](https://arxiv.org/html/2609.00111v1#S2)

### 与三条技术路线的关系

| 自身一手来源 | 已有机制 | Qwen-Drive 的差异和比较边界 |
| --- | --- | --- |
| NVIDIA，Alpamayo-R1，2025；[原文架构与训练](https://arxiv.org/html/2511.00088v2)，以及 [Alpamayo-1.5 官方实现](https://github.com/NVlabs/alpamayo1.5) | 因果链理由条件化 diffusion/flow 动作专家，利用 VLM KV cache，并训练理由—动作一致性；1.5 是后续公开版本 | Qwen-Drive 增加联合显式 3D 感知适配并冻结主干训练规划；不能把 KV cache 连接或 flow matching 本身写成本文首创，R1 与 1.5 的表格也要分开 |
| Zhou 等，AutoVLA，2025；[自身方法原文](https://arxiv.org/html/2506.13757v3) | 将物理动作离散 token 化，在同一自回归序列内生成理由与动作；GRPO 学习是否需要较长推理 | Qwen-Drive 使用独立连续轨迹专家和可选理由，而不是由 LLM 直接生成动作 token；数据规模和是否按每个数据集单独训练不一致，不能仅归因于输出形式 |
| Yang 等，BEVFormer v2，2022 arXiv 版、CVPR 2023；[自身原文 §3](https://arxiv.org/html/2211.10439v1) | 用透视空间监督改善图像主干与 BEV 检测优化，并把透视 proposal 送入 BEV 头 | Qwen-Drive 借鉴 BEV 检测组件形成多任务 3D probe；其对照实现删去了 Group-DETR 与对应 2D loss，另有多任务变体，表 1 不是原版 BEVFormer v2 榜单成绩 |

三项均读取自身全文或官方版本实现。以上比较是机制定位，不包含系统查新意义上的“首次”认定。

## 方法和系统设计

### 从共享表示到两个外部模块

感知头读取多视角视觉特征，用几何 view transform 得到 voxel 特征，并把 VLM 最终输出经特征金字塔扩为多尺度后送入 BEV transformer，再分别解码检测、占据和地图。它对共享视觉路径提供三维梯度，也作为观察 VLM 三维信息是否可访问的 probe。

规划头不以感知头输出的检测框作为唯一接口，而是读取 VLM 的 key/value cache。Qwen3.5 主干含八个 grouped-query softmax attention 层；每层 cache 条件化连续四个规划 transformer 层，共 32 层。带噪 waypoint、历史轨迹编码、流时间、导航和自车状态共同参与生成，最终从噪声积分到连续轨迹。感知和规划因此共享表示，但不是“先输出全部感知结果，再按规则规划”的串联系统。[§2.1、图 2–3](https://arxiv.org/pdf/2609.00111v1#page=3)

### 三组关键定义与优化目标

第一组是条件生成的任务定义，原式 6：

$$
\tau\sim p(\tau\mid s,\ell,\tau_{\rm hist},n,e,r),\qquad \tau=\{(x_k,y_k,\theta_k)\}_{k=1}^{50}.
$$

$s$ 是传感器图像，$\ell$ 为序列化相机布局，$\tau_{\rm hist}$ 为历史轨迹，$n$ 为导航，$e$ 为自车状态，$r$ 为可选文本理由。位置、航向分别按 165 米、25 米和 $\pi/2$ 归一化。不同数据集必须统一到相同坐标和采样率，不能把不同相机 rig 的 token 顺序随意拼接。

第二组是 clean-endpoint flow matching，合并原式 7–8 并展开速度误差的定义：

$$
\tau_t=(1-t)\tau_0+t\tau_1,\quad \hat v_\theta=\frac{\hat\tau_1-\tau_t}{1-t},\quad \mathcal L_{\rm plan}=\mathbb E\lVert\hat v_\theta-(\tau_1-\tau_0)\rVert^2+2\!\times\!10^{-4}\mathcal L_{\Delta1}+2\!\times\!10^{-5}\mathcal L_{\Delta2}.
$$

$\tau_0$ 是高斯噪声，$\tau_1$ 是日志真值轨迹，$\hat\tau_1$ 是专家预测的干净终点；后两项约束时间一阶、二阶变化。训练将 $t$ 截至 0.9，避免分母过小。推理用确定性 Euler 积分；这里监督的是一条记录未来及其平滑性，仍可能惩罚另一条同样安全、但不同于人类日志的路线。[式 7–8及相邻定义](https://arxiv.org/pdf/2609.00111v1#page=5)

第三组说明 RL 改的是什么。原式 13 为组内相对优势：

$$
A_i=\frac{R_i-\bar R}{\sigma_R+10^{-8}},\qquad \bar R=\frac1G\sum_{j=1}^G R_j,\quad G=8.
$$

同一场景产生八组理由/轨迹，$R_i$ 为对应评测奖励。由于默认 flow 积分是确定性的，作者在部分生成步骤加入低频子空间随机扰动，再用原式 14 的 on-policy 梯度优化专家；并非直接对一个无随机转移的 Euler 过程套策略梯度。NAVSIM 用 PDMS，WOD-E2E 用人类偏好 RFS，并对各源加入共享位移约束。VLM 保持冻结，所以这些奖励不会直接更新语言推理参数，也没有证明文本理由与动作已实现因果一致。[§2.2、式 9–14、附录 A](https://arxiv.org/pdf/2609.00111v1#page=6)

### 四阶段训练和部署边界

- Stage 1 冻结视觉主干和 VLM，只训练新感知头；Stage 2 联合更新视觉主干、VLM 和感知头，混合三维监督、驾驶语言数据与通用 VQA。
- Stage 3 冻结共享主干，只训练规划专家；有/无理由的样本都只监督未来轨迹。Stage 4 继续冻结主干，用任务奖励优化专家。
- 推理可选择直接规划、先生成理由再规划，或单独问答。真实未来、感知标注和 benchmark 奖励只用于训练或评估，不是部署输入；best-of-6 由评测器选最高 PDMS 的做法尤其不能直接当作可部署选择器。

Stage 2 在重复前含约 154 万例，包含自建驾驶 QA；Stage 3 的约 283 万规划样本来自 NAVSIM/OpenScene、WOD-E2E、PAI-AV，其中 24.2% 带被接受的规划理由。WOD-E2E 的 4 Hz 轨迹需样条重采样为 10 Hz。因而“规划使用公共数据”不等于整套 VLM 所有训练数据、标注和处理产物都已公开。[§2.3](https://arxiv.org/pdf/2609.00111v1#page=8)

## 关键图与可视化结果

![原论文图 3：外部 BEV 感知头与读取 VLM KV cache 的规划专家](../../assets/papers/qwen-drive-foundation-model-figure-1.png)

左侧从视觉 token 与体素特征进入 BEV transformer，最上方分成占据、检测和地图；右侧从 VLM 的八组注意力 cache 连到 32 层规划专家。注意右侧没有把左侧预测框画成唯一规划输入。图证明架构存在显式 3D 输出，并不证明 planner 的每次行动都依赖这些输出。[官方原图](https://arxiv.org/html/2609.00111v1/head.png)

![原论文图 4：四阶段训练、冻结与更新范围](../../assets/papers/qwen-drive-foundation-model-figure-2.png)

按从左到右阅读火焰与雪花：先训练新头，再共同适配主干，最后两阶段只动规划专家。RL 阶段 VLM 和视觉编码器仍被冻结；把该图描述成“强化学习端到端修正语言与轨迹”会超出实际训练路径。它是训练流程图，不是闭环实验结果。[官方原图](https://arxiv.org/html/2609.00111v1/training_recipe.png)

## 实验结论与证据

### 四种评测应分开解读

WOD-E2E 的 RFS 将预测匹配到人类评分候选，可接受不同于日志的一条合理路线；ADE 则测量与记录轨迹的平均欧氏距离，单位米。PAI-AV 比较六条采样轨迹的平均 ADE 与最小 ADE，并同时给标准 644 例和从 held-out clip 筛出的 700 帧子集；论文明确前者与公开训练数据有重叠，后者用于减轻这一重叠影响。NAVSIM v1.1 navtest 评测单段轨迹、周车非反应式；AlpaSim 才会在动作改变观测后反复重规划，本论文使用 916 个 PAI-AV-NuRec 26.02 场景。[§3.3、表 4–7](https://arxiv.org/pdf/2609.00111v1#page=17)

### 主结果包含清楚的得失

| 原表与固定条件 | 配置 | 关键结果 | 证据解释 |
| --- | --- | --- | --- |
| 表 4b，WOD-E2E test | SFT 有理由 / RL | RFS 7.78 / 7.91；5 秒 ADE 2.65 / 2.67 米 | 偏好改善，但位移误差未同步下降 |
| 表 6，NAVSIM 单轨迹 | SFT 有理由 / RL | PDMS 88.2 / 90.7 | 高 2.5 点；本文计算；非持续反应式驾驶 |
| 同表，评测器 best-of-6 | SFT / RL | PDMS 89.3 / 91.4 | 额外用了候选评分选择，不能替代上一行 |
| 表 7，AlpaSim | SFT / RL | 越界 24% / 12%；进度 54% / 48%；at-fault 总分 0.27 / 0.37 | 更少越界伴随更保守行进 |
| 同表同协议 | Alpamayo-1.5 | 越界 16%；进度 59%；at-fault 总分 0.45 | Qwen-RL 未在闭环综合表现全面胜出 |

AlpaSim 的全部近距事件率还从 SFT 38% 增到 RL 41%，自车责任近距事件率从 12% 到 11%。近距事件不是严格碰撞率，all-event 与 at-fault 也不是同一口径。不能只选择越界减半的数字宣称整体安全翻倍。

表 5 的 PAI-AV 700 帧子集同样给出代价：SFT 有理由的平均 3 秒 ADE 为 0.42 米，Alpamayo-1.5 为 0.36 米；最小 ADE 分别为 0.39 和 0.17 米，提示 Qwen 的多候选分布更集中。RL 后平均 ADE 为 0.47 米。公共数据规模、理由数量和时序输入不同，不能把所有差距归结为主干优劣。

### 3D 监督与规划增益的归因

表 8 固定 WOD-E2E、每个版本训练规划头 15 个 epoch。原始 Qwen、仅语言适配、语言加 3D 适配的验证 RFS 为 7.88、7.91、7.96。增加 3D 后有可检查的感知能力，且规划兼容性良好；0.05 的小幅差距不足以单独证明规划改善由三维监督造成，作者也明确限制了这一解释。

表 1 的检测/地图确实提高，但占据没有全面提高：同为 SigLIP-Qwen 初始化/编码器类型的比较中，多任务 BEVFormerV2 对照的 nuScenes 占据 mIoU 为 25.72，Qwen-Drive 为 19.82。此表还使用重映射类别与将属性项设为零的修改 NDS，不能同原始 nuScenes 榜单直接横比。未见相机 rig 的图 13 仅为定性预测，缺少统一感知真值，不能称为已验证精确泛化。[表 1、8、§3.4](https://arxiv.org/pdf/2609.00111v1#page=13)

## 应用场景与启发

- 作者主张：为驾驶适配提供保留通用视觉语言能力的基础模型，将几何感知、问答和规划放在同一共享表示上。
- 我的判断：最可迁移的是数据坐标/采样对齐、冻结主干与专家分离的训练接口，以及同时保留通用能力回归测试。只看 PDMS 会忽略偏好优化、位移误差、候选多样性和交互进度之间的冲突。
- 待验证假设：在总视觉 token 数和模型权重不变时，把 1.5 秒内稀疏四帧改为“近期密集、远期稀疏”的采样，可能改善 AlpaSim 短时反应而不丢历史上下文。作者把稀疏历史列为可能原因，此处只是可检验假设，尚未证明。

## 局限与阅读风险

作者指出推理文字和轨迹仍需加强一致性，跨 rig 三维输出尚缺定量真值，NAVSIM 高分也可能越来越反映对指标的适配。WOD-E2E validation 的 RFS 标注用于 RL，8.45 高于人类参考 8.13 是训练内奖励优化证据，不能写成超越人类驾驶；更有意义的 held-out 增益是 test 的 7.78→7.91。

本报告还特别保留训练范围的差别：Stage 3 的公共规划数据不等于 Stage 2 的全部 QA 数据公开；HF 有权重不等于四阶段训练流水线齐全；best-of-6 分数包含评测器选择；约 5B 的表格参数量不含 LLM token embedding，不能机械等同模型文件名的“4B”。文中主表没有提供全部结果跨训练随机种子的置信区间，不能把小差距称为显著。

## 后续跟进

### 最小验证与停止条件

- 当前资源：2026-09-14 检查 [GitHub](https://github.com/QwenLM/Qwen-Drive-1.0)实际有推理、感知、demo、场景格式和评估文档；[HF 文件树](https://huggingface.co/Qwen/Qwen-Drive-1.0-4B/tree/main)存在主干权重及 perception、planner-sft、planner-rl。公共数据需分别获取；完整四阶段训练/微调流水线与自建 QA 产物未在本轮核实为可完整复现。没有运行模型。
- 最小实验：先在固定 held-out 场景和单轨迹模式核对 SFT/RL 输出，再比较原时序采样与近期加密采样；固定 token 数、分辨率、历史状态、expert、理由开关和随机种子。分别报告 WOD-E2E test RFS/ADE，以及 AlpaSim 近距事件、越界、进度、时延，禁止用 best-of-6 代替部署选择。
- 成功信号：近期加密在同计算预算下降低交互失误且进度不退化，并保留跨数据集规划与问答能力；用按场景配对的区间估计确认收益不是少数路线造成。
- 停止/转向条件：若只是更慢或更保守导致总分变好、效果只在参与 RL 的 validation 出现，或采样改变破坏相机布局/时间一致性，则先修复数据协议或奖励设计，暂不增加模型规模。

### 来源与核验记录

依据 2609.00111v1，首次提交 2026-08-31，PDF 标注 2026-09-02，2026-09-14 核验。主要依据 §2.1–2.3、式 6–14、表 1、4–8 与 §3.4。分别读取 Alpamayo-R1、AutoVLA、BEVFormer v2 原文，并打开 Alpamayo-1.5 官方实现核对版本。两张官方 PNG 为原图 3、4，作者已逐张打开，源文件和图像 SHA-256 已保存，独立复核另行进行。本次是内容与公开资源核验，不是训练、复现或道路部署验证。
