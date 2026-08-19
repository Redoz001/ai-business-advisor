const SUPABASE_URL = "https://whvzdutfyydshamwfhvu.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodnpkdXRmeXlkc2hhbXdmaHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjQ5MDAsImV4cCI6MjA5NDE0MDkwMH0.KEVgU3l-d9glmFf0n4oO3nOnLnvbxTu98gdwh3hyWmo";

async function testGeneration(message, label) {
  console.log(`\n=== TESTING: ${label} ===`);
  console.log(`Message: "${message}"`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/reuben-ai`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({
        message,
        chatId: `test-${Date.now()}`,
        userId: "test-user",
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response type: ${data?.type}`);
    console.log(`Mode: ${data?.mode}`);
    
    if (data?.type === "image") {
      console.log(`✅ IMAGE GENERATION SUCCESS`);
      if (data?.image?.svg) {
        console.log(`  - SVG data URL (length: ${data.image.svg.length})`);
        // Save the SVG to a file
        const fs = await import("fs");
        const svgContent = Buffer.from(data.image.svg.split(",")[1], "base64").toString("utf-8");
        fs.writeFileSync("test_outputs/generated_image.svg", svgContent);
        console.log(`  - Saved to test_outputs/generated_image.svg`);
      }
      if (data?.image?.url) {
        console.log(`  - URL: ${data.image.url}`);
      }
      if (data?.image?.prompt) {
        console.log(`  - Prompt: ${data.image.prompt}`);
      }
    } else if (data?.type === "text") {
      console.log(`⚠️ Got text response instead of image:`);
      console.log(`  - Payload: ${data?.payload?.slice(0, 200)}`);
    } else {
      console.log(`❌ Unexpected response:`, JSON.stringify(data, null, 2).slice(0, 500));
    }
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
  }
}

async function main() {
  // Test 1: Image generation (should trigger ReuCore local generation)
  await testGeneration("generate an image of a futuristic city skyline", "Image Generation (ReuCore)");

  // Test 2: Video generation (should return placeholder)
  await testGeneration("create a video of a sunset over the ocean", "Video Generation");
}

main();