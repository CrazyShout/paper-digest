---
{
  "id": "m4world-multimodal-driving-world",
  "tag": "world-models",
  "tags": ["world-models", "autonomous-driving-testing"],
  "title": "M4World: A Multi-view Multimodal Driving World Model for Interactive Object Manipulation and Minute-long Streaming",
  "source": "arXiv:2607.14005 / https://arxiv.org/abs/2607.14005",
  "authors": ["Ke Cheng", "Hanqiao Ye", "Lei Shi", "Yahui Liu", "Yunhan Shen", "Jingtao Dong", "Zhenke Wang", "Wenxuan Ao", "Weixiang Xu", "Kaining Huang", "Shuhan Shen"],
  "affiliations": ["Meituan", "Institute of Automation, Chinese Academy of Sciences", "Beijing Institute of Technology"],
  "comment": "把十相机、LiDAR、对象外观与分钟级流式生成统一到一个驾驶世界模型中，并用少样本长尾物体增强验证下游收益；亮点是可控性，不只是画质。"
}
---

## 一句话定位

M4World 是一个可流式生成十相机视频和同步 LiDAR 的驾驶世界模型，允许按 3D 布局、类别、文本和参考图像控制单个交通物体，并通过少量稀有 clips 做后训练。它进入本期的关键不是“能生成 60 秒视频”，而是论文把对象级可控性、跨视角一致性和下游长尾检测收益放进同一证据链，尝试让生成模型从展示工具变成数据资产工具。

## 论文要解决的问题

现有驾驶视频生成通常只能用地图、框或 ego 轨迹控制物体位置，很难指定“同一位置出现什么样的车”；长时间自回归还会积累闪烁和结构漂移。对于安全关键数据生成，这意味着模型既难精确构造目标长尾物体，也难保证它跨相机、跨模态和跨时间保持身份一致。论文因此同时解决对象外观控制和分钟级稳定 rollout，而不是只优化短片 FVD。

## 方法和系统设计

- 共享 DiT 主干通过两路 cross-attention 接入时变控制信号、全局场景/传感器上下文，在统一 latent 中联合生成多视角视频和 LiDAR range map。
- 训练从双向视频先验开始，经 teacher forcing 转为因果自回归，再用模型自产历史做迭代长视频微调；四步学生去噪器配合 latent context refresh，减少 chunk 间闪烁和长期背景退化。
- 数据包含约 4 万个 10 s clips、4,000 个 60 s clips，传感器为 10 相机和 128 线 LiDAR。Qwen3-VL 自动生成场景文本和物体描述；少样本后训练与首帧参考条件用于定制稀有物体。

## 关键图与可视化结果

![图 1：M4World 的共享 DiT、控制信号和跨传感器生成结构](https://arxiv.org/html/2607.14005v1/x3.png)

图 1 来自论文官方 arXiv HTML。两个条件通路分别承担动作/布局控制和相机-LiDAR 上下文对齐，避免为每种传感器维护彼此独立的生成器。读图时应关注共享主干是否真正约束跨模态一致，而不只是并行输出。

![图 2：六视角 60 秒 rollout 的关键帧稳定性](https://arxiv.org/html/2607.14005v1/x9.png)

图 2 展示分钟级多视角生成的关键帧，论文强调没有出现灾难性漂移，并保持物体外观和运动连续。它是重要的长时定性证据，但仍不足以替代动作响应、物理一致性和闭环策略排序测试。

## 实验结论与证据

在相同训练数据上，M4World 相比 MagicDriveV2 将 FID/FVD 从 41.7/346.1 降到 34.8/288.7。VLM judge 中，对象视觉/文本一致性从 13.4%/11.6% 提升到 62.7%/59.1%，跨视角对象一致性从 78.9% 提到 84.5%。四步学生在 8 张 A100 上生成六相机加一条 LiDAR 流时，1024×567、424×800、224×400 分辨率分别约为 0.7、2.3、7 FPS，说明高分辨率仍远未实时。

最有说服力的应用实验是 tree-hauling truck：作者从不足 5 个真实 clips 出发做少样本适配，生成 500 个 10 s clips，混入 5 万真实 clips 后，目标物体 recall 从 1.0% 升到 69.7%，常规集 mAP 从 66.7% 保持到 66.8%。这说明可控生成可能真正补足特定长尾类别，而不仅是提高视频观感。

## 应用场景与启发

- 应用场景：适合稀有车辆/天气的数据增强、可编辑多传感器回放、世界模型长时稳定性研究和生成式仿真素材生产。
- 方法启发：长尾生成应从“文本描述一个罕见场景”升级为对象级布局、外观、跨视角身份和下游任务收益的联合验收。
- 讨论问题：当合成数据把某个长尾类别 recall 大幅抬高时，如何确认模型学到的是物体结构，而不是生成器特有纹理或标注捷径？

## 局限与阅读风险

训练数据为内部大规模车队数据，外部难以复现；主要生成对比只有 MagicDriveV2，VLM judge 也可能继承评审模型偏差。60 秒稳定性以定性图和生成指标为主，论文尚未让驾驶策略真正与世界模型闭环交互，作者也把 genuine closed-loop evaluation 列为未来工作。因此它现在更接近高质量、可控的数据生成器，而不是已经获得测试准入的安全仿真器。

## 后续跟进

- 优先检查模型、数据接口和 VLM judge 是否开放，并复核 500 个合成 clips 的数据增强设置。
- 用独立检测器、不同真实测试域和人工审核验证长尾收益，排除生成器指纹。
- 后续应结合本期“世界模型准入阶梯”，补充动作跟随、有效时域、失败拒绝和闭环策略排序证据。
