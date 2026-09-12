---
{
  "id": "driving-videos-to-simulatable-scenarios",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing",
    "world-models",
    "3d-reconstruction"
  ],
  "title": "From Driving Videos to Simulatable Scenarios",
  "source": "IEEE ITSC 2026 (accepted; formal page unavailable at audit) / arXiv:2606.21993 / https://arxiv.org/abs/2606.21993",
  "authors": [
    "Alexandre Levy",
    "Ernest Valveny Llobet",
    "Antonio Manuel López"
  ],
  "affiliations": [
    "Department of Computer Science, Universitat Autònoma de Barcelona",
    "Computer Vision Center, Universitat Autònoma de Barcelona"
  ],
  "comment": "视频经事件描述转成 SCENIC 场景，CARLA 测试保留约 90% 语义元素，94% 脚本可直接运行。真实视频只有定性验证，语义召回不等于事故重现；官方仓库仍仅有展示材料。"
}
---

## 一句话定位

D-V2S 用“视频→自然语言事件描述→SCENIC 程序”把观察到的交通事件转成可编辑仿真。依据 [2606.21993v1](https://arxiv.org/html/2606.21993v1)，它重建的是参与者、道路和交互的语义结构；目标不是逐点恢复原视频的几何与轨迹。

- 核心证据：五类、每类 22 个 CARLA 视频的端到端语义召回为 $0.90\pm0.21$，原文报告 94% 脚本无需修改即可编译运行。
- 主要边界：真实 GoPro 视频只给定性结果；90% 不是事故重现率、轨迹精度或自动驾驶安全提升。

## 论文要解决的问题

### 从视频观察到可执行事件

驾驶视频方便记录问题，但不能直接修改邻车出现位置、天气或制动行为。手工编写仿真脚本又需要熟悉场景语言。本文输入视频及描述视角、关注事件的问题，输出可运行的 SCENIC 脚本，并保留可人工编辑的中间描述。所谓自动转换仍依赖视频专属提示，例如询问“为什么自车被堵住”，不是完全没有人指定事件兴趣的批处理。

### 两项直接比较

| 工作与自身原文 | 已有机制 | D-V2S 的区别及边界 |
| --- | --- | --- |
| Tan 等，LCTGen，CoRL 2023，[§4.1–4.4](https://proceedings.mlr.press/v229/tan23a/tan23a.pdf) | GPT-4 把文字转为地图和车辆属性向量，检索地图区域；在真实场景上训练的 Transformer 一次生成多车状态与运动 | 本文先从视频取得描述，再用上下文示例直接生成代码；两者输出表示和训练资源不同 |
| Zhang 等，ChatScene，CVPR 2024，[§3.2–3.3](https://openaccess.thecvf.com/content/CVPR2024/papers/Zhang_ChatScene_Knowledge-Enabled_Safety-Critical_Scenario_Generation_for_Autonomous_Vehicles_CVPR_2024_paper.pdf) | 建立人工检查的 SCENIC 片段库，用 Sentence-T5 检索行为、道路和出生位置片段，组合执行并调整易碰撞参数范围 | D-V2S 的 SG 使用固定规则与描述—代码示例进行上下文学习，增加视频入口；文字生成可执行交通场景并非本文才有 |

本文把这些不同输出都渲染成鸟瞰图供比较。偏好评测回答的是与文字描述是否相符，不能据此断言任意闭环风险搜索中都更好。

## 方法和系统设计

### 两阶段信息流

Driving Record Analysis（DRA）按模型输入限制抽帧、缩放，保留时间顺序；通用提示要求参与者、动作、道路和关系，专属提示说明视角及事件。最终选择 GPT-4o 生成简短描述。Scenario Generation（SG）再把描述与固定上下文送入 GPT-4o，产生地图参数、周围交通行为、道路几何及出生位置四部分脚本，交给 CARLA 执行。

上下文包括 SCENIC 规则、常见错误提醒及可编译的描述—代码示例，用来降低虚构 API 的概率。场景参数可以取范围，因而一个程序对应多个实例；这和完整保留原视频每辆车的速度、时机及责任关系不同。

### 决定证据含义的公式

本文没有新增训练损失，关键是 Table I 的集合指标。令 $G$ 为人工标注的视频语义元素，$S$ 为模型描述：

$$
\mathrm{SCS}=\frac{\lvert G\cap S\rvert}{\lvert G\rvert},
\qquad \mathrm{HR}=1-\frac{\lvert G\cap S\rvert}{\lvert S\rvert}.
$$

SCS 测遗漏，HR 测描述里多出的无依据内容。元素包括车辆、行人、道路拓扑、动作和关系，结果依赖标注及元素匹配规则。

令 $S_{de}$ 为输入描述、$S_{sc}$ 为生成场景、$G_v$ 为原视频真值、$S_o$ 为最终输出：

$$
\mathrm{SP}=\frac{\lvert S_{de}\cap S_{sc}\rvert}{\lvert S_{de}\rvert},
\qquad \mathrm{E2E\!\!\!\!-SC}=\frac{\lvert G_v\cap S_o\rvert}{\lvert G_v\rvert}.
$$

两者都是召回型指标；保留“车辆并线、行人过街”不代表动作时序、间距和碰撞因果正确，也不会直接惩罚最终场景新增的所有错误元素。编译成功率则是另一道可执行性检查，不能混入语义分数。

### 模型和监督边界

DRA 对比 LLaVA-Video-72B-Qwen2、Qwen2-VL-72B-Instruct 与 API 的 GPT-4o；SG 也用 GPT-4o。作者不微调这些模型，人工标注用于评测，SCENIC 示例作为推理上下文。原文没有给固定 GPT-4o 快照、完整抽帧预算、上下文集合及统一修复调用预算；也没有依据可验证的参数规模解释 GPT-4o 优势。

## 关键图与可视化结果

![原论文 Figure 1：视频分析和场景生成两个阶段](https://arxiv.org/html/2606.21993v1/fig/paper_xai_flow.png)

从左到右是视频、DRA 描述和 SG 程序。中间的文本接口方便检查遗漏并修改事件，但也是语义压缩点：没有留下的时间或空间信息，后端可能只能凭模型补全。

![原论文 Figure 10：CARLA 视频转为可运行场景，并修改参与者和天气](https://arxiv.org/html/2606.21993v1/fig/quali_synth.jpg)

左上为第三视角输入，右上为生成后的车载视角，下方为参数变体；绿色文字正是事件专属问题。道路外观和参与者细节会变化，图片证明可编辑语义实例，不能证明原视频的精确重放。这张图的原编号是 10。

## 实验结论与证据

### 分开看三个评测层次

DRA 的视频来自 CIL++ 在 CARLA 中的失败记录，共 62 个场景问题、360 份作答；360 不是独立驾驶事件或明确报告的参与者人数。SG 用 23 个文字描述，其中 8 个改编自事故记录，获得 164 份作答。端到端评测另用五类各 22 个生成视频，共 110 个。

| 位置与任务 | 方法 | 关键结果 |
| --- | --- | --- |
| Table II，DRA 描述 | GPT-4o | SCS $0.91\pm0.18$；HR $0.06\pm0.17$ |
| 同上 | LLaVA / Qwen | SCS 0.70 / 0.69；HR 0.20 / 0.15 |
| Table IV，描述→场景 | SG / LCTGen / ChatScene | SP $0.93\pm0.11$ / $0.63\pm0.35$ / $0.53\pm0.31$ |
| Table V，164 份作答 | SG | 偏好 75%，作者区间 67.85%–81.00% |
| Table VI，完整转换 | D-V2S | E2E-SC $0.90\pm0.21$；行人过街为 $0.80\pm0.29$ |

作者报告平均 19.08 秒生成一个脚本，94% 无需修改即可编译并执行；这个时间不是实时传感器渲染或被测策略延迟。语义评测是否排除未运行脚本、失败后如何修复及重复次数不够清楚。

### 消融与统计解释

DRA 模型选择和 SG 方法比较支持各自局部效果，但没有在同一组视频、同一调用预算下隔离两阶段设计、示例数量和专属问题的作用。调查随机化了显示顺序且隐藏模型名称，是有用控制；作者给出显著性检验，但同一参与者可答多题，独立参与者数和聚类处理未清楚报告，本报告不据这些极小 p 值进一步声称稳健总体优势。

## 应用场景与启发

- **作者主张：** 将观察到的事件变成可修改、可回归测试的仿真场景。
- **我的判断：** 适合场景初稿与人工审查入口；还不能替代测量驱动的事故重建。
- **待验证假设：** 在相同调用与上下文预算下，中间描述明确记录“谁先做什么、何时进入冲突区域”，能比只列元素提高关键事件时序和风险后果的重现率，即使两者语义召回相近。

## 局限与阅读风险

主要定量证据来自 CARLA，真实 GoPro 视频只有示例。全文把剩余 6% 失败概括为轻微格式问题，但 Table VII 还列出几何不可行，不能统一归为纯语法错误。自然语言中“因果关系保持”的主张，也没有直接事件时间、轨迹误差或原事件后果保持指标支持。

## 后续跟进

### 最小验证与停止条件

- **资源（2026-09-12）：** [作者项目页](https://alexandre-levy.github.io/DV2S.github.io/)和[官方仓库](https://github.com/Alexandre-Levy/DV2S)均仍写 Code (coming soon)。仓库主分支 `8c1f59ec` 的完整目录仅有 README、许可证、图片和演示视频，未有实现、提示配置、评测标注或场景脚本；这与正文“完整实现已公开”不一致。模型无需本文微调，不存在已核实的任务微调权重发布。ITSC 2026 接收依据作者声明，未核实正式论文落地页。
- **最小实验：** 先取得带事件时间真值的 30 个独立 CARLA 视频，固定模型快照、抽帧、示例、输出 token 上限及每阶段一次调用。比较原自由描述、等长的有序事件描述、把事件顺序打乱的等长控制；SG 使用同一接口。每个脚本以相同三组环境种子执行，失败脚本保留在总分母，不额外人工修复。
- **成功信号：** 有序组在留出场景同时提高可执行率、关键事件顺序正确率和风险后果重现率，而非仅增加语义元素；按视频报告配对差异。
- **停止或转向：** 若收益来自更多 token 或重试，或乱序组效果相同，则不支持时序结构假设；若语义高分仍不能复现事件，保留人工几何和时间校核。

### 来源与核验记录

已读固定 v1 §III–V、Table I–VII 和全部评测设置，分别打开官方 Figure 1/10；LCTGen 与 ChatScene 的比较来自各自方法正文。资源目录为实际读取结果；本次未调用视频分析模型、执行 SCENIC 或复现实验。
