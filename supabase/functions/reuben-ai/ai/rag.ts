import { embed } from "../embeddings.ts";

/**
 * FIXED: proper export name (NO MORE boot error)
 */
export async function buildRAGContext(message: string) {
  try {
    const vector = await embed(message);

    const res = await fetch(
      Deno.env.get("RAG_ENDPOINT") || ""
    );

    if (!res.ok) return "";

    const docs = await res.json();

    return (docs || [])
      .slice(0, 5)
      .map((d: any) => d.content)
      .join("\n\n");
  } catch {
    return "";
  }
}