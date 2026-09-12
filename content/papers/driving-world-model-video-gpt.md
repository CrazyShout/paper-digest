---
{
  "id": "driving-world-model-video-gpt",
  "revisionOf": "driving-world-model-video",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving"
  ],
  "title": "DrivingWorld: Constructing World Model for Autonomous Driving via Video GPT",
  "source": "ICPR 2026 / Springer online 2026-08-04, citation year 2027 / https://doi.org/10.1007/978-3-032-31583-0_19 / arXiv:2412.19505 / https://arxiv.org/abs/2412.19505 / Fixed full text: https://arxiv.org/html/2412.19505v3",
  "authors": [
    "Xiaotao Hu",
    "Mingkai Jia",
    "Xiaoyang Guo",
    "Qian Zhang",
    "Xiao-xiao Long",
    "Wei Yin"
  ],
  "affiliations": [
    "The Hong Kong University of Science and Technology",
    "Horizon Robotics",
    "Nanjing University"
  ],
  "comment": "DrivingWorld 用分解时空注意力和模态平衡，让视频 GPT 同时预测前视图像与自车位姿。v3 的长时样例存在帧率冲突，训练依赖大量私有视频，开放环规划结果需与生成质量分开阅读。"
}
---

## 一句话定位

DrivingWorld 将视频和自车相对位姿离散化，用跨帧时间建模加帧内 token 自回归预测未来。重点是控制信号在大量图像 token 中如何保留，以及长序列误差如何累积。

