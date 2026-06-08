export async function searchTavily(query: string) {
  const apiKey = Deno.env.get("TAVILY_API_KEY");

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        topic: "general",
        include_answer: true,
        include_raw_content: true,
        include_images: false,
        max_results: 10,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Tavily Error:", data);
      throw new Error(data?.message || "Tavily error");
    }

    return {
      success: true,
      answer: data.answer || "",
      results: data.results || [],
      raw: data,
    };
  } catch (err: any) {
    console.error("Tavily Search Failed:", err);

    return {
      success: false,
      answer: "",
      results: [],
      error: err?.message || "Unknown Tavily error",
    };
  }
}