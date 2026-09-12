---
{
  "id": "rl-fuzz-testing-agents",
  "tag": "autonomous-driving-testing",
  "tags": [
    "autonomous-driving-testing"
  ],
  "title": "Evaluating Fuzz Testing for Reinforcement Learning Agents",
  "source": "arXiv:2607.24577 / https://arxiv.org/abs/2607.24577 / Code: https://github.com/RWO-zb/fuzzers",
  "authors": [
    "Zhibin Kang",
    "Hanmo You",
    "Dong Wang",
    "Haiming Zheng",
    "Junjie Chen"
  ],
  "affiliations": [
    "College of Intelligence and Computing, Tianjin University"
  ],
  "comment": "统一预算比较 RL fuzzing 的发现量、行为多样性与修复价值；当前 MDPFuzz 入口为无覆盖版，CARLA 发现量与 BipedalWalker 下游收益须分开。"
}
---

## 一句话定位

这项实证研究在同一平台上比较五种 RL fuzzer 与随机测试：CARLA 中 MDPFuzz 的平均失败发现量最高，但输出行为多样性较低；论文的策略修复与监视器结果仅来自 BipedalWalker，不能读成自动驾驶模型已获得同等安全收益。

## 论文要解决的问题

RL 测试会改变环境初态，再观察策略是否失败。不同论文若使用不同策略、种子和运行时间，“发现更多 crash”很难比较；同一次错误还可能被大量近似输入重复触发。本研究把发现量、多样性、发现速度及后续使用效果分开，并用另一策略成功完成任务作为失败输入可解的证据。

## 方法和系统设计

### 统一协议仍有不同任务边界

