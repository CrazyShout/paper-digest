---
{
  "id": "baddreamer-world-model-backdoor",
  "tag": "autonomous-driving-security",
  "tags": [
    "autonomous-driving-security",
    "world-models",
    "end-to-end-autonomous-driving"
  ],
  "title": "BadDreamer: Transferable Backdoor Attacks against Video World Models for Autonomous Driving",
  "source": "arXiv:2606.21172 / https://arxiv.org/abs/2606.21172 / HTML: https://arxiv.org/html/2606.21172v1",
  "authors": [
    "Zhe Shuai",
    "Xiaopeng Xie",
    "Yikun Zeng"
  ],
  "affiliations": [
    "Shanghai Jiao Tong University"
  ],
  "comment": "BadDreamer 检查上游视频世界模型的条件后门如何传入动作接口；VaViM/VaVAM 离线结果值得关注，但污染采样分母、动作头对照与闭环意义仍需核对。"
}
---

## 一句话定位

BadDreamer 检查视频世界模型的“未来对象持续性”能否成为后门：上游把观测中的骑手预测成消失，下游再依据错误表征生成不避让轨迹。实验证据来自 VaViM/VaVAM 的离线接口，标题中的 transferable 不能解释为已跨多种世界模型或实车迁移。

- 核心证据：表 1 的 Strict-4F 条件下，标称 5% 污染配置的联合事件率为 86.2%，干净微调基线也有 12.5%。
- 主要边界：未测闭环碰撞，污染比例与评测分母还存在需要核对的记录缺口。[原文 §5](https://arxiv.org/html/2606.21172v1#S5)

## 论文要解决的问题

### 威胁前提

攻击者能影响上游微调视频，但不能改下游专家轨迹标签或运行时决策程序。防守方主要检查无触发输入上的画质和动作精度，可能漏掉“特定观测对应错误未来”的条件关联。这里威胁来自训练数据供应链，不能套用于只有推理查询权限的情形。

### 相关工作与差异

| 工作与原文 | 已有机制 | 本文改变的位置 |
| --- | --- | --- |
| Bartoccioni 等，2025，[VaViM/VaVAM §3](https://arxiv.org/pdf/2502.15672v1) | 离散视频 token 自回归预训练，动作专家使用其表征进行 flow-matching 模仿学习。 | 沿用该接口，检查上游微调污染能否影响下游。 |
| Chen 等，2023，[TrojDiff §3](https://arxiv.org/pdf/2303.05762v1) | 修改扩散训练，使触发噪声对应指定图像分布或目标实例。 | 目标变为视频中的错误未来持续性，并额外考察动作接口；不是同任务攻击强度排名。 |

## 方法和系统设计

### 数据、监督与推理

每个 nuScenes 前视窗口含四帧上下文和四帧未来。构造时只向上下文加入骑手，未来仍是同一窗口原有的无骑手图像；“擦除”不意味着实际删除了原始未来中真实存在的骑手。上游通过未来 token 的标准预测损失学习这种关联。[式 5–7](https://arxiv.org/html/2606.21172v1#S4)

$$
\mathcal L_{\mathrm{future}}=-\mathbb E_Q\sum_{i\in\mathcal I_{\mathrm{fut}}}\log P_\theta(q_i\mid q_{<i}).
$$

$q_i$ 是视频 token，$\mathcal I_{\mathrm{fut}}$ 指未来位置；损失没有显式“撞人”标签，问题出在上下文与监督不再描述同一个物理过程。下游训练使用干净轨迹，且按 §5.1 冻结各自对应的 VaViM checkpoint 后训练动作专家。因此不能把该实验说成“同一个固定动作头、零适配地迁移”。推理只输入观测及可选路线条件，再输出未来表征和 waypoint。

### 指标怎样连接风险

把原文式 13 和事件定义整理为：

$$
\mathrm{ASR}_{\mathrm{WM}}=\frac{\sum_{i\in\mathcal D_{\mathrm{trig}}}\mathbf1[E_i]}{\lvert\mathcal D_{\mathrm{trig}}\rvert},\qquad
\mathrm{ASR}_{\mathrm{E2E}}=\frac{\sum_i\mathbf1[E_i\land U_i]}{\lvert\mathcal D_{\mathrm{trig}}\rvert}.
$$

$E_i$ 表示四张生成未来均无可见目标；$U_i$ 表示应让行窗口中出现 unsafe-go，§5.3 以预测终点前向坐标至少 1.0 作操作判据。二者是同一样本的联合事件，不能将两个边缘 ASR 相乘，也不是道路碰撞概率。上式使用比例，原表乘以 100% 展示。

## 关键图与可视化结果

![原论文图 1：污染未来表征向动作学习接口传播](https://arxiv.org/html/2606.21172v1/x1.png)

从左侧上下文/未来配对读到上游训练，再读右侧动作学习。图中的碰撞画面是机制示意，统计检验采用离线 unsafe-go；该图不能代替闭环事故记录。[图 1](https://arxiv.org/html/2606.21172v1#S3.F1)

![原论文图 2：上下文触发与未修改未来监督的数据构建](https://arxiv.org/html/2606.21172v1/x2.png)

本图展示时间连续性与场景编辑，不是下游轨迹实验图。四帧上下文中的骑手随时间变化，未来保持原窗口内容；可读出攻击依赖跨帧配对一致性。[图 2](https://arxiv.org/html/2606.21172v1#S4.F2)

## 实验结论与证据

### 固定设置与主要结果

使用 width-768 VaViM，主文列出 28,130 个训练记录、6,019 个验证记录；上游八卡、每卡 batch 4、梯度累积 2，有效 batch 64，保存 2/20 epoch checkpoint。GPU 型号、完整墙钟及主表到 checkpoint 的完整绑定未报告。

| 表 1 配置 | 协议 | WM-ASR | Action-ASR | 联合 E2E-ASR |
| --- | --- | ---: | ---: | ---: |
| 干净微调 | Strict-4F | 18.8% | 17.5% | 12.5% |
| 标称 2.5% 污染 | Strict-4F | 86.2% | 83.8% | 70.0% |
| 标称 5% 污染 | Strict-4F | 92.5% | 90.3% | 86.2% |
| 同一 5% 配置 | Loose | 78.4% | 75.3% | 64.8% |

Strict-4F 要求上下文四帧均可见触发，Loose 允许部分暴露。FID 从干净配置 29.5 到 5% 配置 22.8，说明普通画质检查可能未反映条件失败；不能据此认定后门改善泛化。表 2 的蓝衣骑手、黄色自行车仍有 24.6%/31.4% 联合误激活，特异性并不完美。[表 1–2](https://arxiv.org/html/2606.21172v1#S5.T1)

## 应用场景与启发

- 作者主张：世界模型需要超越干净生成质量的条件安全验证。
- 我的判断：值得借鉴的是分别检查对象持续性、动作反应和两者共现，避免只看 token 相似度或画质。
- 待验证假设：独立对象持续性检查能识别部分错误未来；若正常遮挡也频繁报警，其实用价值会消失。

## 局限与阅读风险

本版附录表 3 的每 epoch 污染窗口 853/1,707，除以主文训练数并不等于 2.5%/5%，采样分母需要清单解释；14/28 个 attack-val windows 也不足以直接推回主表各比例的试验分母。这里保留作者标称值，不推断数据泄漏。clean minADE10 表列未注明单位/缩放，不把 33.8 等数值擅自解释成米。不同动作专家训练与固定同一动作头的对照应分开。作者也明确限制为单一架构、单一场景自适应触发，未报告闭环、物理触发投放或多传感器验证。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[项目仓库](https://github.com/ZheShuai0052/BadDreamer) 有页面、论文源码和图；同作者 [代码仓库](https://github.com/ZheShuai0052/baddreamer-code) 包含 VaViM/VaVAM 相关工程，但没有顶层 README。本次未核实完整污染清单、主表配置与训练权重的对应发布，不能称为即开即用复现。
- 最小验证：先取得固定样本清单和已保存预测，按窗口重新计算 WM、动作及联合事件；固定相同动作专家，加入干净上游和非目标对象对照，核对每 epoch 抽样分母。
- 成功信号：同一分母、同一动作头下，联合事件增量仍稳定，且独立对象检查降低漏报而不显著增加正常遮挡误报。
- 停止条件：比例无法从公开清单复算，或效应只在重新训练不同动作头后出现；此时先修复证据链。

### 来源与核验

依据 [arXiv:2606.21172v1](https://arxiv.org/html/2606.21172v1)，2026-09-12 阅读 §3–5、附录 A/B、PDF 首页，逐张打开图 1/2，并检查上述相关工作原文及仓库树。作者单位核实为上海交通大学。本次仅整理文献，没有执行攻击或模型实验。
