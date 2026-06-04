export async function searchTavily(query: string) {
  const apiKey = Deno.env.get("TAVILY_API_KEY");

  if (!apiKey) {
    throw new Error("Missing TAVILY_API_KEY");
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Tavily error");
  }

  return data;
}