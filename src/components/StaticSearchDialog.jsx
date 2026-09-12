import { useEffect, useMemo, useRef, useState } from "react";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogList,
  SearchDialogOverlay
} from "fumadocs-ui/components/dialog/search";
import { prepareSearchRecords, SEARCH_KINDS, searchRecords } from "../lib/search.js";
import { loadSearchIndex } from "../lib/search-index-client.js";

const PAGE_SIZE = 18;

export default function StaticSearchDialog({ sourceUrl, open, onOpenChange }) {
  const cache = useRef(new Map());
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open || !sourceUrl) return;
    if (cache.current.has(sourceUrl)) {
      setRecords(cache.current.get(sourceUrl));
      setIsLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    let active = true;
    setRecords([]);
    setError("");
    setIsLoading(true);

    loadSearchIndex(sourceUrl, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const prepared = prepareSearchRecords(data);
        cache.current.set(sourceUrl, prepared);
        setRecords(prepared);
      })
      .catch((error) => {
        if (active && error.name !== "AbortError") setError("搜索索引加载失败，请重试。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, sourceUrl, retry]);

  const matches = useMemo(() => searchRecords(records, search, kind), [records, search, kind]);
  const items = useMemo(() => matches.slice(0, limit).map((record) => ({
    id: record.id,
    url: record.url,
    type: "page",
    content: record.title,
    breadcrumbs: record.breadcrumbs
  })), [matches, limit]);

  function changeSearch(value) {
    setSearch(value);
    setLimit(PAGE_SIZE);
  }

  return (
    <SearchDialog open={open} onOpenChange={onOpenChange} search={search}
      onSearchChange={changeSearch} isLoading={isLoading}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <input className="notebook-search-input" value={search}
            onChange={(event) => changeSearch(event.target.value)}
            aria-label="搜索论文、简报、综述和 Idea" placeholder="搜索论文、作者、机构、关键词" />
          <SearchDialogClose />
        </SearchDialogHeader>
        <div className="notebook-search-filters" role="group" aria-label="搜索类型">
          {SEARCH_KINDS.map((item) => (
            <button key={item.id} type="button" aria-pressed={kind === item.id}
              onClick={() => { setKind(item.id); setLimit(PAGE_SIZE); }}>
              {item.label}
            </button>
          ))}
        </div>
        {error ? (
          <div className="notebook-search-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>重试</button>
          </div>
        ) : (
          <SearchDialogList items={items} Empty={() => (
            <p className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
              {isLoading ? "正在加载全库索引…" : "没有匹配内容"}
            </p>
          )} />
        )}
        {!error && !isLoading && (
          <SearchDialogFooter>
            <span role="status" aria-live="polite">显示 {items.length} / {matches.length} 条</span>
            {matches.length > limit && (
              <button className="notebook-search-more" type="button"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}>查看更多结果</button>
            )}
          </SearchDialogFooter>
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
