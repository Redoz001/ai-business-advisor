import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function checkUserLimit(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!data) throw new Error("User not found");

  const plan = data.plan || "free";
  const used = data.requests_used || 0;

  const limits = {
    free: 20,
    pro: 2000,
    elite: 999999,
  };

  if (used >= limits[plan]) {
    throw new Error("Daily limit reached. Upgrade plan.");
  }

  await supabase
    .from("profiles")
    .update({
      requests_used: used + 1,
    })
    .eq("id", userId);

  return true;
}