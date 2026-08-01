import { lazy } from "react";
import { RootProvider } from "fumadocs-ui/provider/astro";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle
} from "fumadocs-ui/layouts/notebook/page";
import DigestNotes from "./DigestNotes.jsx";

const StaticSearchDialog = lazy(() => import("./StaticSearchDialog.jsx"));

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
  children
}) {
  return (
    <RootProvider
      pathname={pathname}
      params={params}
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
        tree={tree}
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
            text: "Ideas",
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
          toc={toc}
          breadcrumb={{ enabled: true }}
          footer={{ enabled: true }}
          tableOfContent={{ enabled: toc.length > 0, style: "clerk" }}
        >
          {eyebrow ? <p className="doc-eyebrow">{eyebrow}</p> : null}
          <DocsTitle>{title}</DocsTitle>
          <DocsDescription>{description}</DocsDescription>
          <DocsBody>
            {children}
            {notes ? <DigestNotes {...notes} /> : null}
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}
