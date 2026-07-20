"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import NavBar from "@/components/NavBar";
import { sourceColor } from "@/lib/format";

interface Category {
  id: string;
  name: string;
}

interface SourceItem {
  id: string;
  name: string;
  url: string;
  type: "GENERIC_LINKS" | "KAGGLE_API";
  linkPattern: string | null;
  isActive: boolean;
  lastCrawledAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastFoundCount: number;
  categoryId: string;
  category: Category;
}

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-800";
const labelClass = "mb-1 block text-xs font-medium text-neutral-500";
const ghostBtn =
  "rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

function StatusDot({ status }: { status: string | null }) {
  if (!status) return <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />;
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${status === "success" ? "bg-emerald-500" : "bg-red-500"}`}
    />
  );
}

export default function AdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [crawlingId, setCrawlingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");

  const [form, setForm] = useState({
    name: "",
    url: "",
    categoryId: "",
    type: "GENERIC_LINKS" as "GENERIC_LINKS" | "KAGGLE_API",
    linkPattern: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, srcRes] = await Promise.all([fetch("/api/categories"), fetch("/api/sources")]);
    const cats = await catRes.json();
    const srcs = await srcRes.json();
    setCategories(cats);
    setSources(srcs);
    if (!form.categoryId && cats[0]) {
      setForm((f) => ({ ...f, categoryId: cats[0].id }));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      setNewCategoryName("");
      load();
    }
  }

  async function addSource(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFormError(data.error ?? "추가에 실패했습니다.");
      return;
    }
    setForm((f) => ({ ...f, name: "", url: "", linkPattern: "" }));
    load();
  }

  async function toggleActive(source: SourceItem) {
    await fetch(`/api/sources/${source.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !source.isActive }),
    });
    load();
  }

  async function deleteSource(source: SourceItem) {
    if (!confirm(`"${source.name}" 링크를 삭제할까요? 수집된 게시물도 함께 삭제됩니다.`)) return;
    await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    load();
  }

  async function crawlNow(source: SourceItem) {
    setCrawlingId(source.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/sources/${source.id}/crawl`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ text: `"${source.name}" 크롤링 완료: ${data.foundCount}건 발견 (신규 ${data.newCount}건)`, ok: true });
      } else {
        setMessage({ text: `"${source.name}" 크롤링 실패: ${data.error ?? "알 수 없는 오류"}`, ok: false });
      }
    } finally {
      setCrawlingId(null);
      load();
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <NavBar active="admin" />

      {message && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">카테고리</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <span
              key={c.id}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              {c.name}
            </span>
          ))}
        </div>
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="새 카테고리 이름 (예: 자격증)"
            className={`${inputClass} flex-1`}
          />
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            추가
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">링크 추가</h2>
        <form onSubmit={addSource} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>카테고리</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>목록 페이지 URL</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/list"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>타입</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as "GENERIC_LINKS" | "KAGGLE_API" })}
              className={inputClass}
            >
              <option value="GENERIC_LINKS">일반 (목록 페이지 + 링크 정규식)</option>
              <option value="KAGGLE_API">Kaggle API 전용</option>
            </select>
          </div>

          {form.type === "GENERIC_LINKS" && (
            <div>
              <label className={labelClass}>상세글 링크 정규식 (예: /Recruit/GI_Read/\d+)</label>
              <input
                value={form.linkPattern}
                onChange={(e) => setForm({ ...form, linkPattern: e.target.value })}
                placeholder="href 안에서 상세 게시물 링크를 찾는 정규식"
                className={`${inputClass} font-mono`}
                required
              />
            </div>
          )}

          {formError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          <button className="self-start rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
            링크 추가
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">등록된 링크</h2>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-900" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sources.map((source) => {
              const color = sourceColor(source.id);
              return (
                <li
                  key={source.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-neutral-900 dark:text-neutral-100">
                      <span className={`h-2 w-2 rounded-full ${color.dot}`} />
                      {source.name}
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal text-neutral-500 dark:bg-neutral-800">
                        {source.category.name}
                      </span>
                      {!source.isActive && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal text-neutral-500 dark:bg-neutral-700">
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => crawlNow(source)} disabled={crawlingId === source.id} className={ghostBtn}>
                        {crawlingId === source.id ? "크롤링 중..." : "지금 크롤링"}
                      </button>
                      <button onClick={() => toggleActive(source)} className={ghostBtn}>
                        {source.isActive ? "비활성화" : "활성화"}
                      </button>
                      <button
                        onClick={() => deleteSource(source)}
                        className={`${ghostBtn} border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40`}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-xs text-neutral-500 hover:text-brand-600 hover:underline dark:hover:text-brand-400"
                  >
                    {source.url}
                  </a>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                    <StatusDot status={source.lastStatus} />
                    {source.lastCrawledAt ? (
                      <span>
                        {new Date(source.lastCrawledAt).toLocaleString("ko-KR")} ·{" "}
                        {source.lastStatus === "success" ? `성공 (${source.lastFoundCount}건)` : `실패 - ${source.lastError}`}
                      </span>
                    ) : (
                      <span>아직 크롤링한 적 없음</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
