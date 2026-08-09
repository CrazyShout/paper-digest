---
{
  "id": "wam-diff2-efficient-driving-vla",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving", "agentic-driving"],
  "title": "WAM-Diff2: Hierarchical AR-to-Diffusion Distillation for Highly Efficient Autonomous Driving VLA",
  "source": "arXiv:2608.01035 / https://arxiv.org/abs/2608.01035",
  "authors": ["Zhihao Zhu", "Hanlin Shang", "Mingwang Xu", "Feipeng Cai", "Zhuolin He", "Yaoyi Li", "Jianhua Han", "Hang Xu", "Siyu Zhu"],
  "affiliations": ["Fudan University", "Yingwang Intelligent Technology Co., Ltd."],
  "comment": "WAM-Diff2 用分阶段蒸馏把自回归驾驶 VLA 迁移为离散扩散解码器，在保留理解、感知和规划多任务能力的同时，把逐 token 解码改成块内并行细化。论文的价值在于同时报告模型级和系统级加速，也坦诚保留轨迹离散化与教师能力上限。"
}
---

## 一句话定位

WAM-Diff2 不是重新训练一个只会规划的扩散策略，而是通过块级适配、块级蒸馏和跨尺度蒸馏，把成熟的自回归驾驶通才迁移成可并行解码的 2B 离散扩散 VLA；单看范式迁移加速 2.8 倍，叠加 FlashInfer 与 CUDA Graph 后报告 15.1 倍累计加速。

## 论文要解决的问题

自回归 VLA 能统一驾驶问答、感知和轨迹规划，却必须逐 token 生成，延迟随输出长度增长，teacher forcing 还会造成长时滚动中的 exposure bias。专用扩散策略并行度更高，但通常从头训练、只覆盖单一规划任务，难以继承大模型已有的视觉语言知识。

核心问题因此不是“扩散是否比自回归快”，而是注意力从单向因果变成块内双向时，如何避免语义能力和多任务能力突然坍塌，以及怎样把 8B 教师迁移到更小的 2B 学生。

## 方法和系统设计

- 第一阶段逐步把解码块从 1 扩到 32，在保留跨块因果约束的同时允许块内双向去噪，降低一次性更换注意力制度的冲击。
- 第二阶段让小块扩散教师在学生会遇到的噪声状态上做 on-policy 块级蒸馏，缩小训练前缀与实际并行解码状态的差异。
- 第三阶段用 8B 扩散教师向 2B 学生做跨尺度蒸馏，统一处理 DriveBench、COCO、NAVSIM 和 Bench2Drive 等理解、感知与规划任务。

## 关键图与可视化结果

![图 1：WAM-Diff2 的块因果并行解码与三阶段 AR-to-diffusion 蒸馏框架](https://arxiv.org/html/2608.01035v1/figs/arch.drawio.png)

图 1 的关键不是常规教师学生结构，而是迁移顺序：先改注意力制度，再处理学生实际噪声状态，最后缩模型。这个顺序把架构错配和容量压缩分开，便于定位性能损失来自哪里。

![图 2：自回归基线、扩散迁移和系统优化后的延迟与规划表现对照](https://arxiv.org/html/2608.01035v1/x1.png)

图 2 同时展示模型级 2.8 倍和端到端内核优化后的 15.1 倍。后者依赖 FlashInfer、CUDA Graph 与特定推理栈，不能直接当成所有设备上的算法固有倍数。

## 实验结论与证据

论文报告自回归基线为 22.7 ms/token，迁移为扩散后约 8.1 ms/token，再加入 FlashInfer 与 CUDA Graph 后为 1.5 ms/token。对应规划分数从 88.14 变为 87.44，再到 87.28，说明主要加速并未伴随大幅榜单坍塌。离散扩散还把长时轨迹误差从约 0.5935 降至 0.5589，支持并行细化可以缓解部分逐步累积误差。

证据支持“在论文给定硬件、任务和内核栈上，可以把一个多任务 AR 驾驶 VLA 高效迁移为离散扩散模型”，但不支持“15.1 倍是脱离部署栈的普适算法收益”，也没有实车截止时间和故障回退证据。

## 应用场景与启发

- 应用场景：车端 VLA 多任务服务、需要固定延迟预算的轨迹候选生成，以及大模型教师向小模型并行策略的迁移。
- 方法启发：速度评测应把解码范式、内核、图捕获和硬件分别列账；否则算法收益与系统工程收益无法复现。
- 研究问题：把离散轨迹 token 换成连续 occupancy-flow 或控制分布后，块内并行细化能否继续保持速度与几何平滑性？

## 局限与阅读风险

轨迹离散化会带来空间量化与平滑伪影，学生也受教师错误上限约束。规划分数近似保持不代表反应式闭环安全保持，NAVSIM 的非反应式协议尤其不能观测他车对自车动作的反馈。15.1 倍结果包含专用内核和图执行优化，需要按目标硬件重新测量内存、尾延迟与动态输入失效情况。

## 后续跟进

- 在同一硬件上分别复现 AR、纯扩散迁移、FlashInfer 和 CUDA Graph 四级延迟账本。
- 报告 p50、p95、p99 延迟与轨迹平滑度，而不只报告平均 token 延迟和聚合规划分。
- 在反应式仿真中检查大块解码导致的少量精度变化是否集中在最后安全干预时刻。
