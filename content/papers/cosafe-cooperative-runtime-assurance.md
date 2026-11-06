---
{
  "id": "cosafe-cooperative-runtime-assurance",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "autonomous-driving-testing", "autonomous-driving-security"],
  "title": "CoSafe: Cooperative Runtime Safety Assurance for Mixed-Traffic Autonomous Driving",
  "source": "ICSE 2027 已录用，依据作者提交的 arXiv comments，正式论文集页未核实 / arXiv:2611.06204v1 / https://arxiv.org/abs/2611.06204v1 / 固定全文 https://arxiv.org/html/2611.06204v1 / 官方代码 https://github.com/Kiki2049/CoSafe",
  "authors": ["Dingji Wang", "You Lu", "Haowen Jiang", "Yanggang Chen", "Yuyang Bi", "Bihuan Chen", "Shenglin Bao", "Xin Peng"],
  "affiliations": ["College of Computer Science and Artificial Intelligence, Fudan University", "East China Institute of Computing Technology"],
  "comment": "CoSafe 让路侧单元识别多车冲突并联合分配接管轨迹，避免各车独立避险后相互堵住。异构 ADS 混部仿真中 DS 从 55.16 升至 83.00，但依赖统一辅助 BEV 表征、车辆服从接管及有限候选轨迹。"
}
---

## 一句话定位

