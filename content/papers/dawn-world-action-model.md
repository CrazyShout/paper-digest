---
{
  "id": "dawn-world-action-model",
  "tag": "world-models",
  "tags": [
    "world-models",
    "end-to-end-autonomous-driving"
  ],
  "title": "The DAWN of World-Action Interactive Models",
  "source": "arXiv:2605.11550 / https://arxiv.org/abs/2605.11550 / Fixed full text: https://arxiv.org/html/2605.11550v1 / Project: https://cowarobot-ai.github.io/DAWN/ / Code: https://github.com/COOWAI/DAWN",
  "authors": [
    "Hongbo Lu",
    "Liang Yao",
    "Chenghao He",
    "Haoyu Wang",
    "Xiang Gu",
    "Xianfei Li",
    "Wenlong Liao",
    "Tao He",
    "Pai Peng"
  ],
  "affiliations": [
    "COWARobot Co., Ltd.",
    "Shanghai Jiao Tong University",
    "Hohai University"
  ],
  "comment": "DAWN 在推理中交替更新潜在未来与动作假设，用同一去噪器提出和修正轨迹。收益需要与迭代成本一起读：NAVSIM v1 有提升，v2 总分仍低于较强基线，且主结果采用完整四秒世界展开。"
}
---

## 一句话定位

DAWN 让预测的未来参与动作去噪，再让动作反过来改变未来预测。世界模型推理在特征空间展开，不渲染未来 RGB。

