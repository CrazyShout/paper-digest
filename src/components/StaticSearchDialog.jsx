import { useEffect, useMemo, useState } from "react";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay
} from "fumadocs-ui/components/dialog/search";

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN");
}

export default function StaticSearchDialog({
  sourceUrl,
  open,
  onOpenChange
}) {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || records.length || !sourceUrl) return;
    const controller = new AbortController();
    setIsLoading(true);

    fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setRecords([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [open, records.length, sourceUrl]);

  const items = useMemo(() => {
    const query = normalize(search).trim();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = records.filter((record) => {
      if (!terms.length) return record.featured;
      const haystack = normalize([
        record.title,
        record.description,
        record.content,
        ...(record.breadcrumbs || [])
      ].join(" "));
      return terms.every((term) => haystack.includes(term));
    });

    return matches.slice(0, 18).map((record) => ({
      id: record.id,
      url: record.url,
      type: "page",
      content: record.title,
      breadcrumbs: record.breadcrumbs
    }));
  }, [records, search]);

  return (
    <SearchDialog
      open={open}
      onOpenChange={onOpenChange}
      search={search}
      onSearchChange={setSearch}
      isLoading={isLoading}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput
            aria-label="搜索论文、简报、综述和 Idea"
            placeholder="搜索论文、作者、机构、关键词"
          />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={items}
          Empty={() => (
            <p className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
              {isLoading ? "正在加载全库索引…" : "没有匹配内容"}
            </p>
          )}
        />
      </SearchDialogContent>
    </SearchDialog>
  );
}
