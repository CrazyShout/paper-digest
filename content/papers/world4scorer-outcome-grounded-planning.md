---
{
  "id": "world4scorer-outcome-grounded-planning",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "world-models"
  ],
  "title": "World4Scorer: Outcome-Grounded World Modeling for Autonomous Driving",
  "source": "arXiv:2609.36438v1 / https://arxiv.org/abs/2609.36438v1 / Repository: https://github.com/World4Scorer/World4Scorer / Project: https://world4scorer.github.io/",
  "authors": [
    "Jieyuan Pei",
    "Meiyi Lu",
    "Sining Ang",
    "Yubo Zhao",
    "Zhangyi Hu",
    "Mingwei Xu",
    "Haokai Ding",
    "Wei Li",
    "Zihan You",
    "Jianwei Zheng",
    "Li Yu",
    "Yifeng Pan",
    "Ji Tao",
    "Rongjunchen Zhang",
    "Yan Wang"
  ],
  "affiliations": [
    "Institute for AI Industry Research (AIR), Tsinghua University",
    "HiThink Research",
    "The Hong Kong University of Science and Technology (Guangzhou)",
    "Zhejiang University",
    "University of Science and Technology of China",
    "Shenzhen MSU-BIT University (SMBU)",
    "University of Washington",
    "Mohamed bin Zayed University of Artificial Intelligence",
    "Zhejiang University of Technology",
    "Southeast University",
    "Changan Automobile"
  ],
  "comment": "World4Scorer 用每条候选轨迹的仿真后果训练评分状态，再用已执行轨迹的真实未来约束共享预测器。NAVSIM-v2 的 93.0 分包含连续性重排序贡献，Bench2Drive 闭环结果来自额外接入路线与模拟器自车状态的适配系统。"
}
---

## 一句话定位

World4Scorer 让轨迹评分器先形成“走这条路会怎样”的候选状态，再预测安全、进度与舒适度；它把所有候选都能取得的仿真后果标签，与只有已执行轨迹才有的未来观测，接入同一个预测器。值得读的是这两种监督如何互补，以及作者如何用固定候选池与标签打乱实验检验评分机制。

