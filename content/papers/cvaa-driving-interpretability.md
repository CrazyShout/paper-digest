---
{
  "id": "cvaa-driving-interpretability",
  "tag": "autonomous-driving-security",
  "tags": [
    "autonomous-driving-security",
    "autonomous-driving-testing",
    "agentic-driving",
    "end-to-end-autonomous-driving"
  ],
  "title": "What Do They See? Interpreting Complex Road Scenarios Through the Eyes of Vision-Language-Action Models for Safe and Trustworthy Autonomous Vehicle Learning",
  "source": "arXiv:2607.16938 / https://arxiv.org/abs/2607.16938 / HTML: https://arxiv.org/html/2607.16938v1",
  "authors": [
    "Kalpana Panda",
    "Wesley Maia",
    "Vinti Agarwal",
    "Ross Greer"
  ],
  "affiliations": [
    "Department of Computer Science and Information Systems, Birla Institute of Technology and Science, Pilani",
    "Machine Intelligence, Interaction, and Imagination Lab, University of California, Merced"
  ],
  "comment": "CVAA 用对象删除比较 Alpamayo 1 的均值轨迹变化；排名不稳定与内部探针提供审计线索，但修补混杂和原文数值问题限制了因果解释。"
}
---

## 一句话定位

CVAA 通过移除一个道路对象并重新预测，衡量 Alpamayo 1 的轨迹响应，而不是依赖模型生成的解释。Counter-nuScenes 含 210 个前视关键帧；这提供了对象敏感性证据，但单帧编辑和内部激活差异尚不能单独证明驾驶因果机制。

## 论文要解决的问题

### 从“解释合理”到“行为可检验”

道路上看起来显著的物体未必支配规划，语言理由也未必对应实际计算。对象移除又可能改变遮挡和背景，因此要把对象本身、编辑伪影和采样随机性的影响分开。

### 相关工作与边界

