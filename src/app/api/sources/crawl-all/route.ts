import { NextResponse } from "next/server";
import { crawlAll } from "@/lib/crawler";

export async function POST() {
  const results = await crawlAll();
  return NextResponse.json({
    ranAt: new Date().toISOString(),
    results,
  });
}
