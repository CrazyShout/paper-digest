---
{
  "id": "camasa-v2x-trajectory-dataset",
  "tag": "cooperative-autonomous-driving",
  "tags": [
    "cooperative-autonomous-driving"
  ],
  "title": "CAMASA: A CAM-based Dataset from the MASA Living Lab",
  "source": "arXiv:2606.10641 / https://arxiv.org/abs/2606.10641 ; dataset: https://www.automotivesmartarea.it/dataset/",
  "authors": [
    "Salvatore Iandolo",
    "Marco Savarese",
    "Gaetano Orazio Cauchi",
    "Antonio Solida",
    "Martin Klapez",
    "Maurizio Casoni",
    "Angelo Porrello",
    "Carlo Augusto Grazia"
  ],
  "affiliations": [
    "Department of Engineering \"Enzo Ferrari\", University of Modena and Reggio Emilia"
  ],
  "comment": "CAMASA 提供来自 Modena Automotive Smart Area 的真实 CAM/DENM 数据，把 V2X 轨迹预测从合成或传感器中心数据推进到基础设施记录的通信动态。"
}
---

## 一句话定位

CAMASA 把城市路侧接收到的真实 CAM/DENM 报文整理成可分析的运动轨迹；它最有价值的部分是保留通信采样与身份切换问题，而不是提供又一个完整感知数据集或已经验证的预测模型。

