import { NextResponse } from "next/server";

import { getBarePlayData } from "../../../../../lib/bareplay-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBarePlayData();
  return NextResponse.json(
    data.suppressions.map((email) => ({ email })),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="bareplay-suppressions.json"',
      },
    },
  );
}
