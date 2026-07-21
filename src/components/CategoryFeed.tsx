"use client";

import { useMemo, useState } from "react";
import { relativeTime, sourceColor, buildPostHtml } from "@/lib/format";

export interface FeedPost {
  id: string;
  title: string;
  url: string;
  dateLabel: string | null;
  content: string | null; // 크롤링 시점에 이미 확보된 본문(있는 경우). 없으면 복사 클릭 시 서버에서 지연 추출.
  sortTime: string; // ISO. 글이 올라온 시각(파싱된 postedAt) 우선, 없으면 firstSeenAt으로 대체
  firstSeenAt: string; // ISO
  sourceId: string;
  sourceName: string;
}

function isNew(firstSeenAtIso: string) {
  return Date.now() - new Date(firstSeenAtIso).getTime() < 1000 * 60 * 60 * 24;
}

const PAGE_SIZE = 10;

// 페이지 번호를 1 … 4 5 [6] 7 8 … 20 형태로 압축해서 보여준다.
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export default function CategoryFeed({ posts }: { posts: FeedPost[] }) {
  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) map.set(p.sourceId, p.sourceName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [posts]);

  const [selectedSourceId, setSelectedSourceId] = useState<string | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [contentCache, setContentCache] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<{ post: FeedPost; html: string } | null>(null);
  const [previewTab, setPreviewTab] = useState<"preview" | "code">("preview");

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // 클립보드 권한이 없는 환경(예: http)에서는 조용히 무시
    }
  }

  async function resolveContent(post: FeedPost): Promise<string | null> {
    if (post.content) return post.content;
    if (post.id in contentCache) return contentCache[post.id];

    setLoadingKey(`${post.id}:html`);
    try {
      const res = await fetch(`/api/posts/${post.id}/content`);
      const data = await res.json().catch(() => ({}));
      const content: string | null = data.content ?? null;
      setContentCache((c) => ({ ...c, [post.id]: content }));
      return content;
    } catch {
      return null;
    } finally {
      setLoadingKey(null);
    }
  }

  async function openHtmlPreview(post: FeedPost) {
    const content = await resolveContent(post);
    setPreviewTab("preview");
    setPreview({ post, html: buildPostHtml({ ...post, content }) });
  }

  function selectSource(id: string | "all") {
    setSelectedSourceId(id);
    setPage(1);
  }

  function selectSort(order: "newest" | "oldest") {
    setSortOrder(order);
    setPage(1);
  }

  const visiblePosts = useMemo(() => {
    const filtered =
      selectedSourceId === "all" ? posts : posts.filter((p) => p.sourceId === selectedSourceId);

    return [...filtered].sort((a, b) => {
      const diff = new Date(a.sortTime).getTime() - new Date(b.sortTime).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });
  }, [posts, selectedSourceId, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(visiblePosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPosts = visiblePosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (sources.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => selectSource("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedSourceId === "all"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            전체
          </button>
          {sources.map((s) => {
            const color = sourceColor(s.id);
            const isActive = selectedSourceId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => selectSource(s.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                {s.name}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
            <path
              d="M7 12h10M4 6h16M10 18h4"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <select
            value={sortOrder}
            onChange={(e) => selectSort(e.target.value as "newest" | "oldest")}
            className="cursor-pointer rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-medium text-neutral-600 outline-none focus:border-brand-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>
      </div>

      {visiblePosts.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          해당 조건의 게시물이 없습니다.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {pagedPosts.map((post) => {
          const color = sourceColor(post.sourceId);
          const titleCopied = copiedKey === `${post.id}:title`;

          return (
            <li key={post.id}>
              <div className="group flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-sm shadow-sm transition-all hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium text-neutral-900 group-hover:text-brand-600 dark:text-neutral-100 dark:group-hover:text-brand-400">
                    {post.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${color.bg} ${color.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                      {post.sourceName}
                    </span>
                    {post.dateLabel && <span>{post.dateLabel}</span>}
                    <span className="text-neutral-400">· {relativeTime(post.sortTime)}</span>
                    {isNew(post.firstSeenAt) && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-semibold text-red-600 dark:bg-red-950 dark:text-red-400">
                        NEW
                      </span>
                    )}
                  </div>
                </a>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copy(post.title, `${post.id}:title`)}
                    title="제목 복사"
                    className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      titleCopied
                        ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "border-neutral-200 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {titleCopied ? (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
                        <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth={1.8} fill="none" />
                        <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">{titleCopied ? "복사됨" : "제목"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openHtmlPreview(post)}
                    disabled={loadingKey === `${post.id}:html`}
                    title="HTML 미리보기 (게시판 붙여넣기용 본문 확인 후 복사)"
                    className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    {loadingKey === `${post.id}:html` ? (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin">
                        <path d="M21 12a9 9 0 11-9-9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
                        <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">HTML</span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
            aria-label="이전 페이지"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>

          {pageNumbers(currentPage, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-neutral-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-8 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  p === currentPage
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800"
            aria-label="다음 페이지"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <p className="min-w-0 truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {preview.post.title}
              </p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="shrink-0 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="닫기"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>

            <div className="flex gap-1 px-4 pt-2">
              {(["preview", "code"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPreviewTab(tab)}
                  className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    previewTab === tab
                      ? "border border-b-0 border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                      : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  }`}
                >
                  {tab === "preview" ? "미리보기" : "코드"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto border-t border-neutral-200 p-4 dark:border-neutral-800">
              {previewTab === "preview" ? (
                <div
                  className="text-sm leading-relaxed text-neutral-700 [&_a]:text-brand-600 [&_a]:underline [&_img]:max-w-full [&_p]:mb-2 dark:text-neutral-300 dark:[&_a]:text-brand-400"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap break-all rounded-lg bg-neutral-100 p-3 text-xs text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  {preview.html}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => copy(preview.html, `${preview.post.id}:html`)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  copiedKey === `${preview.post.id}:html`
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                }`}
              >
                {copiedKey === `${preview.post.id}:html` ? "복사됨" : "복사하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
