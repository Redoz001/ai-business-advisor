export function planAgent(message: string, tools: any) {
  const lower = message.toLowerCase();

  const needsTools =
    !!tools ||
    /calculate|solve|\+|-|\*|\//.test(lower);

  return {
    mode: needsTools ? "tool-augmented" : "chat",
  };
}