- 核心证据：NAVSIM-v2 的 EPDMS 从逐帧选择的 91.4 升至加入连续性重排序后的 93.0；固定候选、固定权重的对照将其中 1.6 点明确归于重排序。[表 1、表 2](https://arxiv.org/html/2609.36438v1#S4.T2)
- 主要边界：本文 NAVSIM 配置使用非反应式背景交通，v2 为 one-stage navtest 评估；Bench2Drive 的 73.27 Driving Score 则来自使用额外路线输入和模拟器自车状态的完整适配系统，不能单独归因于世界模型评分器。[附录 B.1、E.5](https://arxiv.org/html/2609.36438v1#A5.SS5)

## 论文要解决的问题

### 日志只告诉我们实际走过的那条路

假设车辆接近路口，生成器给出直行、提前右转、先减速再右转等候选。驾驶日志只记录人类实际走过的轨迹及其后续图像，无法提供另外每条轨迹的真实未来视频。如果预测器只学习匹配这一个未来，未执行候选的状态是否足以区分碰撞、越界和有效前进，仍缺少直接约束。

仿真评分提供另一类信息：把各候选交给控制器跟踪，便能获得碰撞、可行驶区域、行驶方向、碰撞时间、进度、舒适度等结果标签。World4Scorer 的假设是，让这些标签直接监督候选预测状态，再用已发生未来约束共享参数，比只给评分头或只给视觉预测头增加能力更有利于排序。这里的“世界模型”是面向决策的潜在状态预测器，不要求重建完整场景或所有可能未来。[§3.1–3.3](https://arxiv.org/html/2609.36438v1#S3)

### 与直接相关工作的差异

| 工作与一手来源 | 已有机制 | 本文改变了什么及比较边界 |
| --- | --- | --- |
| Kirby 等，DrivoR，CVPR 2026；[正式发表页](https://openaccess.thecvf.com/content/CVPR2026/html/Kirby_Driving_on_Registers_CVPR_2026_paper.html)、[原文 §3](https://arxiv.org/html/2601.05083v2#S3) | 相机 register tokens 压缩视觉输入；两个解码器分别生成轨迹、预测仿真子分数，评分梯度在候选坐标处截断 | 本文沿用其传感器与生成器接口，把评分主干改为同时接受未来约束的共享预测器，并加入候选库监督与重排序；主表比较的是完整训练系统，额外监督和训练安排并未被消除 |
| Li 等，WoTE，ICCV 2025；[正式发表页](https://openaccess.thecvf.com/content/ICCV2025/html/Li_End-to-End_Driving_with_Online_Trajectory_Evaluation_via_BEV_World_Model_ICCV_2025_paper.html)、[原文 §3.2–3.4](https://arxiv.org/html/2504.01941v2#S3) | 从相机与 LiDAR 构造 BEV，按候选递推未来 BEV 状态，以仿真 BEV 语义和奖励监督预测，再选择轨迹 | 本文使用相机特征与紧凑候选状态，不依赖显式未来 BEV 语义解码；其“已执行未来”目标来自冻结 DINOv2 的视觉特征。两者表征、输入模态与预算不同，表 1 的分数差不是只替换预测空间的消融 |

## 方法和系统设计

### 从四路相机到一条候选轨迹

四路相机经 LoRA 适配的 DINOv2 ViT-S/14 得到场景 tokens，生成器提出 64 条轨迹。动作编码器把每条候选编码为 query；四层 Transformer 通过候选间自注意力和对场景的交叉注意力生成候选状态。评分头叠加自车状态，预测六项结果，最后按分数选择，并可检查与上一帧计划是否连续。

训练额外加入两类 query：每场景从带标签的扰动轨迹库抽取 16 条候选，以及一条日志中实际执行的轨迹。三类 query 分别调用同一个预测器，共享参数；它们并非一次注意力计算中的 81 个相同监督样本。候选库补充碰撞、越界等低分轨迹，缓解模仿生成器主要产生高分候选的问题。[图 2、§3.4](https://arxiv.org/html/2609.36438v1#S3.SS4)

### 三组公式说明监督与选择

第一组是候选状态和评分，以下合并原文式 (1)–(2) 的定义：

$$
q_{t,i}=\phi(\operatorname{sg}[\tau_{t,i}]),\qquad Z_t=P([q_{t,1},\ldots,q_{t,64}],s_t),\qquad p_{t,i,m}=\sigma(H_m(z_{t,i}+e_t)).
$$

$$
\widehat J_{t,i}=\sum_{m\in\mathcal G}\alpha_m\log p_{t,i,m}+\log\left(\sum_{m\in\mathcal A}\beta_m p_{t,i,m}\right).
$$

$\tau_{t,i}$ 是第 $i$ 条候选，$\phi$ 是动作编码器，$P$ 是共享预测器，$s_t$ 与 $e_t$ 分别表示场景和自车特征，$z_{t,i}$ 是候选状态。$\mathcal G$ 包含无碰撞 NC、可行驶区域 DAC、方向合规 DDC；$\mathcal A$ 包含碰撞时间 TTC、进度 EP、舒适度 C。对数中的前一组形成类似乘法门控，后一组平衡收益。$\alpha,\beta$ 是基准相关权重。它是**学习到的排序效用**，最终 PDMS/EPDMS 仍由官方评估器计算，两个数不能混为一谈。停止梯度 $\operatorname{sg}$ 阻止评分经候选坐标反向改变生成器，评分仍可训练场景特征。[式 (1)–(2)](https://arxiv.org/html/2609.36438v1#S3.SS2)

第二组是已发生未来与总目标。将原文式 (3)–(4)、(7) 的符号合写为：

$$
z_t^{\rm exec}=P([\phi(\tau_t^{\rm exec})],\operatorname{sg}[s_t]),\qquad
\mathcal L_{\rm fut}=\frac{1}{M}\sum_{n=1}^{M}\left[1-\operatorname{sim}_{\cos}\left(g(z_n^{\rm exec}),f_{\rm DINO}(o_{n,+2{\rm s}})\right)\right],
$$

$$
\mathcal L=\mathcal L_{\rm WTA}+\mathcal L_{\rm score}+\mathcal L_{\rm fut}+0.5\mathcal L_{\rm bank}.
$$

$M$ 为场景数，$g$ 是线性视觉读出，冻结的 $f_{\rm DINO}$ 将两秒后前视图像压成 384 维均值特征。未来损失更新动作编码器、预测器及读出头；该分支截断当前场景 tokens 的梯度。WTA 模仿损失只监督最接近日志轨迹的生成候选；生成候选的六项结果采用二元交叉熵，其中进度允许软标签。候选库则对五项非进度指标平均交叉熵，再加 0.1 倍进度 L1。两种结果损失的归一化不同，不能简单按 64∶16 理解贡献比例。[§3.3–3.4、附录 A.2](https://arxiv.org/html/2609.36438v1#A1.SS2)

未来分支只有一个 query，因此自注意力的 query/key 投影不从该分支获得梯度；作者计算这部分占共享参数的 11.6%。“约束共享预测器”并不表示视觉损失逐一监督了每个候选或每个参数。命题 1 只在已拟合参数附近的局部二次近似下，说明新增未来约束可缩小候选分差的扰动范围；它不提供全局排序或真实安全保证。[式 (6)、附录 A.2、C.4](https://arxiv.org/html/2609.36438v1#A3.SS4)

第三组是无训练的连续性重排序：

$$
\Psi_{t,i}=\log(0.01+0.99c_{t,i}),\qquad
i_t^\star\in\arg\max_i[\widehat J_{t,i}+\Psi_{t,i}].
$$

$c_{t,i}$ 表示当前候选与上一条已选计划是否通过 NAVSIM-v2 的 extended comfort 检查。LQR 控制器和运动学自行车模型展开两条计划，比较重叠时段的加速度、jerk、横摆角速度及角加速度。通过者惩罚为零，不通过者减去 $\log100$。检查只使用上一计划、当前候选与确定性控制器展开，不读未来观测或未来标签，但会引入额外计算。[式 (8)、§3.5](https://arxiv.org/html/2609.36438v1#S3.SS5)

### 训练预算与部署信息

NAVSIM 训练使用 103,288 个样本，25 epochs、AdamW、峰值学习率 $2\times10^{-4}$、全局 batch 64；前 10% 步数预热，随后余弦衰减。输入每路为高 672、宽 1148 像素，LoRA rank 32；四张 80 GB A800/A100 约训练 40 小时。主结果采用验证集选出的第 23 epoch，未来目标对照采用最后一轮，测试集未参与模型选择。[表 7、附录 A.2](https://arxiv.org/html/2609.36438v1#A1.T7)

训练标签由缓存地图、日志中的环境占据及自车状态生成：控制器按 0.1 秒步长跟踪四秒候选，再计算几何与运动指标。真实未来图像、候选库和这些标签仅用于训练；部署的学习评分器接收当前观测、候选和自车状态。环境未来缓存属于监督/评估信息，不能被描述为部署时可直接读取的世界状态。[附录 B.1](https://arxiv.org/html/2609.36438v1#A2.SS1)

## 关键图与可视化结果

![原论文图 2：候选生成、共享预测器、两类监督和连续性重排序](../../assets/papers/world4scorer-outcome-grounded-planning-figure-2.png)

读[图 2](https://arxiv.org/html/2609.36438v1#S2.F2)先看上方的推理链，再看下方两条训练分支。左下只有日志轨迹能与两秒后的前视特征配对；右下为生成候选和候选库提供结果监督。左下的 stop-gradient 与冻结目标编码器标记，是理解信息流的关键。

![原论文图 6：Bench2Drive 右转与雨天路口的执行轨迹](../../assets/papers/world4scorer-outcome-grounded-planning-figure-6.png)

[图 6](https://arxiv.org/html/2609.36438v1#S4.F6)以紫色表示本文系统、黄色表示 VAD。右转案例可结合末端路径图查看车道偏离；雨天案例的下方放大序列标出碰撞位置。不同方法的时间戳并不一致，不能把并排截图当作同速逐帧对照。这是两个选取案例的执行记录，支持“这些场景中完成了动作”，整体结论仍依赖 220 条路线统计和输入条件。

![原论文图 8：不同候选 query 的两秒后视觉读出](../../assets/papers/world4scorer-outcome-grounded-planning-figure-8.png)

[图 8](https://arxiv.org/html/2609.36438v1#S4.F8)每组依次给出候选、当前图像、左/近直行/右候选的视觉读出，以及实际观测未来。该图使用额外训练的重建网络，结合当前空间网格与冻结解码器；只有日志轨迹有真实未来对照。图中视点会随 query 变化，说明状态带有动作条件信息，尚未验证未执行动作对应图像的反事实准确性，也不是规划器运行时生成视频的证据。

## 实验结论与证据

### 先区分两种驾驶评估

本文在 NAVSIM-v1/v2 上均评估 12,146 个 navtest 场景；附录 B.1 将本次背景交通描述为非反应式。公开的 [v2 运行脚本](https://github.com/World4Scorer/World4Scorer/blob/main/tools/inertial_reranking/run_navsim_v2.sh)进一步明确：使用官方 devkit v2.2，先导出候选池并做 LQR 展开，再生成开/关重排序两份提交，最后对 one-stage navtest 显式设置 traffic_agents=non_reactive，调用单阶段评分与跨帧聚合。这里的 93.0 对应这个配置。

这与 NAVSIM-v2 可使用 IDM 反应式车辆、双阶段提交默认采用反应式主体的设置不同；基准官方也说明，自车在单次评估中仍承诺一条完整计划，不会不断接收模拟后的观测再规划。因此需要同时区分背景车是否响应、自车是否持续闭环、以及单阶段/双阶段协议，不能只凭“v2”混用数值。[官方 v2.2 交通主体说明](https://github.com/autonomousvision/navsim/blob/v2.2/docs/traffic_agents.md)

PDMS 合并无碰撞、可行驶区域、TTC、进度和舒适度；EPDMS 进一步加入方向、交通灯、车道保持、历史及跨帧舒适度，并按官方协议处理日志人类也违规的项。以下均按原表的百分制分数报告，越高越好；它们不是碰撞概率或真实道路成功率。携带上一计划进行重排序，也不等于完成了自车的反应式闭环。[附录 B.1](https://arxiv.org/html/2609.36438v1#A2.SS1)

| 评测与原表 | 系统 | PDMS / EPDMS，分，↑ | 比较条件 |
| --- | --- | --- | --- |
| NAVSIM，表 1 | DrivoR | 93.7 / 90.7 | 相机输入；完整基线系统 |
| NAVSIM，表 1 | WoTE | 88.3 / 87.6 | 相机与 LiDAR；不同生成器和监督 |
| NAVSIM，表 1 | World4Scorer，逐帧 | 94.0 / 91.4 | 自身 64 候选；验证集选择 checkpoint |
| NAVSIM-v2，表 1、2c | 加连续性重排序 | 未报 / 93.0 | 同权重同候选，较逐帧 EPDMS 增加 1.6 点 |

相对 DrivoR，逐帧结果的差值为 PDMS +0.3、EPDMS +0.7 点，均由表 1 相减得到。重排序的主要收益来自跨帧舒适度 EC：77.0 到 92.8；进度 EP 从 90.0 降至 89.8。改善不是所有子指标同步上升，也不能把 93.0 全部归于未来监督。[表 1、2](https://arxiv.org/html/2609.36438v1#S4.T2)

Bench2Drive 则在 CARLA 中实际执行计划：官方 1,000-clip 子集训练，220 条路线测得 Driving Score 73.27、成功率 46.36%。适配加入 20 米前方路线点，使用 CARLA 真值自车位置、速度、加速度，保留转弯命令，并按路线几何重排序；参考代理通常从 GNSS/IMU 估计自车状态。其表 3 中 WoTE 为 61.71、SafeDrive 为 66.77，但训练数据与输入接口未匹配，故只能作完整系统参考。NAVSIM 的 25-epoch 配置也不适用于该实验：适配训练为 15 epochs，未来损失权重与梯度缩放均调整。[§4.2、附录 E.5](https://arxiv.org/html/2609.36438v1#A5.SS5)

### 哪些对照支持了机制

| 控制实验 | 原文结果 | 可以支持的判断 |
| --- | --- | --- |
| 表 2a：无辅助目标 / 当前帧目标 / 已发生未来目标 | PDMS 93.01 / 92.70 / 93.96 | 相同架构、seed、候选库、最后一轮评估下，未来目标较无目标 +0.95 点；当前帧目标反而 -0.31 点 |
| 表 2b：正确标签 / 仅打乱库标签 / 全部打乱 | 排序准确率 64.2% / 55.6% / 51.5%；所选 PDM 为 0.728 / 0.647 / 0.461（0–1） | 标签与候选的对应关系重要；实验仅用 512 训练场景、60 epochs，以及日志隔离的 511 测试场景 |
| 表 4：对应状态 / 场景内打乱 / 全部换成场景均值 | PDMS 94.19 / 79.73 / 71.10 | 固定已发布 DrivoR 的 64 候选池后，候选特异状态影响选择；打乱结果为 100 次平均 |

表 2a 是单 seed，无法据此声称稳健的统计显著提升。表 4 的 94.19 使用外部固定候选池，不能与主表自身生成器的 94.0 当作同一实验；它验证的是状态与候选的正确对应，而非证明这种状态是唯一有效的世界表征。原文表 4 的下降列可能使用未四舍五入值，复算时应优先保留原始分数，避免用显示精度推导更精确的增益。[§4.3–4.4、附录 D.1](https://arxiv.org/html/2609.36438v1#A4.SS1)

### 额外计算与跨任务证据

表 8 给出 35.52M 参数和 A100、batch 1、fp32 下 106.5 ms 的单次前向时间，**不含**所有 64 候选的 CPU 连续性重排序，后者另需 125.4 ms。349.9 GFLOPs 使用单次乘加计一操作且排除融合注意力，计入注意力后为 927.1；不能用较小值当作完整算力预算。未来监督无需推理时的未来帧，但整个方案也不是零额外部署成本。[表 8](https://arxiv.org/html/2609.36438v1#A1.T8)

OGBench-Cube 的补充实验固定 LeWM 世界模型与规划预算，在 11 个评估种子、每个 50 个配对 episode 上，将成功率从 68.91% 提至 73.64%；作者报告配对增益 4.73 点、95% CI 为 [2.18, 7.27]。这支持结果评分在另一项规划任务中的可迁移性，使用的是为机械操作训练的结果头，不能当作驾驶模型零样本跨域成功。[表 5、附录 D.2](https://arxiv.org/html/2609.36438v1#A4.SS2)

## 应用场景与启发

- 作者主张：候选未来表征应受决策后果约束，既服务候选排序，也能与视觉预测监督协同训练。
- 我的判断：对已有“生成再选择”管线，最值得借鉴的是两类对照：保持候选池不变评估评分器，以及保持标签分布不变但破坏候选配对。它们比只比较整车总分更容易排查收益来源。
- 待验证假设：在相同候选数和数据预算下，加入真实未来目标，应主要降低动态场景中的候选排序遗憾；如果增益只出现在重排序后的 EC，而固定池排序不改善，就应将主要收益归于连续性规则。

## 局限与阅读风险

作者明确把状态定义为承载决策后果的潜在表示，视觉读出也明确标为定性分析。现有结果没有证明对其他车辆的交互响应已被准确建模；本文 NAVSIM 监督与已公开评估脚本仍采用非反应式背景交通。真实道路和感知失效下的表现尚待验证。

候选覆盖也构成上限：库中每场景平均有 54.5 条有效轨迹，310 个场景无库条目，10.7% 的场景无法在要求的安全类别中填满抽样配额。已发布候选数固定在 64，不等于所有危险或可行方案都被覆盖。[附录 A.2](https://arxiv.org/html/2609.36438v1#A1.SS2)

从比较范围看，主结果叠加了未来监督、候选库与重排序；局部理论、单 seed 训练消融、Bench2Drive 不匹配的输入条件分别限制了不同层面的结论。后续应优先补齐预算匹配、多 seed 和真实反应式交通控制实验，而不是仅重复更高的综合分数。

## 后续跟进

### 最小验证与停止条件

截至 **2026-10-05**，资源分项状态如下：

| 资源 | 实际核验结果 |
| --- | --- |
| 代码 | [官方仓库](https://github.com/World4Scorer/World4Scorer)已有 NAVSIM、Bench2Drive 与 OGBench-Cube 实现；已读取共享预测器源文件。旧作者仓库与项目地址已迁移 |
| 配置 | 已读取 [训练脚本](https://github.com/World4Scorer/World4Scorer/blob/main/scripts/training/run_world4scorer.sh)和 agent YAML，包含 64 候选、16 库候选、未来损失与 25-epoch 配方；未运行 |
| 数据 | README 提供 NAVSIM/OpenScene、地图与未来特征生成流程；候选库要求另从 CLOVER 取得，仓库不重分发。本次未下载训练集或核验库内容 |
| 权重 | README 列出 NAVSIM epoch-23、Bench2Drive 两个 checkpoint、Cube 结果头及 SHA-256；[Hugging Face 文件端点](https://huggingface.co/pei2333/World4Scorer)本次多次读取失败，文件可下载性与字节哈希尚未独立核实 |

固定版本论文仍写“发表后发布代码”，而当前仓库已有实现。上表反映访问当天的资源状态，不把论文旧承诺当作现状，也不把 README 权重链接当作已完成下载验证。

- 最小实验：先取得并核对指定 checkpoint、DINO 权重和 NAVSIM 评估缓存；按日志固定抽取 200 个 navtest 场景，冻结同一 64 候选池及模型，比较正确状态、固定无不动点置换、场景均值三种情况。记录官方 PDMS、相对候选池 oracle 的遗憾、排序准确率与端到端耗时；这是建议的快速筛查规模，不是论文设置。
- 成功信号：正确对应状态在多数日志中稳定降低选择遗憾，且交换状态能复现排序退化。若继续检验未来监督，再做相同 seed、数据和 epoch 的未来目标/当前目标/无目标对照。
- 停止或转向：若哈希与配置无法对齐，先停止分数复现；若固定池收益消失，优先检查生成器与数据差异；若重排序代价超过控制周期，则转向更便宜的连续性估计，而非以 106.5 ms 前向时间代替整条链路延迟。

### 来源与核验记录

依据 [arXiv:2609.36438v1](https://arxiv.org/abs/2609.36438v1)，实际核验日期为 **2026-10-05**。已阅读方法 §3、实验 §4，以及附录 A.2–A.3、B.1–B.2、C.4、D.1–D.2、E.5；公式定位为 (1)–(4)、(7)–(8)，数字重点核对表 1–5、7–8。PDF 首页核对了全部 15 位作者及 11 个单位；SMBU 全称另由[大学官网](https://en.smbu.edu.cn/)确认。正式题名依 arXiv 题名元数据，PDF 首页的 World4Scorer 字样在 HTML 标题中未被保留。

图 2、6、8 均从固定版本 arXiv 官方图片下载原字节，逐张实际打开并与图注及 PDF 对照，未重绘。DrivoR 与 WoTE 的机制分别回到其原文 §3 核对；发表状态由各自 CVF 正式页确认。另读取了 v2 运行、重排序、逐场景评分与聚合脚本，并与 NAVSIM v2.2 官方交通主体说明对照。本次未执行训练、仿真或模型推理，资源核查和原文复核不等于实验复现。
