const FULL_DATE = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/;
const SHORT_DATE = /(?:^|[^\d])(\d{1,2})[./\-](\d{1,2})(?:[^\d]|$)/;

/**
 * 사이트마다 제각각인 날짜 표기 텍스트(dateLabel)를 실제 Date로 변환한다.
 * "D-25"처럼 상대 표기만 있는 경우는 절대 날짜를 알 수 없으므로 null을 반환하고,
 * 호출부에서 firstSeenAt(크롤링 발견 시각)으로 대체한다.
 */
export function parseDateLabel(label: string | null, now: Date = new Date()): Date | null {
  if (!label) return null;

  const full = label.match(FULL_DATE);
  if (full) {
    const [, y, m, d] = full;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const short = label.match(SHORT_DATE);
  if (short) {
    const [, m, d] = short;
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(now.getFullYear(), month - 1, day);
    const sixMonthsMs = 1000 * 60 * 60 * 24 * 180;
    if (date.getTime() < now.getTime() - sixMonthsMs) {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date;
  }

  return null;
}
