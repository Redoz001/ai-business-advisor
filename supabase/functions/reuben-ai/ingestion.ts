import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { embedBatch } from "./embeddings.ts";

/* =========================================================
   ENV
========================================================= */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY"
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase environment variables"
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =========================================================
   CONFIG
========================================================= */

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;
const MAX_DOCUMENT_SIZE = 500_000;

/* =========================================================
   TYPES
========================================================= */

export interface IngestResult {
  success: boolean;
  chunks: number;
  inserted: number;
  skipped: number;
  documentId: string;
}

/* =========================================================
   HASH
========================================================= */

async function sha256(
  input: string
): Promise<string> {
  const data = new TextEncoder().encode(
    input
  );

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map((b) =>
      b
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

/* =========================================================
   CHUNKING
========================================================= */

export function chunkText(
  text: string,
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP
): string[] {
  const clean = text
    .replace(/\s+/g, " ")
    .trim();

  const chunks: string[] = [];

  let start = 0;

  while (start < clean.length) {
    const end = Math.min(
      start + size,
      clean.length
    );

    chunks.push(
      clean.slice(start, end)
    );

    start += size - overlap;
  }

  return chunks.filter(Boolean);
}

/* =========================================================
   INGEST
========================================================= */

export async function ingest(
  text: string,
  metadata: Record<
    string,
    unknown
  > = {}
): Promise<IngestResult> {
  const content =
    String(text ?? "").trim();

  if (!content) {
    throw new Error(
      "Document is empty"
    );
  }

  if (
    content.length >
    MAX_DOCUMENT_SIZE
  ) {
    throw new Error(
      "Document exceeds maximum size"
    );
  }

  const documentId =
    await sha256(content);

  /* ==========================================
     DUPLICATE CHECK
  ========================================== */

  const {
    data: existing,
  } = await supabase
    .from("documents")
    .select("id")
    .eq(
      "document_hash",
      documentId
    )
    .limit(1);

  if (
    existing &&
    existing.length > 0
  ) {
    return {
      success: true,
      chunks: 0,
      inserted: 0,
      skipped: 1,
      documentId,
    };
  }

  /* ==========================================
     CHUNKING
  ========================================== */

  const chunks =
    chunkText(content);

  /* ==========================================
     BATCH EMBEDDINGS
  ========================================== */

  const embeddings =
    await embedBatch(chunks);

  const rows = chunks.map(
    (chunk, index) => ({
      content: chunk,

      embedding:
        embeddings[index],

      metadata: {
        ...metadata,

        chunkIndex:
          index,

        totalChunks:
          chunks.length,

        ingestedAt:
          new Date().toISOString(),
      },

      document_hash:
        documentId,
    })
  );

  /* ==========================================
     INSERT
  ========================================== */

  const { error } =
    await supabase
      .from("documents")
      .insert(rows);

  if (error) {
    console.error(
      "Ingestion error:",
      error
    );

    throw error;
  }

  return {
    success: true,
    chunks: chunks.length,
    inserted: rows.length,
    skipped: 0,
    documentId,
  };
}