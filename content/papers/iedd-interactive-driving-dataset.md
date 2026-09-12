---
{
  "id": "iedd-interactive-driving-dataset",
  "tag": "agentic-driving",
  "tags": [
    "agentic-driving",
    "autonomous-driving-testing"
  ],
  "title": "An interactive enhanced driving dataset for autonomous driving",
  "source": "https://doi.org/10.1038/s41597-026-07929-2 / Scientific Data (2026) / arXiv:2602.20575 / https://arxiv.org/abs/2602.20575 / Code: https://github.com/egik-von/IEDD / Data: https://huggingface.co/datasets/Egikk/IEDD / Zenodo: https://doi.org/10.5281/zenodo.18742437",
  "authors": [
    "Haojie Feng",
    "Xinrui Zhang",
    "Mengjie Tian",
    "Peizhi Zhang",
    "Zhuoren Li",
    "Junpeng Huang",
    "Xiurong Wang",
    "Junfan Zhu",
    "Jianzhou Wang",
    "Dongxiao Yin",
    "Lu Xiong"
  ],
  "affiliations": [
    "School of Automotive Studies, Tongji University, Shanghai, 201804, China",
    "Tongji Automotive Design & Research Institute Co., Ltd., Shanghai, 201804, China",
    "University of Chicago, Chicago, IL 60637, USA",
    "Faculty of Computer Science, University of New Brunswick, Fredericton, NB E3B 5A3, Canada"
  ],
  "comment": "IEDD 把五个既有自然驾驶轨迹库统一为可追溯的交互片段，并进一步生成 BEV 视频、物理指标与分层 VQA，用于交互理解和 VLA 评测。它的价值在于数据重组与任务设计，而不是新采集传感器数据；微调提升物理量估计的同时显著损害反事实推理，是阅读时必须保留的结果。"
}
---

## 一句话定位

IEDD 将五个公开轨迹库重新组织为可检索交互片段，再生成物理描述量、轨迹渲染 BEV 视频与分层问答。它是一条可追溯的数据加工流程，而非新采集的多传感器数据集。

- 核心证据：派生记录共 7,313,985 段；Qwen2.5-VL 微调后量化任务 MAE 1855.55 → 0.3036，但未参与训练的反事实推理得分 4.66 → 0.19。[正式版表 2、7](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)
- 主要边界：评测只有 100 个典型交互场景，BEV 从已知轨迹绘制，反事实没有闭环执行结果；片段数量不是独立交通事件数量。

## 论文要解决的问题

### 问题与假设

已有驾驶日志很大，但交叉、汇入、跟车、对向交互不易检索，轨迹、视频与语言标签也未必对齐。IEDD 复用 Lyft Level 5、Waymo Open Motion、nuPlan、INTERACTION 和 SIND 的运动记录，尝试让片段、主体 ID、物理量和语言任务沿同一来源链对应。

其假设是规则化挖掘与语义生成可以形成有用的交互研究接口。统一 0.1 秒采样和坐标并不会消除不同城市、传感器、地图和规则的差异；后续用途仍依赖来源级分组与去重。

### 相关工作与差异

