export function validateMessage(message: any) {
  if (!message) return false;
  if (typeof message !== "string") return false;
  if (message.trim().length === 0) return false;
  if (message.length > 8000) return false;

  return true;
}

export function validateChatId(chatId: any) {
  return typeof chatId === "string" && chatId.length > 0;
}