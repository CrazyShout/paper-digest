---
{
  "id": "driving-world-model-video-gpt",
  "revisionOf": "driving-world-model-video",
  "tag": "world-models",
  "tags": ["world-models", "end-to-end-autonomous-driving"],
  "title": "DrivingWorld: Constructing World Model for Autonomous Driving via Video GPT",
  "source": "ICPR 2026 / https://doi.org/10.1007/978-3-032-31583-0_19 / arXiv:2412.19505 / https://arxiv.org/abs/2412.19505 / HTML: https://arxiv.org/html/2412.19505v3",
  "authors": ["Xiaotao Hu", "Mingkai Jia", "Xiaoyang Guo", "Qian Zhang", "Xiao-xiao Long", "Wei Yin"],
  "affiliations": ["The Hong Kong University of Science and Technology", "Horizon Robotics", "Nanjing University"],
  "comment": "[人工核验版] 已对齐 arXiv v3 与 ICPR 2026 正式版：使用当前 Figure 2/7，并明确论文对 640 帧样例存在 5 Hz 与 10 Hz 两种互相冲突的表述。"
}
---

## 一句话定位

DrivingWorld 是一个 frame-wise 自回归驾驶世界模型：它先预测下一时刻的姿态，再预测对应前视图像，把跨帧时间建模和帧内空间生成拆开处理。论文的价值不是只把 Video GPT 搬到驾驶视频，而是针对图像 token 数量远多于控制 token、长序列注意力昂贵和误差累积三类问题分别设计结构。

## 论文要解决的问题

驾驶世界模型需要根据历史观察和动作推演未来，服务仿真、规划或策略学习。经典 next-token GPT 若把姿态与数百个图像 token 串成一维序列，会出现两个直接问题：稀少的控制 token 容易被视觉 token 淹没，且全序列注意力随时间和空间 token 数量快速增长。连续视频的 teacher forcing 还会让训练时未见过的预测误差在长 rollout 中逐步放大。

## 方法和系统设计

- **离散状态**：把前视图像量化为二维视觉 token，并把相邻时刻的相对朝向与位置分别离散化；视频 tokenizer 和 decoder 加入因果时间注意力以减少逐帧闪烁。
- **Next-frame AR**：同一空间位置先沿时间轴做因果注意力，再在当前时刻做多模态融合，把跨帧动力学和帧内空间关系分开，降低直接展开长序列的计算量。
- **Internal-frame AR**：在每个新时刻先生成控制状态，再在该状态条件下自回归生成图像 token；balanced attention 提高稀疏姿态 token 的权重，避免控制信号被视觉 token 稀释。
- **随机遮蔽训练**：训练时随机丢弃或替换部分真值 token，让模型接触受污染上下文，减轻长时自回归漂移。

## 关键图与可视化结果

![图 2：DrivingWorld v3 pipeline，展示姿态和前视图像的离散化、世界模型与解码流程](https://arxiv.org/html/2412.19505v3/pipeline.png)

Figure 2 展示当前版本的完整信息流：历史朝向、位置和前视图像分别编码为 token，世界模型先预测下一姿态与视觉状态，再由解码器还原为物理量和图像。它支撑的是模型接口与生成顺序，不直接证明视频具有物理真实性。

![图 7：DrivingWorld v3 展示的 640 帧长时生成样例](https://arxiv.org/html/2412.19505v3/long_term.png)

Figure 7 用连续采样展示道路结构在长 rollout 中的保持情况，但论文对这组样例的时长存在内部冲突：图注写“640 帧、5 Hz、128 秒”，正文却写“640 帧、10 Hz、64 秒”。因此这里只保留可直接确认的 640 帧，不把 64 秒或 128 秒作为已消除歧义的结论。

## 实验结论与证据

世界模型使用 3,456 小时驾驶视频训练，其中 120 小时来自 nuPlan，3,336 小时为私有数据；评估使用 200 个 nuPlan 测试片段和 150 个 nuScenes 测试片段。当前版本的 Table 1 报告 DrivingWorld 在 nuScenes 上生成 400 帧、最长 40 秒，并给出 FID/FVD 以及见过和零样本设置的比较；消融图显示不使用随机遮蔽时，生成内容在约第 10 帧后快速漂移。论文还报告轨迹规划结果，但这些证据仍主要说明视频预测与姿态条件可用性，不能替代闭环驾驶安全评测。

## 应用场景与启发

- 应用场景：用作候选轨迹条件下的视觉未来预测器，或给驾驶策略提供自监督时空表征。
- 方法启发：把“沿时间传播动力学”和“在单帧内生成空间细节”拆成不同注意力路径，比把所有模态直接拼成一条 token 序列更容易诊断。
- 讨论问题：若把前视视频扩展到多相机、深度和 occupancy，怎样保证不同模态共享同一几何状态，而不是各自生成视觉上合理但互相矛盾的未来？

## 局限与阅读风险

论文主要生成单个前视视频，不是完整多传感器闭环仿真；FID/FVD、用户偏好和少量姿态指标不能证明三维几何、交互因果或碰撞风险正确。训练数据绝大部分不公开，复现实验需要 64 张 A100 训练 12 天的量级，数据和算力边界都较高。640 帧样例的采样频率在同一版本内自相矛盾，也说明长时结论必须回到原始视频和代码配置再核验。

## 后续跟进

- 核对正式版补充材料或代码中的 640 帧采样频率，消除 5 Hz/10 Hz 冲突。
- 用公开 nuPlan 子集复现随机遮蔽和 balanced attention 的最小消融，分别测长时漂移与动作可控性。
- 增加深度、占用或 3D 轨迹一致性检查，并在闭环规划器中评估错误未来是否会诱导错误决策。
