/* =========================================================
   REUBEN AI EMBEDDINGS
   OpenAI Embedding Service
========================================================= */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY");
}

/* =========================================================
   TYPES
========================================================= */

export interface EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
  tokens?: number;
}

/* =========================================================
   CONFIG
========================================================= */

const EMBEDDING_MODEL = "text-embedding-3-small";
const REQUEST_TIMEOUT_MS = 30000;

/* =========================================================
   OPENAI EMBEDDING
========================================================= */

export async function embed(
  text: string
): Promise<number[]> {
  const result = await createEmbedding(text);

  return result.embedding;
}

/* =========================================================
   ADVANCED EMBEDDING RESPONSE
========================================================= */

export async function createEmbedding(
  text: string
): Promise<EmbeddingResponse> {
  const input = String(text ?? "").trim();

  if (!input) {
    throw new Error(
      "Cannot create embedding from empty text"
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",

        signal: controller.signal,

        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input,
        }),
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "OpenAI Embedding Error:",
        raw
      );

      throw new Error(
        `Embedding request failed (${response.status})`
      );
    }

    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      console.error(
        "Invalid OpenAI JSON:",
        raw
      );

      throw new Error(
        "Invalid embedding response"
      );
    }

    const embedding =
      data?.data?.[0]?.embedding;

    if (!embedding) {
      console.error(
        "Missing embedding:",
        data
      );

      throw new Error(
        "Embedding missing in response"
      );
    }

    return {
      embedding,
      dimensions: embedding.length,
      model: EMBEDDING_MODEL,
      tokens: data?.usage?.total_tokens,
    };
  } catch (err) {
    if (
      err instanceof DOMException &&
      err.name === "AbortError"
    ) {
      throw new Error(
        "Embedding request timed out"
      );
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   BATCH EMBEDDINGS
========================================================= */

export async function embedBatch(
  texts: string[]
): Promise<number[][]> {
  const cleaned = texts
    .map((t) => String(t ?? "").trim())
    .filter(Boolean);

  if (!cleaned.length) {
    return [];
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",

        signal: controller.signal,

        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: cleaned,
        }),
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "Batch Embedding Error:",
        raw
      );

      throw new Error(
        `Batch embedding failed (${response.status})`
      );
    }

    const data = JSON.parse(raw);

    return (
      data?.data?.map(
        (row: any) => row.embedding
      ) ?? []
    );
  } finally {
    clearTimeout(timeout);
  }
}