---
{
  "id": "commercial-av-failure-sampling",
  "tag": "autonomous-driving-testing",
  "tags": ["autonomous-driving-testing", "autonomous-driving-security"],
  "title": "Importance Sampling and PCA for Finding Failures in Commercial Autonomous Vehicles",
  "source": "arXiv:2607.18106 / https://arxiv.org/abs/2607.18106",
  "authors": ["Hailey Warner", "Duncan Eddy", "Shreya Parjan", "Caroline Cahilly", "Harrison Delecki", "Matthias Kleinstauber", "Chaitanya Shinde", "Jerry Lopez", "Mykel J. Kochenderfer"],
  "affiliations": ["Department of Aeronautics and Astronautics, Stanford University", "Torc Robotics"],
  "comment": "把 AST 和扩散失效采样真正接到商业自动驾驶卡车栈，并用 PCA 把碰撞样本压缩为可复现的 eigenfailures；重点是从“找到一次事故”走向“诊断可重复失效模式”。"
}
---

## 一句话定位

多数稀有失效搜索只在学术驾驶栈上证明能找到碰撞，商业规划器是否仍会被同类方法有效测试并不清楚。这篇论文把 Adaptive Stress Testing（AST）和 Diffusion-based Failure Sampling（DiFS）接到 Torc 的商业自动驾驶卡车意图规划器，再用 PCA 聚类并反演出可重复的“eigenfailures”。它进入本期，是因为研究对象和输出都更接近工程测试：高可靠系统、搜索成本、失效严重度、近失事件和可复现诊断。

## 论文要解决的问题

普通 Monte Carlo 在高可靠规划器上极难碰到失败，即使找到碰撞，也只得到一条长噪声轨迹，无法解释哪个时段、哪种感知偏差真正触发故障。论文希望同时解决两件事：用定向采样提高稀有失败发现率；把大量搜索轨迹压缩为少数可迁移的低维失效模式，支持后续回归测试与修复。

## 方法和系统设计

- 在切入场景中对周车感知位置注入时序噪声，商业规划器接收带噪轨迹并控制 ego 卡车。
- AST 用 Soft Actor-Critic 搜索高概率碰撞噪声；DiFS 从低鲁棒样本训练去噪扩散分布，强调更可能且更多样的失败。
- 对 300 条 AST 失败轨迹按横纵向时序做 PCA 与聚类，再反变换得到代表性 eigenfailures，并在原场景及切入距离 ±5 m 的相似场景中复放。

## 关键图与可视化结果

![图 1：商业卡车栈的切入测试场景与感知噪声位置](../../assets/papers/commercial-av-failure-sampling-figure-1.png)

图 1 来自官方源码。绿色轮廓是切入车辆真实位置，灰框是 ego 感知到的噪声位置；论文搜索的不是任意交通行为，而是能够通过感知偏差改变商业规划器响应的时序噪声。

![图 2：PCA 反演得到的三类 eigenfailure 噪声轨迹](../../assets/papers/commercial-av-failure-sampling-figure-2.png)

图 2 展示三类低维失效模板。它揭示 AST 会先施加不必要的右偏、随后用左偏诱发切入碰撞，说明 PCA 不仅压缩样本，也能暴露奖励最大化带来的搜索伪影。

## 实验结论与证据

Monte Carlo 在 2000 个评估 episode、约 26 小时仿真中没有找到碰撞；AST 在 300 个 episode 中得到 94.6% 失败率，DiFS 为 3.1%。二者目标不同：AST 追求高失败率，DiFS 找到的失败平均 log-probability 更高、更接近自然噪声，但单次碰撞发现成本也更高。

DiFS 的 300 条轨迹中有 9 次碰撞和 10 次非碰撞近失；按 DRAC 阈值区分后，4 次碰撞被判定为物理上不可避免，5 次属于规划器失败。AST 策略迁移到切入距离 ±5 m 的两个变体时，各 100 次均产生碰撞。PCA 得到的 eigenfailures 也能在相同和相似场景复现故障，证明诊断结果不是只对应单条原始噪声序列。

## 应用场景与启发

- 应用场景：商业闭环栈的加速测试、感知误差回放、切入/汇入回归集和失效根因聚类。
- 方法启发：生成器的交付物不应只是更多事故，而应包括概率、严重度、最早可干预时刻和可复放的最小扰动模板。
- 讨论问题：修复一个 eigenfailure 后，如何判断系统是真正消除了失效机制，还是只对这一条模板过拟合？

## 局限与阅读风险

商业规划器不可公开，第三方无法完整复现；实验集中在单一切入场景和简化高斯感知噪声，真实传感器误差通常带偏置、相关性和对象级漏检。AST 的 94.6% 失败率并不意味着这些事故在现实中高概率发生，它反映的是定向策略成功诱发失败。严重度使用相对速度平方，且仿真到真实的迁移未验证；PCA 前三主成分对纵向噪声只解释约 40% 方差，低维结构仍有限。

## 后续跟进

- 用实车日志拟合对象级、时序相关和场景相关噪声，而不是手工高斯分布。
- 将 eigenfailure 变成版本化回归测试，并在每次规划器更新后记录复现率、MinTTC 和首次偏离时刻。
- 与可解释因果分析结合，验证 PCA 模式究竟对应感知、预测还是决策层缺陷。
