export const HOME_DESCRIPTION = "记录近期论文与研究进展，按方向找到值得细读的内容。";

export function readingNavigationTree(tree, pathname) {
  const current = String(pathname).replace(/\/+$/, "") || "/";
  const matches = (url) => typeof url === "string" && (url.replace(/\/+$/, "") || "/") === current;
  function visit(node) {
    const children = (node.children || []).map(visit);
    const active = matches(node.url) || matches(node.index?.url) || children.some((child) => child.active);
    return {
      active,
      node: {
        ...node,
        ...(node.children ? { children: children.map((child) => child.node) } : {}),
        ...(node.type === "folder" ? { defaultOpen: active } : {})
      }
    };
  }
  return visit(tree).node;
}

// Fumadocs translation keys include their UI context, not just the English text.
export const READING_TRANSLATIONS = {
  "Search(search trigger)": "搜索",
  "Search(search dialog)": "搜索论文、作者、机构、关键词",
  "Open Search(search trigger)(aria-label)": "打开搜索",
  "Close Search(search dialog)(aria-label)": "关闭搜索",
  "No results found(search dialog)": "没有匹配内容",
  "On this page(table of contents)": "本页目录",
  "No Headings(table of contents)": "暂无目录",
  "Previous Page(pagination)": "上一篇",
  "Next Page(pagination)": "下一篇",
  "Open Sidebar(sidebar)(aria-label)": "展开导航",
  "Close Sidebar(sidebar)(aria-label)": "收起导航",
  "Close Sidebar(aria-label)": "收起导航",
  "Collapse Sidebar(sidebar)(aria-label)": "收起导航",
  "Hide Sidebar(sidebar)": "收起导航",
  "Show Sidebar(sidebar)": "展开导航",
  "Toggle Menu(mobile menu)(aria-label)": "切换菜单",
  "Light(theme switcher)(aria-label)": "浅色",
  "Dark(theme switcher)(aria-label)": "深色",
  "System(theme switcher)(aria-label)": "跟随系统",
  "Toggle Theme(theme switcher)(aria-label)": "切换外观"
};
