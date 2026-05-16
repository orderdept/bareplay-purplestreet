import { NextResponse } from "next/server";

import { getBarePlayData } from "../../../../lib/bareplay-data";
import { hostedSmtpLoginTest } from "../../../../lib/bareplay-mail";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getBarePlayData();
    const result = await hostedSmtpLoginTest(data.draft);
    return NextResponse.json({
      ok: true,
      message: `Hosted SMTP login works for ${result.username} on ${result.host}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hosted SMTP login failed." },
      { status: 500 },
    );
  }
}
