import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { Source } from "@prisma/client";
import type { CrawledItem } from "./types";
import { parseDateLabel } from "./parseDate";
import { USER_AGENT } from "./constants";

const DATE_PATTERN = /\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|~?\d{1,2}[./]\d{1,2}(?:\([월화수목금토일]\))?|D-\d+|D-DAY/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// "새글" 아이콘처럼 제목이 아닌 배지성 이미지의 alt 텍스트를 걸러낸다.
// (데이콘처럼 카드 썸네일의 alt가 곧 제목인 사이트가 있는 반면,
//  순천대처럼 "새 글 알림" 아이콘의 alt가 앵커 안에서 먼저 잡히는 사이트도 있어서 구분이 필요함)
const DECORATIVE_ALT_PATTERN = /^(new|hot|notice|알림|공지|첨부|필수|아이콘|new글|새\s*글)/i;

function extractTitle($: cheerio.CheerioAPI, anchor: Element): string | null {
  const $a = $(anchor);
  const titleAttr = $a.attr("title")?.trim();
  if (titleAttr) return titleAttr;

  const imgAlt = $a
    .find("img[alt]")
    .toArray()
    .map((img) => $(img).attr("alt")?.trim())
    .find((alt): alt is string => !!alt && !DECORATIVE_ALT_PATTERN.test(alt));
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
 * closedSelector가 설정된 소스에서, 카드/행 안에 그 셀렉터에 걸리는 요소가 있으면
 * "모집/접수 마감"으로 보고 이 글은 건너뛴다. (예: 데이콘의 마감 배지 아이콘)
 * 앵커 안쪽뿐 아니라(카드 전체가 링크인 경우) 같은 행/리스트아이템 안(링크와 배지가 형제인 경우)도 함께 본다.
 */
function isClosed($: cheerio.CheerioAPI, anchor: Element, closedSelector: string | null): boolean {
  if (!closedSelector) return false;
  const $a = $(anchor);
  if ($a.find(closedSelector).length > 0) return true;

  const container = $a.closest("tr, li").first();
  return container.length > 0 && container.find(closedSelector).length > 0;
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

  // 같은 상세글을 가리키는 앵커가 목록 페이지에 여러 개 있을 수 있다(제목 링크, 뱃지 링크 등).
  // 잡코리아처럼 그 앵커들의 href가 트래킹용 쿼리스트링만 다르고(예: &PageGbn=ST 유무) 실제로는
  // 같은 글을 가리키는 경우, 전체 URL로 구분하면 같은 글이 중복 저장된다.
  // 그래서 "이 글이 맞다"를 판별하는 linkPattern이 실제로 매칭한 부분(잡 ID 등 핵심 식별자)만
  // 중복 판정 키(dedupeKey)로 쓰고, 실제 방문 링크로는 처음 만난 앵커의 전체 URL을 그대로 둔다.
  // 이 dedupeKey는 크롤 실행 사이에도 안정적이어야 해서(index.ts에서 DB에 이미 저장된 글과
  // 비교할 때도 재사용) href의 매칭된 부분 문자열 그대로를 키로 쓴다.
  const seen = new Map<string, CrawledItem>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const match = href.match(pattern);
    if (!match) return;

    const dedupeKey = match[0];
    if (seen.has(dedupeKey)) return;
    if (isClosed($, el, source.closedSelector)) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, source.url).toString();
    } catch {
      return;
    }

    const title = extractTitle($, el);
    if (!title) return;

    const dateLabel = extractDateLabel($, el);
    const postedAt = extractBrazeInfoPostedAt($, el) ?? parseDateLabel(dateLabel);

    seen.set(dedupeKey, {
      title,
      url: absoluteUrl,
      dateLabel,
      postedAt,
      content: null, // 목록 크롤링 시에는 상세 페이지를 fetch하지 않고, "HTML 복사" 클릭 시점에 지연 추출한다
      dedupeKey,
    });
  });

  return Array.from(seen.values());
}
