import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { Source } from "@prisma/client";
import type { CrawledItem } from "./types";
import { parseDateLabel } from "./parseDate";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const DATE_PATTERN = /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|~?\d{1,2}[./]\d{1,2}(?:\([월화수목금토일]\))?|D-\d+|D-DAY/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function extractTitle($: cheerio.CheerioAPI, anchor: Element): string | null {
  const $a = $(anchor);
  const titleAttr = $a.attr("title")?.trim();
  if (titleAttr) return titleAttr;

  const imgAlt = $a.find("img[alt]").first().attr("alt")?.trim();
  if (imgAlt) return imgAlt;

  const text = $a.text().replace(/\s+/g, " ").trim();
  return text || null;
}

function extractDateLabel($: cheerio.CheerioAPI, anchor: Element): string | null {
  const container = $(anchor).closest("tr, li").first();
  const scope = container.length ? container : $(anchor).parent();
  const match = scope.text().match(DATE_PATTERN);
  return match ? match[0] : null;
}

/**
 * 잡코리아 등 Braze 마케팅 트래킹을 쓰는 사이트는 data-brazeinfo 속성에
 * "제목|gno|gino|게시일(YYYY-MM-DD)|마감일|회사명|..." 형태로 실제 게시일이 파이프로 구분되어 들어있다.
 * 있으면 D-day 텍스트보다 훨씬 정확한 게시 시각을 얻을 수 있어 우선 사용한다.
 */
function extractBrazeInfoPostedAt($: cheerio.CheerioAPI, anchor: Element): Date | null {
  const container = $(anchor).closest("tr, li").first();
  if (!container.length) return null;

  const raw = container.find("[data-brazeinfo]").first().attr("data-brazeinfo");
  if (!raw) return null;

  const isoField = raw.split("|").find((part) => ISO_DATE.test(part.trim()));
  if (!isoField) return null;

  const date = new Date(isoField.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 목록 페이지 HTML을 가져와 linkPattern에 매칭되는 상세글 링크를 모두 추출한다.
 * 사이트마다 마크업이 달라도 "목록 페이지 + 상세 링크 정규식"만 있으면 동작하도록
 * title/date는 앵커 주변에서 최대한 추정한다.
 */
export async function crawlGenericSource(source: Source): Promise<CrawledItem[]> {
  if (!source.linkPattern) {
    throw new Error("linkPattern이 설정되지 않았습니다.");
  }

  const res = await fetch(source.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`목록 페이지 요청 실패: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const pattern = new RegExp(source.linkPattern);

  const seen = new Map<string, CrawledItem>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !pattern.test(href)) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, source.url).toString();
    } catch {
      return;
    }

    if (seen.has(absoluteUrl)) return;

    const title = extractTitle($, el);
    if (!title) return;

    const dateLabel = extractDateLabel($, el);
    const postedAt = extractBrazeInfoPostedAt($, el) ?? parseDateLabel(dateLabel);

    seen.set(absoluteUrl, {
      title,
      url: absoluteUrl,
      dateLabel,
      postedAt,
    });
  });

  return Array.from(seen.values());
}
