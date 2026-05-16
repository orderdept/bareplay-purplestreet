import { NextResponse } from "next/server";

import { getBarePlayData } from "../../../../lib/bareplay-data";
import { hostedSmtpLoginTest } from "../../../../lib/bareplay-mail";

export const runtime = "nodejs";

async function requestPassword(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  return typeof body.password === "string" ? body.password : "";
}

export async function POST(request: Request) {
  try {
    const data = await getBarePlayData();
    const result = await hostedSmtpLoginTest(data.draft, { password: await requestPassword(request) });
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
