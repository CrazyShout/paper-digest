---
{
  "id": "language2drive-paired-instruction-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving", "agentic-driving"],
  "title": "Language2Drive: Do Vision-Language-Action Models Really Follow the Instructions in Autonomous Driving?",
  "source": "arXiv 预印本 / arXiv:2610.16634v1 / https://arxiv.org/abs/2610.16634v1 / Project: https://zihanyou.github.io/Language2Drive/ / Repository: https://github.com/ZihanYou/Language2Drive",
  "authors": ["Zihan You", "Zehua Fan", "Wenqi Lyu", "Aoqi Wang", "Ni Wang", "Yifei Yang", "Linge Zhao", "Huan Li", "Sining Ang", "Yuguang Yang", "Jueyu Chen", "Xiangyu Li", "Qianshan Wei", "Jieyuan Pei", "Yuxin Wang", "Zhiwen Chen", "Jiaqi Li", "Wenxuan Song", "Yanyuan Qiao", "Benjin Zhu", "Haoang Li", "Yan Wang"],
  "affiliations": ["Institute for AI Industry Research (AIR), Tsinghua University", "Southeast University", "Li Auto Inc.", "The Hong Kong University of Science and Technology (Guangzhou)", "Shanghai Jiao Tong University", "University of Adelaide", "Beijing Information Science and Technology University", "Amazon", "Beijing Jiaotong University", "Wuhan University", "Huazhong University of Science and Technology", "University of Science and Technology of China", "NIO", "University of Texas at Austin", "Chinese Academy of Sciences", "HiThink Research", "AMD", "The University of Hong Kong", "EPFL"],
  "comment": "Language2Drive 固定初始场景、只换指令，检查模型能否完成两种可行行为。CARLA 六个主要系统的成功运行中，93.2% 缺少另一指令下的成功配对；普通驾驶分数难以揭示这种偏向。"
}
---

## 一句话定位

