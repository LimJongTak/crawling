"use client";

import { useState } from "react";
import CategoryFeed, { FeedPost } from "./CategoryFeed";

export interface CategoryData {
  id: string;
  name: string;
  hasSources: boolean;
  posts: FeedPost[];
}

const ICONS: Record<number, JSX.Element> = {
  0: (
    <path
      d="M8 21h8M12 17v4M7 4h10v3a5 5 0 01-5 5 5 5 0 01-5-5V4zM7 5H4a2 2 0 002 2M17 5h3a2 2 0 01-2 2"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
  1: (
    <path
      d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M5 8h14a1 1 0 011 1v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a1 1 0 011-1zM3 13h18"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  ),
};

export default function CategoryTabs({ categories }: { categories: CategoryData[] }) {
  const [activeId, setActiveId] = useState(categories[0]?.id);
  const activeIndex = categories.findIndex((c) => c.id === activeId);
  const active = categories[activeIndex] ?? categories[0];

  return (
    <div>
      <div className="mb-7 flex flex-wrap gap-2">
        {categories.map((c, i) => {
          const isActive = c.id === active?.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                  : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
                {ICONS[i % 2]}
              </svg>
              {c.name}
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isActive ? "bg-white/20" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                }`}
              >
                {c.posts.length}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <section key={active.id} className="animate-fade-in">
          {!active.hasSources && (
            <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
              등록된 링크가 없습니다. 관리 페이지에서 링크를 추가해보세요.
            </div>
          )}

          {active.hasSources && active.posts.length === 0 && (
            <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
              아직 크롤링된 정보가 없습니다. 관리 페이지에서 수동 크롤링을 실행해보세요.
            </div>
          )}

          <CategoryFeed posts={active.posts} />
        </section>
      )}
    </div>
  );
}
