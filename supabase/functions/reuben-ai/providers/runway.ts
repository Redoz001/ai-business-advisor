const RUNWAY_API_BASE =
  "https://api.dev.runwayml.com/v1";

const RUNWAY_API_VERSION = "2024-11-06";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 24;

type RunwayTaskResponse = {
  id?: string;
  status?: string;
  output?: unknown;
  output_url?: unknown;
  result?: unknown;
  failure?: string;
  failureCode?: string;
  error?: string;
};

export async function generateImage(
  prompt: string
): Promise<string> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error(
      "An image prompt is required."
    );
  }

  const apiKey =
    Deno.env.get("RUNWAY_API_KEY");

  if (!apiKey) {
    throw new Error(
      "Missing RUNWAY_API_KEY in Supabase secrets."
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version":
      RUNWAY_API_VERSION,
  };

  /*
   * Use gen4_image for text-only generation.
   * gen4_image_turbo requires an image reference.
   */
  const payload = {
    model: "gen4_image",
    promptText: cleanPrompt,
    ratio: "1024:1024",
  };

  console.log(
    "Starting Runway image generation:",
    {
      model: payload.model,
      ratio: payload.ratio,
      promptLength: cleanPrompt.length,
    }
  );

  const initResponse = await fetch(
    `${RUNWAY_API_BASE}/text_to_image`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );

  const initBody =
    await initResponse.text();

  if (!initResponse.ok) {
    throw new Error(
      [
        `Runway initialization failed (${initResponse.status}).`,
        initBody || "No error body returned.",
      ].join(" ")
    );
  }

  const initData =
    parseJson<RunwayTaskResponse>(
      initBody,
      "Runway returned invalid initialization JSON."
    );

  const taskId = initData.id;

  if (
    !taskId ||
    typeof taskId !== "string"
  ) {
    throw new Error(
      `Runway did not return a task ID. Response: ${initBody}`
    );
  }

  console.log(
    "Runway task created:",
    taskId
  );

  let lastStatus = "UNKNOWN";

  for (
    let attempt = 1;
    attempt <= MAX_POLL_ATTEMPTS;
    attempt++
  ) {
    await sleep(
      POLL_INTERVAL_MS +
        Math.floor(Math.random() * 750)
    );

    const statusResponse = await fetch(
      `${RUNWAY_API_BASE}/tasks/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          "X-Runway-Version":
            RUNWAY_API_VERSION,
        },
      }
    );

    const statusBody =
      await statusResponse.text();

    if (!statusResponse.ok) {
      throw new Error(
        [
          `Runway status request failed (${statusResponse.status}).`,
          statusBody ||
            "No error body returned.",
        ].join(" ")
      );
    }

    const task =
      parseJson<RunwayTaskResponse>(
        statusBody,
        "Runway returned invalid task-status JSON."
      );

    const status = String(
      task.status ?? "UNKNOWN"
    ).toUpperCase();

    lastStatus = status;

    console.log(
      `Runway task ${taskId}:`,
      {
        attempt,
        status,
      }
    );

    /*
     * Runway statuses are uppercase.
     */
    if (status === "SUCCEEDED") {
      const outputUrl =
        extractOutputUrl(task);

      if (!outputUrl) {
        throw new Error(
          [
            "Runway reported SUCCEEDED",
            "but returned no valid image URL.",
            `Response: ${statusBody}`,
          ].join(" ")
        );
      }

      console.log(
        "Runway image generation completed:",
        outputUrl
      );

      return outputUrl;
    }

    if (
      status === "FAILED" ||
      status === "CANCELED" ||
      status === "CANCELLED"
    ) {
      const failureDetails = [
        task.failureCode,
        task.failure,
        task.error,
      ]
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            value.trim().length > 0
        )
        .join(" — ");

      throw new Error(
        failureDetails
          ? `Runway task ${status}: ${failureDetails}`
          : `Runway task ${status}. Response: ${statusBody}`
      );
    }

    /*
     * Expected incomplete statuses include
     * PENDING, RUNNING and THROTTLED.
     * Continue polling for those statuses.
     */
  }

  throw new Error(
    [
      "Runway generation timed out.",
      `Last status: ${lastStatus}.`,
      `Task ID: ${taskId}.`,
    ].join(" ")
  );
}

function parseJson<T>(
  value: string,
  errorMessage: string
): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(
      `${errorMessage} Response: ${value}`
    );
  }
}

function extractOutputUrl(
  task: RunwayTaskResponse
): string | null {
  return (
    findUrl(task.output) ??
    findUrl(task.output_url) ??
    findUrl(task.result)
  );
}

function findUrl(
  value: unknown
): string | null {
  if (typeof value === "string") {
    const candidate = value.trim();

    if (isHttpUrl(candidate)) {
      return candidate;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findUrl(item);

      if (url) {
        return url;
      }
    }

    return null;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<string, unknown>;

    const preferredKeys = [
      "url",
      "uri",
      "output_url",
      "outputUrl",
      "files",
      "output",
      "result",
    ];

    for (const key of preferredKeys) {
      const url = findUrl(record[key]);

      if (url) {
        return url;
      }
    }
  }

  return null;
}

function isHttpUrl(
  value: string
): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}