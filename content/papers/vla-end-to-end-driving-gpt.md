---
{
  "id": "vla-end-to-end-driving-gpt",
  "revisionOf": "vla-end-to-end-driving",
  "tag": "end-to-end-autonomous-driving",
  "tags": [
    "end-to-end-autonomous-driving",
    "world-models"
  ],
  "title": "OpenDriveVLA: Towards End-to-end Autonomous Driving with Large Vision Language Action Model",
  "source": "AAAI 2026 / https://doi.org/10.1609/aaai.v40i16.38386 / arXiv:2503.23463 / https://arxiv.org/abs/2503.23463",
  "authors": [
    "Xingcheng Zhou",
    "Xuyuan Han",
    "Feng Yang",
    "Yunpu Ma",
    "Volker Tresp",
    "Alois C. Knoll"
  ],
  "affiliations": [
    "Technical University of Munich (TUM)",
    "Ludwig Maximilian University of Munich (LMU Munich)"
  ],
  "comment": "OpenDriveVLA 以层级实例 token 对齐、驾驶问答和他车运动辅助任务训练语言轨迹解码器；证据限于 nuScenes 开环，公开0.5B权重支持后续接口复核。"
}
---

## 一句话定位

OpenDriveVLA 将经 3D 感知预训练的场景、目标和地图 token 接入 Qwen2.5，再以问答、他车预测和自车轨迹依次微调；现有证据是 nuScenes 开环规划，尚无交互闭环验证。[固定全文 v2，§III–IV、补充 §VI–VIII](https://arxiv.org/html/2503.23463v2)

## 论文要解决的问题

通用图文模型不擅长精确定位道路对象，也未必理解他车运动。作者希望先让视觉特征对应具体实例及地图，再用动作监督建立空间关系，避免仅凭图像描述直接猜坐标。

## 方法和系统设计

### 视觉通路与分阶段优化

ResNet-101/FPN 提取多视图特征，BEVFormer 得到 200×200 BEV；SceneSampler 从二维特征池化全局场景，TrackQFormer 与 MapQFormer 从 BEV 提取目标和地图 token。视觉模块先按 UniAD 做检测、跟踪和全景地图分割预训练。

Stage 1 用 536k  caption 对齐：分别以双层 MLP 投影三类 token，目标 caption 还包含 BEV 坐标；只训练 projector，冻结视觉与 LLM。Stage 2 用 566k 驾驶 QA 训练 projector 与 LLM。Stage 2.5 用 459k 他车运动样本，条件于场景、地图、自车状态和被查询目标，学习未来轨迹，视觉继续冻结。Stage 3 用约 28k 自车样本联合调节 BEV/query 模块、projector 和 LLM，但二维骨干冻结。所谓交互建模主要是条件预测辅助任务，没有显式博弈求解器。

### 轨迹是文本序列

输出为 3 s 内每 0.5 s 一个点，共六个 $(x,y)$，通过文本 tokenizer 自回归生成，再解析为数值。自车规划坐标以自车为原点、x 向右、y 向前，单位 m（补充 §VI-B1）；他车预测的位移则相对被查询目标（§IV-A），两种参考系不同。按照 §III-D/E 式 4–6，条件似然的核心结构为：

$$
p(W\mid C)=\prod_{t=1}^{6}p(w_t\mid w_{<t},C),\qquad
C=(V_{\mathrm{env}},S_{\mathrm{ego}},X_{\mathrm{command}}).
$$

$V$ 为视觉 token，$S$ 包含自车状态与过去 2 s 轨迹；他车预测阶段另指定目标 token。实际一个坐标需多个文本 token，这不是六个单步控制码。推理 temperature=0，默认不展开显式 CoT；QA 训练灌输推理模式，不能当成在线推导的安全保证。轨迹解析后没有本文验证过的控制器或硬动力学约束。

### 与两项原始方法对照

[Hu 等，UniAD，2023 v2，§2](https://arxiv.org/html/2212.10156v2#S2) 用 Track/Map/Motion/Occ 查询接口把感知预测连接到规划，并以预测占据修正轨迹；OpenDriveVLA 继承感知基础，但通过语言解码坐标，没有原封不动继承占据避碰求解。[Zhou 等，AutoVLA，2025 v1，§3](https://arxiv.org/html/2506.13757v1#S3) 采用短时物理动作码本及快／慢思考 SFT、GRPO；本工作采用普通文本坐标和四阶段监督微调，未做强化后训练。

## 关键图与可视化结果

![原文 Fig. 3：四阶段训练与冻结边界](https://arxiv.org/html/2503.23463v2/sec_aaai/fig/drivevla-Training.jpg)

火焰／雪花区分更新与冻结；Stage 3 的视觉火焰不包含仍冻结的二维骨干，须结合表 VIII 理解。

![原文 Fig. 4：同一场景的前行／右转与问答](https://arxiv.org/html/2503.23463v2/sec_aaai/fig/drivevla-result_vis.jpg)

指令改变预测轨迹，属于开环反事实示例；没有真实执行或安全率统计。

## 实验结论与证据

### 两套开环度量不能混排

nuScenes 使用标准 train/val；推理效率测 6019 个验证样本。表 I 同时报告 ST-P3 与 UniAD 评测设置，以下均为各自 1/2/3 s 的平均，L2 单位 m、碰撞单位 %：

| 模型 | ST-P3 L2 ↓ | ST-P3 Collision ↓ | UniAD L2 ↓ | UniAD Collision ↓ |
| --- | --- | --- | --- | --- |
| UniAD | 0.69 | 0.12 | 1.03 | 0.31 |
| OpenDriveVLA-0.5B | 0.35 | 0.09 | 0.68 | 0.26 |
| OpenDriveVLA-3B | 0.33 | 0.10 | 0.67 | 0.30 |
| OpenDriveVLA-7B | 0.33 | 0.10 | 0.66 | 0.25 |

同一模型在两套设置差异明显；论文未在主文统一展开两套实现，不能挑一列与其他论文另一列比较。0.5B 已接近大模型，增大参数并非各碰撞指标都改善。问答在 Stage 2 后直接评估，例如 nuScenes-QA 准确率 58.4/58.5/58.2%，不代表最终规划检查点也保留全部相同 QA 能力。

### 匹配消融及状态依赖

表 V 固定 0.5B：只训 Stage 3 的 UniAD 平均 L2/碰撞为 0.70 m/0.37%；先做 Stage 1、2 为 0.68 m/0.31%，再加 Stage 2.5 为 0.68 m/0.26%。这支持辅助运动任务与碰撞代理改善相关，但不同阶段同时增加训练量，缺等更新预算的替代辅助任务对照。

表 IV 全输入为 0.68 m；去视觉为 0.77 m，去自车状态则为 1.34 m。两种移除仍有其他输入，不是无信息基线；结果提示自车状态捷径，不能将低开环误差全部归给视觉空间推理。[表 IV–V](https://arxiv.org/html/2503.23463v2#S4)

## 应用场景与启发

适合作为实例 token 与语言动作结合的基线。报告判断：最值得验证的是他车预测预训练是否改善真正交互，而不仅让解码器更熟悉坐标文本；这需要同预算训练与后续闭环，不能靠更改测试指令证明训练机制。

## 局限与阅读风险

0.5B 训练报道为 4 H100、约两天，四阶段各一 epoch，视觉预训练开销未单独列。单 A100 bf16 的 0.5B/3B/7B 时延为 1.36/1.85/1.74 s，最大显存报告 1.56/7.35/17.15 GB；处理边界和缓存开销未充分分拆，不能作为部署显存保证，也不满足通常的高频控制需求。

没有闭环验证或多 seeds 显著性，补充定性例子还承认相机方位描述错误、预测转向不合理。3D token 不能消除幻觉，文本解析成功也不等于物理可行。

[官方仓库](https://github.com/DriveVLA/OpenDriveVLA)已公开模型／推理代码、nuScenes/CAN bus/地图及 GT 缓存准备说明；[0.5B 权重](https://huggingface.co/OpenDriveVLA/OpenDriveVLA-0.5B)公开列有约 1.47 GB safetensors 和 tokenizer/config，但模型访问需登录并接受作者的 gated-access 条件（含联系方式共享）；2026-09-12 仅检查公开文件目录，未代为接受条件或下载执行。当前未见完整四阶段训练脚本、全部对齐数据或 3B/7B 发布权重，原始公开组件不能替代这些缺口。

## 后续跟进

### 先复核推理，再单独检验训练

先在获得授权模型访问后，用 0.5B 在固定 100 个 val 样本验证六点坐标解析、坐标轴、两套 metric 和实测时延；这只检验接口。要检验 Stage 2.5，则需同一个 Stage 2 检查点复制两组：一组做他车条件运动预测，另一组用等样本／等更新量的自车轨迹任务，再采用相同 Stage 3 数据、预算及 3 seeds。拟定通过条件是平均碰撞代理下降至少 0.03 个百分点且 L2 不恶化，并单列有效解析率；缺中间检查点或对齐数据就停止该训练归因实验。本次未运行模型。
