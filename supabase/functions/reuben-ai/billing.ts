import { createClient } from "npm:@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  )!
);

export async function checkUserLimit(
  userId: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!data) return true;

  return true; // disabled for stability first
}