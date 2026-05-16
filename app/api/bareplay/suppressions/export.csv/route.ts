import { NextResponse } from "next/server";

import { getBarePlayData } from "../../../../../lib/bareplay-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBarePlayData();
  const csv = ["email", ...data.suppressions].join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bareplay-suppressions.csv"',
      "Cache-Control": "no-store",
    },
  });
}
