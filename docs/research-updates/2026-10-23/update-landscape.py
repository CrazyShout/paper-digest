import json
import subprocess
from pathlib import Path

p = Path('content/research-landscape.json')
d = json.loads(p.read_text())
d.update(updatedAt='2026-10-23', analysisWindowIssues=5, title='十月下旬阅读线索：动作依赖、失效归因与评价区域',
         summary='最近五期的工作把问题具体化到信息如何改变动作、失败如何归因、场景表征如何评分。未有新报告的方向保留近期证据；候选课题的真实评审状态仍见 Idea 中心。')
trends = {
    'testing-as-common-language': ('同场景干预检验信息是否影响动作', 'Cartender 交换可行指令，感知—动作耦合诊断改变视觉、历史状态与制动约束；Language2Drive 提供成对行为评价。', '分别检查指令响应、危险响应和过度停车；使用真值障碍的诊断与自动门控要单列。', ['autonomous-driving-testing', 'end-to-end-autonomous-driving'], ['cartender-counterfactual-language-driving', 'perception-action-binding-gap', 'language2drive-paired-instruction-evaluation']),
    'world-models-become-instruments': ('世界模型服务适配与候选评价', 'PIA 混合仿真先验与实车数据修正动力学；DA-WAM 在潜在未来上评价候选轨迹，两者依赖的监督和验证对象不同。', '分别检查适配中的安全违规和候选排序收益。单赛道实车、NAVSIM评价与闭环驾驶指标不能相互替代。', ['world-models'], ['pia-simulation-prior-racing-adaptation', 'da-wam-decision-aligned-world-model']),
    'e2e-bottleneck-shifts': ('闭环训练收益需要固定输入和骨干比较', 'DriveMLP 在固定对象级规划网络上比较训练目标；TacitVLA 则分离推理监督与本次文本生成。', '对象级真值、传感器输入和特权教师不是同一条件；推理变快也可能伴随更多训练成本。', ['end-to-end-autonomous-driving', 'autonomous-driving-testing'], ['drivemlp-expert-guided-closed-loop', 'tacitvla-reasoning-supervision']),
    'agentic-driving-grounded': ('测试智能体用执行反馈修订场景', 'LAST-V2X 将语言解析、检索、场景执行与反思修订串联；AutoAgent0 在驾驶任务中验证并恢复动作。', '场景生成智能体与车端策略分开评价；LAST-V2X 的大规模参数搜索仍采用简化后端。', ['agentic-driving', 'autonomous-driving-testing'], ['last-v2x-communication-failure-testing', 'autoagent0-runtime-recovery']),
    'v2x-systemization': ('通信异常需要连接到实际安全后果', 'LAST-V2X 对照消息驱动车与真值影子车，SIGN-MAPPO 则分开状态、意图与执行仲裁。', '消息变旧、消息错误和参与者没有消息是不同失效机制；影子车不影响背景交通，归因限于该对照。', ['cooperative-autonomous-driving', 'autonomous-driving-testing'], ['last-v2x-communication-failure-testing', 'sign-mappo-imperfect-v2x']),
    'radar-representation-from-measurement-to-state': ('雷达流式评价要固定扇区和标签来源', 'StreamRPS 使用旋转FMCW雷达的极坐标结构，提供手工标签校验；RadarGSOcc 使用4D成像雷达张量，两者输入不同。', '网络扇区吞吐不等于传感器更新率；切分stuff区域可能抬高PQ，伪标签与手工测试分数也应分列。', ['radar-occupancy-representation', 'dynamic-scene-representation'], ['streamrps-streaming-radar-panoptic', 'radargsocc-doppler-semantic-occupancy']),
}
for row in d['trends']:
    if row['id'] in trends:
        title, evidence, judgement, tags, ids = trends[row['id']]
        row.update(title=title, evidence=evidence, judgement=judgement, tags=tags, evidencePaperIds=ids)
