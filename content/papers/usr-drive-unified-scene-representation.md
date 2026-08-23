---
{
  "id": "usr-drive-unified-scene-representation",
  "tag": "3d-reconstruction",
  "tags": ["3d-reconstruction", "world-models"],
  "title": "USR-Drive: Unified Driving Scene Representation via Joint Denoising of 3D Gaussians and Boxes",
  "source": "arXiv:2608.19036 / https://arxiv.org/abs/2608.19036 / HTML: https://arxiv.org/html/2608.19036",
  "authors": ["Li-Heng Chen", "Haokai Pang", "Chengye Su", "Jiarun Liu", "Qifeng Chen", "Ziqian Ni", "Jianxin Huang", "Shi-Sheng Huang", "Hongbo Fu", "Sheng Yang"],
  "affiliations": ["NIO", "The Hong Kong University of Science and Technology", "Beijing Normal University"],
  "comment": "USR-Drive 把稠密 3D Gaussian 几何与稀疏 3D box 当作共同世界状态联合去噪，在 nuScenes 同时提升重建和检测，并在 VKitti 做零样本验证；作者也明确指出当前缺少全局长期状态、4D 身份和实时性。"
}
---

## 一句话定位

USR-Drive 试图打破驾驶场景中“重建一套几何、检测再建一套对象”的双系统：稠密 3D Gaussian latent 与稀疏 box latent 在同一个 metric spatiotemporal coordinate 中联合去噪，让对象结构约束动态几何、几何反过来给 box 提供空间落点。它是场景表示方向很清晰的前沿稿，但目前仍是 50 步离线生成器，不是可直接部署的 4D 状态。

## 论文要解决的问题

纯重建模型容易在动态车体上出现 temporal smearing，也不输出规划可用的对象；纯 3D detector 则给出稀疏 box，却缺少可渲染表面和完整场景结构。串联“先重建再检测”会累积误差，两条支路也无法在生成过程中互相修正。论文希望用统一 latent 同时回答 surface reconstruction 与 instance layout，并检验这种耦合是否真的双向受益。

## 方法和系统设计

- Stage I 用双分支 autoencoder 分别压缩 dense geometry 与 slot-aligned 3D boxes；box 还包含类别、偏移、速度和辅助 token。
- Stage II 的 MMDiT 对两类 latent 联合 rectified-flow denoising，共享 self-attention 允许结构信息双向交换。
- Unified Positional Encoding 为 Gaussian patch 和 box anchor 都提供 metric 3D anchor 与归一化时间，避免只靠 token 序号对齐异构模态。
- 输入是 6 路 posed camera、8 帧 clip；推理不使用 GT box/track，从 Gaussian noise 开始做 50 步去噪，长序列用重叠窗口。

## 关键图与可视化结果

![图 1：双分支 autoencoder、共享 MMDiT 和 Unified Positional Encoding 的统一去噪框架](https://arxiv.org/html/2608.19036v1/overview_demo2.png)

图 1 展示“统一”的严格含义：不是末端把两个输出一起展示，而是几何与 box 在去噪中共同演化。UPE 是维持物理对应的关键，否则不同 token 只共享注意力、没有共享空间。

![图 2：nuScenes 上场景重建、动态对象外观和 3D box 的定性对比](https://arxiv.org/html/2608.19036v1/main_exp.png)

图 2 显示动态区域边缘和 box grounding 的改善，和对象级 PSNR/SSIM 结果相符。它仍不能说明长期身份、速度连续性或规划效用，这些正是作者在 limitations 中承认的缺口。

## 实验结论与证据

模型只在 nuScenes 训练，使用官方 split；VKitti 抽取 400 个 case 做零样本测试。nuScenes 场景级重建达到 PSNR 27.55、SSIM 0.853、LPIPS 0.076、depth RMSE 4.59，均优于列出的 VGGT、DA3、Pi-3、AnySplat、STORM 和 DGGT。动态前景重建 PSNR 24.45、SSIM 0.833、LPIPS 0.083，提升尤其明显。

在 nuScenes vision-only 3D detection 上达到 NDS 0.625、mAP 0.552，高于列出的 RoPETR 0.614/0.529。VKitti 零样本重建为 26.45 PSNR、0.743 SSIM，检测 mAP 0.518、mATE 0.812；专用 nuScenes detector 在该跨域表中 mAP 只有 0.008-0.022。跨方法训练设置并非完全等价，因此这组数字更适合证明 unified representation 具有迁移潜力，而不是宣布通用检测器被彻底取代。

消融中 box-only 检测 mAP 仅 0.012，去掉 UPE 为 0.214，完整模型为 0.552；decoupled two-stage 为 mAP 0.473、PSNR 21.47。联合去噪优于串联的证据较完整，但默认 MMDiT 已有 1.418B 参数，50 步推理成本不可忽略。

## 应用场景与启发

- 应用场景：离线驾驶场景数字化、可渲染对象级重建、合成数据生成和统一几何预训练。
- 方法启发：surface、instance 与后续 occupancy 不应只在输出端共享，而要在 metric latent 中互相施加约束。
- 研究启发：加入 radar Doppler/return likelihood 作为第三类 token，让 geometry、box 与动态 occupancy 共享时空 anchor，并显式维护 unknown。
- 讨论问题：统一模型同时提高 PSNR 和 mAP 后，怎样证明共享表示也提高了规划，而不是仅让两个离线任务互相正则化？

## 局限与阅读风险

作者明确承认当前 patch/frame-aligned geometry 没有 compact global state 和长期身份，不能直接支持 4D tracking；重叠 8 帧窗口也不能替代长时状态。50 步迭代去噪限制为离线估计，论文未报告真实延迟。检测比较引用不同专用模型的官方数字，统一模型参数更大；VKitti 是合成域且只取 400 case。扫描时没有代码或模型入口，因此可复现性暂时弱于有开放资产的入选论文。

## 后续跟进

- 先复核 UPE、decoupled pipeline 与 joint denoising 三组消融，而不是直接训练完整 1.4B 模型。
- 用 causal/few-step distillation 测试延迟与重建、检测两端性能的 Pareto 曲线。
- 增加 object identity、occupancy/free-space 和 radar Doppler token，建立可持续更新的全局场景状态。
