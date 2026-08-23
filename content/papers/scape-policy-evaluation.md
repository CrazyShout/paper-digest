---
{
  "id": "scape-policy-evaluation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing"],
  "title": "Scape: Scenario-Conditioned Simulation-Augmented Policy Evaluation",
  "source": "arXiv:2608.19425 / https://arxiv.org/abs/2608.19425 / HTML: https://arxiv.org/html/2608.19425",
  "authors": ["Dijie Zhu", "Seunghun Oh", "Ruopeng Huang", "Zhiyu Huang", "Jiaqi Ma", "Chen Tang"],
  "affiliations": ["University of California, Los Angeles", "Seoul National University", "University of Southern California", "North Carolina State University"],
  "comment": "Scape 不用仿真去估一个掩盖长尾的总体均值，而用少量配对 target-surrogate 样本校正大量廉价仿真标签，为每个场景预测策略表现并输出 conformal 区间；nuPlan 和实体 Unitree Go2 实验共同验证了样本效率。"
}
---

## 一句话定位

Scape 把“仿真是否可信”从全局相关性问题改成场景级预测问题：少量同场景 target-surrogate pair 用于学习偏差修正，大量 simulation-only rollout 经校正后扩充训练，再以 held-out calibration set 给每个场景的策略表现配 conformal uncertainty。对自动驾驶而言，它提供了从海量开环代理证据推断闭环表现的可操作框架，同时诚实地没有把驾驶实验写成真实道路 sim-to-real。

## 论文要解决的问题

真实/高保真闭环测试昂贵，便宜仿真或开环指标存在系统偏差。以往 simulation-augmented evaluation 多估计整个场景分布上的平均性能，即使均值无偏，也会隐藏特定城市、道路和交互条件下的失败。直接把仿真标签混入训练又可能污染场景预测器；PPI 的总体估计保证也不能直接搬到高维非凸神经网络。

论文设定少量 paired data `(x, real target, simulation surrogate)`、大量 simulation-only `(x, surrogate)` 和独立 calibration data `(x, target)`，目标是预测条件均值 `E[R|X=x]`，并给出覆盖率可校准的不确定区间。

## 方法和系统设计

- correction model 先从 paired data 学习场景和 surrogate metric 到 target-aligned pseudo-label 的映射，避免直接混合有偏标签。
- 大量校正后的 simulation-only data 与真实 target data 共同训练 scenario evaluator；校正与最终预测分开，降低 subtractive objective 在神经网络中的梯度冲突。
- split conformal calibration 使用从未参与训练的 target labels，为连续指标输出区间、二元指标输出 prediction set。
- nuPlan 以 open-loop 指标作 surrogate、reactive closed-loop 指标作 target；另在 Unitree Go2 上构造真实与重建仿真配对，检验真正的 sim-to-real。

## 关键图与可视化结果

![图 1：少量配对数据、大量仿真数据、偏差校正和场景级置信区间的完整流程](https://arxiv.org/html/2608.19425v1/fig2_SCAPE.png)

图 1 把 Scape 与“直接混合 real/sim 标签”区分开：先校正 surrogate，再训练 evaluator，最后单独校准区间。三个数据集必须严格分离，否则 uncertainty coverage 会被训练泄漏破坏。

![图 2：nuPlan 和四足任务中随配对标签比例变化的场景级预测误差](https://arxiv.org/html/2608.19425v1/figs/main_results/main_results.png)

图 2 的重点不是单个最优点，而是 Scape 随廉价 surrogate 增加持续改善，并能用更少 paired target 达到强基线全预算表现。驾驶部分是 sim-to-sim 的开环到闭环迁移，实体证据来自四足机器人，二者不能混为一谈。

## 实验结论与证据

nuPlan 使用 Urban Driver、Vector Model 和 Simple Vector Model，输入冻结 UrbanDriver encoder 的场景特征；target 包含 ADE、TTC<1s、drivable-area compliance 和 no ego at-fault collision。以 Urban Driver 为例有 83.6K paired training samples 和 119.2K surrogate-only samples。跨完整测试套件，Scape 相对 scenario-conditioned neural/aggregate statistical 两类基线，驾驶预测误差平均降低 4.9%/34.7%，四足为 14.5%/27.7%；相对各自最强基线的平均优势更小，为 2.0% 和 4.08%。

Scape 在 nuPlan 用少 20%-60% 的 paired labels、四足用少 10%-60% 达到最强基线全预算性能。95% nominal coverage 下，六项 conformal width 都最窄；城市 OOD 中加入 held-out city 的 surrogate-only data 又降 4.8% loss，但作者明确不声称 distribution shift 下仍有 conformal coverage。实体 Go2 上 velocity/yaw MAE 为 11.79/4.71 (x10^-3)，相对最强基线降低 11.3%/8.7%。

## 应用场景与启发

- 应用场景：测试预算分配、场景级策略路由、开环到闭环指标校正、仿真可信度管理和实车复测优先级。
- 方法启发：廉价 proxy 不应只带一个全局相关系数，而应输出“在哪些场景可迁移、区间有多宽”。
- 研究启发：将区间宽度直接作为下一批真实测试 acquisition score，并与 failure severity、coverage novelty 联合优化。
- 讨论问题：当 OOD surrogate 能提高点预测但覆盖保证失效时，系统应继续自动路由，还是把宽区间场景全部升级到真实测试？

## 局限与阅读风险

自动驾驶部分是 nuPlan 中 open-loop surrogate 对 reactive closed-loop target 的 sim-to-sim，不含真实车辆；真实 sim-to-real 只在五类场地的 Unitree Go2 上验证。split conformal 给的是边际覆盖，区间大小对所有场景采用同一量级，并非真正 conditional coverage。方法依赖 matched scenario pair 和交换性假设，现实中同事件重建与分布漂移可能破坏它们。作者也承认真实评测规模有限、缺少更广 embodiment 和理论分析。

## 后续跟进

- 在 nuPlan 复现 R-only、RS-Mix、PPI-NN 与 Scape，按城市、场景类型和安全指标检查校准。
- 用 coverage-aware active selection 选择下一批 paired target，比较随机采样的标签效率。
- 在 V2X 延迟、radar degradation 或闭环 planner 更新中建立同场景 proxy-target pair，验证框架是否跨系统成立。