- 核心证据：表 I 报告 40,446,000 条 CAM、2,376,571 条 DENM、25,839 个 CAM station ID；这些分别是报文和标识符计数，不等于独立交通事件或物理车辆数。
- 主要边界：10 Hz 是处理后的插值频率，原文观察到的平均报文间隔约 400 ms；累计距离在表 I 与表 V 分别为 103,054 km 和 14,287 km，全文未清楚解释两种统计范围。[§IV、表 I/V](https://arxiv.org/html/2606.10641v1#S4)

## 论文要解决的问题

### 从接收报文到轨迹样本

生产车辆通过 CAM 广播位置、速度和航向，RSU 在覆盖范围内记录它们；同一报文可能被多个接收点看到，也可能因无线覆盖中断而缺失。stationID/MAC 还会随隐私机制改变，故“相同 ID 的消息串”不是自然完整轨迹。CAMASA 尝试清洗、关联和统一采样，支持通信感知的交通建模。[§III–IV](https://arxiv.org/html/2606.10641v1#S3)

MASA 覆盖约 0.64 km²、部署 18 个 RSU，车辆主要来自具备原厂 V2X 的 Volkswagen。未装备 V2X 的车和弱势交通参与者不一定出现在报文里，因此该数据不能当作区域所有交通主体的真值，也不能直接用于完整场景碰撞标签。

### 相关工作与差异

| 工作与一手来源 | 已有设计 | CAMASA 的差异与使用边界 |
| --- | --- | --- |
| Kueppers 等，V2AIX，ITSC 2024；[原文 v1 §III–IV](https://arxiv.org/html/2403.10221v1#S3) | ASN.1 到 ROS/ROS 2 的自动类型与转换工具；移动车和固定设施记录 CAM/DENM/MAPEM/SPATEM，部分配置有相机/LiDAR 上下文。 | CAMASA 强调长期固定路侧采集、规模更大的 CAM/DENM 和身份关联后的轨迹；只含两类消息、缺原始感知。不同 V2AIX 版本计数不同，不直接沿本文二手表做严格规模排名。 |
| Grasselli 等，CAMNet，CCNC 2026；[原文 v1 §IV-B、V](https://arxiv.org/html/2510.12703v1#S4.SS2) | 从 Modena CAM 建 11 s 场景，经两阶段插值和人工清理；用 VRNN 与 GNN 进行多模态轨迹预测。 | CAMASA 主要扩展和描述数据资产，没有重做完整预测 benchmark。CAMNet 中 98% 场景只有一个广播主体，提示消息量大并不自动带来充分交互观测；该比例属于 CAMNet 旧子集，不移植为 CAMASA 统计。 |

## 方法和系统设计

### 原始数据与清洗顺序

RSU 经 DSRC/ITS-G5 接收报文，通过接入网络和光纤骨干送往服务器；论文列出 RSU 同时具备 C-V2X 能力，但数据中的协议行为应按实际捕获栈核验，不能把硬件能力当作两种无线技术都有记录。[图 1、§III](https://arxiv.org/html/2606.10641v1#S3)

原始 PCAP 被解析为 JSON，保留位置、时间戳、速度、航向和身份字段。清洗删除孤立 CAM、RSU 自身消息、空文件，并排除部分高速/密集环路区域，因为连续车辆运动相似会使关联算法退化。之后关联 ID 切换、插值到约 100 ms 间隔，保留插值标记。[§IV Filtering operations](https://arxiv.org/html/2606.10641v1#S4)

[作者处理仓库](https://github.com/MarcoSavarese27/camasa-dataset-filtering)还说明最终目录只含 CAM，DENM 最后保留于去除 RSU 后的中间阶段。因此需要事件分析时，不能只下载最终轨迹表而假设其中仍有所有 DENM。

### 关联规则与插值，不是学习目标

这篇数据论文没有新训练损失。核心规则可从正文与已读作者代码区分：正文说 ID 改变、间隔“等于 1.5 s”、距离不超过 21 m；当前 `stage_6_attach_traces.py` 则在时间差大于 1500 ms 或距离大于 21 m 时拒绝。对按时间排序的相邻记录，可概括代码意图为：

$$
 \operatorname{link}(i,j)=\mathbf1[\operatorname{ID}_i\ne\operatorname{ID}_j]\,
 \mathbf1[\Delta t\le1.5\,\mathrm{s}]\,
 \mathbf1[d(i,j)\le21\,\mathrm{m}].
$$

21 m 约等于 50 km/h 在 1.5 s 内的行程。它是距离门限，不证明两条记录来自同一物理车辆；代码所查条件没有显式使用航向、加速度或多候选竞争。正文的相等描述与代码时间窗要保留区别，不自行修正文献。[§IV；作者关联脚本](https://github.com/MarcoSavarese27/camasa-dataset-filtering/blob/main/stage_6_attach_traces.py)

线性插值的含义可以用标准定义解释，下面是对处理过程的数学转写，原文没有编号公式：

$$
 \widehat x(t)=(1-a)x_i+a x_j,\qquad a=\frac{t-t_i}{t_j-t_i},\qquad t\in[t_i,t_j].
$$

它在已有观测之间补采样点，不能创造独立测量或还原真实瞬时加速度。[实际插值脚本](https://github.com/MarcoSavarese27/camasa-dataset-filtering/blob/main/stage_end_interpolate.py)同时处理 generationDeltaTime 的 65,536 ms 回绕、UTM 坐标和航向角周期；本次只阅读代码，没有验证其所有边界情况或严格 100 ms 对齐。

### 原始观测与下游训练的边界

用 processed 轨迹做预测时，输入/标签可能都包含插值点；若跨预测起点用未来原始观测插值历史，将产生未来信息泄漏。本文没有提供专门的 forecasting split、预测时域、ADE/FDE 基线或防泄漏评测协议，因此数据处理完成不等于预测评测设计完成。

还应把 RSU 接收时间和 CAM 生成时间分开：接收间隔同时反映发包策略与链路丢失。若没有发送端完整日志，不能单凭收到的报文数直接计算可靠的全链路丢包率。

## 关键图与可视化结果

![原论文图 1：车辆、DSRC、RSU、骨干网络与服务器](../../assets/papers/camasa-official-figure-1.png)

从左向右看消息经过的采集路径，明确数据在基础设施侧记录。它解释来源和系统组成，没有给出真实时延分布或覆盖概率。[原图 1](https://arxiv.org/html/2606.10641v1#S1.F1)

![原论文图 3：同一示例轨迹在多个 RSU 接收区之间延续](../../assets/papers/camasa-official-figure-3.png)

点的颜色对应接收 RSU，蓝色圆点为 RSU 位置。沿路线颜色变化可以理解多接收点组成轨迹的过程；一个视觉连贯样例不能量化 ID 关联的正确率，也不能把报文属性看作独立传感器真值。[原图 3](https://arxiv.org/html/2606.10641v1#S4.F3)

## 实验结论与证据

### 规模与统计单位

| 原文位置与量 | 报告值 | 可以解释为什么 |
| --- | ---: | --- |
| 表 I，CAM 报文 | 40,446,000 | 长期接收样本规模，未等价为独立广播次数 |
| 表 I，DENM 报文 | 2,376,571 | 含事件通知重复发送的可能，不能当事故数量 |
| 表 I，CAM unique ID | 25,839 | 可变 pseudonym 数，不能直接当唯一车辆数 |
| 表 I，累计距离 | 103,054 km | 该表口径下的累计值 |
| 表 V，CAMASA 距离 | 14,287 km | 与表 I 不一致，清洗/去重范围未说明 |

摘要使用“超过 14,000 km”，结论又写“超过 100,000 km”；在找到逐阶段清单前，不能选择较大的数字宣传，也不能猜测差异全部来自去重。[表 I、表 V、§V](https://arxiv.org/html/2606.10641v1#S2.T1)

### DENM 内容及接收点差异

表 II 的三类报文分别为 traffic increasing 1,606,678、stationary vehicle 767,711、dangerous situation 2,182。按报文数相加恰为 2,376,571，但各类 unique ID 不能直接相加当独立发送车总数；有些 ID 可能跨事件类别。三类报文规模差异很大，用它训练事件分类必须处理采样与重复通知，不能简单按报文计准确率。

表 I 的三个高负载 RSU 接收 CAM 约 310–332 万条，反映覆盖、交通和接收重叠的共同作用；它不是受控比较，不能推断某个 RSU 硬件更好。图 6 的轨迹长度/持续时间还截断在第 99 百分位，未展示的极端尾部不能由图复算。

### 清洗效果的证据缺口

论文展示 ID 片段连接和插值前后可视化，但没有人工真值匹配的错误合并/错误拆分率、阈值扫描表或移除道路区域前后的覆盖差异。作者说 1.5 s 是经验上较好的阈值，当前证据不足以认定它在密集跟车、不同限速或跨城市仍最优。

10 Hz 输出与原始平均约 400 ms 间隔必须一起报告。数据适合规则采样模型，不代表其拥有与原生 10 Hz 高精定位轨迹同等时间精度。[§IV、图 4–6](https://arxiv.org/html/2606.10641v1#S4)

## 应用场景与启发

- 作者主张：用于轨迹预测、SUMO 校准、城市数字孪生以及通信覆盖分析。
- 我的判断：最直接的用途是保留原始接收间隔、RSU 来源与插值标记的交通模型；与相机/LiDAR 数据应互补，不能当作完整场景替代品。
- 待验证假设：按原始观测可信度给插值训练标签降权，会比统一当真值更好地预测稀疏/中断链路轨迹；应只在未插值的原始观测点上评价核心误差。

## 局限与阅读风险

作者明确承认地理覆盖、V2X 装配率、厂商实现及关联错误限制外推，且不含 SPATEM/MAPEM。主动删除关联困难的高速度/密集路段还可能让保留数据低估困难工况，需报告筛除分布。

原始报文、不同 RSU 重复接收、重建轨迹和最终插值记录的总量尚未以单一可核算清单对应。代码 README 对部分字段单位表述也不统一，应以 ETSI 编码和实际解码脚本核对，而不是直接把 Speed/Heading 当作常识单位。

## 后续跟进

### 最小验证与停止条件

- 当前资源（2026-09-12）：[官方入口](https://www.automotivesmartarea.it/dataset/)链接原始数据和处理仓库。数据端点 HEAD 返回 200、ZIP 长度 18,686,528,716 byte，约 18.69 GB；未下载归档。作者代码有解析/筛选/关联/插值脚本，代码 LICENSE 为 GPL-3.0；数据归档的独立许可本次未核实。没有模型权重需求；README 所写插值文件名与实际 `stage_end_interpolate.py` 不同，运行命令未验证。
- 最小实验：只取一个日期、少量 RSU 原始片段，逐阶段统计广播去重、ID 数、轨迹数、累计距离和插值占比；人工检查随机关联候选与密集区域候选，固定真值标注后比较 1.0/1.5/2.0 s 时间窗及不关联基线。先完成数据审计，再以恒速为基线，固定 LSTM 的输入、划分和训练预算，对比插值标签等权与降权；两组均只在原始观测点评价，并按接收间隔分层；普通 CPU 可做小样本，完整归档磁盘与 RAM 需求需实测。
- 成功信号：逐阶段数字解释两种距离口径；ID 关联错误率可量化，且只在原始观测点评价时预测收益仍存在。
- 停止/转向条件：无法建立阶段清单、关联大量不同车辆或历史插值用了预测窗口内的观测，则暂停预测排名，先修正数据协议并保留原始时间戳。

### 来源与核验记录

依据 [arXiv:2606.10641v1](https://arxiv.org/html/2606.10641v1)，2026-06-09 版本，2026-09-12 核验；读 §III–IV、表 I–V、图 1/3 实际图像与机构。相关工作分别读 V2AIX v1 §III–IV、CAMNet v1 §IV–V；处理代码为当天官方仓库 main 的只读检查，未声称是论文发布时的固定 commit。未下载车辆记录、运行关联或预测模型。
