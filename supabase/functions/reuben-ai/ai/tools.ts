export async function runTools(message: string) {
  const lower = message.toLowerCase();

  const tools: any = {};

  // simple calculator tool
  if (/\d+\s*[\+\-\*\/]\s*\d+/.test(lower)) {
    try {
      tools.calculation = {
        type: "math",
        result: eval(lower.replace(/[^0-9+\-*/().]/g, "")),
      };
    } catch {}
  }

  // search intent detection
  if (lower.includes("search") || lower.includes("news")) {
    tools.searchHint = {
      type: "search",
      query: message,
    };
  }

  return Object.keys(tools).length ? tools : null;
}