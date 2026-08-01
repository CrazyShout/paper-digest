---
{
  "id": "mojito-modal-joint-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": ["end-to-end-autonomous-driving"],
  "title": "MOJITO: Modal Joint Learning for Unified End-to-End Autonomous Driving",
  "source": "arXiv:2607.23511 / https://arxiv.org/abs/2607.23511 / Official code repository (model weights pending): https://github.com/mumucc01/MOJITO",
  "authors": ["Zhijing Cheng", "Xuancheng Zhang", "Donglin Di", "Lei Fan", "Baorui Ma", "Hao Li", "Xun Yang"],
  "affiliations": ["University of Science and Technology of China", "Li Auto", "University of New South Wales"],
  "comment": "MOJITO 把图像、LiDAR 与轨迹 token 放进逐层联合注意力，不再让规划器只读取压缩后的感知上下文。它在 NAVSIM 的非反应式评测中给出有竞争力的规划分数，也提供了检验感知与规划双向交互是否有效的清晰消融。"
}
---

## 一句话定位

MOJITO 是一个 1.27 亿参数的相机、LiDAR 到轨迹端到端模型：它用逐层 Modal Joint Attention 让动作 token 与两类传感器 token 双向更新，并用无锚点扩散规划器输出轨迹；本期收录它的主要理由不是“又一个更大的 VLA”，而是它以较紧凑的纯 Transformer 结构直接检验了感知与规划之间的信息瓶颈。

## 论文要解决的问题

常见端到端驾驶模型先把相机和 LiDAR 压缩为一个紧凑上下文，再由独立规划头读取该上下文。这个接口便于模块划分，却可能在规划发生之前丢掉车道边界、障碍物几何和局部深度等细节，而且轨迹损失难以反向约束哪些感知信息应被保留。为了稳定规划，许多方法还会增加检测等辅助监督，或使用预定义轨迹锚点限制搜索空间。

MOJITO 的切入点是取消这条单向接口：图像、点云和正在去噪的轨迹都保留为 token，在每一个 Transformer block 内共同参与注意力。这样，动作 token 可以按当前规划状态查询传感器细节，感知 token 也能随规划意图更新，而不是一次性产出固定上下文。

## 方法和系统设计

- **三条并行分支**：图像分支采用 DINOv3-S+ 结构并以 16 x 16 patch 生成 token；LiDAR 分支采用 Uni3D-S 结构；动作分支以 Diffusion Transformer 表示 8 个未来 waypoint，每个 waypoint 包含二维位置和航向角。
- **PillarGroup 点云 token 化**：点云先按固定物理范围裁剪并划分为 32 x 32 个柱体，选取 512 个非空柱体，每柱采样 64 个点。与 FPS+KNN 相比，这种 token 保留绝对尺度和道路场景的全局布局。
- **Modal Joint Attention**：每层把图像、LiDAR 和动作 token 拼接后做共享多头自注意力，再拆回各自分支。完整模型使用 12 个对齐 block、384 维隐状态，使规划和感知交互贯穿网络深度，而不是只在末端融合。
- **无锚点扩散规划**：推理从高斯噪声轨迹开始，以扩散步和高层驾驶指令调制动作 token，最终解码 4 秒内的 8 个 waypoint。论文报告使用 2 个扩散步，不依赖候选轨迹锚点或额外检测监督。
- **训练设置**：三路前向相机图像被拼接为 1024 x 256 输入，并同时读取原始 LiDAR；图像与 LiDAR 骨干从公开权重初始化并微调，动作规划器从头训练。训练使用 NAVSIM navtrain、AdamW、总 batch size 512 和 8 张 NVIDIA H200。

## 关键图与可视化结果

![图 1：MOJITO 用逐层联合注意力连接图像、LiDAR 与扩散动作分支](../../assets/papers/mojito-modal-joint-driving-figure-1.png)

这张官方架构图展示了论文最值得复核的设计。底部三种输入分别经过图像 patchify、PillarGroup 和噪声轨迹编码；中部每个 block 保留独立 FFN，却共享 Modal Joint Attention；顶部才解码动作。读图时应关注联合注意力发生在每一层，而不是只做一次后融合，也要注意高层指令只是条件输入，模型本身不是以大语言模型为主干。

![图 2：NAVSIM-v1 上 MOJITO、DiffusionDrive 与 ReCogDrive 的轨迹定性比较](../../assets/papers/mojito-modal-joint-driving-figure-2.png)

官方定性图给出环岛、分岔和弯道三类场景，绿色点表示参考轨迹，红色点表示各模型预测。MOJITO 的样例更贴近可行车道，尤其在第三行没有像对比方法那样产生过度转向。不过这只是少量挑选样例，它能够说明模型会生成几何上更平滑的候选轨迹，不能单独证明总体安全性、因果反应能力或真实道路闭环稳定性。

