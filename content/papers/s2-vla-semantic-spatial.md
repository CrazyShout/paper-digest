---
{
  "id": "s2-vla-semantic-spatial",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving"
  ],
  "title": "S-squared-VLA: Decoupling Semantic and Spatial Streams in Vision-Language-Action Models for Autonomous Driving",
  "source": "arXiv:2607.13926 / https://arxiv.org/abs/2607.13926",
  "authors": [
    "Jianguo Yu",
    "Rukang Wang",
    "Duanfeng Chu",
    "Chen Wang",
    "Renju Feng",
    "Liping Lu"
  ],
  "affiliations": [
    "School of Mechanical and Electronic Engineering, Wuhan University of Technology",
    "Intelligent Transportation Systems Research Center, Wuhan University of Technology",
    "School of Computer Science and Artificial Intelligence, Wuhan University of Technology"
  ],
  "comment": "把 VLA 的语义推理与连续空间特征分成两条流，再用辅助 BEV/目标监督补回几何约束；核心启发是不要让轨迹规划完全穿过离散语言瓶颈。"
}
---

## 一句话定位

S²-VLA 在 InternVL3-2B 旁边保留视觉特征通路：规划 token 先读多层语义与自车状态，再读由 BEV 地图和目标检测监督训练的空间特征。NAVSIM 的逐项消融支持组合方案有效，但没有证明空间信息“不再损失”或轨迹必然安全。依据 [固定 v1 全文](https://arxiv.org/html/2607.13926v1)，该版本没有附录。

## 论文要解决的问题

### 连续规划需要怎样的视觉接口

只让语言模型输出坐标文本，会同时受到表示、解码方式和监督目标影响。S²-VLA 希望把导航意图与局部几何分开处理：语义流适合聚合指令和情境，空间旁路保留语言主干之前的视觉信息，再通过地图和目标标签促使其学习几何。

“空间表征坍缩”是作者提出的解释。论文没有用空间探针、坐标量化误差或信息保真测量直接验证这一原因；观察到轨迹偏移，并不足以确认错误都由语言离散化造成。

### 与两项直接前作的机制关系

[VLA-Adapter §3.1–3.4](https://arxiv.org/html/2509.09372v1) 已经使用多层原始视觉语言特征、ActionQuery、自车/机器人状态、两个交叉注意力与一个自注意力，并用 $\tanh(g)$ 门控原始特征后输出连续动作。S²-VLA 明确借鉴这一桥接设计，新增的是从 InternViT 直接读取的空间查询、驾驶 BEV/agent 监督，以及后续空间细化，不能把多层桥接本身作为全新机制。

[ReCogDrive §4.2–4.3](https://arxiv.org/html/2506.08052v2) 已让连续扩散规划器同时读取完整 VLM hidden states 和其均值向量，并融合历史轨迹与自车状态，并非只能读离散文字或一个压缩 token。S²-VLA 的独立视觉旁路与直接回归头是结构区别；本文比较的是 ReCogDrive 的监督版本，不能把它的 86.5 分当作包含强化学习后的完整方法成绩。

## 方法和系统设计

### 六层语义特征与动作查询

输入包括单张前视图像、导航指令、自车历史和可学习查询。语义流由 InternViT 与 Qwen2.5 构成的 InternVL3-2B 处理，在输入中加入 64 个 action query，并读取第 3、8、13、18、23、24 层的两类输出：图文 token 特征和 action-query 特征。历史状态经 MLP 后与 action-query 特征拼接为 state memory。

这条路径输出连续 hidden states，规划阶段没有要求先生成文字推理。论文没有列出每个规划 block 与六个语义层的完整对应表，也未交代历史采样长度的全部配置。

### 空间旁路仍是学习压缩

一张前视图像分为八个局部 crop 和一个全局缩略图，每个 crop 加入 64 个 visual query，与 CLS、patch token 一起通过视觉编码器，得到总计 576 个查询 token；再加 tile 位置编码并经过 Transformer。它绕过语言主干，但不是未经压缩的完整像素或全部视觉 patch 特征。

576 个查询被重排成 24×24 特征网格，地图头上采样到 128×256 多类 BEV，覆盖前方 $X\in[0,32]$ m、$Y\in[-32,32]$ m。重排查询本身不是标定投影，位置到 BEV 的对应依赖监督学习；论文没有说明如何处理这一区域内不可见或被遮挡的标签。Agent 头以 30 个 DETR 查询和 Hungarian 匹配预测有向二维框及类别置信度，它预测当前目标，不是未来目标轨迹。

### 先语义融合、再空间细化

8 个 planning token 对应未来 waypoint，Figure 2 的任务提示给定未来 4 秒。按式（4）–（6），每层先并行读取语义、状态 memory 并自注意力，再加入空间残差：

$$
P_f=P+W[\tanh(g)\odot\operatorname{CA}_1(P,V_s);\operatorname{CA}_2(P,E_m);\operatorname{SA}(P)],
$$

$$
P_v=P_f+\operatorname{CA}_3(P_f,V_x),\qquad P'=P_v+\operatorname{FFN}(P_v).
$$

$V_s$ 是多层语义，$E_m$ 是含历史状态的 memory，$V_x$ 是空间流特征，$g$ 为逐通道可学习门控；$W$ 表示拼接后的线性投影。最终 MLP 输出 8×3 轨迹。这里没有障碍距离约束、可行域投影或优化求解器，因此注意力残差不能保证轨迹不穿越边界。

式（7）–（8）与 Table I 对应的训练目标为：

$$
L_{\mathrm{plan}}=\|\hat Y-Y\|_1+0.5\!\sum_{u\in\{a,j\}}\operatorname{SmoothL1}(u,0),\qquad
L=L_{\mathrm{plan}}+0.1L_{\mathrm{agent}}+0.5L_{\mathrm{map}}.
$$

$a,j$ 为预测轨迹的加速度和 jerk，但差分方法、时间归一化及单位处理未列出；这是向零惩罚，不是明确的加速度/jerk 上限。Agent 损失的 L1 与 BCE 权重均为 1。正文称 map loss 使用类别权重缓解不均衡，Table I 却把 $\omega_c$ 列为 1.0；没有证据确认实际采用了非均匀权重。

### 三阶段优化与部署输入

先在 ReCogDrive VQA 数据上 SFT 三个 epoch；第二阶段冻结 VLM 基础权重、引入 LoRA，训练意图与辅助感知模块四个 epoch，暂不接空间细化；第三阶段冻结感知与意图组件，只训练视觉细化模块四个 epoch。正文同时使用“端到端多任务训练”概括全系统，实际训练描述是分阶段冻结，不能理解成三个阶段所有参数都联合更新。

Table I 为 AdamW、学习率 $10^{-4}$、batch 16、LoRA rank 8/alpha 16，硬件四张 A100。LoRA 插入层、各阶段精确可训练参数、完整图像 crop 分辨率、种子、训练时长和峰值显存未给出。地图/目标标签只用于训练，部署规划读取空间特征；是否实际裁掉辅助输出头、语义/空间是否复用同一次视觉前向，尚无实现可核查。

## 关键图与可视化结果

### 原文 Figure 2：旁路和级联接口

![原文 Figure 2：S²-VLA 双流架构](https://arxiv.org/html/2607.13926v1/x2.png)

已打开并与 [原文 Figure 2](https://arxiv.org/html/2607.13926v1#S2.F2) 核对：上方语义特征通过门控进入第一轮融合，下方空间特征进入后续交叉注意力，map/agent 头旁接在空间分支。图中轨迹来自连续解码器，不能将这套模型仍描述为逐坐标文字生成。

### 原文 Figure 4(b)：对比文本解码基线

![原文 Figure 4(b)：InternVL3-2B 与 S²-VLA 的轨迹](https://arxiv.org/html/2607.13926v1/x4.png)

已核对这幅是 [Figure 4 中的 InternVL3-2B 子图](https://arxiv.org/html/2607.13926v1#S4.F4)，上排基线、下排本文，绿色为专家轨迹、橙色为预测。红圈标出弯道和路口偏移；图片展示选中案例的改善，不能由此确定是语义、连续回归还是空间监督单独起作用。

## 实验结论与证据

### 最接近同模型的增量证据

Table III 使用 NAVSIM navtest，分数按 0–100 展示，越高越好：

| 配置 | PDMS | NC | DAC | TTC | EP |
| --- | --- | --- | --- | --- | --- |
| InternVL3-2B 文本轨迹基线 | 84.1 | 97.6 | 93.1 | 92.7 | 79.1 |
| 加多层语义与 planning adapter | 85.6 | 98.2 | 94.0 | 93.9 | 80.2 |
| 再加空间特征 | 86.2 | 98.1 | 94.5 | 94.2 | 80.6 |
| 再加辅助感知监督 | 87.1 | 98.4 | 94.9 | 94.6 | 81.6 |

空间旁路增加 0.6 PDMS 和 0.5 DAC，但 NC 从 98.2 降到 98.1；辅助监督再增加 0.9 PDMS。第一步同时加入连续规划 adapter 和多层语义，缺少“相同连续头只读末层”的控制，所以 1.5 分不能全部归于多层表示。消融也没有直接比较反向级联或并行融合，作者声称级联顺序更合理仍未得到匹配实验验证。

### 跨方法分数与评估范围

Table II 中 S²-VLA 87.1 高于监督版 ReCogDrive 86.5、ImagiDrive 86.4，低于相机+LiDAR DiffusionDrive 88.1。其 NC 98.4 在该表最高，但 DAC 94.9 低于 DiffusionDrive 96.2，EP 81.6 低于后者 82.2；没有全指标领先。各方法训练数据、相机数量和骨干未对齐，“纯监督”也不意味着完全相同训练协议。

结果对应 v1 的 PDMS，未报告 v2 EPDMS。NAVSIM 的短时模拟执行不把更新环境持续回送给自车规划器；[官方协议说明](https://github.com/autonomousvision/navsim/blob/main/docs/traffic_agents.md) 明确这一边界。因此正文称“强调动态闭环交互”的措辞不能作为反应式重规划或实车验证的证据。

### 成本和机制测量缺口

没有推理时延、总参数、FLOPs 或训练显存表。单前视相机降低传感器数量，但九 crop、576 视觉查询和六层特征仍带来计算成本；不能因不使用扩散就认定完整系统更快。论文结尾也承认双流融合开销明显。

辅助头没有独立 mIoU、框定位误差或校准曲线，无法直接检查“几何更准确”与规划收益的对应关系。没有误差条或多种子结果，0.1 分 NC 变化的稳定性未知。

## 应用场景与启发

### 先建立可检验的空间旁路

对已具备 VLM 指令能力的规划模型，可以保留一个经几何任务监督的视觉接口，避免所有决策信息都依赖语言深层输出。这比泛称语言模型缺乏几何更便于验证：同一动作头、同一监督预算下，比较末层、多层、空间旁路，观察道路边界误差与 DAC 是否同步改善。

作者认为该设计实现了物理可行性保证；本报告的判断是，它提供了有用的归纳偏置。若需要明确的安全限制，还须另测碰撞距离、动力学违规与分布外失效，不能把训练损失当作部署约束。

## 局限与阅读风险

- 查询和 tile 重排仍压缩视觉信息，不能宣称“不压缩”或证明所有空间信息被保存。
- Agent 标签监督的是当前二维目标框，正文对动态轨迹理解的强表述超过该辅助任务定义。
- 部分训练细节与概括性叙述存在差距，包括类别权重、分阶段冻结与全系统联合训练；没有代码时不能自动选取有利解释。
- 单前视相机和局部 BEV 标签未覆盖全部周边交通；缺少遮挡、夜间、标定变化和跨城市压力测试。

## 后续跟进

### 当前可用资源

截至 2026-09-12，[作者仓库 MRYUjg/S2-VLA](https://github.com/MRYUjg/S2-VLA) 的 main tree `17cb93cc0bb0118728603fb06aa67d6b37cf3f5e` 只有 204 字节 README 和论文链接，没有实现、训练配置、数据清单或权重。InternVL3 与 ReCogDrive 数据是依赖入口，不能替代本文 checkpoint。全文与两幅官方图已核查，未运行模型。

### 最小验证与停止条件

取得实现后，先在一张显存经实测确认的 GPU 上对 20 个场景审查数据流：576 个视觉查询、六个语义层、8 个 waypoint、训练标签不进入推理；记录每阶段可训练参数，并核实 map 权重与加速度差分。若形状或冻结规则无法对应论文，停止后续重训。

基线可复现后，固定 InternVL3-2B、连续动作头与训练样本，比较“末层语义”“多层语义”“多层+空间”“再加辅助监督”四组，首先在相同 200 个场景做配对评估。成功条件是空间组 DAC 改善且 NC 不下降，辅助头误差也下降；只有差值稳定才扩展到完整 navtest 与三个种子。若增益主要来自换掉文本解码头，或只提高平均分却增加边界碰撞，就停止以空间坍缩修复作为主要归因。
