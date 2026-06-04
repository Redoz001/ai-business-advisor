export async function generateImage(prompt: string) {
  const apiKey = Deno.env.get("RUNWAY_API_KEY");

  if (!apiKey) {
    throw new Error("Missing RUNWAY_API_KEY");
  }

  // =========================
  // 1. START GENERATION
  // =========================

  const payload: any = {
    model: "gen4_image_turbo",
    promptText: prompt,
    ratio: "1024:1024",

    // ✅ HARD GUARANTEE: always valid array of objects
    referenceImages: [
      {
        uri: "https://dummyimage.com/1024x1024/000/fff.png",
      },
    ],
  };

  // 🔒 SAFETY GUARD (prevents accidental upstream mutation issues)
  if (
    !Array.isArray(payload.referenceImages) ||
    payload.referenceImages.length === 0
  ) {
    payload.referenceImages = [
      {
        uri: "https://dummyimage.com/1024x1024/000/fff.png",
      },
    ];
  }

  const init = await fetch(
    "https://api.dev.runwayml.com/v1/text_to_image",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!init.ok) {
    const err = await init.text();
    throw new Error("Runway init failed: " + err);
  }

  const initData = await init.json();
  const id = initData?.id;

  if (!id) {
    throw new Error("Runway did not return a task id");
  }

  // =========================
  // 2. POLLING LOOP (HARDENED)
  // =========================

  let attempts = 0;
  const maxAttempts = 10;
  const delay = 2500;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, delay));

    let statusRes;

    try {
      statusRes = await fetch(
        `https://api.dev.runwayml.com/v1/tasks/${id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
    } catch (err) {
      throw new Error("Runway network failure");
    }

    if (!statusRes.ok) {
      const err = await statusRes.text();
      throw new Error("Runway status failed: " + err);
    }

    let statusData: any;

    try {
      statusData = await statusRes.json();
    } catch {
      throw new Error("Runway returned invalid JSON status response");
    }

    // =========================
    // 3. SUCCESS CASE
    // =========================

    if (
      statusData.status === "succeeded" ||
      statusData.status === "completed"
    ) {
      const url =
        typeof statusData?.output === "string"
          ? statusData.output
          : Array.isArray(statusData?.output)
          ? statusData.output[0]
          : typeof statusData?.output_url === "string"
          ? statusData.output_url
          : typeof statusData?.result === "string"
          ? statusData.result
          : Array.isArray(statusData?.result)
          ? statusData.result[0]
          : typeof statusData?.result?.files?.[0] === "string"
          ? statusData.result.files[0]
          : typeof statusData?.output?.url === "string"
          ? statusData.output.url
          : null;

      if (!url || typeof url !== "string") {
        throw new Error(
          "Runway succeeded but no valid output URL found"
        );
      }

      return url;
    }

    // =========================
    // 4. FAILURE CASE
    // =========================

    if (statusData.status === "failed") {
      throw new Error("Runway generation failed");
    }

    // =========================
    // 5. LOOP CONTROL
    // =========================

    attempts++;
  }

  throw new Error("Runway timeout: generation took too long");
}