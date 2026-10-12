---
{
  "id": "odyssey-long-horizon-driving",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving", "3d-reconstruction"],
  "title": "Odyssey: A Closed-Loop Benchmark for Long-Horizon Real-World Driving with Explicit Navigation Routes",
  "source": "arXiv:2610.06469v1 / https://arxiv.org/abs/2610.06469v1 / Project: https://snu-adr.github.io/Odyssey-Page/ / Repository: https://github.com/SNU-ADR/Odyssey",
  "authors": ["Jungho Kim", "Hongjae Shin", "Seunghoon Yu", "Heecheol Yoo", "Myeongjun Kim", "Jiyong Oh", "Donghyuk Kwak", "Seunghyeop Nam", "Haesung Oh", "Hyunju Kim", "Hyungchan Cho", "Jaehyun Park", "Soo Won Seo", "Jun Won Choi"],
  "affiliations": ["Seoul National University"],
  "comment": "Odyssey 将 100 秒真实日志重建成可连续重规划的传感器闭环，并用明确道路路线检查提前选道。开放环安全评分和 GRPO 的收益在这里出现反转；看懂交通模式、时长与各项惩罚比只看总分更重要。"
}
---

## 一句话定位

Odyssey 把“这条四秒轨迹看起来合理”推进到“连续执行后，车辆还能否走对道路、提前选道并安全完成任务”：100 个 nuPlan 场景提供明确的标准精度地图路线，规划动作改变车位，系统随之渲染新相机图像，再让规划器作下一次决策。

