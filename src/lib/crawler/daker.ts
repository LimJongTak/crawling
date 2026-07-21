import type { CrawledItem } from "./types";
import { escapeHtml } from "@/lib/format";
import { sanitizeHtmlString } from "./extractContent";
import { USER_AGENT } from "./constants";

interface DakerHackathon {
  slug?: string;
  title?: string;
  description?: string;
  organizerName?: string;
  totalPrize?: string;
  participantCount?: number;
  registrationStartDate?: string;
  registrationDeadline?: string;
  createdAt?: string;
  isPrivate?: boolean;
}

const API_URL = "https://daker.ai/api/hackathons";
const BASE_URL = "https://daker.ai";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * daker.ai(데이콘이 운영하는 해커톤 전용 플랫폼)는 /public/hackathons 목록 페이지 자체는
 * 순수 SPA라 정적으로 못 가져오지만, 그 화면이 호출하는 공개 API(/api/hackathons)가 있어
 * 그걸 바로 사용한다. registrationDeadline이 지나지 않은(=모집중) 항목만 남긴다.
 */
export async function crawlDakerHackathons(): Promise<CrawledItem[]> {
  const res = await fetch(API_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`daker.ai API 요청 실패: HTTP ${res.status}`);
  }

  const data: DakerHackathon[] = await res.json();
  if (!Array.isArray(data)) return [];

  const now = Date.now();
  const items: CrawledItem[] = [];

  for (const h of data) {
    if (!h.slug || !h.title || h.isPrivate) continue;
    if (!h.registrationDeadline) continue;

    const deadline = new Date(h.registrationDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= now) continue; // 모집 마감된 건 제외

    const url = `${BASE_URL}/public/hackathons/${h.slug}`;
    const createdRaw = h.registrationStartDate ?? h.createdAt ?? null;
    const postedAt = createdRaw ? new Date(createdRaw) : null;

    const summaryLines: string[] = [];
    if (h.organizerName) summaryLines.push(`<p>주최: ${escapeHtml(h.organizerName)}</p>`);
    if (h.totalPrize && Number(h.totalPrize) > 0) {
      summaryLines.push(`<p>총 상금: ${escapeHtml(Number(h.totalPrize).toLocaleString("ko-KR"))}원</p>`);
    }
    const description = h.description ? sanitizeHtmlString(h.description, url) : "";

    items.push({
      title: h.title,
      url,
      dateLabel: `모집마감 ${formatDate(h.registrationDeadline)}`,
      postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
      content: [...summaryLines, description].filter(Boolean).join("\n") || null,
    });
  }

  return items;
}
