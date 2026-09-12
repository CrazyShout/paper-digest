---
{
  "id": "flashdrive-vla-inference",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "agentic-driving"
  ],
  "title": "FlashDrive: Flash Vision-Language-Action Inference for Autonomous Driving",
  "source": "arXiv:2608.12932 / https://arxiv.org/abs/2608.12932 / Project: https://z-lab.ai/projects/flashdrive / Code: https://github.com/z-lab/flashdrive",
  "authors": [
    "Zekai Li",
    "Yihao Liang",
    "Hongfei Zhang",
    "Jian Chen",
    "Yesheng Liang",
    "Zhijian Liu"
  ],
  "affiliations": [
    "University of California San Diego",
    "Princeton University",
    "Independent Researcher"
  ],
  "comment": "FlashDrive 不把 VLA 延迟归结为单一大模型，而是分别处理视频重编码、prefill、推理 token 串行生成和 flow-matching 过度迭代。它把 Alpamayo 1.5-10B 在 RTX PRO 6000 上从 717 ms 降到 151 ms，并公开代码与检查点。"
}
---

## 一句话定位

FlashDrive 对现成 Alpamayo 1.5-10B 的视觉编码、上下文 prefill、语言解码和动作生成分别减冗余，再结合 CUDA Graph、融合算子和 W4A8 量化。在 RTX PRO 6000 的单轨迹持续推理中，平均延迟从 716.9 降至 151.4 ms；六候选最优 ADE 略退步，单候选 ADE 改善，不能统称为数值完全无损。[固定全文 2608.12932v1，2026-08-13，Table 1](https://arxiv.org/html/2608.12932v1#S4.T1)

## 论文要解决的问题

### 四段瓶颈有不同原因

每个窗口含 4 时间点×4 相机，新窗口只新增一个时间点，却可能重复编码其余图像和 KV；语言部分逐 token 生成约 16-token 的驾驶推理；动作专家又执行 8 步流匹配。只改某个算子会把瓶颈转移到下一段。

输入仍为多相机视频、自车上下文等 Alpamayo 输入，输出为未来 6.4 s 轨迹。FlashDrive 是需要状态缓存、额外 drafter 和微调权重的推理栈，不是仅切换一个低精度选项；每条连续视频流还需独立维护及重置缓存。

### 两项直接相关的原始机制

| 一手来源 | 原有机制 | FlashDrive 的具体适配 |
| --- | --- | --- |
| Xiao 等，StreamingLLM，2023；[v1 §3.2](https://arxiv.org/html/2309.17453v1#S3.SS2) | 保留初始 attention sink 和近期 KV，按缓存内位置重编号；已经提出存 pre-RoPE keys、使用时重新旋转 | FlashDrive 扩展到按相机排列的视频 tokens，逐视角插入新帧并设置 streaming mask，另外微调动作专家以适应近似缓存；pre-RoPE 不是本文首创 |
| Chen 等，DFlash，2026；[v1 §4.1–4.2](https://arxiv.org/html/2602.06036v1#S4) | 将目标模型的多层上下文特征注入每层 drafter KV，用一次 block diffusion 前向并行提出 token，再由目标模型验证 | FlashDrive 采用两层、block size 8 的驾驶专用 drafter，并将目标上下文限制为最近 8 tokens，减少短推理场景的条件与验证成本 |

两篇原文均已读取。这些技术分别覆盖缓存与解码，本文贡献更适合评价为整个驾驶推理链的组合和量测，而非每项底层算法均重新提出。

## 方法和系统设计

### 协议组一：流式 KV 是近似复用

窗口按 view-major 排列，即同一相机的时间帧相邻。新帧必须插入各视角末端，旧帧相应淘汰，而非全部追加到序列末尾。用 $k^{\mathrm{pre}}$ 表示旋转前 key，位置变化时的更新可以按 §3.1 的操作写成：

$$
k^{\mathrm{old}}=R(p)k^{\mathrm{pre}},\qquad k^{\mathrm{new}}=R(p-\Delta)k^{\mathrm{pre}}.
$$

$R$ 是 RoPE 旋转，$\Delta$ 是窗口移位。这只修正位置编码，不能让旧 key/value 自动获得新上下文；作者明确承认与完整重算存在分布差异。训练时冻结 VLM，在长度可变的真实视频窗口中先无梯度滚动 $L-1$ 步填缓存，仅最后一步更新动作专家。这里 teacher forcing 指使用日志图像推进，并不生成或执行预测动作来采集训练图像。[§3.1](https://arxiv.org/html/2608.12932v1#S3.SS1)

### 推测推理与量化边界

两层 DFlash 在一个前向中提出 8-token block，目标 VLM 并行验证，作者报告平均接受 5.6 tokens。这个接受量是性能指标，不是正确率；正确验证可以维持目标语言模型的生成分布，但整套 FlashDrive 还改变了缓存、动作头和精度，因此不能把推测解码的无损性质扩展到全部轨迹。

W4A8 用 ParoQuant 将 VLM 权重量化到 4 bit，激活使用 8 bit，调用 Marlin 路径；动作专家保持 BF16。CUDA Graph 降低重复 kernel launch，QKV 与 MLP 投影融合降低调度和访存开销。论文未给完整量化校准样本与训练优化超参数；当前仓库侧重发布推理栈。[§3.2、3.4–3.5](https://arxiv.org/html/2608.12932v1#S3.SS2)

### 协议组二：动作流保留积分步、跳过网络求值

依据 §3.3 与公开 `diffusion.py`，用 $x_i$ 表示去噪动作状态，均匀时间步仍为 8 个：

$$
x_{i+1}=x_i+(t_{i+1}-t_i)\widetilde v_i,\qquad
\widetilde v_i=\begin{cases}v_\theta(x_i,t_i),&i\notin S,\\v_{j(i)},&i\in S,\end{cases}
$$

$j(i)$ 是最近一次真正计算速度场的步。当前 `scripts/infer.py` 固定 $S=\{3,4,5,6\}$，从零编号；新求值发生在 0、1、2、7。它跳过四次动作专家前向，仍完成全部 Euler 更新，不能混成均匀的四步 solver，也不是根据每个场景在线选择步数。源码禁止跳过第 0 步，因为尚无缓存速度。[动作积分源码](https://github.com/z-lab/flashdrive/blob/main/flashdrive/diffusion.py)

### 训练与测量入口

流式微调用 4000 clips、约 60 万样本，每 clip 至多 150；drafter 用 6 万 clips 各一个窗口。评测另采 100 clips，以 10 FPS 提取每段 120 窗口，总计 12000。正文没有发布三集合的逐 clip 去重清单，本次未核验交集，也未运行训练。[§4.1](https://arxiv.org/html/2608.12932v1#S4.SS1)

发布 API 首次调用只 prefill，返回空轨迹；后续窗口才规划。当前基准脚本默认 3 个 warmup 窗口不计分/计时，计时前后做 CUDA synchronize，并输出平均、中位和 P90。因此 151.4 ms 应理解为持续运行的模型推理数字，不能代表冷启动或缓存重置后的首次有效动作。[README 与脚本](https://github.com/z-lab/flashdrive/blob/main/scripts/infer.py)

## 关键图与可视化结果

![原论文 Fig. 1：四阶段延迟及单/六候选轨迹误差](https://arxiv.org/html/2608.12932v1/teaser.png)

左侧堆叠条展示四段共同缩短；中间单轨迹 ADE 降低，右侧六候选最优 ADE 升高。读图必须同时看这两个方向，不能只引用速度和较好的误差项。[Fig. 1](https://arxiv.org/html/2608.12932v1#S0.F1)

![原论文 Fig. 2：按四相机组织旧帧、新帧与 pre-RoPE KV](https://arxiv.org/html/2608.12932v1/streaming_model.png)

灰色淘汰、橙色复用、蓝色新增；每个相机各自追加新时间帧。它解释约 75% 输入重叠的来源，并不表示所有 VLM 隐状态与完整重算严格相同。两张官方图已单独打开并核对图注，保留准确的原 URL。[Fig. 2](https://arxiv.org/html/2608.12932v1#S3.F2)

## 实验结论与证据

### 单独组件不是累积阶梯

Table 1 的 streaming、speculative、adaptive 三行都是**分别加在 system-optimized baseline 上**，不能按行相邻相减理解贡献。最后 All above 才把它们组合。

| RTX PRO 6000，单轨迹计时；Table 1 | 总时间 ↓，ms | minADE1 ↓，m | minADE6 ↓，m |
| --- | ---: | ---: | ---: |
| 原始 Alpamayo 1.5 | 716.9 | 1.705 | 0.767 |
| 仅系统优化 | 513.3 | 1.673 | 0.770 |
| 系统 + streaming | 355.8 | 1.697 | 0.791 |
| 系统 + speculative | 401.3 | 1.633 | 0.777 |
| 系统 + adaptive action cache | 450.4 | 1.536 | 0.812 |
| 系统 + 三种算法 | 176.0 | 1.563 | 0.850 |
| 再加 W4A8 | 151.4 | 1.573 | 0.844 |

minADE6 是六条未来 6.4 s 轨迹中最接近真值者的平均位移误差；计时列只生成一条，不能把六候选质量绑定到 151.4 ms。最终单候选改善 0.132 m，六候选退化 0.077 m，后者约相对增加 10.0%；把它除以 6.4 s 不会得到定位误差的安全容限。作者提出方差正则化解释，但没有独立因果验证。

### 近似误差如何修复

| 附录 Table A1(a)，同流式设置 | minADE1 ↓，m | minADE6 ↓，m |
| --- | ---: | ---: |
| 非流式参考 | 1.72 | 0.77 |
| 流式不微调 | 2.04 | 0.96 |
| 仅微调 VLM | 4.69 | 2.98 |
| 仅微调动作专家 | 1.73 | 0.79 |

该对照支持针对动作专家适配缓存误差；不能把 streaming 写成直接部署、无需训练的无损缓存。动作缓存把 system baseline 的 Action 段从 113.9 降到 47.6 ms，六候选误差 0.770→0.812 m，速度与质量需同时约束。

### 多设备和闭环代价

Table 2 中六轨迹在 RTX PRO 6000 为 2609.8→245.8 ms，才对应 10.6 倍；Jetson Thor 单轨迹为 3770.3→943.6 ms，不是 151 ms。RTX 3090/4090 的原始六轨迹 OOM，论文没有给虚构速度比。六样本量化显存约从 31.6 GB 到 18.3 GB。[Table 2、§3.4](https://arxiv.org/html/2608.12932v1#S4.T2)

AlpaSim 对 100 clips、单轨迹的 episode 事件比例中，Collision 0.19→0.15、Off Road 0.41→0.32，但 Wrong Lane 0.45→0.51；最大路径距离 20.0→22.4 m，也未全部改善。Wrong Lane 以航向偏离车道超过 120° 判定，作者指出路口处可能噪声较大。未提供重复采样或置信区间，不能由这 100 段推断真实驾驶安全不受影响。[Table 3、附录 A.3](https://arxiv.org/html/2608.12932v1#S4.T3)

该闭环每步还含轨迹优化和渲染，总时间为 1150→463 ms，约 2.5 倍；与模型级 4.7 倍属于不同计时范围。

## 应用场景与启发

作者希望让大规模 reasoning VLA 更接近在线使用。我的判断是，四段单独分析、最终端到端核对的方法可直接迁移；更值得复用的是明确哪一类近似由哪个模块适应，而非不加区分地缩短所有序列和迭代。

待验证假设：在保持相同单轨迹误差界限时，缓存周期越长越需要动作专家适配；只改 RoPE 不能消除上下文陈旧误差。可以按连续窗口数、停车/运动状态和缓存重置频率分组，检验误差是否随累计长度变化。

## 局限与阅读风险

加速叠加了新权重、随机生成、缓存近似、solver 改变和量化，不适合称为整个模型“lossless”。原文的约 6.6 Hz 是均值倒数，缺少冷启动、最坏时延以及丢帧/相机不同步条件，不构成硬实时保证。

驾驶短推理的高接受量未必迁移到长而开放的语言任务；固定跳步也可能在罕见急转或异常速度场上失效。训练成本、准确率方差、clip 划分哈希及真实车辆验证仍未给齐，不能从一次系统性能表推断广泛适用性。

## 后续跟进

### 资源与匹配验证

2026-09-12 已检查[代码仓库](https://github.com/z-lab/flashdrive)、推理脚本、配置和文件树：有 MIT 代码、`uv.lock`，README 要求 Python 3.12、CUDA 12.8、算力 8.0+ NVIDIA GPU。基础微调模型、PARO 量化模型、DFlash 草稿模型的 Hugging Face 文件树均有真实权重与配置；没有下载权重或安装环境。[模型集合](https://huggingface.co/collections/z-lab/flashdrive)

最小测试可在论文已覆盖的 RTX 4090 上固定同一组连续 clips，以 system-only 为全量重算参考，在完全相同的 streaming 配置下比较原始动作专家与已适配动作专家；分别按连续 1/8/32/120 窗口重置缓存，固定缓存容量、RoPE、精度、候选数、VLM 与解码种子，分析适配收益是否随缓存周期变化。完整方案另作系统性能对照，不用它替代上述单变量比较。记录单轨迹误差、每段延迟、启动/重置时间、峰值显存与 P90；六候选单独计时。数据需合法取得 PhysicalAI-AV 访问权限，实际下载容量与训练所需资源本次未测。

成功信号是同硬件、同采样数量和同窗口序列下，平均与尾时延均降低，且误差上界在连续长缓存及重置后仍稳定。若只在剔除大量窗口后才接近主表，或加速伴随误差随缓存时长发散，就停止扩大部署测试，先定位缓存、量化或动作步缓存；不能用不同精度/候选数量掩盖回退。本次无模型执行。

### 核验记录

固定 [FlashDrive v1](https://arxiv.org/html/2608.12932v1)，含附录 A；重点 §3.1–3.5、Tables 1–3/A1–A3 与 Figs. 1–2。StreamingLLM v1 §3.2 和 DFlash v1 §4 已读；公式是对正文操作和公开源码的简写，不冒充原文编号公式。机构按论文与项目页信息保留。