## 实验结论与证据

实验在 NAVSIM-v1 和 NAVSIM-v2 上进行。输入是 2 Hz 的真实驾驶日志，但规划评测属于 **non-reactive closed-loop**：预测轨迹在模拟评测器中执行，环境不会根据自车动作反馈，其他交通参与者也不会实时响应。因此下列数字是规划 benchmark 证据，不等价于交互式仿真或实车闭环。

- **NAVSIM-v1 navtest**：MOJITO 的 PDMS 为 88.9，超过同表中的 DiffusionDrive 88.1 和 WoTE 88.3；分项为无责任碰撞 98.6、可行驶区域 96.9、TTC 94.5、舒适性 100、行驶进度 83.5。VLA 对比表中带强化学习的 ReCogDrive 达到 90.8、AdaThinkDrive 达到 90.3，因此 88.9 不应解释为超过所有 VLA 方法。
- **NAVSIM-v2 Stage 1**：在 navtest 的日志评测上，MOJITO 得到 88.4 EPDMS，高于 DiffusionDriveV2 的 85.5；方向、车道和历史舒适合规分数分别为 99.5、97.3 和 98.4。
- **NAVSIM-v2 navhard**：Stage 2 没有 LiDAR，论文移除 LiDAR 分支后以相机输入评测，综合 EPDMS 为 29.0，对比 GuideFlow 27.1、DiffusionDrive 24.2。该结果确实包含更难的后续观察，但仍由 NAVSIM 协议生成，并非开放交通中的完全反应式闭环。
- **关键消融**：相机单模态为 86.8 PDMS；加入 FPS+KNN 点云 token 后为 86.1；PillarGroup 加单向 cross-attention 为 85.7；PillarGroup 加双向 self-attention 的完整模型为 88.9。这组结果支持“点云 token 设计与双向融合共同重要”，但没有把预训练骨干、训练预算等因素完全隔离。
- **规模与效率**：模型从 33.4M、64.4M、95.5M 扩展到 127M 时，PDMS 从 80.5、80.5、83.0 增至 88.9。单张 H200、BF16 下报告延迟为 187.65 ms，慢于 Transfuser 的 88.15 ms 和 DiffusionDrive 的 123.22 ms，快于 ReCogDrive 的 331.68 ms。

## 应用场景与启发

- **应用场景**：适合作为相机与 LiDAR 联合端到端规划的紧凑基线，尤其适合研究传感器细节应在规划网络的哪一层被读取，而不是直接替代经过实时性和安全认证的车载规划器。
- **方法启发**：最有价值的可延伸问题是把“规划反向影响感知表示”变成可测量机制，例如限制动作到感知的注意力范围、引入可观测性置信度，或在通信受限的协同驾驶中只传输当前规划真正查询的 token。
- **讨论问题**：如果把相同骨干和训练预算固定，逐层双向注意力在反应式闭环中的收益是否仍存在，还是主要来自更大的联合计算量与预训练初始化？

## 局限与阅读风险

- 论文的 NAVSIM 结果是非反应式评测，没有环境反馈、交互车辆反应或真实控制器误差，不能表述为实车闭环验证。
- navhard Stage 2 使用相机单模态，不能直接证明完整相机加 LiDAR 模型在更强协议中的收益；29.0 的绝对分数也说明该设置仍很困难。
- 论文使用三路前向视角而非完整环视输入，预测范围只有 4 秒；遮挡后的长时交互、后方来车和极端传感器失效没有被覆盖。
- 逐层拼接全部模态增加注意力计算，187.65 ms 的单样本延迟尚未包含完整车载栈、数据搬运和控制执行，离实时部署结论仍有距离。
- arXiv 源文件采用 ECCV 2026 格式，但本次没有核验到正式 proceedings 页面，因此这里只按预印本记录，不写作已录用论文。
- 论文和 arXiv 记录链接了官方仓库，代码已经公开，但仓库截至本次核验仍标注模型权重将在后续开放；因此目前不能验证权重完整性、端到端依赖或结果可复现性。

## 后续跟进

- 先以官方仓库固定 commit 和环境，复现 NAVSIM-v1 navtest 的 88.9 PDMS，并核对 2-step diffusion、三相机裁剪和 LiDAR 预处理是否与论文一致。
- 最小消融只保留四组：相机单模态、相机加 FPS+KNN、PillarGroup 加 cross-attention、完整 self-attention；至少运行多个种子，检查论文中约 2.1 至 3.2 PDMS 的差异是否稳定。
- 单独记录前处理、骨干、联合注意力和扩散解码的延迟，再在可交互仿真中加入突然切入或让行场景，验证双向融合是否改善反应，而不只是提升日志评分。
- 持续检查是否出现正式会议页面；若后续有 proceedings 链接，应与 arXiv 和官方仓库同时保留。
