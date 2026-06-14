---
{
  "id": "perception-informed-sil-simulation",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "autonomous-driving-security"],
  "title": "A Causal Probabilistic Framework for Perception-Informed Closed-Loop Simulation of Autonomous Driving",
  "source": "arXiv:2606.07186 / https://arxiv.org/abs/2606.07186",
  "authors": ["Zhennan Fei", "Rickard Johansson", "Mikael Andersson", "Matthias Eng", "Mattias Eriksson", "Kaveh Kianfar", "Sadegh Rahrovani", "Chris van der Ploeg", "Michael Borth", "Maren Buermann", "Michiel Braat", "Henk Goossens", "Zijian Han", "Majid Khorsand Vakilzadeh", "Gabriel Rodrigues de Campos"],
  "affiliations": ["Volvo Cars, Sweden", "TNO, The Netherlands", "Zenseact, Sweden", "Chalmers University of Technology, Sweden", "Eindhoven University of Technology, The Netherlands"],
  "comment": "这篇论文把 SIL 闭环测试从理想 object list 推向 perception-informed failure injection，用因果概率模型把雾、雨、弱光、目标合并等触发条件转成检测丢失和定位误差。"
}
---

## 一句话定位

这是一篇非常工程化的自动驾驶测试论文，关注 SIL 仿真中的“理想感知”问题。它不追求更逼真的全栈传感器渲染，而是用 causal probabilistic model 在 object-level SIL 中注入真实感知缺陷，让大规模测试更接近 SOTIF 风险。

## 论文要解决的问题

很多 SIL 仿真用 ground-truth object list 经过视场和遮挡过滤得到“传感器输出”，但这种输出几乎没有真实感知算法的功能不足，例如雾天漏检、弱光误检、目标合并导致定位偏差。全栈像素级仿真虽然更真实，但成本高，不适合大规模法规和安全评级场景。论文要解决的是在 object-level SIL 的效率下，系统注入由物理触发条件导致的感知错误。

## 方法和系统设计

- 构建 causal probabilistic models，把雨、雾、光照、镜头划痕、前车、目标合并等触发条件映射到 contrast loss、CNR、sharpness loss、IoU increase 等中间变量。
- 中间变量进一步影响 misdetection、sizing error、lateral/longitudinal positioning error 等功能不足。
- 将错误注入标准 scenario-based simulation toolchain，使用 OpenSCENARIO、OpenDRIVE、esmini 和 OSI 接口。
- 在 CCRs、CCRm、cut-out 等场景中比较 ideal sensing 与 injected perception errors 对 ego 行为的影响。

## 关键图与可视化结果

![图 1：感知失效的因果链，包括对比度退化和目标合并](../../assets/papers/perception-informed-sil-simulation-figure-1.png)

图 1 展示了论文的核心建模方式：不是直接随机丢 detection，而是从物理或环境触发条件出发，经由图像质量和几何关系变量，最终导致功能不足。这个结构适合解释 SOTIF 风险来源。

![图 2：感知错误注入后，目标尺寸、距离、速度和加速度的闭环变化](../../assets/papers/perception-informed-sil-simulation-figure-2.png)

图 2 是测试结果页，显示注入 misdetection 后，目标宽高、距离估计、ego velocity 和 acceleration 的变化。它说明 perception error 在闭环中会转化成车辆响应差异，而不只是单帧检测指标下降。

## 实验结论与证据

论文在标准场景中展示，理想 sensing 会掩盖感知退化导致的潜在风险；加入因果错误模型后，SIL 能暴露漏检、定位偏差和目标尺寸变化对闭环行为的影响。证据来自多个 EuroNCAP 相关场景中的 object-level failure injection 曲线，对比了 ideal sensing 和 causal model 输出对 ego control 的影响。

## 应用场景与启发

- 应用场景：SOTIF validation、法规场景批量 SIL、感知故障注入、EuroNCAP 场景扩展。
- 方法启发：测试平台不必在“理想 object list”和“昂贵全栈像素仿真”之间二选一，可以用可解释因果错误模型补齐中间层。
- 讨论问题：如何从真实传感器日志估计这些 causal model 的参数，而不是人工设定规则。

## 局限与阅读风险

因果模型的可信度取决于参数标定和触发条件覆盖，论文的实验更像方法验证而非完整认证。它主要面向 camera-related object-level errors，没有覆盖所有传感器融合、深度网络内部不确定性和交通参与者行为变化。若用于真实测试，需要把模型参数与实车数据闭环校准。

## 后续跟进

- 检查作者是否发布 OSI/esmini 集成配置和 causal model 参数。
- 与 Bench2Drive-Robust 对照：一个注入部署扰动，一个注入感知功能不足。
- 后续可把这个方法接入 RiskFlow 生成的 safety-critical scenario，形成“危险交互 + 感知退化”的组合测试。
