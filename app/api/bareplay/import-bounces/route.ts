import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { runBarePlayBounceImport } from "../../../../lib/bareplay-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      campaignSubject?: unknown;
      password?: unknown;
      username?: unknown;
    };
    const result = await runBarePlayBounceImport(
      typeof payload?.campaignSubject === "string" ? payload.campaignSubject : "",
      {
        password: typeof payload?.password === "string" ? payload.password : "",
        username: typeof payload?.username === "string" ? payload.username : "",
      },
    );
    revalidatePath("/");
    revalidatePath("/bareplay-email");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not import bounce notices.",
      },
      { status: 500 },
    );
  }
}
