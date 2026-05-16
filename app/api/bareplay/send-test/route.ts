import { NextResponse } from "next/server";

import { getBarePlayData } from "../../../../lib/bareplay-data";
import { sendHostedBarePlayTestEmail } from "../../../../lib/bareplay-mail";

export const runtime = "nodejs";

export async function POST() {
  try {
    const data = await getBarePlayData();
    const template = data.latestTemplate;

    if (!template) {
      return NextResponse.json(
        { error: "Save a message template first so PS has something to send." },
        { status: 400 },
      );
    }

    const result = await sendHostedBarePlayTestEmail(data.draft, template.message);
    return NextResponse.json({
      ok: true,
      message: `Sent hosted test to ${result.name} <${result.to}> from ${result.from}.`,
      templateName: template.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hosted test send failed." },
      { status: 500 },
    );
  }
}
