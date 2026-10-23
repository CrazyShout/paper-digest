# 2026-10-23 检索、写作与复核记录

本期承接 2026-10-18，公告窗口为 10 月 19–23 日，提交查询重叠至 10 月 16 日。执行时间和来源限制保存在原始检索记录中。

- `arxiv-retrieval.json`：六目录完整分页与上期差分、十方向查询、385 个有摘要的召回候选；下载不计阅读。
- `source-retrieval.json`：正式源、官方项目、Semantic Scholar 与 OpenAlex 的查询、原始出现和规范 ID；含非论文与过期记录，不能把实体数当相关论文数。
- `selection-reading-ledger.json`、`selection-aliases.json`、`selection-summary.json`：独立筛选者的实际阅读范围、身份归并与八篇首次报告。正式台账在 `content/digest-audits/2026-10-23.json`。
- `version-updates.json`、`external-primary-evidence.json`、`selector-primary-checks.json`：DA-WAM 与 Comfortably Stuck 的版本变化、CooperScene 的建档/发表日期区别，以及补查旧文的边界。
- `author-*.json`：作者所读方法、表格、相关一手来源、资源状态、实际打开的官方图片和初稿指纹。
- `review-*.json`：未参与撰写者的语义、数字和图片复核，包含未通过发现及修正。属于同模型家族交叉复核，不是实验复现或外部同行评审。
- `local-corpus-evidence.json`、`prompts/`、`maintenance-scope.json`：十个方向重跑当前本库查询，保留原站外检索及实质复核日期。研究态势观察最近五期；Idea 仅同步页面日期，候选、分数和判定未改。
- `final-bindings.json`、验证与浏览器记录：最终复核文件的指纹及发布前检查。测试中等待独立复核的历史失败与最终运行分开保存。

原始 HTML/PDF、按节提取和请求回执保存在本地临时检索目录；公开清单保存实际来源 URL、参数及哈希，不将本机缓存等同于长期可下载资产。完整订阅信息和邮件回执存于忽略目录或加密记录，不进入本目录。

Pages 成功后，现有通知工作流核验同一提交的线上产物，再通过内容指纹账本决定是否发送。旧简报固定版本未改，本轮只产生一份新期通知。

终端日志仅去除行末空格，保留命令输出与退出结果；原始字节副本留在本地发布记录中。