- 核心证据：nuScenes 上经过该库微调的版本 FID/FVD 为 6.5/86.0，未见该库训练的版本为 7.4/90.9，不能混为同一设置。[表 1](https://arxiv.org/html/2412.19505v3#S3.T1)
- 主要边界：训练有 3,336 小时私有视频；视频观感和开放环轨迹指标不等于闭环驾驶能力。

## 论文要解决的问题

### 为什么拆开时间与空间

每帧有 512 个图像 token，却只有朝向、位置两个控制 token。直接将全序列展开，图像会稀释控制信息，注意力开销也随历史长度增长。作者以按位置跨时间、按时间跨模态的两步交互缓解这一问题。

### 相关工作与差异

| 一手工作 | 原有机制 | DrivingWorld 的变化 |
| --- | --- | --- |
| Hu 等，[GAIA-1 v1 §2](https://arxiv.org/html/2309.17080v1#S2)，2023 预印本 | 图像、文本、速度/曲率 token 输入 AR 模型，再由视频扩散解码器渲染和时间超分 | 本文联合预测位姿和图像，以分解注意力与时序 VQ 解码工作，不依赖同等文本接口 |
| Gao 等，[Vista v1 §3](https://arxiv.org/html/2405.17398v1#S3)，NeurIPS 2024 | 潜变量视频扩散，历史替换及动作交叉注意力支持多种控制 | 本文按离散 token 生成，并直接输出位姿；表格中的训练数据和是否微调仍不同 |

## 方法和系统设计

### 输入、坐标与预测顺序

输入最近 15 帧前视 RGB、位置和朝向。坐标以 ego 为中心，图 2 的 x 沿车前、y 向左；采用相邻时间步的相对位移/转角，首步置零，避免全局坐标不断增大。位置的两个轴分别分桶，再合为一个位置 token；朝向为另一个 token。图像编码器在 VQ 前后加入因果时间注意力，码本含 16,384 项。

跨帧模块先在同一 token 位置做因果时间注意力，再在同一时刻融合不同位置和模态。帧内模块依次生成朝向、位置及图像 token；可用用户给定轨迹替换位姿控制。最后查码本并解码成图像/相对位姿，再将预测反馈到下一步。未来真实帧仅作训练目标，不属于自由滚动的输入。[§3.1–3.4](https://arxiv.org/html/2412.19505v3#S3)

### 平衡注意力与训练目标

原式 5 对注意力 logit 增加模态相关偏置：

$$
\hat z_i=z_i+\frac{1}{m n_j},\qquad
w_i=\frac{\exp(\hat z_i)}{\sum_k\exp(\hat z_k)}.
$$

$i$ 属于模态 $j$，$n_j$ 为该模态 token 数，$m$ 为模态数；少 token 的位姿得到更大的每项偏置。这不保证生成动作符合动力学。

原式 6 的图像 token 交叉熵为：

$$
\mathcal L_{\rm WM}=-\sum_{t,i}\log p(q_t^i\mid\mathbf q_{<t},q_t^{j<i},\phi_{\le t},v_{\le t}).
$$

$q$ 是图像 token，$\phi,v$ 是朝向/位置 token。训练可用因果掩码并行计算已知前缀，推理仍有自回归依赖。RMS 以 0.5 概率启用随机掩码，被掩项再以 0.3 概率随机替换，以暴露错误历史。原文未在式 6 单列位姿损失。

### 训练成本与实现边界

70M tokenizer 用 32 张 4090、batch 128、100 万步训练；损失为 Charbonnier、感知和码本项。1B 世界模型用 64 张 A100、batch 64、45 万步、12 天训练，视频共 3,456 小时（nuPlan 120 小时，其余私有），再于 nuScenes 微调一天。主文未给完整 optimizer/学习率及阶段间冻结清单；不能用公开 demo 代替训练可复现性。[§4.1](https://arxiv.org/html/2412.19505v3#S4.SS1)

## 关键图与可视化结果

![原论文图 2：位姿/视频分词、两个 AR 模块及解码](https://arxiv.org/html/2412.19505v3/pipeline.png)

先看左右的 ego 坐标和输入输出，再看中间时间模块、帧内模块。图中包含位姿预测，不是仅把预定轨迹渲染成视频。[图 2](https://arxiv.org/html/2412.19505v3#S2.F2)

![原论文图 7：编号到 640 帧的长序列样例](https://arxiv.org/html/2412.19505v3/long_term.png)

红字是帧号。图注写 640 帧、5 Hz、128 s，§4.3 却写 10 Hz、64 s；表 1 另列 400 帧/40 s。三处不可合成一个无歧义“最大时长”，本报告保留冲突。精选帧也不能量化全程漂移。[图 7](https://arxiv.org/html/2412.19505v3#S3.F7)

## 实验结论与证据

### 质量与规划分开评价

视频评测使用 nuPlan 200 个、nuScenes 150 个片段；FID 衡量图像分布差异，FVD 衡量视频特征分布差异，均越低越好。表 1 比较遵循 Vista 的等长生成设置，最长展示长度不是计算 FVD 的统一长度。

| 表 1，nuScenes 视频评测 | FID ↓ | FVD ↓ | 训练边界 |
| --- | ---: | ---: | --- |
| Vista | 6.9 | 89.4 | 见过 nuScenes，采用不同训练流程 |
| DrivingWorld | 6.5 | 86.0 | 有 nuScenes 微调 |
| DrivingWorld 零样本 | 7.4 | 90.9 | 未用 nuScenes 训练 |

表 3 本文平均轨迹 L2 为 1.26 m、碰撞率 0.38%，只输入前相机，但“无辅助监督”不代表未用真实位姿，也不能与环视、不同标注预算的方法等条件排名。没有车辆真实执行或可反应他车闭环测试。

### 消融与成本缺口

表 2 同为 nuPlan 重建，Llama-Gen 微调版 → 本文 tokenizer 的 FVD12 为 20.33→14.66，PSNR 22.71→23.82 dB。表 4 的 FVD40：无 BA/RMS 665.15，仅 RMS 361.94，仅 BA 324.58，完整 159.46；支持两者互补，但没有种子方差，FVD 下标口径不应擅自换算成秒。图 9 只比较显存/FLOPs趋势，主文未给完整生成吞吐，不能声称实时。[表 2–4](https://arxiv.org/html/2412.19505v3#S4.T4)

## 应用场景与启发

- 作者主张：以时空分解和稀疏控制增强长序列生成。
- 我的判断：适合研究离散视频表示与动作敏感性；规模收益受私有数据约束。
- 待验证假设：按模态数分配的偏置可以在相同 token 数和训练预算下改善动作敏感性，而非只改善视频观感。

## 局限与阅读风险

相机单视角、私有数据、离线规划与时长冲突限制外推。另有可复现性错误：v3 PDF 第 9 页式 7 的 $\Delta y$ 逆量化项不能正确反解式 1；[公开 tokenizer 代码](https://github.com/YvanYin/DrivingWorld/blob/main/modules/tokenizers/pose_tokenizer.py)使用独立 x/y 索引、区间裁剪与桶中心偏移。不能把排版公式直接当可执行算法，也不能默认早期代码完全匹配 v3。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[官方 GitHub](https://github.com/YvanYin/DrivingWorld)有推理、配置和部分预处理，训练和完整评价仍在 TODO；[HF](https://huggingface.co/huxiaotaostasy/DrivingWorld)列出 `vqvae.pt`、`world_model.pth`、demo 与验证清单。未下载权重，未确认与 v3 全部结果的对应；私有训练视频未公开。
- 前置条件：固定代码/权重、分桶边界、坐标和真实采样率，先检验位姿编码再解码误差。
- 最小实验：固定 tokenizer、数据、历史、训练步数及采样种子，做 BA 开/关 × RMS 开/关；同一历史施加左右/直行控制，报告轨迹响应、视频分布分数和逐时漂移。
- 成功信号：BA 改善控制响应且不增加长时漂移；若仅 FVD 改善、画面不随动作改变，停止可控性结论，先检查位姿量化和注意力接口。

### 来源与核验记录

依据 arXiv:2412.19505v3 全文、式 1–7、表 1–4、图 2/7；逐张打开两图并查看 PDF 式 7。相关方法读取 GAIA-1 v1 与 Vista v1。Springer 页面确认六位作者、ICPR 2026、2026-08-04 上线，标准引用年份为 2027；旧 GitHub 八作者署名不覆盖此版。未进行实验复现。
