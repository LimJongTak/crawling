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
  type: "GENERIC_LINKS" | "KAGGLE_API" | "DAKER_API";
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
  const [crawlingAll, setCrawlingAll] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const [form, setForm] = useState({
    name: "",
    url: "",
    categoryId: "",
    type: "GENERIC_LINKS" as "GENERIC_LINKS" | "KAGGLE_API" | "DAKER_API",
    linkPattern: "",
    contentSelector: "",
    closedSelector: "",
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
    setForm((f) => ({ ...f, name: "", url: "", linkPattern: "", contentSelector: "", closedSelector: "" }));
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

  async function crawlAllNow() {
    setCrawlingAll(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sources/crawl-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const results: { ok: boolean; foundCount: number; newCount: number }[] = data.results ?? [];
        const successCount = results.filter((r) => r.ok).length;
        const newTotal = results.reduce((sum, r) => sum + r.newCount, 0);
        setMessage({
          text: `전체 크롤링 완료: ${successCount}/${results.length}개 소스 성공, 신규 ${newTotal}건`,
          ok: results.every((r) => r.ok),
        });
      } else {
        setMessage({ text: `전체 크롤링 실패: ${data.error ?? "알 수 없는 오류"}`, ok: false });
      }
    } finally {
      setCrawlingAll(false);
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">링크 추가</h2>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={1.8} fill="none" />
              <path
                d="M9.5 9.2a2.5 2.5 0 014.9.8c0 1.7-2.4 2-2.4 3.5M12 17h.01"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            {showHelp ? "설명 닫기" : "작성 방법"}
          </button>
        </div>

        {showHelp && (
          <div className="mb-5 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-400">
            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">이름</p>
              <p>관리 화면과 대시보드에 표시될 이 링크의 이름. 원하는 대로 자유롭게 입력하면 됩니다.</p>
              <p className="mt-1 text-neutral-400">예: 잡코리아 AI·개발·데이터 TOP100</p>
            </div>

            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">카테고리</p>
              <p>이 링크가 어느 분류(경진대회/해커톤, 취업 관련 기타 등)에 속할지 선택합니다. 원하는 카테고리가 없으면 위쪽 "카테고리" 섹션에서 먼저 만들어주세요.</p>
            </div>

            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">목록 페이지 URL</p>
              <p>크롤링할 게시판/목록 페이지의 전체 주소. 로그인 없이 접속 가능한 공개 페이지여야 합니다.</p>
              <p className="mt-1">
                주의: 리액트/뷰 등으로 완전히 그려지는 SPA 사이트(예: 캐글, 데이커)는 페이지 소스를 봐도 목록 내용이 안 보여서 이 방식으로는 못 가져옵니다. 그런 사이트는 대신 아래 "타입"에서 전용 API를 고르거나, 별도 어댑터가 필요합니다.
              </p>
            </div>

            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">타입</p>
              <p>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">일반</span>: 목록 페이지 HTML을 그대로 가져와서 아래 정규식으로 상세글 링크를 찾는 범용 방식. 공지사항, 채용공고 게시판처럼 대부분의 사이트에 사용합니다.
              </p>
              <p className="mt-1">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">Kaggle API 전용 / DAKER API 전용</span>: 이미 만들어둔 특정 사이트 전용 크롤러입니다. 목록 URL·정규식을 몰라도 되고, 이미 등록돼 있어서 새로 추가할 일은 거의 없습니다.
              </p>
            </div>

            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">
                상세글 링크 정규식 <span className="font-normal text-neutral-400">("일반" 타입 필수)</span>
              </p>
              <p>
                목록 페이지 안의 여러 {"<a href=\"...\">"} 중에서 "상세 게시글로 연결되는 링크"만 골라내는 정규식입니다.
                브라우저에서 목록 페이지를 열고 게시글 제목을 마우스 우클릭 → "검사(Inspect)"를 눌러 그 링크의 href가 어떤 규칙(숫자 ID, 고정 경로 등)을 갖는지 확인한 뒤, 그 규칙만 정규식으로 적으면 됩니다.
              </p>
              <div className="mt-2 flex flex-col gap-1 rounded-lg bg-white p-2 font-mono text-[11px] dark:bg-neutral-900">
                <span>데이콘: ^/competitions/official/\d+</span>
                <span>잡코리아: /Recruit/GI_Read/\d+</span>
                <span>순천대: selectNttInfo\.do\?nttSn=\d+</span>
              </div>
            </div>

            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">
                본문 셀렉터 <span className="font-normal text-neutral-400">(선택)</span>
              </p>
              <p>
                게시물의 "HTML 복사" 버튼을 눌렀을 때, 상세 페이지의 본문 전체를 가져오고 싶다면 그 본문이 들어있는 HTML 요소를 가리키는 CSS 셀렉터를 적습니다.
                상세글 하나를 열어 본문 영역을 우클릭 → 검사 → 감싸고 있는 태그의 class나 id를 확인해서 <code className="rounded bg-white px-1 dark:bg-neutral-900">태그.클래스명</code> 형태로 입력하면 됩니다.
              </p>
              <p className="mt-1">비워두면 본문 대신 페이지의 요약 메타 정보(og:description 등)로 자동 대체되고, 그마저 없으면 링크만 복사됩니다.</p>
              <div className="mt-2 flex flex-col gap-1 rounded-lg bg-white p-2 font-mono text-[11px] dark:bg-neutral-900">
                <span>순천대: td.dragable</span>
              </div>
            </div>

            <div>
              <p className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">
                마감 표시 셀렉터 <span className="font-normal text-neutral-400">(선택)</span>
              </p>
              <p>
                목록 페이지에 이미 마감/종료된 것도 함께 섞여 나오는 사이트라면, "마감됨"을 나타내는 배지나 아이콘을 가리키는 CSS 셀렉터를 적어주세요.
                크롤링할 때 그 카드/행 안에 이 셀렉터에 걸리는 요소가 있으면 그 글은 통째로 건너뛰어서, 모집 기간이 지난 글은 애초에 저장하지 않습니다.
              </p>
              <p className="mt-1">
                예를 들어 데이콘 목록 페이지는 마감된 대회에 <code className="rounded bg-white px-1 dark:bg-neutral-900">{'<img alt="non participating">'}</code> 아이콘이 붙어서 나오는데, 이 속성을 셀렉터로 지정하면 그 대회만 제외됩니다.
                비워두면 목록에 나오는 건 전부 가져옵니다(사이트 자체가 이미 모집중인 것만 보여준다면 굳이 안 넣어도 됩니다).
              </p>
              <div className="mt-2 flex flex-col gap-1 rounded-lg bg-white p-2 font-mono text-[11px] dark:bg-neutral-900">
                <span>데이콘: img[alt=&quot;non participating&quot;]</span>
              </div>
            </div>
          </div>
        )}

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
              onChange={(e) => setForm({ ...form, type: e.target.value as "GENERIC_LINKS" | "KAGGLE_API" | "DAKER_API" })}
              className={inputClass}
            >
              <option value="GENERIC_LINKS">일반 (목록 페이지 + 링크 정규식)</option>
              <option value="KAGGLE_API">Kaggle API 전용</option>
              <option value="DAKER_API">DAKER(데이콘 해커톤) API 전용</option>
            </select>
          </div>

          {form.type === "GENERIC_LINKS" && (
            <>
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
              <div>
                <label className={labelClass}>본문 셀렉터 (선택, 예: td.dragable)</label>
                <input
                  value={form.contentSelector}
                  onChange={(e) => setForm({ ...form, contentSelector: e.target.value })}
                  placeholder="상세 페이지에서 본문 영역을 가리키는 CSS 셀렉터 - &quot;HTML 복사&quot;에 사용됨"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className={labelClass}>마감 표시 셀렉터 (선택, 예: img[alt=&quot;non participating&quot;])</label>
                <input
                  value={form.closedSelector}
                  onChange={(e) => setForm({ ...form, closedSelector: e.target.value })}
                  placeholder="목록 카드/행 안에 이게 있으면 마감으로 보고 크롤링에서 제외"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </>
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">등록된 링크</h2>
          <button
            onClick={crawlAllNow}
            disabled={crawlingAll || sources.length === 0}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {crawlingAll ? "전체 크롤링 중..." : "전체 지금 크롤링"}
          </button>
        </div>
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