- 核心证据：低分辨率消融中，未来预测器的 PDMS 为 85.2，增加双向互动后为 87.9。[表 3](https://arxiv.org/html/2605.11550v1#S3.T3)
- 主要边界：主结果采用 4 s 世界/4 s 动作时域；“更短未来足够”的依据是 2–3 s 消融，不能混用配置。

## 论文要解决的问题

### 世界与动作是否真的互相更新

一次性预测未来再规划，会把未来假设固定住。DAWN 希望在同一历史下，先提出轨迹，查询该轨迹下的未来，再利用这个未来修正轨迹；迭代可能提高动作与未来的一致性，但不自动保证物理正确或数值收敛。

### 相关工作与差异

| 一手工作 | 原有机制 | DAWN 的接口变化 |
| --- | --- | --- |
| Wang 等，[Drive-JEPA v1 §3](https://arxiv.org/html/2601.22032v1#S3)，2026 预印本 | V-JEPA 预训练后接规划器；完整版还蒸馏模拟器多轨迹并做动量感知选择 | 将潜在未来预测显式保留在推理互动中；其 89.0 的简化版与 93.3 的完整版不能混为一个基线 |
| Zhang 等，[Epona v1 §3](https://arxiv.org/html/2506.24113v1#S3)，ICCV 2025 | 时空主干后分别用 TrajDiT 规划、VisDiT 生成下一帧，后者以动作条件化 | DAWN 反复更新未来特征和动作，避免逐轮像素解码；未承担同等视频生成任务 |

## 方法和系统设计

### 输入、表征与输出

输入为相机历史和自车状态/路线等条件。附录实现观察四帧、2 Hz，主实验裁剪至 512×256，消融为 256×256。V-JEPA 2 Large 提取密集特征，Auto-Encoder Resampler 压为 16 个 token；训练专用 EMA teacher 从真实未来得到目标特征，部署时移除。

12 层因果 World Predictor 根据历史特征、条件和当前动作预测未来；共享的 DiT 去噪器以不同 query 区分首次提案和后续修正，动作头输出间隔 0.5 s 的位姿序列。主文没有完整展开位置/朝向坐标变换；公开转换器保留 ego-to-global 位姿、自车系速度/加速度，复现应与数据适配器对齐，不能把导航命令理解为网络自行从图像推断。

### 递归更新与监督

原式 11–13 的关键计算为：

$$
a^{(0)}=G_\phi(q_{\rm init},c,z),\quad
z_f^{(k+1)}=P_\theta(z,c,a^{(k)}),\quad
a^{(k+1)}=G_\phi(q_{\rm ref}^{(k)},c,z_f^{(k+1)},a^{(k)}),\quad
\hat\tau=H_{\rm act}(a^{(K)}).
$$

$z$ 是观测压缩特征，$c$ 是非视觉条件，$a$ 是动作假设，$z_f$ 是预测未来。首次提案可以绕过 Predictor，随后 $P/G$ 交替工作。未来真实帧只通过 teacher 提供训练目标。[§2.2–2.4](https://arxiv.org/html/2605.11550v1#S2)

训练分视频预训练、resampler、世界预测、世界/动作联合四阶段。算法 1 用预测特征与 teacher 目标的距离监督世界分支；附录规划目标含分类、回归、速度和朝向，后两项权重为 0.5，未完整给出所有损失细节和阶段冻结配置。训练使用 80 张 A100、150 epoch、峰值学习率 $10^{-4}$、8 epoch warmup。推理六个轨迹模式、每次五步 DPM-Solver++，默认四轮互动；采样步数与互动轮数是两层循环。[附录 §9.2](https://arxiv.org/html/2605.11550v1#S9)

## 关键图与可视化结果

![原论文图 2：训练 teacher 与推理世界/动作循环](https://arxiv.org/html/2605.11550v1/overview_.png)

先看上方真实未来只进入 teacher，再看下方红色反馈箭头。未来帧是监督标签，不是规划时额外相机输入；初始化绕过预测器的细节以式 11 为准。[图 2](https://arxiv.org/html/2605.11550v1#S2.F2)

![原论文图 4：五类场景中的人类、Drive-JEPA 与 DAWN 轨迹](https://arxiv.org/html/2605.11550v1/Vis_cropped.png)

上排图像、下排 BEV；绿线人类、黄线 Drive-JEPA、红线 DAWN。局部贴合道路仅是精选定性证据，未展示车辆执行后的他车响应。[图 4](https://arxiv.org/html/2605.11550v1#S3.F4)

## 实验结论与证据

### 协议与主结果

nuScenes 为开放环轨迹误差/碰撞评测；NAVSIM 是日志场景上的模拟规则评分，PDMS/EPDMS 综合碰撞、可行驶区域、进度、舒适等指标。论文未给可确认的 NAVSIM v2 evaluator 提交或 human-penalty 开关，跨论文比较必须固定这些版本。

| 原表与设置 | 本文结果 | 对照及边界 |
| --- | --- | --- |
| 表 1，NAVSIM v1 | PDMS 89.1 | Drive-JEPA 简化版 89.0；不同方法训练流程不等价 |
| 表 2，nuScenes，1/2/3 s 平均 | L2 0.33 m，碰撞 0.11% | WorldRFT 0.47 m/0.15%；没有同预算重训对照 |
| 表 7，NAVSIM v2 | EPDMS 83.2 | Drive-JEPA 87.8；DAC 92.0 对 98.6，不能概括为全部基准领先 |

### 互动收益与计算代价

256×256 下，仅 resampler 为 82.8，加入 Predictor 为 85.2，再互动为 87.9；移除世界→动作或动作→世界后为 81.6/84.9。四轮得 87.9，六轮降至 86.9，增加迭代并非单调更好。[表 3、5、9](https://arxiv.org/html/2605.11550v1#S10.T9)

固定 4 s 动作时域，世界展开 0/2/4 s 的 PDMS 为 82.8/87.3/87.9，时延为 331.253/690.540/1067.975 ms。短展开保留大部分收益，但主配置更慢；计时设备和 batch 未明确，不能直接宣称实时。16→64 token 的时延 331.253→963.645 ms 约为 2.91 倍，非附录声称的“超过三倍”。[表 4、6](https://arxiv.org/html/2605.11550v1#S3.T6)

## 应用场景与启发

- 作者主张：双向世界/动作推断比固定未来假设更有规划价值。
- 我的判断：值得借鉴循环接口，真实交互收益仍需单独验证。
- 待验证假设：按两轮间的轨迹变化自适应停止，可保留四轮的规划收益并减少简单场景延迟。

## 局限与阅读风险

作者承认潜变量不易解释、长时交互不足和数据覆盖限制。附录的 12 个未来目标帧与主文 4 s rollout 的映射未说明；部分 C/TTC 表头次序也不一致，聚合分数之外须回到配置核对。缺少多种子区间，不应将 0.1 PDMS 优势写为稳定领先。

## 后续跟进

### 最小验证与停止条件

- 资源（2026-09-12）：[官方仓库](https://github.com/COOWAI/DAWN)有 nuScenes 推理/评测、配置和转换器，README 列出预训练与推理网盘权重，本次未验证下载；完整 NAVSIM 训练链未确认。
- 发布转换器从整段累计 yaw 推导命令，GT 框过滤路障/锥桶；这些是任务条件和评测口径，需要核对 GT 仅参与评价，不能宣传为完全无标注部署。
- 最小实验：固定模型、六模式、五步采样、最多四轮，比较固定四轮与基于轨迹变化的提前停止；停止阈值仅在验证集选择，报告分场景 PDMS、DAC、碰撞和 p95 时延。
- 成功信号：简单场景更快且危险场景无实质退步；若提前停止增加越界/碰撞，取消该策略，先改善停止判据。

### 来源与核验记录

2026-09-12 读取 arXiv:2605.11550v1 全文、附录 §7–11、算法 1–2、表 1–10；PDF 首页核验作者单位，逐张打开原图 2/4。相关工作读取 Drive-JEPA v1、Epona v1 自身方法；资源状态独立记录，不以目录存在推断复现成功。