同一个路口，要求左转和要求直行时，模型是否都能执行？Language2Drive 用成对反事实单元（PCU）把这个问题从路线完成分中分离出来。它同时检查选对行为、完整执行和不同措辞下的一致性；CARLA、重建场景及三套日志数据分别报告，不合成跨协议排行榜。[§2–3](https://arxiv.org/html/2610.16634v1#S2)

## 论文要解决的问题

### 一次成功可能只是默认行为碰巧符合要求

如果场景本身暗示车辆应直行，一个忽略语言的策略也能在“继续直行”指令下成功。因此，基准为同一初始状态配两条可行、结果互斥的指令。要求可以是左右选择、不同速度区间、指定停车位，或先后访问两个位置。两边都完成，才支持模型能按语言选择行为。

基准测试的是包含检查点、输入适配器和控制器的完整系统。不同模型并未统一相机数量、历史长度或训练数据；传感器和接口差异会影响执行。Agentic Driving 的相关性在于持续约束、任务状态及有条件指令的评价，并不表示所有受测 VLA 都具有工具调用或持久记忆。

### 已有语言驾驶工作与本基准的差异

| 工作与一手来源 | 已有机制或评测 | Language2Drive 增加什么 |
| --- | --- | --- |
| Shao 等，LMDrive，CVPR 2024；[正式页](https://openaccess.thecvf.com/content/CVPR2024/html/Shao_LMDrive_Closed-Loop_End-to-End_Driving_with_Large_Language_Models_CVPR_2024_paper.html)、[原文 §4–5](https://arxiv.org/html/2312.07488v1#S4) | 融合相机、LiDAR 和历史视觉 token，按导航及提醒指令输出路点；LangAuto 有连续指令和误导指令测试，以路线完成、违章和 DS 评价 | 在匹配的初始条件下比较互斥请求，用独立谓词检查完整执行。并非首次研究语言闭环驾驶 |
| Renz 等，SimLingo，CVPR 2025；[正式页](https://openaccess.thecvf.com/content/CVPR2025/html/Renz_SimLingo_Vision-Only_Closed-Loop_Autonomous_Driving_with_Language-Action_Alignment_CVPR_2025_paper.html)、[原文 §3.1–3.2](https://arxiv.org/html/2503.09594v1#S3) | Action Dreaming 在同一视觉上下文构造多种指令与动作，包含不应真实执行的动作，用于语言—动作对齐 | 核心闭环 PCU 要求两种替代行为均可行，并检查实际执行；安全冲突请求另放诊断集。训练期动作对齐与测试期完整执行分开判断 |

## 方法和系统设计

### 固定初始条件，隐藏判分目标

每个 PCU 固定地图、自车与其他参与者状态、历史、非语言输入和仿真 seed，只替换当前指令。两次运行之后的观测随各自动作演化，不要求整段观测相同。目的地标识、未来参考轨迹、指令分支和成功谓词留在评测器内部，避免通过导航目标泄漏答案。[§2.2、2.6](https://arxiv.org/html/2610.16634v1#S2)

任务按四类组织：单次动作、持续行为、场景实体定位、长时程序。长时程序由顺序、触发条件或记忆引用界定，不只按持续秒数划分。持续速度约束必须进入并完成指定区间；停在区间外不会因为“从未超速”得到成功。

构造流程依次完成来源场景选择、几何绑定、成对规格、公开输入与私有评测信息分离，以及任务有效性检查。每个 PCU 的两种请求都提供三个 seed 下的特权成功执行作为可行性见证；这不同于下面主结果的模型重复次数。

### 单次成功与成对成功

原文式 (1) 对 PCU $i$、措辞 $r$、指令分支 $j\in\{0,1\}$ 定义严格成功 $s_{ir,j}$。先对同一 PCU 的措辞平均，再对 PCU 等权平均，记作 $\langle\cdot\rangle$：

$$
\mathrm{SISR}=100\left\langle\frac{s_{ir,0}+s_{ir,1}}2\right\rangle,\qquad
\mathrm{CFPS}=100\langle s_{ir,0}s_{ir,1}\rangle.
$$

SISR 给每个成功请求计分；CFPS 只有两个请求都成功才计分。始终左转的模型可以在平衡左转／直行任务上得到 50 SISR，却得到 0 CFPS。两者差值由式 (2) 精确对应单边成功：

$$
\mathrm{SISR}-\mathrm{CFPS}=\tfrac12q_{\rm one},\qquad
q_{\rm one}=100\langle|s_{ir,0}-s_{ir,1}|\rangle.
$$

这里 $q_{\rm one}$ 的分母是成对实例；摘要的“93.2%”则以成功运行作为分母，二者不能互换。严格成功还要求满足安全、执行及排除另一分支的条件，缺失或失败输出不会缩小预定分母。

### 部分完成与执行接口

对尚未严格完成的轨迹，式 (3) 用 $c_{ir,j}\in[0,1]$ 表示完成程度：

$$
\mathrm{SCS}=100\left\langle\frac{c_{ir,0}+c_{ir,1}}2\right\rangle,\qquad
\mathrm{PCS}=100\langle\min(c_{ir,0},c_{ir,1})\rangle.
$$

PCS 取较弱分支，防止一种行为的高分掩盖另一种完全不执行。宽松语义代理另用 SemISR、Sem-CFPS，不能计作额外的严格成功。综合 L2D 只供同一赛道汇总，核心判断仍先看 SISR、CFPS 及对应条件。

本研究不训练新策略。模型权重冻结，适配器把公开输入转换为原生模型接口，再由原控制器或声明的轨迹跟踪器执行。附录 D 特别区分了原生 LMDrive、SimLingo 与高层 Senna bridge；后者不是完整 Senna-E2E。部分接口每 20 个 CARLA 帧调用一次，在 20 Hz 下是仿真内一秒间隔，不是测得的模型推理延迟。

## 关键图与可视化结果

![原论文图 1：成对指令与四类语言控制任务](../../assets/papers/language2drive-paired-instruction-evaluation-figure-1.png)

[图 1](https://arxiv.org/html/2610.16634v1#S1.F1)先看中央同场景的左转／直行两分支，再看下方四种约束范围。左右环境图说明来源多样性，不表示不同赛道已经统一传感器或评价难度。

![原论文图 3：P11 车道请求与 P22 速度区间请求的实际响应](../../assets/papers/language2drive-paired-instruction-evaluation-figure-3.png)

[图 3](https://arxiv.org/html/2610.16634v1#S3.F3)左侧 P11 中，Alpamayo 1.5 两分支都得到 100 DrivingScore，却只完成保持车道。右侧 P22 的背景色是要求的速度范围，并不是约束生效时间窗；成功还须在指定空间段内完整行驶。SimLingo 满足两种速度请求，Alpamayo 1.5 均未满足完整条件，不能仅凭末端速度落入色带判成功。

## 实验结论与证据

### 样本与协议

CARLA 核心集有 64 个 PCU，每个包含两分支、三种措辞，即每系统 384 次运行、192 个成对实例。RealSim 从 23 个重建场景构造 30 个 PCU，每个两分支、一种措辞，共 60 次运行、30 对。主闭环结果每赛道使用一个固定评价 seed；三种措辞不是三个独立随机种子。[§3.1、附录 E.1](https://arxiv.org/html/2610.16634v1#A5)

开环扩展分别使用 nuScenes、NAVSIM 和 WOD-E2E 的记录历史。预测时域依次为 3、4、5 秒，原点和采样网格也不同；WOD 使用运动代理协议。日志轨迹、重建闭环、CARLA 闭环各自比较，不合并分数。

### 高驾驶分数与低指令成功可以同时出现

| 赛道／原表 | 系统 | 严格 SISR | 严格 CFPS | DrivingScore |
| --- | --- | ---: | ---: | ---: |
| CARLA／表 1 | Alpamayo 1.5 | 8.07 | 1.04 | 62.69 |
| CARLA／表 1 | SimLingo | 7.81 | 1.04 | 65.04 |
| CARLA／表 1 | LMDrive | 12.24 | 0.00 | 50.12 |
| RealSim／表 2 | Alpamayo 1.5 | 11.67 | 0.00 | 97.17 |
| RealSim／表 2 | SimLingo | 6.67 | 3.33 | 83.09 |

以上为 0–100 分，越高越好。CARLA 六个主要系统的成功运行中，93.2% 没有成功的另一分支；RealSim 八系统共 240 个系统—PCU 对中，仅 SimLingo 完成一对。结果说明单次成功不能充分证明按指令选择替代行为，不说明模型从未响应语言。[§3.2](https://arxiv.org/html/2610.16634v1#S3)

### 更换措辞和增加程序要求

CARLA 中没有系统在同一 PCU 的三种措辞下全部完成两分支。SimLingo 在 128 个分支中只有 9 个发生措辞相关的结果变化，但这些分支占其曾成功过的 15 个分支的 60%。整体变化率低可能只是大量任务一直失败，不能直接解释为语言鲁棒。

长时程序类别的七次严格成功均来自“维持条件直到事件发生”；顺序访问、条件回退、引用后返回合计 504 次运行没有严格成功。该结果定位到程序结构层面的执行缺口，但尚未区分语言理解、状态保存、规划和控制误差各占多少。

Safety-Q 只有六个探索性冲突请求；开环 NAVSIM 也只有 38 个 PCU、19 个记录簇。它们适合提出诊断问题，证据范围小于一般道路安全或模型能力的全局判断。

## 应用场景与启发

这套成对协议适合检验驾驶智能体的记忆或约束模块：同一状态下要求“先到 A 再到 B”和“先到 B 再到 A”，保持轨迹跟踪器不变，记录任务阶段是否持续保留。评价应落在实际到访顺序及完成条件上，而不是解释文本是否提到了两个地点。

对于训练数据，可以比较单一专家轨迹与成对替代轨迹监督。关键是让语言成为选择行为的必要信息；单纯把两条输出拉远并不保证任何一条符合指令。

## 局限与阅读风险

结果属于各自公开检查点、输入适配器和控制器构成的系统。相机视角、历史构造、重建域差异以及轨迹跟踪都会影响严格成功，不能把全部失败归因于语言模型内部没有理解指令。主结果单一评价 seed，也不足以量化随机执行方差。

CFPS 要求两分支都完成，能暴露单边成功；其因果解释还依赖匹配初始条件、互斥可行请求和受控随机性。一次成功配对并不自动证明在所有措辞与场景下都可靠。原文提出的状态记忆、成对训练和控制器对齐是后续改进建议，尚不是本基准已证明有效的方法。

## 后续跟进

### 最小验证与停止条件

2026-10-18 核查[官方仓库](https://github.com/ZihanYou/Language2Drive)的 `d6ca4eae429ad159dd24a7e3963ad5d85d97b676`：五套评测代码、适配器、配置及资源清单均可见，GitHub release 提供 v0.1.0 wheel。代码已发布；不应只凭项目页的后续路线图写成“整个基准待开源”。

[Hugging Face 资源目录](https://huggingface.co/datasets/Mike087/Language2Drive/tree/main)可见 CARLA 资源包、RealSim PCU/运行配置及 nuScenes replay 包；这不代表全部上游数据和模型权重随包提供。Waymo、nuScenes 与重建资产需各自满足访问前提，受测模型沿用各自检查点；项目计划的自有模型及其权重仍待发布。当前检查限于目录与清单，未下载大包或运行评测。

- 先用四个左转／直行 PCU 验证适配器：固定初始状态和 seed，运行始终左转、始终直行两个诊断策略，确认它们不能靠私有目标泄漏得到两分支成功。
- 再固定模型、控制器和输入，比较原指令、同义改写、互换目标三种条件；按 PCU 报告两个分支的谓词结果、无效输出和执行轨迹，而非只报综合 L2D。
- 若忽略语言的固定策略也能通过互斥成对判定，停止模型比较，先排查初始化、私有输入泄漏和成功谓词。若计划正确而执行失败，先检查时间戳、坐标原点和控制器，再决定是否改语言模块。

### 来源与核验记录

依据 arXiv:2610.16634v1，核验日 2026-10-18；阅读 §2–3、表 1–2、附录 D、E.1–E.2 与 J 的相关讨论。作者单位按全文首页，发表状态保留预印本。两张官方 PNG 已打开对照图注；相关工作分别读取 LMDrive §4–5 与 SimLingo §3.1–3.2，正式题录来自 CVF。资源另核对 GitHub 文件树、release 及 Hugging Face 清单；没有复现论文的模型成绩。
