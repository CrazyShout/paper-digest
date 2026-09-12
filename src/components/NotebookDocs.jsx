import { lazy, useId, useMemo, useState } from "react";
import { RootProvider } from "fumadocs-ui/provider/astro";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsPage,
  DocsTitle
} from "fumadocs-ui/layouts/notebook/page";
import DigestNotes from "./DigestNotes.jsx";
import { readingNavigationTree, READING_TRANSLATIONS } from "../lib/reading-ui.js";

const StaticSearchDialog = lazy(() => import("./StaticSearchDialog.jsx"));

function ReadingDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  if (!text) return null;
  const collapsible = text.length > 180;
  return (
    <div className="doc-description">
      <p id={id} className={`doc-description-copy${collapsible && !expanded ? " is-collapsed" : ""}`}>
        {text}
      </p>
      {collapsible && (
        <button type="button" className="doc-description-toggle" aria-controls={id}
          aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收起摘要" : "展开完整摘要"}
        </button>
      )}
    </div>
  );
}

export default function NotebookDocs({
  tree,
  pathname,
  params,
  title,
  description,
  eyebrow,
  toc = [],
  searchUrl,
  notes,
  homeUrl = "/",
  showFooter = true,
  children
}) {
  const readingTree = useMemo(() => readingNavigationTree(tree, pathname), [tree, pathname]);
  return (
    <RootProvider
      pathname={pathname}
      params={params}
      i18n={{ locale: "zh-CN", translations: READING_TRANSLATIONS }}
      search={{
        preload: false,
        SearchDialog: StaticSearchDialog,
        options: { sourceUrl: searchUrl }
      }}
      theme={{
        attribute: "class",
        defaultTheme: "light",
        enableSystem: true
      }}
    >
      <DocsLayout
        tree={readingTree}
        nav={{
          title: "Paper Digest",
          url: homeUrl,
          mode: "auto"
        }}
        links={[
          {
            text: "综述",
            url: `${homeUrl}reviews/`,
            active: "nested-url"
          },
          {
            text: "研究想法",
            url: `${homeUrl}ideas/`,
            active: "url"
          }
        ]}
        sidebar={{
          collapsible: true
        }}
        themeSwitch={{
          enabled: true,
          mode: "light-dark-system"
        }}
        searchToggle={{ enabled: true }}
      >
        <DocsPage
          className="reading-document"
          toc={toc}
          breadcrumb={{ enabled: true }}
          footer={{ enabled: showFooter }}
          tableOfContent={{ enabled: toc.length > 0, style: "clerk" }}
        >
          {eyebrow ? <p className="doc-eyebrow">{eyebrow}</p> : null}
          <DocsTitle className="doc-title">{title}</DocsTitle>
          <ReadingDescription key={pathname} text={description} />
          <DocsBody>
            {children}
            {notes ? <DigestNotes {...notes} /> : null}
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}
