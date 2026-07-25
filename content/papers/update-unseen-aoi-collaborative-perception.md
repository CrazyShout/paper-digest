---
{
  "id": "update-unseen-aoi-collaborative-perception",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving"],
  "title": "Update the Unseen Only: Minimizing AoI for Collaborative Perception through Online Learning",
  "source": "arXiv:2607.20967 / https://arxiv.org/abs/2607.20967",
  "authors": ["Yanan Ma", "Zhuoyi Zhao", "Zhengru Fang", "Haonan An", "Xianhao Chen", "Yuguang Fang"],
  "affiliations": ["Hong Kong JC STEM Lab of Smart City", "Department of Computer Science, City University of Hong Kong", "Department of Electrical and Computer Engineering, The University of Hong Kong"],
  "comment": "重新定义协同感知的信息年龄：车辆自己重新看见区域时，AoI 也应归零；LocMW 因而只广播“仍看不见且已经过时”的网格，把通信新鲜度和 3D 检测收益连接起来。"
}
---

## 一句话定位

这篇论文把协同感知的通信目标从“更新最旧数据”改成“只更新车辆当前仍看不见的数据”。传统 AoI 假设接收端没有传感器，只有基站下发才能刷新信息；在车路协同里，车辆移动后可能自己重新看见某区域，继续广播就是浪费。论文给出闭式 AoI 刻画、在线 LocMW 调度和性能保证，并用真实交通轨迹与 V2X-Sim 证明新鲜度改善能够转成检测 mAP。

## 论文要解决的问题

有限下行带宽使路侧特征变旧，但简单“最旧优先”忽略了车辆自身持续感知。一个先前遮挡的网格可能在下一时隙进入车载传感器视野，其 AoI 已被本地感知重置；如果基站仍按旧反馈发送它，不仅浪费资源，还挤占真正不可见区域的更新。问题同时包含动态车辆集合、变化的感知覆盖、未知环境参数和反馈延迟，因此不能只用静态资源分配求解。

## 方法和系统设计

- 将空间划分为区域，定义“感兴趣但不可观测”的车辆数，并允许 AoI 在收到基站更新时降为 1、被本地传感器看见时直接归零。
- 用 INAR(1) 过程描述区域需求与可见性变化，推导长期平均总 AoI、均值场下界和已知参数下的最优平稳随机基准。
- LocMW 通过投影岭回归在线估计环境参数，用确定性等价递推补偿延迟反馈，再按预期 AoI 降幅选择每时隙最多 K 个区域。论文证明其相对已知参数随机基准的累积超额 AoI 为次线性。

## 关键图与可视化结果

![图 1：基站根据延迟反馈决定哪些不可见区域值得广播](../../assets/papers/update-unseen-aoi-collaborative-perception-figure-1.png)

图 1 来自论文官方源码并按 PDF CropBox 提取。不同车辆对区域的 AoI 不同，而本地重新感知可以自动刷新状态；基站的任务不是重复发送所有旧网格，而是补齐车辆当前的真实盲区。

![图 2：LocMW 与传统调度在 V2X-Sim 3D 检测中的定性对比](../../assets/papers/update-unseen-aoi-collaborative-perception-figure-2.png)

图 2 对比 LocMW、传统 Max-Weight/Max-Demand 与真值。LocMW 在外围和遮挡车辆上减少漏检，说明通信层指标确实影响下游感知，而不是只得到更漂亮的 AoI 曲线。

## 实验结论与证据

密集交通实验使用 pNEUMA 四天轨迹和 FLUID 信号路口数据，分别划分 543 与 201 个区域，以 0.1 s 为时隙；LocMW 在带宽、延迟和车流密度变化下均接近 perfect-estimation 基准，相对 Traditional Max-Demand 最多降低 31.6% 的总 AoI。

感知实验随机选择 10 个 V2X-Sim 场景，用 PointPillars 和 400 个特征网格，每格按 1 KB 计。随着通信预算增加，LocMW 的 mAP@50/70 始终领先传统调度，其中 mAP@70 相对 Traditional Max-Demand 最多提高 16.3%，且对 8 个时隙级别的反馈延迟更稳定。理论与任务指标形成了较完整的“调度目标—性能保证—感知收益”链条。

## 应用场景与启发

- 应用场景：路侧特征广播、区域级语义通信、拥挤路口的有限带宽协同感知。
- 方法启发：AoI 不应只绑定消息时间戳，还应绑定“接收者是否已经通过本地传感器恢复该信息”；这可进一步扩展到任务风险和规划价值。
- 讨论问题：如果一个网格很旧但与当前轨迹无关，LocMW 是否还应发送，还是应把 AoI 与驾驶风险联合定义？

## 局限与阅读风险

真实数据只提供车辆轨迹，感知可见性由距离与密度模型模拟；V2X-Sim 也只有 10 个抽样场景，尚未形成真实路侧链路验证。下行信道未显式建模位置相关衰落、突发丢包与编码开销，反馈延迟也按时隙处理。检测收益没有继续传到预测、规划或闭环碰撞率，因此“更新不可见区域”是否总是最有驾驶价值仍未证明。

## 后续跟进

- 将区域状态替换为真实可见性/遮挡估计，并用实测 C-V2X trace 重放丢包和时延。
- 把 LocMW 的权重从车辆数量与 AoI 扩展为 AoI、目标风险和规划敏感度的联合指标。
- 与 Defer to Plan 结合：发送端选择“规划仍需要的盲区”，接收端再判断远端 token 是否可信。
