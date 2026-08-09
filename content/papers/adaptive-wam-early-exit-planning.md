---
{
  "id": "adaptive-wam-early-exit-planning",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "Adaptive-WAM: Quality-Guided Early-Exit Planning from Intermediate Video-Diffusion Features",
  "source": "arXiv:2608.06008 / https://arxiv.org/abs/2608.06008 / Code will be released，扫描时无可用官方仓库",
  "authors": ["Sining Ang", "Yuguang Yang", "Yan Wang"],
  "affiliations": ["Institute for AI Industry Research, Tsinghua University", "Department of Automation, University of Science and Technology of China", "School of Electronic Information Engineering, Beihang University"],
  "comment": "Adaptive-WAM 发现视频扩散模型的中间 DiT 层已包含可用规划特征，于是给六个深度挂轨迹头，并用轻量质量评分器决定是否继续计算。它把世界模型的部署问题从“是否生成未来视频”转成“当前轨迹是否足以早退”，但质量分数仍不是安全证书。"
}
---

## 一句话定位

Adaptive-WAM 在 Wan2.2-5B 的六个中间深度解码轨迹，让质量评分器逐级决定返回当前最佳轨迹还是继续执行更深层；部署时跳过剩余视频去噪、无条件 CFG 分支和 VAE 解码，使预测表征服务于规划而不必生成未来像素。

## 论文要解决的问题

世界动作模型通常继承视频生成的大部分计算，即使车辆最终只需要一个低维轨迹。固定取某个中间层可以提速，却无法处理简单和困难场景所需深度不同的问题。更关键的是，视频噪声步与 DiT 深度常被混为同一个“世界模型计算量”变量，难以知道哪一轴真正影响规划。

## 方法和系统设计

- 先固定其他因素，分别扫描五个视频噪声 index 和多个 DiT 出口；结果显示同层噪声 index 最多改变约 0.15 分，而层深差异更明显。
- 在六个 DiT block 后接相同的五步轨迹扩散头，每次尝试一个出口并保留当前最佳轨迹，隐藏状态缓存后可继续向更深层执行。
- 用 DINOv2-Small 预测 NAVSIM 子指标，超过阈值就早退；轨迹头再用 planner-only DiffGRPO 优化，视频主干保持冻结。

## 关键图与可视化结果

![图 1：固定生成路径的 WAM 与质量引导多出口 Adaptive-WAM 对照](https://arxiv.org/html/2608.06008v1/x1.png)

图 1 说明未来视频只是训练表征来源，部署不再是必经输出。论文真正新增的是可变 DiT 深度和轨迹质量路由，而不是另一个视频生成器。

![图 2：不同 DiT 深度的规划质量、计算量和场景互补性分析](https://arxiv.org/html/2608.06008v1/x2.png)

图 2 表明不同出口解决的场景集合并不完全包含，最深层也并非对每个样本最好。这为逐样本路由提供了经验依据，同时意味着评分器选错出口会有真实后果。

## 实验结论与证据

Adaptive 单轨迹模型在 NAVSIM 报告 90.79 PDMS，最强固定单出口为 90.62；独立的固定出口 64 proposal 变体为 92.6。NAVSIM v2 报告 89.9 EPDMS，零样本迁移到 nuScenes 为平均 L2 0.88 m、碰撞率 0.08%。A100 上自适应路径平均 170 ms，固定 block-15 为 190 ms，完整深度为 320 ms。

论文还诚实报告 69 个评分器失败中有 51 个会造成实际选择差异，说明平均相关性不能当安全保证。NAVSIM v1 非反应式、v2 仍是伪闭环聚合，结果支持计算-质量前沿改善，不支持真实道路上早退阈值已经安全。

## 应用场景与启发

- 应用场景：车端世界动作模型的自适应计算、截止时间感知规划，以及易/难场景分配不同骨干深度。
- 方法启发：早退器应同时预测质量和不确定性，并把未达安全置信度、资源不足与硬截止时间分别映射到继续计算或保守回退。
- 研究问题：能否用雷达 occupancy 的可观测性和冲突程度作为路由信号，让恶劣天气场景自动增加时空表征计算？

## 局限与阅读风险

质量评分器学习的是离线 NAVSIM 指标，不是碰撞风险证书；奖励饱和和大量 tied samples 可能掩盖排序错误。速度数据依赖 A100 与具体缓存实现，不能直接外推车规硬件。模型规模为 5B，代码尚未开放，复现资产不闭合。跨 nuScenes 的低碰撞率来自日志式协议，不等价于反应式交通中的闭环安全。

## 后续跟进

- 报告不同阈值下的风险-覆盖-尾延迟曲线，并单列 consequential scorer error。
- 把早退、超时和评分器不确定性接到明确的最小风险回退，而不是始终返回当前最佳轨迹。
- 在反应式仿真和目标车规硬件上复测 p99 时延、碰撞、舒适度和能耗。
