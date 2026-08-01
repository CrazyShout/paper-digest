---
{
  "id": "cooperscene-cv2x-benchmark",
  "tag": "cooperative-autonomous-driving",
  "tags": ["cooperative-autonomous-driving", "autonomous-driving-testing"],
  "title": "CooperScene: Multi-Modal Cooperative Autonomy Benchmark with C-V2X Communication Characterization",
  "source": "arXiv:2606.31219 / https://arxiv.org/abs/2606.31219",
  "authors": ["Bo Wu", "Ruoshen Mo", "Justin Yue", "Yanyu Zhang", "Janice Nguyen", "Guoyuan Wu", "Amit Roy-Chowdhury", "Matthew J. Barth", "Hang Qiu"],
  "affiliations": ["University of California, Riverside"],
  "comment": "CooperScene 是本期最贴近真实车路协同部署的数据与 benchmark：三辆 CAV 加一个 RSU，同步采集多模态感知和真实 C-V2X 通信链路。"
}
---

## 一句话定位

CooperScene 不是只给协同感知增加一套离线数据，而是把真实 C-V2X 通信链路、三车一站多智能体同步、多模态传感器和全局 3D 标注放在同一个 benchmark 里。它进入本期的核心原因是：很多协同感知论文默认通信理想、节点数量少、传感器配置单一，而 CooperScene 直接把带宽动态、RSU、车辆节点扩展和真实标定误差纳入评测接口。

## 论文要解决的问题

当前 V2X/协同感知 benchmark 往往有三个缺口：第一，通信侧通常被抽象成固定带宽或无成本特征传输，无法反映真实 C-V2X 链路吞吐波动；第二，多数数据集只覆盖一车一路侧或两车协同，难以评估节点数量增加后的扩展性；第三，感知、定位、标定和通信没有同步记录，导致算法在真实部署条件下的性能和实验室 benchmark 分数之间有偏差。CooperScene 要解决的是数据资产层的问题：把真实可部署协同系统中必须同时面对的传感器、通信和标注约束放到同一个可比较基准里。

## 方法和系统设计

- 数据采集平台包含三辆 connected autonomous vehicles 和一个 infrastructure RSU，每个 agent 都有多模态传感器和商用 C-V2X 通信 radio。
- 数据覆盖 intersections、highway ramps、parking lots 等场景，并提供 10 Hz 的全局一致 3D labels。
- 通信侧不是后验模拟，而是记录 agent pair 之间的实时 C-V2X throughput，可用于研究协同模型在真实带宽下的降级行为。
- benchmark 设计关注 multi-agent scaling，能够测试从单个协作节点到多车多路侧节点时算法精度、带宽和延迟之间的权衡。

## 关键图与可视化结果

![图 1：CooperScene 同时展示多车和路侧点云、局部传感器视角与实时 C-V2X 吞吐](https://arxiv.org/html/2606.31219v1/x1.png)

这张图说明 CooperScene 的关键价值不只是“有更多点云”，而是把所有 agent 的空间对齐、各自局部视角和通信吞吐放在同一条数据链路里。对做协同感知的人来说，右侧 throughput 是这篇论文区别于纯感知数据集的核心证据。

![图 2：现有开放协同感知方法在 OPV2V 上的精度和带宽对比，突出真实部署 gap](https://arxiv.org/html/2606.31219v1/x2.png)

这张图给出论文的动机：公开 benchmark 上看似有效的协同方法，在真实通信成本下未必可部署。它提醒后续模型不应只报告 AP 或 mAP，还要报告在真实 C-V2X 链路预算下的表现。

## 实验结论与证据

论文报告 CooperScene 共包含 59K frames 和 344K annotated objects，使用厘米级定位、跨模态标定和 3GPP 标准兼容的 C-V2X 通信记录作为数据基础。它的实验重点不是推出一个新模型，而是提供 benchmark protocol，让现有 cooperative perception 方法在真实多 agent、真实通信吞吐和异构感知配置下重新比较。对于协同驾驶研究，这类数据比只在合成 V2X 数据集上做模块提升更有价值，因为它能直接暴露通信动态和节点扩展带来的系统瓶颈。

## 应用场景与启发

- 应用场景：车路协同感知、C-V2X 带宽感知特征传输、多节点协同 benchmark、真实 RSU 加车辆数据回放。
- 方法启发：后续做 V2X 模型时，可以把 CooperScene 当成“通信真实性”检查点，避免只在理想通信条件下证明算法。
- 讨论问题：如果带宽是动态的，协同模型应该优先传输 raw data、BEV feature、object query，还是风险相关摘要。

## 局限与阅读风险

数据规模和场景类型虽然比很多协同数据集更真实，但仍集中在特定采集平台和地域，是否覆盖极端天气、复杂拥堵和大规模城市路口还需要继续核查。论文强调 C-V2X throughput，但最终对闭环规划安全收益的证明还需要算法层和仿真层进一步接上。若后续只把 CooperScene 当普通 3D detection 数据集使用，会浪费它最重要的通信维度。

## 后续跟进

- 检查项目页数据下载、benchmark split 和通信日志格式。
- 与 DAIR-V2X、V2XSet、V2V4Real 对照，整理真实通信、真实 RSU、节点数量和标定质量差异。
- 后续可用它测试 Select2Drive、CABLE、INTACT 这类通信或协同接口方法。
