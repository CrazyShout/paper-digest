import json
from pathlib import Path

p = Path('content/research-landscape.json')
d = json.loads(p.read_text())
d.update(updatedAt='2026-10-28', analysisWindowIssues=5,
         title='十月末阅读线索：未知物体、观测依赖与可执行修复',
         summary='最近五期的证据涉及指令和观测如何影响动作、未知物体如何评价，以及失败场景如何用于训练。新数据集与修复方法都需要固定输入、阈值和计算条件比较。')
trends = {
    'testing-as-common-language': ('从失败诊断到训练与预警', '规划器代理生成针对特定规划头的训练场景；SRP 从冻结策略内部表示提前读出风险。', '检测到障碍、预测到风险与成功避险是三个终点；比较训练后的碰撞率，也要测固定阈值下的事件覆盖和误报。', ['autonomous-driving-testing', 'end-to-end-autonomous-driving'], ['planner-surrogate-safety-critical-training', 'srp-structured-risk-anticipation', 'perception-action-binding-gap']),
    'world-models-become-instruments': ('统一表示需要匹配预算比较', 'DriveUniTok 在同样584个token下比较统一与分流表示；PIA 则检验仿真先验对真实动力学适配的作用。', '重建质量、候选轨迹评价与物理适配需要分别验证。NAVSIM非反应评分不能替代实车闭环。', ['world-models'], ['driveunitok-unified-world-action-latent', 'pia-simulation-prior-racing-adaptation', 'da-wam-decision-aligned-world-model']),
    'e2e-bottleneck-shifts': ('规划训练数据要匹配模型失效', '模型特定代理从固定规划头生成攻击场景，并为其求解可行逃逸标签；DriveMLP 提供训练目标的另一类对照。', '训练收益依赖场景和标签，代理仍会漏掉真实规划器的失败。需要独立评价场景与未参与搜索的模型。', ['end-to-end-autonomous-driving', 'autonomous-driving-testing'], ['planner-surrogate-safety-critical-training', 'drivemlp-expert-guided-closed-loop']),
    'agentic-driving-grounded': ('多个假设怎样影响实际动作', 'DriveMind 保留多个场景解释并随观测更新权重，再让扩散控制器读取加权表示。', '权重不是校准概率；增加假设数也改变初始动作覆盖，闭环收益需与计算预算和局部退步一起读。', ['agentic-driving', 'end-to-end-autonomous-driving'], ['drivemind-multi-hypothesis-belief', 'ad-memo-language-driving-memory', 'autoagent0-runtime-recovery']),
    'v2x-systemization': ('对象外的观测也会改变协同收益', 'AWCR 在对象内点不变时删除外部点，观察协同检测何时失效，再用当前观测修复候选。', '原特征替换是诊断对照；部署修复会引入新错，且真实实现集中访问双方点云。应同时记录恢复与保留。', ['cooperative-autonomous-driving', 'autonomous-driving-testing'], ['awcr-weather-context-cooperative-repair', 'last-v2x-communication-failure-testing', 'sign-mappo-imperfect-v2x']),
    'radar-representation-from-measurement-to-state': ('从运动几何追到雷达信号', 'AuRaSim 将命中点局部速度和多径传播转为ADC信号，与真实RD图比较；StreamRPS 则研究旋转雷达的语义输出。', '归一化信号相似度不等于绝对功率校准或下游任务提升；仿真帧耗时与感知网络吞吐也要分开。', ['radar-occupancy-representation'], ['aurasim-dynamic-fmcw-radar-simulation', 'streamrps-streaming-radar-panoptic', 'radargsocc-doppler-semantic-occupancy']),
    'unknown-objects-and-protocols': ('未知物体检出要同时保留已知语义', 'DriveOSS 保留19类已知语义并单列未知物体；开放集预测在OOD验证集标定阈值后评价测试集。', 'AP、测试集FPR95和固定验证阈值下的open-IoU回答不同问题；公开脚本的范围与帧过滤还会改变样本总体。', ['lidar-anomaly-segmentation', 'autonomous-driving-testing'], ['driveoss-open-set-anomaly-benchmark', 'stu-road-anomaly-dataset', 'lido-lidar-anomaly-segmentation'])
}
for row in d['trends']:
    if row['id'] in trends:
        title, evidence, judgement, tags, ids = trends[row['id']]
        row.update(title=title, evidence=evidence, judgement=judgement, tags=tags, evidencePaperIds=ids)
