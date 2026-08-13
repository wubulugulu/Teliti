import { NextRequest, NextResponse } from "next/server";
import { rewriteDocument } from "@/lib/rewrite";
import { GeminiCallError } from "@/lib/gemini-client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";
    const biases = Array.isArray(body?.biases) ? body.biases : [];
    const issues = Array.isArray(body?.issues) ? body.issues : [];

    if (!text || text.trim().length < 10) {
      return NextResponse.json({ error: "Teks terlalu pendek" }, { status: 400 });
    }

    const result = await rewriteDocument(text, biases, issues);
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("rewrite error:", e);
    if (e instanceof GeminiCallError) {
      return NextResponse.json({ error: e.userMessage }, { status: e.status });
    }
    return NextResponse.json({ error: "Gagal membuat dokumen revisi." }, { status: 500 });
  }
}