# 首轮部署发现的时区修正

首轮提交 `a76e966` 的 Pages 工作流成功。线上 42 项资源比对中，仅 Idea 页面未匹配：`formatDate` 将日期补为 `+08:00` 午夜，却让 `Intl.DateTimeFormat` 使用构建机器默认时区，导致 UTC 构建显示前一天。其他页面、搜索 JSON/gzip、原图和 CSS 已匹配；邮件尚未发送。

修正仅为现有日期格式化显式设置 `timeZone: "Asia/Shanghai"`，不改变 Idea 内容、来源日期或审阅状态。使用 `TZ=UTC GITHUB_ACTIONS=true npm run build` 重建 192 页后，Idea HTML 与原先正确的本地 +08:00 输出在只归一化 Astro island UID 后完全一致。全套测试再次为 285 通过、7 跳过、0 失败。独立增量复核与第二次部署仍绑定新的最终提交。