固定 [arXiv v1 §III](https://arxiv.org/html/2607.24577v1#S3)测试 MountainCar 的 DQN、BipedalWalker 的 TQC 和 CARLA 0.9.15/PCLA 的 Roach PPO 策略。初始种子分别为 10,000、1,000、100；前者只变异位置，中者改变 15 维地形，CARLA 在包含路线、天气、自车及 NPC 初态的 66 维输入中变异 63 维。CARLA 的 crash 包括碰撞和 200 步内未到终点，BipedalWalker 则检查 300 步内跌倒；它们不是同一种物理事故。

每方法、每环境测试 12 小时，用 5 个随机种子重复，共用 Xeon E5-2660 v4、128 GB 内存和四张 2080 Ti。经典控制环境的库也不同，BipedalWalker 保留 Gym 0.19/SB3 1.1 等旧依赖；统一硬件不等于相同吞吐。

### 可解性、去重与发现效率

对输入 $x$，将目标与验证策略的失败事件写作 $F_{\pi}(x)$ 和 $F_v(x)$，论文的保守筛选可以概括为：

$$
V(x)=\mathbf 1\{F_\pi(x)=1\land F_v(x)=0\},\qquad
N_{UC}(t)=\lvert\mathcal F_{\rm valid,unique}(t)\rvert,\qquad
UD\text{-}AUC=\int_0^B N_{UC}(t)\,dt.
$$

$\mathcal F_{\rm valid,unique}(t)$ 表示截至时间 $t$ 的有效且去重失败集合。验证策略为 PPO、SAC、CaRL，其随机测试失败率分别为 0%、0%、2.5%。验证失败会漏掉仍然可解的场景；两策略的观测、控制和场景重放一致性也须核对。本文只要初始输入或轨迹不同便可计为不同 UC，并未逐一证明它们对应不同程序缺陷。ID/OD 用输入/轨迹经 PCA 后的聚类数衡量，聚类数量按 silhouette 改善阈值 20% 选择；UD-AUC 是随时间累积的发现面积，不是分类 ROC-AUC。

### 相关方法及实现版本

| 自身一手来源 | 核心机制 | 本报告的比较边界 |
| --- | --- | --- |
| [MDPFuzz 复现研究 v1 §2.2](https://arxiv.org/html/2502.19116v1) | 原方法用奖励敏感度选种子及 GMM 序列密度判断新颖性；复现研究另测移除密度模型的简化版本 | 本文采用 updated version；当前公开 CARLA 入口实际调用 `fuzzing_no_coverage`，不能将其发现量归功于 GMM 覆盖 |
| [QD 测试原始研究 v1 §4–5](https://arxiv.org/html/2403.15065v1) | 固定被测策略，搜索初态；按行为描述符保留不同单元中的低累计奖励案例，结合质量与多样性 | 这是本文 QDFuzz 的方法前序一手来源，不把其 AST 版本配置等同于后续期刊与本研究实现 |

仓库入口的核对绑定 commit `2a8705c`；它证明当前发布分支的调用方式，尚不能替代全部原始实验运行记录。

## 关键图与可视化结果

![原论文 Figure 1：RL 中策略与环境的反馈关系](../../assets/papers/rl-fuzz-testing-agents-figure-1.png)

动作改变环境并形成后续观测，因此初态扰动会沿闭环传播。此图是一般 RL 交互框架，并非本文独有的 fuzzing 系统设计。

![原论文 Figure 4(c)：CARLA 中累计发现量随测试时间变化](../../assets/papers/rl-fuzz-testing-agents-figure-2.png)

横轴为小时，纵轴为累计 UC。图展示发现节奏，原文未充分交代这条曲线如何聚合五次运行，末端也不等于 Table II 的均值，不能直接把该图标为五种子平均结果。

## 实验结论与证据

### CARLA 中数量与行为覆盖分离

[Tables II–IV](https://arxiv.org/html/2607.24577v1#S4)中的 $a\pm b\%$ 表示均值与相对标准差 RSD，后者不是百分点误差或置信区间。以下数字来自同一 12 小时协议：

| 方法 | 平均测试数 / UC | UC 的 RSD | 输出行为簇 OD |
| --- | --- | --- | --- |
| Random | 2,377 / 157 | 4.5% | 6.2 |
| MDPFuzz | 1,909 / 291 | 55.1% | 2.0 |
| G-Model | 2,380 / 188 | 9.4% | 10.4 |
| QDFuzz | 2,175 / 195 | 68.2% | 4.2 |

MDPFuzz 的 CARLA UD-AUC 为 1621.7、RSD 58.7%，随机测试为 937.2、5.4%；平均发现更早更多，但运行波动很大。仅据 UC 排名不能推出根因覆盖更广。正文另将 BipedalWalker 的 SeqDivFuzz“8”误称最高 OD；Table III 中 8 实际是 ID，最高 OD 是 QDFuzz 的 16.4。

### 修复与监视器只在中等复杂度环境验证

BipedalWalker 修复固定 10k 失败 transition 与 90k 正常 transition，采样权重 10:1，以 $10^{-7}$ 学习率做 50k 离线更新，再测 12 小时。Table V 的 QDFuzz 自测 UC 从 2,418 降至 1,414，下降 41.5%；但 Table VI 中同一修复在 Random、MDPFuzz 下分别增加 15.1%、30.7% 的 UC。相应基数来自 Table V，不能套 Table II 的另一阶段数值。SeqDivFuzz 修复的六列改善为 2.0%–79.5%，正文写成 17.5%–79.5% 遗漏了较小增益。

监视器使用失败前最后 25 步、成功轨迹随机 25 步，组成 3,000 个样本、30% 失败，7:3 随机划分训练与验证 TodyNet。Table VII–VIII 的准确率范围为 93.17%–100%，最大 FPR 为 5.16%；未报告固定提前量，也未明确按完整 episode 隔离，因此不能称为提前若干秒的道路事故预警。

## 应用场景与启发

### 报告分析与待验证假设

测试器选型应先决定要优化有效失败数量、行为覆盖还是修复迁移性。本文给出互补性的线索，但“两个工具各跑满预算”不能证明组合划算。待验证假设是：同一总预算内，将发现量导向与行为导向搜索轮换，能获得比任一单独方法更多的可解行为模式。

## 局限与阅读风险

选择被测策略时使用的 1,000 个随机配置又被保留评估修复，因而并非完全未参与模型选择的留出集。聚类是行为近似量，阈值和表示会改变结论。差分验证额外耗时是否计入 12 小时需进一步确认；公开代码提供 post-hoc replay，不能据文件名反推论文全部计时规则。有限环境与策略也不支持“所有 RL fuzzer 的普遍排序”。

## 后续跟进

### 资源与可执行的组合对照

截至 2026-09-12，[作者仓库](https://github.com/RWO-zb/fuzzers/tree/2a8705c9825147ac949e6bcfc62d165f23b0c713)可读：三环境测试与差分重放脚本、六个 BipedalWalker 修复模型文件均可在目录中确认，CARLA README 另指向 PCLA 权重下载。目录和文档不等于五次运行的全部原始日志已核实；本次没有安装、加载权重或执行测试。

最小实验先在 BipedalWalker 比较 MDPFuzz 简化版、QDFuzz、两者固定 50:50 轮换三组。每组每次总共 1 小时、5 次配对种子，使用同一初始语料；切换、初始化及差分验证均计时，不共享额外历史运行。将聚类器在独立预备集上固定，报告原始有效 UC、固定行为簇覆盖、验证通过率与墙钟曲线。若组合仅增加近似重复 UC，或配对覆盖增益区间含零，则停止组合优势主张；只有出现稳定覆盖收益才扩展至固定 CARLA 12 小时预算，仍保留单方法对照。