d['hotspots'][1].update(title='风险预警的固定阈值迁移', evidence='SRP 同时报告目标集合上的诊断工作点和固定源验证阈值；DriveOSS 也把排序指标与验证阈值下的开放集预测分开。', whyItMatters='评价新路线或新天气时，先固定阈值再测误报与事件覆盖，才能判断部署后的告警负担。', tags=['autonomous-driving-testing', 'lidar-anomaly-segmentation'], evidencePaperIds=['srp-structured-risk-anticipation', 'driveoss-open-set-anomaly-benchmark'])
d['hotspots'][3].update(title='跨场景异常与已知类别退步', evidence='DriveOSS 的ID和OOD场景地理分离，测试同时包含未知障碍和已知类别的分布变化；融合收益随架构和评分方式变化。', whyItMatters='需把未知检出、已知类别误拒和环境迁移分开统计，再判断增加图像信息是否有用。', evidencePaperIds=['driveoss-open-set-anomaly-benchmark', 'stu-road-anomaly-dataset'])
updates = {
    'cooperative-autonomous-driving': ('上下文干扰与修复', 'AWCR 把天气相关外部观测变化与对象表示损坏连接起来，并比较当前测量支持的候选修复。', '自然天气结果来自固定站点的开发数据；修复损失与集中点云访问尚需在独立站点和实际通信预算下验证。', ['awcr-weather-context-cooperative-repair', 'last-v2x-communication-failure-testing', 'cooperscene-cv2x-benchmark']),
    'agentic-driving': ('多假设持续更新', 'DriveMind 用跨帧假设更新、证据评分和重采样连接语言解释与控制。', '分布权重未校准；动作词表、初始化覆盖和异步时延都可能影响结果，需要固定预算对照。', ['drivemind-multi-hypothesis-belief', 'autoagent0-runtime-recovery', 'ad-memo-language-driving-memory']),
    '3d-reconstruction': ('挡风玻璃反射分离', 'RIDE-Splat 将相机附着的反射与世界坐标中的场景分别优化，提供真实与合成反射评价。', '真实参考来自另一次采集，时空匹配近似；论文模型、公开默认配置和发布数据的处理差异需逐项对齐。', ['ride-splat-windshield-reflection-removal', 'foundation4d-unified-perception-reconstruction']),
    'autonomous-driving-testing': ('定向训练与事件预警', '规划器代理减少昂贵渲染搜索，SRP 从冻结策略内部表示读出即将发生的失败。', '两者目前主要提供仿真证据；代理覆盖、告警阈值和实际接管后的后果仍需单独验证。', ['planner-surrogate-safety-critical-training', 'srp-structured-risk-anticipation', 'awcr-weather-context-cooperative-repair']),
    'end-to-end-autonomous-driving': ('内部表示与规划头的用途', 'DriveMind 为轨迹生成提供持续更新的假设，规划器代理为训练构造失败，SRP 为现有策略增加监测读出。', '三种方法分别改变控制条件、训练数据和告警接口，不能用一个综合分数比较其系统收益。', ['drivemind-multi-hypothesis-belief', 'planner-surrogate-safety-critical-training', 'srp-structured-risk-anticipation']),
    'world-models': ('多模态统一token', 'DriveUniTok 共享编码RGB、投影深度和ego状态，以同预算对照连接重建、未来预测与轨迹评分。', '冻结tokenizer仍有较大模型成本；传感器、奖励后训练及非反应评价条件需与比较对象对齐。', ['driveunitok-unified-world-action-latent', 'pia-simulation-prior-racing-adaptation', 'da-wam-decision-aligned-world-model']),
    'radar-occupancy-representation': ('动态ADC信号仿真', 'AuRaSim 使用路径复系数和命中点局部速度生成雷达信号，支持多普勒与阵列建模消融。', '三段数字孪生验证与归一化RD相似度尚不足以说明广域场景或下游占据收益；逐帧射线追踪仍为离线成本。', ['aurasim-dynamic-fmcw-radar-simulation', 'streamrps-streaming-radar-panoptic', 'radargsocc-doppler-semantic-occupancy']),
    'lidar-anomaly-segmentation': ('开放集语义与误报', 'DriveOSS 新增带19类已知语义的道路异常基准，可以与STU、LIDO对齐未知物体定义、阈值来源和误拒代价。', '数据与权重尚待完整公开；公开代码的距离和少异常点帧过滤需与完整序列评价区分，时序方法还需验证。', ['driveoss-open-set-anomaly-benchmark', 'stu-road-anomaly-dataset', 'lido-lidar-anomaly-segmentation'])
}
for row in d['directions']:
    if row['tag'] in updates:
        signal, focus, gap, ids = updates[row['tag']]
        row.update(signal=signal, focus=focus, gap=gap, evidencePaperIds=ids)
d['opportunities'][8].update(whyNow='DriveOSS 把未知检测与已知语义放在同一评价中，但单帧基线和公开脚本的筛选总体仍留下完整序列验证空间。可以先对齐STU与DriveOSS的标签、距离范围、帧过滤和阈值来源，再研究时序证据是否减少误报。', evidencePaperIds=['driveoss-open-set-anomaly-benchmark', 'stu-road-anomaly-dataset', 'ndp-lidar-distribution-prior', 'lido-lidar-anomaly-segmentation'])
p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n')
idea = Path('content/idea-center.json')
data = json.loads(idea.read_text())
data['updatedAt'] = '2026-10-28'
idea.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