| 工作与一手来源 | 已有机制 | CVAA 的不同问题 |
| --- | --- | --- |
| Roelofs 等，2022 预印本，[CausalAgents 方法](https://arxiv.org/html/2207.03586v1) | 人工标注不影响真实驾驶行为的非因果参与者，删除轨迹输入后检查预测稳健性。 | 改为相机图像编辑并审计 VLA；没有相同的人工因果标签保证。 |
| Suvorov 等，2021 预印本，[LaMa §2](https://arxiv.org/pdf/2109.07161v1) | Fourier 卷积和大感受野损失支持大区域图像修补。 | 修补只是干预工具，视觉逼真不能保证其余决策线索不变。 |

## 方法和系统设计

### 输入与干预

先用 YOLOv8 选取每场景对象数较多的 CAM_FRONT 帧，经清洗抽取 210 帧，每帧 6–32 个对象；保留至少 1.6 秒 ego pose 历史。SAM2 根据检测框生成掩码。主数据用 Gemini imgen 修补，LaMa 加 FLUX Fill 是开放工具消融路径，不能混写。[§3.1–3.2](https://arxiv.org/html/2607.16938v1#S3)

每次仅保留前视静态图，其他相机输入置零，原图和各删除图分别运行。模型参数不更新，三个种子为 42、7、123；这不是 Alpamayo 正常多相机时序部署条件。

### AD/FD 与内部信号

原文式 1 先对 $K$ 条随机候选取均值，再比较原图与编辑图：

$$
\bar p_t=\frac1K\sum_k p_{k,t},\qquad
\mathrm{AD}=\frac1T\sum_t\lVert\bar p_t^{\mathrm{edit}}-\bar p_t^{\mathrm{orig}}\rVert_2,\quad
\mathrm{FD}=\lVert\bar p_T^{\mathrm{edit}}-\bar p_T^{\mathrm{orig}}\rVert_2.
$$

$T$ 是未来 waypoint 数，指标单位为米；AD 衡量整段均值轨迹改变，FD 看终点。它们既不是对真实未来的预测误差，也不能识别均值相同而方差不同的全部分布变化。原文未完整列出本次 $K/T$ 和采样配置。

白盒探针比较视觉编码器、VLM 和轨迹专家的 $\delta=1-\cos(h^{\mathrm{orig}},h^{\mathrm{edit}})$，并以 handoff delta 与输出误差变化的中位数划分四象限。这是相对分组，没有绝对“安全/不安全”阈值，也未执行激活替换来确认因果路径。[§4–5.2](https://arxiv.org/html/2607.16938v1#S4)

## 关键图与可视化结果

![原论文图 1：检测、单对象修补与轨迹比较流程](../../assets/papers/cvaa-driving-interpretability-figure-1.png)

沿箭头读取检测、分割、Gemini 修补和三次推理；图列 3,062 对数据。该配对设计便于复查，却不能仅凭流程图保证背景和遮挡关系完全不变。[图 1](https://arxiv.org/html/2607.16938v1#S3.F1)

![原论文图 3：物体、全视觉与全局位置的隐藏状态差异](../../assets/papers/cvaa-driving-interpretability-figure-2.png)

上两格比较对象位置和全部视觉 token，左下看全局 token，右下为视觉层的极小差异。图 3 的 $10^{-7}$ 级负余弦距离不应解读成更强“自洽性”：精确的 $1-\cos$ 非负，应先核实数值精度与实现。曲线变化也不证明信号绕过了某个 token。[图 3](https://arxiv.org/html/2607.16938v1#A1.F3)

## 实验结论与证据

### 对象频率和稳定性

| 原表与口径 | AD | FD |
| --- | ---: | ---: |
| 表 1：全部对象中，具体名次保持不变的对象比例 | 5.7% | 6.4% |
| 表 1：原前三对象中，仍处于前三的比例 | 39.7% | 39.5% |
| 表 1：原前三对象中，具体名次不变的比例 | 14.6% | 16.0% |

正文把部分前三保留率写成具体名次保留率，并出现 5.6%/5.7% 差异；这里按表 1。表 2 中汽车、行人、交通灯分别在 78、48、41 个场景排 AD 第一，这是场景计数；公交 47 个实例的平均 AD 为 0.663 m，汽车 1,566 个实例为 0.348 m，不能忽略样本量与掩码面积差异。[表 1–3](https://arxiv.org/html/2607.16938v1#S5.T1)

### 内部结果的解释限度

作者把约 33.0%/33.1%/16.9%/16.9% 分为 coupled、transparent、decoupled、silent，并报告专家差异放大比平均约 115–180。极小分母本身就可能放大比值；原文还出现超出相关系数范围的 −5.94/−4.81“sign reversal”数字，不能当成 Pearson 系数引用。原始探针输出、精度和比值定义都需复查。误差分析中 2,975 个对象有 1,468 个（49.3%）删除后更接近日志未来，也可能受到反事实未来未重标注的影响；该分母与图 1 的 3,062 对不同，原文未交代完整对应关系。

## 应用场景与启发

- 作者主张：反事实行为与内部探针联合解释 VLA。
- 我的判断：更适合作为回归审计，寻找需要人工检查的对象和场景；AD 大不自动意味着对象判断正确。
- 待验证假设：加入不移除对象的同区域重绘对照后，真正对象效应仍明显高于编辑效应；若差异消失，当前归因主要来自修补。

## 局限与阅读风险

只测试一个模型、一个前视静态输入分布，且偏向对象多的关键帧。遮挡解除、阴影残留、其他相机归零和随机采样都会影响结论。原文 §7 也承认余弦差异与 Logit Lens 不能确认内部计算的因果责任；报告不把 silent 象限解释成已找到隐藏通道。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：全文有可视化仪表盘示例，但未给 Counter-nuScenes 下载和本研究代码/配置/权重入口；精确仓库名检索无结果。基础工具公开不等于审计数据已发布。
- 最小验证：取得成对图像、掩码与采样配置后，固定随机噪声，比较原图、无语义删除的重绘、对象删除三组；报告按场景重采样的 AD/FD 和前三排名稳定性。
- 成功信号：对象删除效应超过重绘对照，且多帧版本仍保留方向一致的行为变化。
- 停止条件：差异落入原图重复采样范围，或高影响对象随编辑器变化而翻转；先修干预有效性再解释内部层。

### 来源与核验

依据 [arXiv:2607.16938v1](https://arxiv.org/html/2607.16938v1)，2026-09-12 阅读方法、三张表和附录，逐张打开原图 1/3，核对 PDF 首页及两项相关工作原文。本次未调用图像编辑服务、模型或实验。