| 工作与一手来源 | 机制 | IEDD 的变化 |
| --- | --- | --- |
| Sima 等，2024，[DriveLM v2 §2–3](https://arxiv.org/html/2312.14150v2#S2) | 将感知、预测、规划问答连成图，并提供运动输出接口 | IEDD 从已有轨迹挖掘交互与物理指标，视觉是 BEV 重建；没有采用相同的图结构轨迹执行评测 |
| Yan 等，2026，[ObsDriveBench v1 §3](https://arxiv.org/html/2607.23537v1#S3)，预印本 | 用真实天气下相机/LiDAR/雷达观测生成可观测性、空间和风险问答 | IEDD 更适合分析轨迹交互和域内适配，但缺少观测遮挡与外观微语义；两者的“多模态”来源不同 |

## 方法和系统设计

### 输入输出与流程

原始轨迹先重采样、清理无效点，用有限差分、航向展开和对称平滑得到运动状态。随后在局部时间窗口搜索空间交点，根据重合程度、航向差和时间关系分成四类双主体交互，再聚合成自车中心多主体片段。表 1 给出搜索距离 2 m、时间差 3 s、片段窗口 5 s；这些值不同于状态定义中的 50 m 交互距离，不能混用。

片段计算交互强度与效率，离散运动状态转成行为原子和语义序列，最后生成 BEV 视频及 ShareGPT 风格问答。BEV 以交互峰值时刻的自车位姿为参考原点，并叠加短时历史轨迹；这是离线片段对齐，不是每帧当前自车坐标。L1 识别对象和交互，L2 描述行为，L3 估计数值与相对大小；L4 问“若采取另一动作会怎样”，仅用于测试。对称平滑和完整片段渲染属于离线处理，不能直接声称是一条因果在线感知流水线。[正式版 Methods、Data Records](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)

### 核心定义与直觉

原式 3 的强度描述由三项组成：

$$
Q_i(t)=w_sQ_{s,i}(t)+w_rQ_{r,i}(t)+w_pQ_{p,i}(t).
$$

三项是速度/加速度调整、TTC/PET 倒数变化、邻车势场。汇入时权重为 0.25/0.35/0.40，交叉为 0.20/0.55/0.25，对向为 0.15/0.65/0.20。它们是类别相关设计值，不是学到的事故概率；式 5 实际写相邻时刻倒数之差，没有除以时间间隔，改变采样率时需重新核对尺度。

原式 7–10 的效率可合并为：

$$
E_i=\frac{d_{\mathrm{straight}}}{d_{\mathrm{actual}}}
\exp\left(-\alpha_E\frac{T_{\mathrm{delay}}}{T_{\mathrm{free}}}\right)
\exp\left(-\beta_E\frac{\sigma_a}{a_{\mathrm{normal}}}\right).
$$

路径、延迟、加速度波动共同降低分数，默认 $\alpha_E=0.8$、$\beta_E=1.2$、$a_{\mathrm{normal}}=2$ m/s²。路径分子是起终点直线距离，合法弯道也可能天然低分，因此它是描述量，不等于遵守地图约束的最优驾驶真值。势场同样用于事后量化，未充当闭环规划器。[式 3–10、表 1](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)

### 数据生成、训练与推理

数据集本身不是需训练的神经网络，其关键可复现对象是阈值、来源字段、时间窗和语义模板。VLM 验证采用每视频均匀取六帧、512×512，只在多轮对话的第一轮提供图像。模型看到的是整段交互的回顾信息，后续依赖上下文记忆。

域适配实验使用 Qwen2.5-VL-7B-Instruct、两张 Xiyun C500、LoRA、AdamW，学习率 $5\times10^{-5}$、总 batch 128、64 次梯度累积、余弦调度、0.05 warmup、2 epoch。论文段落未给出完整 LoRA rank/目标层和训练样本清单，不能仅凭验证损失 0.0993 声称训练可原样复现。[Technical Validation，微调小节](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)

## 关键图与可视化结果

![原论文图 1：交互挖掘、物理量化和 BEV/语言合成](../../assets/papers/iedd-interactive-driving-dataset-figure-1.png)

从左侧五类轨迹输入，依次读交互挖掘、强度/效率量化、BEV 和语言合成。图中的摄像机符号指向生成的视觉表示，不能解释为新采集原始相机视频。[正式 PDF 图 1](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)

![原论文图 7：零样本与 CoT 的分项结果及变化](../../assets/papers/iedd-interactive-driving-dataset-figure-7.png)

雷达图比较各能力维度，热图显示加入 CoT 的变化。要先看指标方向：MAE 降低是改善，其他许多分数则越高越好；不同量纲和归一化不能凭图形面积解释成统一安全能力。它比较提示方式，微调的反事实退步另见表 7。[正式 PDF 图 7](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)

## 实验结论与证据

### 设置与指标

100 场景测试包含完整 L1–L4 问答，L4 未用于微调。Obj IoU 是文本对象 ID 集合重叠，不是框 IoU；Int Acc 是交互分类；L3 数值 MAE 与逻辑大小判断分开，L4 由 GLM-4.7 按 0–10 评分。原式 12–13 为：

$$
\mathrm{WIS}=0.2L_1+0.2L_2+0.2L_3+0.4L_4,\qquad
\mathrm{WIS}'=(L_1+L_2+L_3)/3.
$$

各 $L$ 先归一化；MAE 归一化用 0.5 容差。WIS' 刻意排除反事实层，因此 WIS' 上升不能证明整体推理改善。物理量 MAE 混合的数值目标也不能直接标成米或 m/s。

### 主要结果与比较

| 表 7，同一 Qwen2.5-VL-7B | WIS' ↑ | L3 MAE ↓ | L3 逻辑准确率 ↑ | L4 推理分 /10 ↑ |
| --- | ---: | ---: | ---: | ---: |
| 零样本 | 0.1475 | 1855.55 | 0.15 | 4.66 |
| 零样本 + CoT | 0.1644 | 9.73 | 0.16 | 4.75 |
| LoRA 微调 | 0.2636 | 0.3036 | 0.53 | 0.19 |
| LoRA + CoT | 0.2336 | 0.3704 | 0.52 | 0.37 |

微调后 WIS' 相对增加约 78.7%（按表计算），但对象 ID IoU 0.3795 → 0.3023、L4 得分明显退步；CoT 对微调后模型也没有继续改善 WIS'。巨大 MAE 变化值得复核输出解析、异常值与数值尺度，不能仅用这一个数推断模型掌握了驾驶物理。[表 7](https://www.nature.com/articles/s41597-026-07929-2_reference.pdf)

### 数据规模与证据边界

7,313,985 段中，双主体 658,636、多主体 6,655,349；Lyft 来源占 6,027,456 段。同一原始场景可贡献多个片段，训练测试需按原始 scenario/scene 分组检查。正文没有给出足以在本次直接重算全库近邻泄漏率的发布清单。

三位专家对 100 份 L4 回答盲评；表 4 的专家分别对照结果汇总为 Pearson 0.81±0.03、Spearman 0.78±0.04、MAE 1.22±0.12。正文将其描述为与平均人工分比较，且 Pearson 写 0.8±0.03，与表格的呈现略不同；这里按原表引用，不把专家间变异当成训练多种子置信区间。该核验只支持 judge 与人类评分的一致性，不是反事实被实际执行的正确性。

## 应用场景与启发

- 作者主张：支持交互片段检索、长尾分析、指令微调和分层评测。
- 我的判断：最适合借鉴的是来源追踪与“域内数字能力上升、未训练推理能力下降”的并列检查。
- 待验证假设：加入通用任务 replay 或反事实一致性约束，可以保住量化收益，同时减轻 L4 退步；应由留出场景与独立 judge 检验。

## 局限与阅读风险

作者承认 BEV 无法表达目光、手势、刹车灯、遮挡和天气微语义，异构来源有域差异，规则/模板可能遗漏模糊协商。报告还需警惕片段重叠、效率公式对道路曲率的偏好，以及人工势场并非策略最优性真值。L4 是语言评分，无反应式交通或车辆动力学验证；不能据此称为闭环驾驶能力提升。

## 后续跟进

### 最小验证与停止条件

- 资源状态（2026-09-12）：[官方 GitHub](https://github.com/egik-von/IEDD)有预处理、轨迹转视觉、问答构造和评测脚本；[HF](https://huggingface.co/datasets/Egikk/IEDD)列出五个来源归档、训练 JSON、视频等派生资产，论文另指向 [Zenodo](https://doi.org/10.5281/zenodo.18742437)。本次未逐包加载，也未确认微调权重；原始五库须独立取得。
- 最小实验：先选一个来源，按原始场景建立不重叠切分，核对 100 条记录的 ID、时间窗、视频帧与数值目标；固定模型和 judge 比较零样本、LoRA、LoRA+replay，同时报告全部 L1–L4。
- 成功信号：MAE/逻辑准确率保留收益，且 L4 人工和第二 judge 的评分不再明显下降。
- 停止/转向：数值收益由解析异常解释，或原始场景跨集合重叠，则先修数据与评分，不继续扩大微调。

### 来源与核验记录

2026-09-12 依据 Scientific Data DOI 10.1038/s41597-026-07929-2 的官方 Article in Press PDF，核对作者/单位页、Methods、Technical Validation、式 3–13、表 1–7、图 1/7；参考 arXiv:2602.20575 仅作身份链接，不混用早期作者顺序。出版 PDF 仍有引用字段排版错误，相关工作机制另从 DriveLM v2 与 ObsDriveBench v1 原文核验。未进行实验复现。
