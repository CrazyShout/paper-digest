---
{
  "id": "ssp-syn2sim2phy-vla-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "end-to-end-autonomous-driving", "agentic-driving"],
  "title": "SSP: An Event-Matched Syn2Sim2Phy Cross-Domain Evaluation Framework for Autonomous-Driving VLA Models",
  "source": "arXiv:2608.14024 / https://arxiv.org/abs/2608.14024 / HTML: https://arxiv.org/html/2608.14024",
  "authors": ["Haojie Feng", "Peizhi Zhang", "Xinrui Zhang", "Zhuoren Li", "Junpeng Huang", "Xiurong Wang", "Dongxiao Yin", "Yuxiang Zhang", "Junfan Zhu", "Lu Xiong"],
  "affiliations": ["College of Automotive and Energy Engineering, Tongji University", "Tongji Automotive Design and Research Institute Co., Ltd.", "Hubei Jingchu Humanoid Robot Co., Ltd.", "University of Chicago"],
  "comment": "SSP 不再拿三个域里标签相同但内容不同的视频比较 VLA，而是把同一 cut-in 或弱势交通参与者事件从合成视频编译到 CARLA 和封闭试验场，并在进入评测前审计事件身份。当前只有两类事件，但提供了少见的物理执行证据链。"
}
---

## 一句话定位

SSP 解决跨域 VLA 评测里最容易被忽略的混杂：Synthetic、Simulation 和 Physical 样本如果只是同名场景而不是同一交互事件，分数差异同时包含域变化和内容难度。作者先冻结事件身份，再改变观测与执行域，最后把异构 VLA 的语言、动作和轨迹投到统一的一秒评测窗口。

## 论文要解决的问题

“cut-in”标签无法保证道路拓扑、目标车辆起点、相对速度、触发时刻、冲突区域和通过顺序一致。若三个域各挑一个样本，物理域分数较高或较低都不能归因于 domain gap。另一方面，不同 VLA 输出自由文本、离散动作、速度-曲率或不同坐标/频率的轨迹，直接比较总分会把接口缺失、解析失败、语义错误和行动不一致混在一起。

论文的核心选择是把评测对象从场景类别收紧到可审计 event instance：哪些语义必须保持、哪些外观和动力学允许变化，都记录在版本化 evidence package 中。

## 方法和系统设计

- 从 AVD2 合成长尾视频抽取道路拓扑、参与者角色、相对运动、冲突关系、通过顺序、允许响应和 approach/trigger/conflict/resolution 阶段，经规则与人工复核形成事件规格。
- 同一规格分别编译为 CARLA 配置和封闭试验场任务；出现对象形变、身份漂移、运动不连续或事件关系改变的资产直接拒绝，不进入模型评测。
- 将 OpenEMMA、LLaViDA 和 Alpamayo-R1 的自由文本映射到封闭语义槽，将轨迹统一到 ego 坐标和 1 s 窗口；缺失、无效与错误分别计分。
- 评价覆盖输出有效率、语义覆盖/正确、关键交互识别、显式动作、轨迹可行性、文本-轨迹一致和持续风险响应，并保留原始输出到评分槽的证据来源。

## 关键图与可视化结果

![图 1：同一 cut-in 与 VRU crossing 事件在合成、CARLA 和封闭试验场中的配对实现](https://arxiv.org/html/2608.14024v1/fig3.png)

图 1 是 SSP 相对普通跨域 benchmark 的关键资产：三个画面不追求像素相似，而要保留角色、冲突区域和事件阶段。图中彩色覆盖只用于解释，不输入 VLA，避免把可视化标注当成模型提示。

![图 2：两类事件、三个域和三种 VLA 的能力矩阵与风险响应结果](https://arxiv.org/html/2608.14024v1/fig6.png)

图 2 不只给一个排行榜，而是把语言有效、语义、关键交互、轨迹和响应延迟拆开。它能识别“文字说要减速、轨迹却继续加速”这类总分不容易暴露的行为链断裂。

## 实验结论与证据

在 cut-in 与 VRU crossing 两类配对事件上，Synthetic、Simulation、Physical 的宏平均 IVCS 分别为 0.259、0.291、0.325；但 cut-in 由 Simulation 以 0.340 领先，VRU 则由 Physical 以 0.374 领先，否定了“越物理越高分”的固定排序。Alpamayo-R1、OpenEMMA、LLaViDA 分别为 0.405、0.338、0.131，后者低分同时包含接口输出缺失、语义槽错误和轨迹质量不足。

在固定 OpenEMMA 风格接口的模型规模对照中，Qwen3-VL-30B-A3B 以约 3B active parameters 达到 0.630 trajectory-quality success rate 和 0.398 IVCS，高于 32B Dense 的 0.426/0.366；235B-A22B 并未单调更好。论文谨慎说明 active parameters 不是 FLOPs、时延或能耗，不能据此宣称实时优势。

## 应用场景与启发

- 应用场景：合成长尾筛查、CARLA 可控复现、封闭场地确认组成的分级测试流水线，以及跨 VLA 接口的行为链诊断。
- 方法启发：跨域数据集应发布事件规格、拓扑映射、阶段标签、编译参数、执行日志和人工修改，而不只是三个视频。
- 研究启发：可把雷达 occupancy 的 free/occupied/unknown、Doppler 与可见性加入事件身份，检查不同域和天气下传感器证据是否仍指向同一冲突。
- 讨论问题：如何把当前短时视频条件轨迹接到真实闭环车辆响应，同时保持三个域中的事件身份可比？

## 局限与阅读风险

当前只有 cut-in 和 VRU crossing，各域资产数量很小；结论不能外推到路口博弈、汇入、遮挡、恶劣天气、高速或连续多车互动。统一 1 s 窗口可能漏掉后续制动，轨迹阈值只能筛明显异常，不能证明动力学安全。封闭试验场包含真实成像和执行扰动，但不是公共道路分布。受限 LLM 提取器仍可能误解否定和指代，论文尚未给出双盲一致性统计；数据和工具也仍是计划公开，而非已验证可下载资产。

## 后续跟进

- 先等待公开 evidence package，再复核每个域是否真正通过同一事件资格审计。
- 增加无结构直接编译、对象关系规格和完整事件规格三组消融，量化 event matching 的净价值。
- 把 1 s 轨迹执行到 CARLA 与试验场，报告最小间距、风险持续时间和紧急接管，而不只评价预测轨迹。
