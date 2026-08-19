const RUNWAY_API_KEY = "key_4bd70bc5b4999e1c09bed4452058b3191f5ed9b59d126735ab13588129cde1f7862e68266e79a67c5052f6ae02c60f570a7a78af39c3d98502ca5d1f99164345";
const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

async function testRunwayImage() {
  console.log("=== TESTING: Runway Image Generation (Fallback) ===");
  
  try {
    const payload = {
      model: "gen4_image",
      promptText: "a futuristic city skyline at night with neon lights",
      ratio: "1024:1024",
    };

    console.log("Initiating Runway task...");
    const initResponse = await fetch(`${RUNWAY_API_BASE}/text_to_image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_API_VERSION,
      },
      body: JSON.stringify(payload),
    });

    const initBody = await initResponse.text();
    console.log(`Init status: ${initResponse.status}`);
    
    if (!initResponse.ok) {
      console.log(`Runway init failed: ${initBody}`);
      return;
    }

    const initData = JSON.parse(initBody);
    const taskId = initData.id;
    console.log(`Task created: ${taskId}`);

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      
      const statusResponse = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RUNWAY_API_KEY}`,
          "X-Runway-Version": RUNWAY_API_VERSION,
        },
      });

      const statusBody = await statusResponse.text();
      const task = JSON.parse(statusBody);
      const status = String(task.status ?? "UNKNOWN").toUpperCase();
      
      console.log(`  Attempt ${attempt}: status = ${status}`);

      if (status === "SUCCEEDED") {
        console.log(`Runway generation SUCCEEDED!`);
        console.log(`  Output: ${JSON.stringify(task.output ?? task.output_url ?? task.result)}`);
        return;
      }

      if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") {
        console.log(`Runway task ${status}: ${task.failure || task.error || "unknown error"}`);
        return;
      }
    }

    console.log("Timed out after 5 attempts (25s)");
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

testRunwayImage();