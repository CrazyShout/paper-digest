# 同步补充的外部近邻

父流程于 2026-11-06 对在线 4D 地图、LiDAR 时序异常及雷达运动信息补查。以下来源提供具体近邻，不是对候选的否定判决；生成和查新时应据机制比较差分。

- [PersistGS](https://arxiv.org/html/2606.03479)：将物体高斯和碰撞网格分开，从遮挡前轨迹估计摩擦与速度，利用可微刚体仿真维持完全遮挡期间的位置。已打开摘要和方法概述；目前读到的实验是合成场景及留出相机。通用“用物理保持遮挡对象”已有具体工作。
- [Multi4D](https://arxiv.org/html/2606.22197)：静态结构、持续动态几何与瞬态外观三层共享渲染器并竞争解释残差，含持久高斯上的 4D 分割。已打开摘要及方法章节结构。分层生命周期构思需要比较它的容量分配机制，不能把三种基元名称本身当作新意。
- [Geometry-Aware Online Mapping](https://arxiv.org/html/2608.14902)：在 Photo-SLAM 建图线程中调整增密、尺度初始化和透明度保持。已读引言与方法概述；该文说明在线有限迭代预算下初始化与容量管理有研究价值。
- [DGOMapping](https://pmc.ncbi.nlm.nih.gov/articles/PMC13306729/)：正式 Sensors 2026 论文，DOI 10.3390/s26123871，研究异步多主体 4DGS 的不确定性耦合、perception-score 交换与长期记忆调整。已打开正式全文的摘要与引言，数值和方法细节仍需进一步核对。

此外，10 月 GS 系统综述已有 [Pattern Recognition 正式出版入口](https://www.sciencedirect.com/science/article/pii/S0031320326020832)，需与 arXiv:2610.17513 对照作者和 DOI 后决定引用格式。
