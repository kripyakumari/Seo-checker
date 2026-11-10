import { connection } from "next/server";
import { analyzeKeyword } from "@/lib/keyword/analyze";

const hits = new Map<string, number[]>();

export async function POST(request: Request) {
  await connection();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    return Response.json(
      { ok: false, error: "Too many checks from this browser.", hint: "Wait a minute, then try again." },
      { status: 429 },
    );
  }

  let body: { url?: string; keyword?: string; secondary?: string };
  try {
    body = (await request.json()) as { url?: string; keyword?: string; secondary?: string };
  } catch {
    return Response.json(
      { ok: false, error: "The check could not be read.", hint: "Enter the URL again." },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeKeyword(body);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error(error);
    return Response.json(
      { ok: false, error: "The checker hit an unexpected problem.", hint: "Try again in a moment." },
      { status: 500 },
    );
  }
}

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 15) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}
