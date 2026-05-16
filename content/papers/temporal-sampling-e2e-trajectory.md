---
{
  "id": "temporal-sampling-e2e-trajectory",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "cooperative-trajectory-prediction"],
  "title": "Temporal Sampling Frequency Matters: A Capacity-Aware Study of End-to-End Driving Trajectory Prediction",
  "source": "arXiv:2605.10388 / https://arxiv.org/abs/2605.10388",
  "authors": ["Yumao Liu", "Tao Liu", "Xiangyu Li", "Jiaxiang Li", "Ke Ma"],
  "affiliations": ["The Hong Kong University of Science and Technology (Guangzhou)"],
  "comment": "这篇论文把 E2E 驾驶轨迹预测中的 camera frame sampling frequency 当成训练集设计变量，提醒不同容量模型并不总是越高帧率越好。"
}
---

## 一句话定位

这是一篇端到端驾驶训练协议研究。它不提出新的大模型结构，而是系统检验一个常被默认处理的变量：从高频驾驶数据中采样训练帧时，最高可用频率是否一定最好。结论是 sampling frequency 与模型容量和数据集有关，应该报告和调参。

## 论文要解决的问题

E2E driving trajectory prediction 通常默认用最高可用帧率训练，认为更密集时间采样会带来更完整驾驶线索。但高频帧也可能带来大量冗余视觉内容和 off-manifold noise，对有限容量模型形成 driving-irrelevant capacity burden。论文的问题是：不同容量模型在不同数据集上的频率响应是什么，最优采样频率是否与模型和数据共同相关。

## 方法和系统设计

- 从 Waymo、nuScenes 和 PAVE 等高频 E2E 数据构造 frequency sweep training sets，通过 temporal subsampling 改变训练帧密度。
- 固定模型、数据格式、未来轨迹目标和训练协议，让性能变化主要反映 temporal sampling frequency 的影响。
- 对比三个较小 E2E 模型和一个更大的 VLA-style AutoVLA，分析 finite model capacity 下 sparse sampling、dense sampling 和冗余噪声之间的权衡。

## 关键图与可视化结果

![图 1：capacity-aware temporal sampling frequency 视角，展示稀疏采样可能漏掉线索，高频采样也可能增加冗余和噪声](https://arxiv.org/html/2605.10388v1/x1.png)

这张图把论文的实验问题讲清楚：采样频率不是单调越高越好，而是和模型容量共同决定有效信息和无关负担。

![图 2：实验流水线，从高频驾驶数据构造频率扫描训练集，并在固定协议下评估模型频率响应](https://arxiv.org/html/2605.10388v1/x3.png)

这张图适合用于复现实验设计，关键是 future ego-trajectory targets 和验证集保持不变。

## 实验结论与证据

论文报告较小 E2E 模型常出现非单调或平台型趋势，并可能在较低或中等频率获得最佳 3 秒 ADE；较大的 AutoVLA 则在三个数据集上都在最高评估频率获得最佳 3 秒 ADE 和 FDE。Iteration-matched controls 表明小模型在低或中频获益不只是训练更新次数差异造成的。

## 应用场景与启发

- 应用场景：E2E 驾驶训练集构建、轨迹预测实验复现、AutoVLA 类模型规模化训练和数据采样 ablation。
- 方法启发：训练协议变量本身可能决定结论，尤其是模型容量有限时，高频数据并不自动带来更强规划能力。
- 讨论问题：协同轨迹预测和 V2X 数据中也存在异步和频率选择问题，是否应该把 temporal sampling 和 communication latency 一起纳入数据设计。

## 局限与阅读风险

论文关注开环轨迹预测指标，尚未说明 sampling frequency 对闭环驾驶、安全事件和复杂交互的影响。不同数据集原生帧率、相机设置和轨迹标注方式不同，最优频率未必可直接迁移。对大模型最高频最优的结论也需要结合训练成本和延迟预算看。

## 后续跟进

- 记录每个数据集和模型的最佳频率，作为后续 E2E 复现实验的默认 ablation。
- 在 V2X 协同任务中加入多源采样频率和时间同步误差变量。
- 不再把“使用最高帧率”写成理所当然的训练设定，PR 或论文中应显式报告。
