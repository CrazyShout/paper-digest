---
{
  "id": "vlga-geometry-action-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "3d-reconstruction",
    "world-models"
  ],
  "title": "VLGA: Vision-Language-Geometry-Action Models for Autonomous Driving",
  "source": "arXiv:2606.12396 / https://arxiv.org/abs/2606.12396 ; project: https://yaojin17.github.io/VLGA",
  "authors": [
    "Jin Yao",
    "Dhruva Dixith Kurra",
    "Tom Lampo",
    "Zezhou Cheng",
    "Danhua Guo",
    "Burhan Yaman"
  ],
  "affiliations": [
    "Uber AV Labs",
    "University of Virginia"
  ],
  "comment": "VLGA 给 VLA 驾驶模型增加独立 geometry expert，并用 LiDAR pointmap 重建监督，让语言、视觉、稀疏感知和稠密几何共同服务轨迹规划。"
}
---

## 一句话定位

VLGA 在 UniDriveVLA 的理解、稀疏感知、动作三个专家之外增加独立几何专家，用训练期 LiDAR 点图监督约束它，再让动作专家读取几何特征。[固定全文 2606.12396v1](https://arxiv.org/html/2606.12396v1) 支持小幅规划改善，但没有证明重建质量本身保证闭环安全。

## 论文要解决的问题

框、车道和占据查询提供结构化信息，却未必保留近车障碍边缘、路面连续形状等细节。作者希望让语言语义与稠密几何保有各自参数，同时服务轨迹预测。这里的研究问题是“新增几何容量和明确重建监督是否有用”，而非仅展示三维点云。

## 方法和系统设计

### 四个专家怎样交换信息

六路 960×544 相机同时进入 VLM 与冻结的 DVGT-2 几何骨干。后者输出每相机 60×34 个 patch 特征，经投影进入新几何专家 G。理解 U、感知 P、几何 G、动作 A 各有 Q/K/V 与前馈参数，通过带掩码的联合注意力交换信息：G 读取 U/P，A 读取 U/P/G。A 用 flow matching 输出未来 3 秒的六个 BEV 二维点，还接收历史四步轨迹与状态条件；全文未列出求解步数和完整控制器设置。它没有在线把点图转成硬碰撞约束。

“有/无自车状态”使用相同权重，区别是输入真值速度、加速度等，还是 P 预测的状态；后者仍有状态条件和历史轨迹，不能理解为完全没有自车运动信息（§3.2、附录 A）。

### 几何监督与冻结边界

累计 LiDAR sweeps 投影到相机，生成自车 LiDAR 坐标系点图；只监督有效深度 0.5–80 m 的位置。五层 Transformer 解码器预测三维点与不确定性，原式 (3)–(4) 为：

$$
(\hat{\mathbf x}_p,c_p)=\mathcal D(G)_p,\qquad
\mathcal L_{\mathrm{pmap}}=\frac1{|\mathcal P|}\sum_{p\in\mathcal P}\left(\frac{\|\hat{\mathbf x}_p-\mathbf x_p^{\mathrm{gt}}\|_1}{b_p}+\log b_p\right),\quad b_p=\operatorname{softplus}(c_p).
$$

这里 P 的花体集合表示有效监督位置，G 表示几何 token；分母降低高不确定位置的误差权重，log 项约束任意放大尺度。正文在 pixel 与 patch 之间用词不完全一致，附录说明输出经 pixel shuffle 恢复像素分辨率。

第一阶段只训练新增几何专家、投影与解码器；第二阶段再解冻动作专家。VLM、感知专家与 DVGT-2 骨干始终冻结。原式 (5)–(6) 的目标为：

$$
\mathcal L_1=\mathcal L_{\mathrm{pmap}},\qquad
\mathcal L_2=\mathcal L_{\mathrm{act}}+0.1\mathcal L_{\mathrm{pmap}}.
$$

推理删除点图解码器，不需要 LiDAR；几何骨干和 G 仍运行。因此删除监督头不等于几何分支没有推理成本。

### 与原始相关方法的区别

[UniDriveVLA v1，§3.2–3.4](https://arxiv.org/html/2604.02190v1) 已用三专家、掩码联合注意力、稀疏检测/地图/运动/占据查询及 flow matching。VLGA 继承这些机制，新增的是独立且受重建监督的几何路径。[DVGT-2 v1，§3.1–3.3](https://arxiv.org/html/2604.00813v1) 则以固定历史缓存联合预测局部点图、相对位姿和轨迹，没有语言流。VLGA 借用它的冻结特征，但不能据此继承其流式速度结论。

## 关键图与可视化结果

![原论文 Figure 1：四类几何信息进入驾驶策略的方式](../../assets/papers/vlga-geometry-action-driving-figure-1.png)

Figure 1 对比稀疏监督、向语言层注入特征、纯几何策略和四专家方案。图中的优劣打勾是作者的架构归纳，不是每一项能力的独立实验证明。

![原论文 Figure 4：七个 nuScenes 样本的六视图、点图及轨迹](../../assets/papers/vlga-geometry-action-driving-figure-2.png)

Figure 4 的绿色是真值、黄色是预测。点图由训练用解码器恢复，显示几何可读出性；这七个精选场景不能证明所有障碍已被完整重建，也不能把点图称为推理时的显式安全约束。

## 实验结论与证据

### 匹配协议下的收益

nuScenes 使用 28,130 训练关键帧、150 个验证场景的 6,019 样本。表 1 的 ST-P3 与 UniAD 是两套评测，下面只比较同一行协议、相同 VLM 规模且不输入真值自车状态的结果；L2/碰撞均越低越好。

| 对照 → VLGA | ST-P3 平均 L2（m） | ST-P3 3 秒碰撞（%） | UniAD 平均碰撞（%） |
| --- | --- | --- | --- |
| UniDriveVLA-Base → Base | 0.54 → 0.52 | 0.31 → 0.28 | 0.41 → 0.35 |
| UniDriveVLA-Large → Large | 0.51 → 0.50 | 0.21 → 0.18 | 0.27 → 0.22 |

这些“碰撞率”是开环预测几何指标。Large 的 UniAD 3 秒 L2 反而从 1.50 升至 1.52 m，并非所有指标改善。

Bench2Drive 在 12 个 CARLA 城镇的 220 路线上闭环测试。表 2 对比 UniDriveVLA：DS 78.37→79.08，成功率 51.82%→52.73%；效率 198.86→194.63，舒适度 11.78→13.06。表 3 的让行成功率 30%→40%，但超车 80%→77.78%、交通标志 58.95%→53.68%。没有方差，不能把 +0.71 DS 当成稳定优势或真实道路保证。

### 消融与成本

表 4 在同一无真值状态、ST-P3 协议下，基线/加 G/再加点图监督的平均 L2 为 0.539/0.529/0.524 m，碰撞为 0.169%/0.149%/0.136%；最后一步下降 0.013 个百分点，相对约 8.7%。这支持监督有增量收益，但未提供相同参数量替代分支、等训练计算量和多种子控制。

附录 B：8 张 H100、有效 batch 128；nuScenes 两阶段 10/30 epoch，Bench2Drive 为 3/7 epoch。表 5 分别给学习率 1e-4/5e-5，与正文“两阶段均 5e-5”冲突；复现前须确认。未报告整套模型推理延迟、峰值显存和训练时长，不能用闭环效率分数代替模型吞吐量。

## 应用场景与启发

适合已有语言与稀疏感知模型、又有训练期 LiDAR 的团队研究几何辅助监督。值得检验的是：在相同几何容量下，持续的点图监督能否改善动作学习；比单纯增加一个几何骨干更容易做因果归因。

## 局限与阅读风险

点图真值依赖标定、累帧与动态物体处理，论文未充分给出构建细则。正文称保留 12,240 个几何 token，附录投影却有 stride-2 spatial unshuffle，最终 token 数与通道变换需代码澄清。上述两处差异在 PDF 中也存在。新增几何预算、输入历史与预训练数据带来的贡献尚未完全分离；语言能力保留也没有新增理解评测支撑。

## 后续跟进

### 资源状态与最小检验

截至 2026-09-12，[官方项目](https://yaojin17.github.io/VLGA/) 标记 Code coming soon；[官方仓库](https://github.com/yaojin17/VLGA) 仅有 README 和架构图，未发现实现、配置、权重或点图生成脚本。当前还不能完整复现。

待同一个阶段一 Base 检查点及监督脚本发布后，复制两组，均保留相同 G 和解码器，以相同 30 epoch、batch、数据顺序和 3 个种子训练阶段二，仅比较点图权重 0.1/0；这是检验“继续几何监督改善动作学习”的训练干预。按论文预算准备 8×H100，先用 100 样本核对坐标与有效掩码，再做完整训练和 6,019 样本评测。成功标准预设为平均碰撞下降至少 0.01 个百分点且 L2 不升；若种子间方向不一致，不宣称稳定收益。缺少阶段一权重、点图协议或未解决学习率/token 数冲突时停止，不以冻结模型删输入代替这一训练比较。本报告未运行实验。