CoSafe 在原驾驶系统外增加一层路侧协同保障：通常放行各车原轨迹，发现危险时才共同改写相关车辆的参考轨迹。在 InterDrive 混合交通仿真中，它同时缓解碰撞与相互等待；这里的“兼容异构 ADS”保留了统一辅助感知和轨迹接口条件，结果尚不构成真实道路安全保证。[§II–IV](https://arxiv.org/html/2611.06204v1#S2)

## 论文要解决的问题

### 避开眼前碰撞之后，谁先走

无信号路口的两辆自动驾驶车可能同时计划穿过冲突区。各自的安全模块都能触发减速，但如果双方持续认为对方会占据道路，就可能一起停住。单车避险减少了即时碰撞，却未必解决多车行动之间的冲突。

论文假设路侧单元 RSU 能看到覆盖区内的环境，并接收参与车辆的 BEV 特征、位姿、速度、规划轨迹和导航信息。RSU 可以指示被判为危险的车辆执行替代轨迹；人驾车、行人及当前被判安全的车辆不受其直接控制。这是带有接管权限的协同设置，部署前需要约定信息格式和车辆执行接口。[§II-B–C](https://arxiv.org/html/2611.06204v1#S2.SS2)

### 从单车接管到联合分配

| 工作与一手来源 | 已有机制 | CoSafe 改变的环节 |
| --- | --- | --- |
| Wang 等，Argus，ASE 2025；[原文 §III](https://arxiv.org/html/2511.09032v1#S3)、[会议记录](https://conf.researchr.org/details/ase-2025/ase-2025-papers/114/Argus-Resilience-Oriented-Safety-Assurance-Framework-for-End-to-End-ADSs) | 通过接管与恢复缓冲监测单车轨迹，使用 IDM 扩展的危险缓解器调整路径和速度 | RSU 收集多车意图，显式识别循环等待，并联合选择多辆危险车辆的轨迹；比较同时包含协同感知与控制协调的变化 |
| Liu 等，CoLMDriver，ICCV 2025；[正式记录](https://openaccess.thecvf.com/content/ICCV2025/html/Liu_CoLMDriver_LLM-based_Negotiation_Benefits_Cooperative_Autonomous_Driving_ICCV_2025_paper.html)、[原文 §4](https://arxiv.org/html/2503.08683v1#S4) | 慢速语言协商给出意图，低层规划器据此生成可执行路点 | CoSafe 保留原 ADS，并在危险时覆盖轨迹；表 I 也把 CoLMDriver 当成受保护系统，二者可组合 |

因此，主结果相对 Argus 的收益不能全部归因于某一个死锁规则。表 IV 保持其他模块、替换联合选择策略的消融，更适合观察协调本身的作用。

## 方法和系统设计

### 路侧建立共享场景，但控制范围有限

车辆上传的特征先按相对位姿变换到 RSU 坐标，再由 CoBEVT 式融合器汇聚。BEVerse 式运动头预测未来 12 步、共 3 秒的参与者运动。预测实例与 V2X 上报车辆按位置和朝向作匈牙利匹配：匹配车辆使用其上报状态和 ADS 规划轨迹；其他参与者使用预测运动。由此，已协同车辆的“打算怎么走”和未协同参与者的“估计怎么走”共同进入危险判断。[§III-B](https://arxiv.org/html/2611.06204v1#S3.SS2)

四类判据分别检测预测包围盒碰撞、停止信号违规、循环等待和无正当原因的持续停滞。死锁检测先建立等待图，若静止车辆的意图走廊相交，则加入等待关系，再寻找有向环。对于已经停住的车辆，使用停滞前的走廊保留前进意图；冷却集合则短暂保留近期危险车辆，减少判断抖动。[§III-C，式 6–14](https://arxiv.org/html/2611.06204v1#S3.SS3)

### 接管开关与有限候选搜索

原文式 2 的执行规则是：

$$
\widetilde{\tau}_i^t=\begin{cases}\widehat{\tau}_i^t,&i\in\mathcal U^t,\\\tau_i^t,&i\notin\mathcal U^t.\end{cases}
$$

$\tau_i^t$ 是原 ADS 的规划，$\mathcal U^t$ 是当前危险车辆集合，$\widehat{\tau}_i^t$ 是 RSU 选出的替代轨迹。控制开关执行后者时，原 ADS 本身仍然保留。实现采用 MPC 跟踪参考轨迹，作者也允许替换为厂商控制器；控制器跟踪误差仍是安全效果的前提。[§II-C、III-E](https://arxiv.org/html/2611.06204v1#S2.E2)

对每辆危险车，系统先从专家轨迹聚类得到的锚点生成候选。按式 15–16：

$$
c_i^m=c^m+\mathrm{MLP}\!\left(\mathrm{Attn}\!\left(\mathrm{TE}(c^m),\mathrm{BEV}_{\mathrm{agg}\to i}^{t}\right)\right),\qquad
\mathcal C_i=\{c_i^m\}_{m=1}^{M}\cup\{c_i^{\mathrm{brake}}\}.
$$

轨迹编码 $\mathrm{TE}(c^m)$ 作为查询，车辆坐标下的融合 BEV 提供场景信息，残差头输出各路点的修正量；另外加入恒定减速度的刹车候选。残差头用 Bench2Drive 专家轨迹训练，仅监督与专家最接近的锚点分支，即 winner-take-all。原 ADS 无须重训，但这层保障仍含独立训练的感知、预测和候选生成模块。[§III-D](https://arxiv.org/html/2611.06204v1#S3.SS4)

接着剪掉偏离可行驶区域、碰撞固定背景轨迹等候选。候选代价由偏离导航参考、接近背景交通、接近其他危险车辆三部分相加；刹车代价高于其余候选。系统保留有限个低代价且行为不同的候选，并维护跨时间的让行优先级，防止两车反复改变先后次序。

分支定界搜索从每辆车的候选池各选一条，最小化总成本，并依据预先计算的冲突图排除相互碰撞或违反让行关系的组合。这里搜索的是给定候选池里的联合分配。刹车候选始终保留，全部停车用于初始化回退；若车辆已经过近且没有可行的前进动作，回退仍可能留下死锁。[算法 1、式 17](https://arxiv.org/html/2611.06204v1#algorithm1)

## 关键图与可视化结果

![原论文图 2：RSU 感知、危险判断、联合缓解与车端接管](../../assets/papers/cosafe-cooperative-runtime-assurance-figure-2.png)

图 2 从左往右看：红色虚线表示 V2X 上传和下发，浅橙色框是 RSU 模块，蓝色框是车端开关。Hazard Assessment 分出 Safe 与 Unsafe 两条路径，只有后一条进入候选生成和联合选择。图中人驾车也属于环境，但没有被画成接受接管轨迹的车辆。[官方图 2](https://arxiv.org/html/2611.06204v1#S2.F2)

![原论文图 3：BEV 条件化的轨迹锚点修正及刹车候选](../../assets/papers/cosafe-cooperative-runtime-assurance-figure-3.png)

图 3 顶部先把路侧融合 BEV 变换到车辆坐标，再以轨迹锚点作 Q、场景特征作 K/V。加号表示把预测残差加回锚点，底部另外放入 brake。它画的是单车候选池生成；多车之间的冲突筛选与分支定界在后续算法 1 中完成。[官方图 3](https://arxiv.org/html/2611.06204v1#S3.F3)

## 实验结论与证据

### 同系统测试与异构混部是两组实验

InterDrive 的 NPC 增强设置覆盖 3 个城镇、46 条路线，每条有 2–8 辆 AV，并含背景车辆、行人和骑行者；场景分为路口、合流和换道。RQ1 对七种 ADS 分别测试，每条路线内所有 AV 使用同一种 ADS。RQ5 才按固定映射混用 TCP、LMDrive 和 UniAD。各项实验重复五次并报均值，但没有给出结果置信区间。[§IV-A](https://arxiv.org/html/2611.06204v1#S4.SS1)

所有受测 ADS 共用在 DeepAccident 上预训练的辅助 BEV 编码器及 RSU 融合模型。这个设计控制了不同 ADS 的特征适配差异，也使“异构兼容”的证据限定于统一辅助表征，尚未验证任意厂商内部特征直接互通。

RC 是路线完成率，IS 是违规惩罚因子，DS 为两者乘积；一条路线内先平均各车 RC、连乘各车 IS，最终再跨路线汇总。因此多车路线的 DS 对联合违规敏感，不能与单车榜单分数直接横比。

| 原表及设置 | 方法 | DS ↑ | SR ↑，% | 碰撞 / 死锁 ↓ |
| --- | --- | ---: | ---: | --- |
| 表 I–II，同 ADS，InterDrive-Total | TCP | 71.35 | 50.00 | 21 / 4 |
| 同上 | TCP + Argus | 82.48 | 67.39 | 10 / 6 |
| 同上 | TCP + CoSafe | 92.42 | 82.61 | 2 / 1 |
| 表 I–II，同 ADS，InterDrive-Total | VAD | 30.85 | 13.04 | 133 / 1 |
| 同上 | VAD + CoSafe | 81.60 | 56.52 | 6 / 5 |
| 表 V，三种 ADS 混部 | 无 CoSafe | 55.16 | 30.43 | 51 / 6 |
| 同上 | 有 CoSafe | 83.00 | 52.17 | 9 / 2 |

TCP 上，独立接管减少碰撞却增加死锁，联合协调同时改善两者；但 VAD 的死锁仍从 1 增至 5。作者将残留失败归于车辆过近、前进候选无法解开冲突，而动作空间没有倒车。安全和通行能力因此需要分别报告。混部 DS 的增加为 27.84 分，即相对增加 50.47%，不能把它替换成摘要中七种 ADS 平均相对提升的 70.03%。[表 I–II、V](https://arxiv.org/html/2611.06204v1#S4.T1)

### 联合选择、预警与运行成本

在 TCP 消融中，保持协同感知和危险判据，仅改成各车独立贪心，DS 降为 57.25、碰撞增至 82；固定优先级为 82.96、18 次碰撞；完整联合选择为 92.42、2 次碰撞。这支持联合分配在此候选集上的作用，也说明额外干预若缺少协调，可能比原 TCP 更差。[表 IV](https://arxiv.org/html/2611.06204v1#S4.T4)

危险识别平均 precision、recall、$F_3$ 分别为 0.836、0.943、0.930。标签取自未保护基线运行中的 CARLA 违规事件，把违规前三秒内的干预视为必要；它评估这一操作性定义下的预警，未直接估计每次干预实际避免事故的概率。[表 III、RQ3 设置](https://arxiv.org/html/2611.06204v1#S4.T3)

活动干预周期平均总耗时为 79.72 ms。协同感知平均/P95 为 27.55/52.30 ms，危险判断为 1.91/4.60 ms，联合缓解为 50.25/80.42 ms，控制开关小于 0.01 ms。实验机器为四张 RTX 3090；作者依据 RSU 与 ADS 并行执行解释其成本可被规划耗时覆盖，但真实部署仍需测量轨迹产生、通信、RSU 计算和车辆执行的完整时间关系，不能用各模块 P95 相加冒充实测整链 P95。[§IV-C](https://arxiv.org/html/2611.06204v1#S4.SS3)

TCP 的 RSU→AV 消息加入 500 ms 延迟后，DS 从无扰动的 92.42 降至 83.05，碰撞从 2 增至 6；加入 30% 丢包时为 90.27、3 次碰撞，均仍优于原 TCP。丢失替代轨迹时车辆执行原 ADS 规划。这组实验只扰动下行消息，没有同时覆盖上行特征过期、定位误差和消息身份错误。[表 VI](https://arxiv.org/html/2611.06204v1#S4.T6)

## 应用场景与启发

这项工作适合有路侧感知与接管接口的路口、园区或协同车队，用于研究“局部避险为何变成全局堵塞”。可以借鉴的是把危险车辆筛选、候选行为生成、联合协调和控制跟踪分别暴露为可检查模块。

一个值得验证的问题是：在保持共享感知不变时，历史让行记忆能否减少接管抖动而不过度固定错误优先级。现有模块消融没有把记忆与搜索完全拆开，因此它仍是待检验的机制问题。

## 局限与阅读风险

保障逻辑依赖感知、未来运动预测和有界跟踪误差，且候选搜索只覆盖有限行为。文中的安全不变量描述的是设计目标；始终保留刹车候选并不能单独证明任意初始状态都能避免碰撞。真实车辆还需要验证停止距离、执行器故障和 RSU 失联处理。

目前覆盖四类判据，未覆盖恶意消息、身份认证、传感器硬件故障或控制器失效。跨“安全”方向的意义是运行时保障与失效恢复，而不是论文已经验证了网络攻击防御。仿真结果也尚未覆盖更大车群、不同 RSU 覆盖交接或真实道路。

## 后续跟进

### 最小验证与停止条件

- **代码与配置**：2026-11-06 已检查官方仓库完整树与 README，存在 `cs_cosafe_c`、Cython 内核、单 ADS/混部/消融评价脚本及 InterDrive 路线。论文报告原型为 7,959 行 Python；本次未重新计数或验证全部实现与论文一致。
- **数据与权重**：仓库含路线文件，训练依赖 Bench2Drive、DeepAccident 等外部数据。树中列出候选生成器 `best.pth`，大小 28,800,513 字节；其他 ADS 与辅助感知权重指向外部下载。本次没有下载并加载这些权重，也未确认所有训练数据和模型组成可直接运行。
- **最小实验**：先补齐依赖和权重，在同一组 TCP 路线、固定候选与共享感知下，对比分支定界、固定优先级以及关闭历史让行记忆。共同记录碰撞、死锁、接管持续时间、优先级反转次数及整链尾时延。
- **成功信号**：相同随机种子下，联合方法减少碰撞和循环等待，同时不靠持续停车维持表面安全；关闭记忆若增加反复让行，可支持其稳定作用。
- **停止/转向条件**：若改进主要由不同候选、不同感知输入或更长等待换来，先统一这些条件；若失效集中于前进候选无解，再测试倒车或重新规划，不能把搜索器更换直接当作充分修复。

### 来源与核验记录

以 2026-11-04 提交的 v1 为准，2026-11-06 阅读 §II–V、式 2/6–17、算法 1 与表 I–VI，核对作者单位并逐张打开官方图 2、3。相关比较另读 Argus §III 和 CoLMDriver §4；正式发表信息与机制原文分别记录。CoSafe 的 arXiv comments 写明 ICSE 2027 accepted，仓库 README 仍写 submitted，本轮未核实正式论文集页面，录用状态仅按作者声明标注。未运行 CARLA、下载完整训练数据或复现指标。
