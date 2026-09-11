const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Set OPENAI_API_KEY in the environment before running this test.");
  process.exit(1);
}

async function testOpenAIImage() {
  console.log("=== TESTING: OpenAI Image Generation ===");

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: "a futuristic city skyline at night with neon lights",
        size: "1024x1024",
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(response.ok ? "OpenAI image generation succeeded." : `OpenAI image generation failed: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error(`Request error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

testOpenAIImage();
