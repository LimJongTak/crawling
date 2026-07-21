import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { USER_AGENT } from "./constants";
import { escapeHtml } from "@/lib/format";

function sanitize($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>, baseUrl: string): string {
  root.find("script, style, iframe, noscript").remove();

  root.find("*").each((_, el) => {
    const $el = $(el);
    for (const name of Object.keys(el.attribs ?? {})) {
      if (name.toLowerCase().startsWith("on")) $el.removeAttr(name);
    }
  });

  root.find("[href]").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href");
    if (!href) return;
    try {
      $el.attr("href", new URL(href, baseUrl).toString());
    } catch {
      // 상대/잘못된 URL은 그대로 둔다
    }
  });

  root.find("[src]").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src");
    if (!src) return;
    try {
      $el.attr("src", new URL(src, baseUrl).toString());
    } catch {
      // 상대/잘못된 URL은 그대로 둔다
    }
  });

  return (root.html() ?? "").trim();
}

/**
 * API 응답 등으로 이미 확보한 HTML 조각(예: daker.ai의 hackathon.description)을
 * 스크립트 제거 + 상대경로 절대화 등 동일한 방식으로 정리한다.
 */
export function sanitizeHtmlString(html: string, baseUrl: string): string {
  const $ = cheerio.load(`<div id="__root__">${html}</div>`);
  const root = $("#__root__");
  return sanitize($, root, baseUrl);
}

/**
 * 상세 페이지를 가져와 본문을 최대한 추출한다.
 * 1) contentSelector가 설정돼 있고 실제로 텍스트가 있으면 그 영역의 HTML을 그대로 사용
 * 2) 아니면 og:description/description 메타 태그로 대체 (요약 수준)
 * 3) 둘 다 없으면 null (호출부에서 제목+링크만으로 대체)
 */
export async function extractDetailContent(url: string, contentSelector: string | null): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  if (contentSelector) {
    const root = $(contentSelector).first();
    if (root.length && root.text().trim().length > 0) {
      const cleaned = sanitize($, root, url);
      if (cleaned) return cleaned;
    }
  }

  const metaDesc = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content");
  if (metaDesc?.trim()) {
    return `<p>${escapeHtml(metaDesc.trim())}</p>`;
  }

  return null;
}
