"use client";

import { useMemo, useState } from "react";
import { relativeTime, sourceColor } from "@/lib/format";

export interface FeedPost {
  id: string;
  title: string;
  url: string;
  dateLabel: string | null;
  sortTime: string; // ISO. 글이 올라온 시각(파싱된 postedAt) 우선, 없으면 firstSeenAt으로 대체
  firstSeenAt: string; // ISO
  sourceId: string;
  sourceName: string;
}

function isNew(firstSeenAtIso: string) {
  return Date.now() - new Date(firstSeenAtIso).getTime() < 1000 * 60 * 60 * 24;
}

export default function CategoryFeed({ posts }: { posts: FeedPost[] }) {
  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) map.set(p.sourceId, p.sourceName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [posts]);

  const [selectedSourceId, setSelectedSourceId] = useState<string | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const visiblePosts = useMemo(() => {
    const filtered =
      selectedSourceId === "all" ? posts : posts.filter((p) => p.sourceId === selectedSourceId);

    return [...filtered].sort((a, b) => {
      const diff = new Date(a.sortTime).getTime() - new Date(b.sortTime).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });
  }, [posts, selectedSourceId, sortOrder]);

  if (sources.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedSourceId("all")}
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
                onClick={() => setSelectedSourceId(s.id)}
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
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
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
        {visiblePosts.map((post) => {
          const color = sourceColor(post.sourceId);
          return (
            <li key={post.id}>
              <a
                href={post.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              >
                <div className="min-w-0">
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
                </div>
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300 transition-colors group-hover:text-brand-500 dark:text-neutral-700"
                >
                  <path
                    d="M7 17L17 7M9 7h8v8"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
