export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;

  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  const diffWeek = Math.round(diffDay / 7);
  if (diffDay < 30) return `${diffWeek}주 전`;

  const date = new Date(iso);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

const SOURCE_PALETTE = [
  { dot: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-950/40" },
  { dot: "bg-sky-500", text: "text-sky-700 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-950/40" },
  { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-950/40" },
  { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-950/40" },
  { dot: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
];

export function sourceColor(sourceId: string) {
  let hash = 0;
  for (let i = 0; i < sourceId.length; i++) {
    hash = (hash * 31 + sourceId.charCodeAt(i)) >>> 0;
  }
  return SOURCE_PALETTE[hash % SOURCE_PALETTE.length];
}