d['hotspots'][0].update(title='完整实例与可见表面如何共同评价', evidence='PanoBench 对历史可见的物体评价完整实例，体素与射线指标可能给出不同排名；Foundation4D 的多任务组合也有占据和深度退步。', whyItMatters='固定可见性掩码、历史帧数和分辨率，才能区分重建更完整、表面更准确与实例分离更好。', tags=['dynamic-scene-representation', '3d-reconstruction'], evidencePaperIds=['panobench-panoptic-occupancy-benchmark', 'foundation4d-unified-perception-reconstruction'])
d['hotspots'][1].update(title='固定模型后检查危险信息的动作作用', evidence='Perceives but Doesn’t Brake 用匹配危险场景检查纵向轨迹依赖，再将制动约束加入固定采样器。', whyItMatters='真值约束下可以制动，仍不代表自动门控能跨域识别何时应制动；需要同时测清空场景的误触发。', tags=['autonomous-driving-testing', 'end-to-end-autonomous-driving'], evidencePaperIds=['perception-action-binding-gap', 'cartender-counterfactual-language-driving'])
directions = {
    'cooperative-autonomous-driving': ('通信失效归因', 'LAST-V2X 用配对信息条件筛查通信致险，接续 SIGN-MAPPO 的状态与意图分流。', '当前通信参数和应用逻辑仍是仿真简化；大规模搜索结果需在完整后端和测得链路上复验。', ['last-v2x-communication-failure-testing', 'sign-mappo-imperfect-v2x', 'cooperscene-cv2x-benchmark']),
    'agentic-driving': ('执行反馈与修订', 'LAST-V2X 的检索、执行诊断和反思用于测试场景；AutoAgent0 的反馈用于任务恢复。', '任务完成、场景可执行和故障归因是不同终点，不能用统一的agent成功率概括。', ['last-v2x-communication-failure-testing', 'autoagent0-runtime-recovery', 'ad-memo-language-driving-memory']),
    '3d-reconstruction': ('统一任务的取舍', 'Foundation4D 将几何、检测、占据和高斯重建放在共享视频骨干下；统一训练的收益按任务变化。', '公开基准专门微调与统一模型需分开，长距离细结构、遮挡跟踪和H100窗口推理成本仍限制使用。', ['foundation4d-unified-perception-reconstruction', 'instant-nurec-feedforward-3dgs']),
    'dynamic-scene-representation': ('实例与评价区域', 'PanoBench 用时间可见性和实例完整性重新定义评价区域，Foundation4D 给出任务组合对照。', '真实物体网格是重建/生成标注，不能视为逐体素物理测量；体素、射线和实例指标需要同时报告。', ['panobench-panoptic-occupancy-benchmark', 'foundation4d-unified-perception-reconstruction', 'infraworld-roadside-occupancy-forecasting']),
    'autonomous-driving-testing': ('配对条件与归因', 'LAST-V2X 比较信息条件，Cartender 比较同场景指令，感知—动作诊断比较输入和制动约束。', '影子交通、日志评价与闭环重建各有边界；真值几何诊断不能替代自动门控的跨域验证。', ['last-v2x-communication-failure-testing', 'perception-action-binding-gap', 'cartender-counterfactual-language-driving']),
    'end-to-end-autonomous-driving': ('监督与动作响应', 'Cartender 用同场景关系学习语言控制；DriveMLP 用对象级状态比较闭环训练；危险耦合诊断检查信息是否真正进入动作。', '兼容门控会损失可行请求执行，低维规划器不能直接代表相机策略，自动危险读出仍有跨域失败。', ['cartender-counterfactual-language-driving', 'drivemlp-expert-guided-closed-loop', 'perception-action-binding-gap']),
    'world-models': ('真实适配的数据条件', 'PIA 用仿真先验初始化赛车世界模型，再以逐步积累的真实轨迹修正动力学。', '已知目标赛道几何与未见几何泛化分开；少量真实数据的预算需包含初始采集和前序适配。', ['pia-simulation-prior-racing-adaptation', 'da-wam-decision-aligned-world-model', 'more-motion-oriented-registers']),
    'radar-occupancy-representation': ('流式极坐标语义', 'StreamRPS 针对旋转雷达设计扇区网络和LiDAR补全标签；与RadarGSOcc的成像雷达张量路线形成输入层面的对照。', '小目标精度、人工标签覆盖和扇区PQ偏差仍需检查；四扇区421.9 FPS只是网络吞吐。', ['streamrps-streaming-radar-panoptic', 'radargsocc-doppler-semantic-occupancy']),
    'lidar-anomaly-segmentation': ('任务协议对照', '本轮专项arXiv查询成功，站外补查到既有COVAL；未核实窗口内足以形成新报告的STU相关进展。', '继续对齐未知语义、几何障碍、全流误报、少点数实例和阈值来源；本期未收录不构成领域停滞的证据。', ['trio-trimodal-anything-perception', 'ndp-lidar-distribution-prior', 'lido-lidar-anomaly-segmentation']),
}
for row in d['directions']:
    if row['tag'] in directions:
        signal, focus, gap, ids = directions[row['tag']]
        row.update(signal=signal, focus=focus, gap=gap, evidencePaperIds=ids)
d['hotspots'][2].update(evidence='AutoAgent0 的运行时验证与恢复增加模型调用；TrackFlood 从另一侧测量跟踪关联和持久轨迹池的计算开销。', whyItMatters='恢复动作与计算压力属于不同路径，需记录各自的耗时、触发条件及任务后果。', evidencePaperIds=['autoagent0-runtime-recovery', 'trackflood-nms-free-tracker-latency'])
d['opportunities'][2].update(whyNow='AutoAgent0 的验证与恢复需要额外模型调用，TrackFlood 则展示跟踪状态带来的计算负担。两类工作尚未共同验证超时回退策略，可先记录结果可用时间和实际控制后果。', evidencePaperIds=['autoagent0-runtime-recovery', 'trackflood-nms-free-tracker-latency', 'denial-of-deadline-inference', 'deployed-vil-cooperative-perception'])
d['opportunities'][3].update(whyNow='Comfortably Stuck 和 Metric Validity 在固定模型下展示执行与计分实现会改变结论。模型升级实验应先冻结这些接口，再研究表征变化造成的兼容问题。', evidencePaperIds=['comfortably-stuck-bench2drive-protocol', 'metric-validity-driving-execution', 'policy-stitching-e2e-driving', 's2-vla-semantic-spatial'])
for row in d['directions']:
    if row['tag']=='lidar-anomaly-segmentation':
        row['focus']='专项arXiv查询成功，站外补查到既有COVAL，未确认窗口内新报告。继续用TriO、NDP与LIDO对齐几何障碍和未知语义协议。'
        row['evidencePaperIds']=['trio-trimodal-anything-perception', 'ndp-lidar-distribution-prior', 'lido-lidar-anomaly-segmentation']
# Retain the latest in-scope anomaly evidence instead of relabeling a new
# occupancy benchmark as anomaly detection merely to populate a rolling window.
before=json.loads(subprocess.check_output(['git','show','f1fd1e68c76cc72298aa47d3a950e85f40941c17:content/research-landscape.json'],text=True))
d['trends'][6]=before['trends'][6]
d['hotspots'][3]=before['hotspots'][3]
d['opportunities'][8]=before['opportunities'][8]
p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n')
