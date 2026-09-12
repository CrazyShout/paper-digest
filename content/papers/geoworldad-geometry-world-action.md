---
{
  "id": "geoworldad-geometry-world-action",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "world-models",
    "dynamic-scene-representation"
  ],
  "title": "GeoWorldAD: Geometry World Action Model for Autonomous Driving",
  "source": "arXiv:2607.17521 / https://arxiv.org/abs/2607.17521",
  "authors": [
    "Songyan Zhang",
    "Jinyuan Tian",
    "Hanbing Li",
    "Daqi Liu",
    "Hao Chen",
    "Wenhui Huang",
    "Fang Li",
    "Guang Chen",
    "Hangjun Ye",
    "Long Chen",
    "Kuiyuan Yang",
    "Chen Lv"
  ],
  "affiliations": [
    "Nanyang Technological University",
    "Xiaomi EV",
    "Zhejiang University",
    "Harvard University"
  ],
  "comment": "把当前 4D 几何、未来深度世界模型和迭代轨迹规划接成同一条世界动作链；它的价值不是再加一个视觉 latent，而是检验显式三维约束能否同时提高安全与通行进度。"
}
---

## 一句话定位

GeoWorldAD 用当前三维几何和短时未来深度监督来训练轨迹规划器；最有说服力的结果是加入未来分支后，NAVSIM 的通行进度提高。它输出由几何特征引导的轨迹，并没有施加可验证的碰撞硬约束。本文依据 [arXiv v1 正文与附录 A](https://arxiv.org/html/2607.17521v1)。

## 论文要解决的问题

### 当前空间与未来变化如何进入动作

视频几何模型通常把所有点映射到首帧坐标，而规划轨迹使用不断移动的自车坐标；直接连接两者会增加对齐负担。另一方面，当前深度能描述路障位置，却不能说明前车何时离开。论文分别改造坐标、聚合不同层次的几何特征，再训练一个预测未来几何的分支，让规划器读取这些信息。

### 与两项直接前作的区别

[StreamVGGT §3.2–3.3](https://arxiv.org/html/2507.11539v1) 已有因果时序注意力、历史 KV 缓存，以及相机、深度和点图监督；它以首帧为参考，并从双向教师蒸馏。GeoWorldAD 改为各时刻自车相机坐标，使用相邻帧相对位姿，还增加驾驶数据训练和轨迹头。不能把流式几何本身归为本文首创。

更接近的 [DVGT-2 §3.2–3.3](https://arxiv.org/html/2604.00813v1) 已经采用当前自车坐标、相邻帧位姿和固定窗口 FIFO 缓存，并联合预测几何与轨迹。因此本文值得检验的增量是四层几何逐次细化，以及未来几何 latent 对动作的贡献。DVGT-2 的持续流式规划也比本文尚待实现的规划缓存更完整。

## 方法和系统设计

### 从四帧图像到当前几何

DINOv2 编码图像，24 层几何 Transformer 融合时空信息，从第 4、11、17、23 层读取四组特征。EgoStreamVGGT 的 DPT 头输出深度和三维点图，相机头输出 9 维参数；重建损失包含相机 Huber 损失、置信度加权的深度/点图误差与梯度误差。附录 A.1 明确了这些监督，但没有完整交代自车相机坐标到车辆规划坐标的工程变换。

### 未来分支预测什么

四个未来 chunk 覆盖之后 2 秒，每个含 64 个可学习 token。它们依次读取四层当前几何和速度、转向状态、导航指令，再在未来 chunk 间进行因果注意力。式（3）可写为：

$$
Q_{\mathrm{fut}}\leftarrow\operatorname{CausalSelfAttn}\!\left(\operatorname{CrossAttn}(Q_{\mathrm{fut}},[G_t^{\ell};E_{\mathrm{ego}}])\right),\qquad \ell\in\{4,11,17,23\}.
$$

其中 $G_t^{\ell}$ 是当前几何特征，$E_{\mathrm{ego}}$ 是自车状态嵌入；每个未来 chunk 只读取自身及更早 chunk。训练时，当前几何再读取未来 latent，经共享 DPT 头解码未来深度。未来深度损失不更新 DPT 头的权重；当前重建分支仍有自己的监督。这是由观测和自车状态条件化的未来预测，输入中没有待评估的候选动作，因而尚不是可比较不同动作后果的反事实世界模型。

### 轨迹、评分与训练边界

动作模块包含 64 组轨迹查询，每组 8 个 1024 维 waypoint token，预测未来 4 秒的 $(x,y,\theta)$。先经过四次当前几何聚合，再经过一次未来几何聚合；共享 MLP 每次解码轨迹，航向由 $\tanh$ 限制到 $[-\pi,\pi]$。式（6）–（9）的关键约束为：

$$
L_{\mathrm{traj}}=\sum_{j=1}^{5}\lambda_j\min_{1\leq r\leq64}\|P_r^{(j)}-P_{\mathrm{gt}}\|_1,\qquad
S_{\mathrm{gt}}=\mathrm{NC}\,\mathrm{DAC}\frac{5\mathrm{EP}+5\mathrm{TTC}+2\mathrm{Comf}}{12},
$$

$$
L=L_{\mathrm{traj}}+L_{\mathrm{score}}+L_{\mathrm{recon}}+L_{\mathrm{wm}}.
$$

$P_r^{(j)}$ 是第 $j$ 次细化的第 $r$ 条轨迹；较早阶段权重指数衰减，但具体数值未给出。评分 MLP 按时间池化候选特征，用模拟器产生的 $S_{\mathrm{gt}}$ 做二元交叉熵监督，训练目标是连续质量分数而非人工二分类标签。推理保留未来 latent 与学习到的评分头，重建和未来深度解码头均可移除；没有依据把模拟器真值评分写成在线规划输入。候选筛选的完整代码尚未核实。

训练分三段：先在 OpenScene、nuScenes、ParallelDomain、RealDriveSim 按 10:10:1:1 采样训练几何 23K 步；再并行训练未来分支 47K 步和仅含当前几何的 GeoAD 规划器 32K 步；最后合并分支，未来聚合输出投影零初始化，再训练 64K 步。全程 batch 64、32 张 H20、AdamW；前两段学习率 $10^{-4}$，最后一段 $10^{-5}$，均用余弦调度。具体图像分辨率、完整相机配置、训练时长和推理时延未在所查正文及附录中核实。

## 关键图与可视化结果

### 原文 Figure 2：三个模块的接口

![原文 Figure 2：GeoWorldAD 框架](../../assets/papers/geoworldad-geometry-world-action-figure-1.png)

[原图与图注](https://arxiv.org/html/2607.17521v1#S3.F2) 中间是读取当前几何的未来查询，右侧是当前几何四次聚合和未来几何一次聚合。图注说明辅助解码器被省略，不能据此把深度图误认为每次部署都必须生成的输入。

### 原文 Figure 9：未来深度的定性检查

![原文 Figure 9：未来深度预测](../../assets/papers/geoworldad-geometry-world-action-figure-2.png)

[附录原图](https://arxiv.org/html/2607.17521v1#A1.F9) 依次展示输入视频、四个未来 RGB、预测深度和稀疏真值深度。已核对图中左侧红色车辆、树木和建筑场景。深度轮廓连贯只能证明这组可视化合理；稀疏真值、动态边界误差和误差传播到规划的程度仍需要定量分析。

## 实验结论与证据

### 最接近机制的比较

下表来自原文 Table 3；分数均按 0–100 展示，越高越好。两模型使用同一论文的 NAVSIM 协议，但完整模型额外经过联合训练，不能把差值全部归因于新增 future token。

| 模型 | v1 PDMS | v1 EP | v1 NC | v2 EPDMS | v2 EP | v2 NC |
| --- | --- | --- | --- | --- | --- | --- |
| GeoAD，仅当前几何 | 89.3 | 82.6 | 98.9 | 87.6 | 86.3 | 98.9 |
| GeoWorldAD | 91.0 | 85.9 | 99.0 | 90.4 | 89.1 | 99.0 |

进度分别增加 3.3 和 2.8 分，NC 各增加 0.1 分。Table 1 的 DVGT-2 为 90.3 PDMS、EponaV2 为 90.4，但 iPad 为 91.7；“整体最优”超出该表支持范围。Table 2 中 GeoWorldAD 的 EPDMS 高于所列 DVGT-2 89.6 和 EponaV2 88.9，仍不是每项子指标都领先。

### 坐标、层次与监督的证据

Table 4 的从头训练、普通 StreamVGGT 加重建、EgoStreamVGGT 不加重建、EgoStreamVGGT 加重建依次为 84.2、84.8、87.3、89.3 PDMS。坐标改造同时伴随训练适配，缺少同训练量、只改坐标的控制。附录 Table 6 则比较“24 层特征一次交互”87.6、“末层特征四次细化”88.2、“四层特征四次细化”89.3；这支持逐次聚合设计，不能简化成单纯迭代次数的消融。

Table 5 的深度 AbsRel 在 OpenScene 从 0.236 降至 0.141，nuScenes 从 0.265 降至 0.117，KITTI 从 0.173 降至 0.077。这验证当前几何适配，而不是未来深度预测准确度。附录位姿表也存在 nuScenes 旋转相对误差回退，不能泛称所有几何指标改善；该表误差单位未充分说明，本文不追加猜测。

### 模拟器能支持多强的结论

v1 使用 4 秒、10 Hz 非反应式评估。v2 支持反应式车辆，但 [NAVSIM 官方交通策略说明](https://github.com/autonomousvision/navsim/blob/main/docs/traffic_agents.md) 明确指出：自车一次提交整段计划，不把更新环境重新反馈给规划器；行人等仍可按日志运动。论文没有给出完整 v2 traffic policy 配置。因此这些结果支持短时模拟规划质量，不能等同于自车持续感知、反复重规划的交互闭环。

## 应用场景与启发

### 可以迁移的设计

对于已有视觉规划器，优先尝试从不同层次的几何特征读取信息，并用零初始化残差接入未来分支，这使初始行为保持在已有规划器附近。若目标是减少“安全但不前进”，应联合记录 EP、碰撞相关分数和动态区域未来深度误差，检验未来分支是否确实改善动作时机。

作者认为未来几何带来预见性；本报告的判断是，当前证据支持这套训练系统有收益，但尚未区分未来预测内容、额外训练步骤和更大的规划器容量。

## 局限与阅读风险

- 未来模型没有候选动作条件，也没有报告预测不确定性与拒绝机制；预测错误时怎样回退仍不清楚。
- 未来深度定量误差、同计算预算的未来分支消融、不同训练种子区间均未核实，安全提升的统计稳定性未知。
- 重建可流式运行，规划器仍使用固定长度 clip；作者在 §5 明确把规划 KV 缓存留作未来工作。
- 输入方程描述单幅相机图像，结果表仅标记 camera；完整相机配置未给出，不能进一步认证“相同相机数”的跨方法公平性。

## 后续跟进

### 资源状态

截至 2026-09-12，已读取固定 v1 正文、附录和官方原图；在论文及精确标题检索中未找到作者发布的 GeoWorldAD 代码、配置、权重或拆分清单。StreamVGGT、DVGT-2 与 NAVSIM 的公开入口不能代替 GeoWorldAD 的可复现资源。本文未下载训练数据、未运行模型。

### 最小验证与停止条件

取得作者权重及配置后，先固定 200 个 navtest 场景，用一张满足实测显存需求的 GPU 做三种离线前向：正常 future latent、跨场景打乱 future latent、零化未来残差；其他模块与候选数保持相同。记录逐场景 PDMS/EP/NC、候选评分和墙钟时延，再做场景级配对 bootstrap。此测试检验已训练模型是否利用未来内容，不把扰动实验当成重新训练消融。

只有正常未来输入的 EP 改善且 NC 不下降、差值区间不跨零，才进入与 GeoAD 等额外 64K 步训练预算的重训比较。若缺少权重、坐标/评分配置无法对齐，或未来扰动没有稳定影响，就停止扩大算力投入；32 张 H20 的原训练规模不是首轮验证的默认预算。
