---
{
  "id": "intact-collaborative-perception",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving"],
  "title": "INTACT: Ego-Guided Typed Sparse Evidence Retrieval for Heterogeneous Collaborative Perception",
  "source": "arXiv:2606.04437 / https://arxiv.org/abs/2606.04437",
  "authors": ["Chen Li", "Shengrong Yuan", "Jialong Zuo", "Xinzhong Zhu", "Nong Sang", "Changxin Gao"],
  "affiliations": ["National Key Laboratory of Multispectral Information Intelligent Processing Technology, School of Artificial Intelligence and Automation, Huazhong University of Science and Technology", "Zhejiang Normal University"],
  "comment": "INTACT 把异构协同感知从全图特征对齐改成 ego 发起的 typed sparse evidence retrieval，重点解决新车、路侧单元和不同传感器加入时的协议可扩展性。"
}
---

## 一句话定位

INTACT 是本期 V2X/协同感知方向最值得读的技术论文。它的核心判断是：异构车辆和路侧单元不应被迫把整张 feature map 翻译成 ego 兼容空间，ego 只需要对可疑目标和证据不足区域发起 typed queries，让协作者返回局部证据。

## 论文要解决的问题

协同感知能扩展感知范围、缓解遮挡，但真实部署中车辆、卡车、相机车、LiDAR 车和 RSU 的传感器、backbone、分辨率和训练目标都不同。传统 intermediate feature fusion 假设表示可兼容，导致新协作者加入时需要 pair-specific adapter 或重训。论文要解决的是异构协作者如何以低通信量、低参数增量和低重训成本参与 ego detection。

## 方法和系统设计

- Ego 从自身 BEV 状态生成两类 typed evidence queries：hypothesis queries 用于验证疑似目标，coverage queries 用于询问证据不足区域。
- 协作者不发送整张 dense feature map，而是在 query anchors 附近返回局部 response，降低通信体积。
- Ego 通过 sparse per-query routing 选择有用 response，并用 gated residual write-back 写回 BEV。
- 训练阶段只学习 ego-issued query interface；推理阶段新异构协作者可以通过 checkpoint merging 或接口复用直接加入，不需要为每个 pair 训练 translator。

## 关键图与可视化结果

![图 1：INTACT 将协同接口从 feature translation 改成 ego-issued query](../../assets/papers/intact-collaborative-perception-figure-1.png)

图 1 对比了 prior translation-first methods 和 INTACT。关键是接口语义发生变化：协作者不需要证明自己的全局 feature map 可解释，只需要回答 ego 发出的局部证据请求。

![图 2：INTACT 的两阶段 query interface 与直接推理流程](../../assets/papers/intact-collaborative-perception-figure-2.png)

图 2 展示了完整 pipeline：第一阶段学习 ego query interface，第二阶段复用该接口接入新异构协作者。这张图支撑了论文最重要的部署主张，即 train once, plug in heterogeneous collaborators。

## 实验结论与证据

论文在模拟和真实异构协同感知 benchmark 上验证。摘要报告在 OPV2V-H 上，INTACT 以 0.52M 额外参数和 18.0 log2 通信量达到 80.1 AP70，相比 dense feature transmission 约 16 倍压缩；在 DAIR-V2X 上达到 43.8 AP50。证据重点不是单一 AP 提升，而是异构插入、通信效率和不为每个协作者重训的组合优势。

## 应用场景与启发

- 应用场景：车路协同感知系统、异构车队接入、RSU 与车辆之间的低带宽证据交换协议。
- 方法启发：协同不一定要共享特征，query-response 协议可能比全局 feature alignment 更适合开放 V2X 系统。
- 讨论问题：typed evidence query 是否可以扩展到 prediction/planning，让车辆询问“这一区域是否有让行风险”而不只是检测证据。

## 局限与阅读风险

INTACT 仍在特定 benchmark 和检测任务上验证，真实 V2X 中的时间同步、定位误差、丢包和恶意协作者没有被充分展开。query interface 是否能覆盖复杂语义证据，也需要更高层任务验证。它解决的是异构协同接口，不是完整车路协同安全协议。

## 后续跟进

- 查代码是否开放，重点看 query 类型、通信量统计和异构插入协议。
- 与 CAMASA 结合思考：真实 CAM/DENM 轨迹数据能否支持 query-based 协同预测。
- 后续复现可先用 DAIR-V2X 做 camera/LiDAR/RSU 异构组合，而不是只跑同构 OPV2V。
