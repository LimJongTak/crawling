import type { CrawledItem } from "./types";
import { escapeHtml } from "@/lib/format";

interface KaggleCompetition {
  ref?: string;
  title?: string;
  url?: string;
  deadline?: string;
  dateCreated?: string;
  enabledDate?: string;
  description?: string;
  reward?: string;
}

// "gettingStarted"(Titanic 등 튜토리얼용, 마감일이 2030년 등으로 무의미)과
// "masters"(항상 비어있음)는 제외하고 실제로 진행 중인 대회만 가져온다.
const CATEGORIES = ["featured", "research", "playground", "community", "recruitment"];

/**
 * Kaggle 공식 API(https://www.kaggle.com/api/v1/competitions/list)를 사용한다.
 * 캐글 대회 목록 페이지는 순수 SPA라 정적 스크래핑이 불가능하고, 비공개 내부 API는
 * 로그인 세션이 필요해 불안정하므로 공식 API + 계정 API 키 방식을 사용한다.
 * https://www.kaggle.com/settings -> API -> Create New Token 에서 KAGGLE_USERNAME/KAGGLE_KEY 발급.
 */
export async function crawlKaggleCompetitions(): Promise<CrawledItem[]> {
  const username = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;

  if (!username || !key) {
    throw new Error(
      "KAGGLE_USERNAME / KAGGLE_KEY 환경변수가 설정되지 않았습니다. https://www.kaggle.com/settings 에서 API 토큰을 발급받아 설정하세요."
    );
  }

  const authHeader = "Basic " + Buffer.from(`${username}:${key}`).toString("base64");
  const items = new Map<string, CrawledItem>();

  for (const category of CATEGORIES) {
    const res = await fetch(
      `https://www.kaggle.com/api/v1/competitions/list?group=general&category=${category}&sortBy=earliestDeadline&page=1`,
      {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Kaggle API 요청 실패 (category=${category}): HTTP ${res.status}`);
    }

    const data: KaggleCompetition[] = await res.json();
    if (!Array.isArray(data)) continue;

    const now = Date.now();

    for (const c of data) {
      if (!c.ref || !c.title) continue;
      if (!c.deadline || new Date(c.deadline).getTime() <= now) continue; // 마감(모집 종료)된 대회는 제외

      const url = c.url ?? c.ref;
      const createdRaw = c.dateCreated ?? c.enabledDate ?? null;
      const createdAt = createdRaw ? new Date(createdRaw) : null;

      const contentLines: string[] = [];
      if (c.description?.trim()) contentLines.push(`<p>${escapeHtml(c.description.trim())}</p>`);
      if (c.reward?.trim()) contentLines.push(`<p>상금: ${escapeHtml(c.reward.trim())}</p>`);

      items.set(url, {
        title: c.title,
        url,
        dateLabel: c.deadline ?? null,
        postedAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
        content: contentLines.length ? contentLines.join("\n") : null,
      });
    }
  }

  return Array.from(items.values());
}