- 核心证据：ReCogDrive 的 GRPO 配置比仅模仿学习高 3.6 PDMS，却在非反应式/反应式长闭环中分别低 16.2/16.0 RouteDS，均为表 5 数值相减。单段轨迹优化与连续决策排序并不一致。[表 5](https://arxiv.org/html/2610.06469v1#S5.T5)
- 主要边界：这是从真实日志重建的仿真闭环；新视角渲染误差、交通控制规则和累计惩罚共同影响结果。100 秒是源日志长度，episode 上限为 200 秒。[§3、附录 C](https://arxiv.org/html/2610.06469v1#A3)

## 论文要解决的问题

### 短轨迹容易漏掉提前几十秒作出的决定

先换道、随后转弯是一个跨时段任务。若只截取转弯前的短片段，模型可能在“已经位于正确车道”的条件下获得高分，而此前是否知道应该换道仍未受测。Odyssey 的 100 个场景中，49 个包含先换道后转弯，16 个的两次动作起点间隔超过 20 秒；另有 13 个交通灯场景和 47 个行人场景。这些标签可以重叠，不能相加当作场景总数。[§3.1](https://arxiv.org/html/2610.06469v1#S3.SS1)

只给“右转”也不足以确定目的地：连续两个右侧出口都可能满足这个词。作者先用完整日志轨迹与 OpenStreetMap 做 HMM 地图匹配，再人工检查道路和连通性，得到从起点到终点的道路折线。部署给规划器的是当前车位前方的路线片段，不是未来人类轨迹或精确车道答案；模型仍须从图像判断路口几何、交通参与者和可用车道。[§3.2、4.2](https://arxiv.org/html/2610.06469v1#S3.SS2)

### 与既有评测的关系

| 工作与一手来源 | 已有机制 | Odyssey 改变的环节 |
| --- | --- | --- |
| Dauner 等，NAVSIM，NeurIPS 2024；[正式记录](https://proceedings.neurips.cc/paper_files/paper/2024/hash/32768f7faf1995026ef9821c696f3404-Abstract-Datasets_and_Benchmarks_Track.html)、[原文 §3](https://arxiv.org/html/2406.15349v2#S3) | 在起始真实观测上调用规划器一次，把固定四秒轨迹交给 LQR 和运动学模型执行，用仿真结果计算 PDMS；过程中不反馈新传感器观测 | Odyssey 会在执行后持续重渲染和重规划，补上连续决策误差；此处比较的是原始 NAVSIM 协议，不概括后来的全部版本 |
| Zhou 等，HUGSIM，2024 年 [v1 原文 §IV](https://arxiv.org/html/2412.01718v1#S4) | 已有 3DGS 相机闭环、LQR 控制及回放、IDM、对抗式交通，并用路线完成度乘局部驾驶分数 | Odyssey 的重点是百秒日志、明确 SD 路线、提前选道和扩散修复，不是首次实现神经渲染闭环；本文没有对齐全部 HUGSIM 场景后证明整体优越 |

上述比较核对了两篇原文。NAVSIM 的 NeurIPS 2024 记录与 HUGSIM 本次实际读取的 arXiv v1 分开标识；Odyssey 文献表所列 HUGSIM 后续期刊状态未在本次另行核实，不用于扩大比较。

## 方法和系统设计

### 执行轨迹以后，重新生成可见世界

系统首先用 OmniRe 重建整段 100 秒序列：车辆用刚体运动，行人用 SMPL 形变，其他动态主体用形变场；交通灯的位置固定，颜色和透明度随时间变化。道路用 LiDAR 初始化的薄高斯圆盘单独建模，限制高度和法向，减少路面漂移；覆盖率采样提高少见区域的训练权重，避免停车时的大量相似帧占满优化预算。[§3.3](https://arxiv.org/html/2610.06469v1#S3.SS3)

规划器接收渲染图、车辆状态和路线，输出按 2 Hz 采样的四秒轨迹。LQR 在 10 Hz 计算加速度和转向变化，运动学自行车模型更新自车；渲染器从新车位生成相机观测，Fixer 单步修复图像后再送入规划器。因此自车驶偏会改变下一次输入，闭环不只是对同一日志逐帧预测。Fixer 修复外观，不修改几何、碰撞状态或车辆动力学。

其他车辆有两套协议：非反应式模式回放日志运动；反应式模式用 IDM 纵向控制，路口另加防死锁逻辑。两者都使用分段触发：自车接近一个路段时才启动该段交通，并按自车与日志进入时刻的差调整交通灯时间。这样慢车仍能遇到原交互，但周围车辆并不是完全自由、可横向博弈的智能主体。[§3.4](https://arxiv.org/html/2610.06469v1#S3.SS4)

### 总分如何处罚走错路和晚换道

原文附录 C 式 (2) 定义：

$$
\mathrm{RouteDS}=100\,\mathrm{RC}_{\mathrm{SD}}P_{\mathrm{PLC}}P_{\mathrm{SD}}P_{\mathrm{col}}P_{\mathrm{off}}P_{\mathrm{TL}}.
$$

$\mathrm{RC}_{\mathrm{SD}}$ 是正确道路路线完成比例，后五项依次处罚提前选道失败、离开指定路线、有责任碰撞、驶出道路/逆行和闯红灯，取值都在 $[0,1]$。例如走错道路会令 $P_{\mathrm{SD}}=0$；提前选道得 0 或 0.5 时分别乘 0.7 或 0.9；行人/车辆有责任碰撞分别乘 0.5/0.6。因此总分升高可能来自走对路或更高进度，同时仍伴随更多碰撞惩罚，不能把 RouteDS 当作碰撞率的别名。[附录 C.3](https://arxiv.org/html/2610.06469v1#A3)

提前选道在停止线处判断：此前 10 米一直处于适合目标路线的车道且正确过线，得 1；较晚才进入得 0.5；错误车道过线得 0。PLCA 对实际遇到的评估路口平均，PLCS 对完整路线的评估路口平均、未到达者记 0。停滞或提早结束会改变两者的差距；没有遇到的路口不再单独累乘提前选道惩罚，仍通过进度与 PLCS 体现。

### 修复模型训练和路线条件化

每个场景包含八相机、10 Hz 的 8,000 张图，重建优化 140,000 次。Fixer 使用 0.6B Cosmos-Predict2 骨干，把欠训练、循环重建和留出相机产生的退化图与真实图配对。附录 B 式 (1) 为：

$$
\mathcal L_{\mathrm{Fixer}}=\lambda_2\mathcal L_2+\lambda_p\mathcal L_{\mathrm{LPIPS}}+\lambda_g\mathcal L_{\mathrm{Gram}}.
$$

像素误差约束整体复原，LPIPS 比较感知特征，Gram 项比较纹理统计。前两项权重均为 1，Gram 项只在最后 1,000 步设为 0.02，其余为 0，以免过度锐化。训练对来自全部 100 个重建场景，因此结果是对这些仿真场景的修复适配，尚未证明直接泛化到未重建地区。[附录 B.2](https://arxiv.org/html/2610.06469v1#A2.SS2)

基线在 NAVSIM 训练集训练。视觉模型将前方 120 个、间隔 1 米的路线点分组编码为 24 个 token，经额外 cross-attention 接入规划解码器；ReCogDrive 则用一个路线 token 和路线导出的导航句子。作者保留各模型原训练配方，因此跨模型名次并不是等训练算力的控制实验。LTF/DiffusionDrive 为 100 epochs，DrivoR 为 25 epochs；论文未统一报告所有模型总 GPU 时数。[§4.2、附录 D](https://arxiv.org/html/2610.06469v1#A4)

## 关键图与可视化结果

![原论文图 1：长场景、明确道路路线与扩散修复观测组成 Odyssey 闭环](../../assets/papers/odyssey-long-horizon-driving-figure-1.png)

[图 1](https://arxiv.org/html/2610.06469v1#S0.F1)先读上排的三个问题，再看下排如何组合源日志、路线和重渲染。100 秒标注指重建序列；箭头表示动作与观测形成反馈。图片中的观感改善本身不证明规划改善，后者须看固定 checkpoint 的表 3。

![原论文图 8：评估时长造成名次交叉，路线合规与选道和碰撞并不同步](../../assets/papers/odyssey-long-horizon-driving-figure-8.png)

[图 8](https://arxiv.org/html/2610.06469v1#S5.F8)全部使用非反应式交通。先看左图不同评估时长的曲线交叉，再看中、右图空心到实心的路线输入变化。五个模型全部提高 SDC，但四个降低 PLCA；四个模型的碰撞分量也下降。碰撞分量越高表示惩罚越少，方向不能读反。左图总分随时间降低部分来自惩罚累积，名次交叉才是短时结论不稳定的更直接证据。

## 实验结论与证据

### 同样走得更对，也可能更容易发生碰撞

100 场景分别在两套交通模式下评估。RouteDS、PDMS 以 0–100 分展示，SDC、PLCA、PLCS 以百分数展示；效率是与周围交通速度的比值乘 100，可超过 100。下表摘录均有 SD 路线的模型，RouteDS 与 PDMS 越高越好，但它们的场景、时长和反馈协议不同，不能直接作数值相减。

| 原表 4 / 模型 | 非反应式 RouteDS ↑ | 反应式 RouteDS ↑ | 非反应式 SDC % ↑ | NAVSIM PDMS ↑ |
| --- | --- | --- | --- | --- |
| DiffusionDrive | 35.9 | 41.0 | 100 | 86.9 |
| DrivoR | 36.5 | 41.4 | 90 | 92.2 |
| SafeDrive | 44.4 | 48.9 | 82 | 90.6 |

DiffusionDrive 的道路合规更高，SafeDrive 的综合完成和惩罚乘积更高；DrivoR 的 PDMS 高于 SafeDrive，长闭环排序却相反。路线指导提高全部基线的 SDC 和 RouteDS，但图 8 的分量退步说明“路走对了”尚未解决提前选道与交通交互。[§5.3、5.6、表 4](https://arxiv.org/html/2610.06469v1#S5.T4)

### 安全分数学习和 GRPO 都有反转

| 原表 5，同模型对照、均有 SD 路线 | 非反应式 RouteDS ↑ | 反应式 RouteDS ↑ | NAVSIM PDMS ↑ |
| --- | --- | --- | --- |
| SafeDrive：Safety Scoring | 44.4 | 48.9 | 90.6 |
| SafeDrive：IL Scoring | 53.9 | 55.3 | 89.5 |
| SafeDrive：IL Scoring + Safety Filtering | 54.4 | 56.1 | 89.5 |
| ReCogDrive：IL + GRPO | 21.5 | 26.3 | 90.4 |
| ReCogDrive：IL only | 37.7 | 42.3 | 86.8 |

SafeDrive 用模仿学习评分，比安全评分高 9.5/6.4 RouteDS；再从通过安全检查的候选中按 IL 分数选轨迹，仅增加 0.5/0.8 分。ReCogDrive 的 GRPO 则提高单段 PDMS、降低长闭环表现。证据指向这些训练与评价组合存在失配，并不能推出所有强化学习或所有安全评分都无效。原表没有多次训练方差或置信区间，小幅 filtering 增益尤其需要重复验证。[§5.4](https://arxiv.org/html/2610.06469v1#S5.SS4)

### 画面变好，规划也可能略降

表 3 固定重建场景和 SafeDrive checkpoint，使用 IL scoring 与 safety filtering；闭环 mIoU 在微调修复版本的同一组相机位姿上比较，以免轨迹不同混入感知对照。

| 原表 3 / 观测 | 开放环 mIoU ↑ | 闭环位姿 mIoU ↑ | 闭环 RouteDS ↑ |
| --- | --- | --- | --- |
| 仅 3DGS | 31.5 | 26.0 | 53.80 |
| 加预训练 Fixer | 31.9 | 28.2 | 52.62 |
| Fixer 经 Odyssey 微调 | 33.7 | 29.4 | 54.43 |

未经适配的修复会提高分割 mIoU，却让 RouteDS 降低 1.18 分；微调后比仅 3DGS 高 0.63 分。图 5 给出预训练修复生成假路缘的例子，提示语义/纹理改善与驾驶可用性应分别测试。这是一个模型配置的消融，不能替代跨规划器的修复鲁棒性检查。[§5.2、表 3](https://arxiv.org/html/2610.06469v1#S4.T3)

代价方面，表 2 在 B200 上报告完整渲染与修复为 39.1 ms/image，OmniRe 基线为 17.8 ms/image；这是单图延迟，不是包含多相机、规划器、控制和数据传输的整车周期。附录表 8 的 6.7 ms/image 只对应优化后的 Fixer，不能拿来替换全链路延迟。

## 应用场景与启发

- 作者主张：把长时导航、明确路线和传感器反馈纳入端到端规划评测，检查单段评分遗漏的后果。
- 我的判断：最适合借鉴的是并列报告道路合规、提前选道、任务进度与碰撞分量，并把交通是否反应、自车是否重新观测写入协议。仅写“闭环”仍不足以区分这些条件。
- 待验证假设：显式路口准备状态能改善 PLCS，但其收益应集中在先换道后转弯、动作间隔超过 20 秒的场景。若提升只发生在短直道或只是更保守停车，便不支持长时机动记忆这一解释。

## 局限与阅读风险

作者承认未被日志覆盖的视角可能让他车模糊或扭曲，扩散修复的时间一致性也待改进。相机图像是学习式重建结果，出现异常动作时，应同时回看原渲染、修复输出与状态真值，以区分规划器缺陷和观测伪影。[§6](https://arxiv.org/html/2610.06469v1#S6)

反应式交通主要使用 IDM 纵向控制和路口规则，未覆盖丰富的横向策略或对抗参与者。100 个精心筛选场景适合诊断，但不是自然驾驶风险的发生频率估计。场景级均分和一次 checkpoint 排序也不足以描述训练不确定性。

SDC 的整段二值惩罚很强，RouteDS 的多个因子又会随时长累积。长时低分既可能来自新失败，也可能是同类小违规重复发生；应保留事件次数、首次失败时刻和轨迹，不把时长增长后的分数下降全部归因于“没有长期推理”。

## 后续跟进

### 最小验证与停止条件

实际资源核验日为 **2026-10-13（Asia/Shanghai）**。论文 v1 的“将发布”已不能完整描述当日资源状态。

| 资源 | 实际核验结果 |
| --- | --- |
| 代码 | [官方仓库](https://github.com/SNU-ADR/Odyssey)可读，已打开评估检查程序和 RouteDS 计算源文件，存在 renderer、traffic、planner zoo 与 benchmark 目录；未运行第三方代码 |
| 数据 | [官方场景文件树](https://huggingface.co/datasets/ADRLAB/odyssey-scenes/tree/main)可读，含编号场景目录；读取目录清单，不等于下载并验证全部重建资产 |
| 配置 | 已读取 `ltf_sdroute.yaml` 与 benchmark/installation 文档，确认相机、历史窗口、四秒输出、路线输入和分交通模式运行规则 |
| 权重 | [官方模型文件树](https://huggingface.co/ADRLAB/odyssey-models/tree/main)可读，递归核对 checkpoint 与 Fixer 文件名；未下载大文件、加载模型或核验整套依赖 |

- 最小实验：先固定官方 LTF SD-route checkpoint、同一重建/修复版本和三个可运行场景，确认新车位确实改变下一帧图像、两个交通模式分别记账；再在预先选定的长间隔换道转弯子集中，比较无准备状态与显式准备状态，匹配参数预算、训练数据和评估时长。
- 观测指标：逐路口 PLCA/PLCS、SDC、完成距离、碰撞事件与首次失败时刻；固定 20/60/100 秒截断另外报告，不混用 200 秒 episode 上限。
- 成功信号：长间隔场景的提前选道改善，在非反应式与 IDM 两种模式下都出现，且任务进度和碰撞没有用停车换来的退步。
- 停止或转向：若资源检查无法重建三个场景，先停在接口验证；若模型名次只随修复版本变化或增益落在重复运行波动内，先研究观测失真；若新增状态不改善长间隔子集，则放弃“长时准备记忆”解释。

### 来源与核验记录

依据 [arXiv:2610.06469v1](https://arxiv.org/abs/2610.06469v1)，2026-10-05 提交，实际核验于 **2026-10-13**；PDF 标为 Preprint，本次未确认正式会议或期刊发表页。已核对 §3–6、附录 B–D、表 2–5、式 (1)–(2)，PDF 首页全部 14 名作者及 Seoul National University 单位。

图 1、8 从固定版本官方 HTML 下载原字节，逐张打开并对照图注；HUGSIM 和 NAVSIM 比较读取各自方法原文。当前仓库实现与资源目录另作当日快照，不能反推所有公开文件都与论文实验冻结状态相同。本次完成原文、数字、图像和资源可见性核对，没有进行训练或闭环复现。
