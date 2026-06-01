export async function checkUserLimit(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("requests_used, requests_limit")
      .eq("id", userId)
      .single();

    if (error || !data) return true;

    if (data.requests_used >= data.requests_limit) {
      return false;
    }

    return true;
  } catch (err) {
    console.error("❌ checkUserLimit crashed:", err);
    return true;
  }
}