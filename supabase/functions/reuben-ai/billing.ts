import { supabase } from "./supabase.ts";

const FREE_MODE_RESET_MS = 30 * 24 * 60 * 60 * 1000;

const TIER_LIMITS: Record<string, { requestsLimit: number; intelligenceLevel: "basic" | "full" }> = {
  normal: { requestsLimit: 30, intelligenceLevel: "basic" },
  medium: { requestsLimit: 50, intelligenceLevel: "basic" },
  intelligence: { requestsLimit: Number.POSITIVE_INFINITY, intelligenceLevel: "full" },
};

function defaultAccess() {
  return {
    plan: "normal" as const,
    intelligenceLevel: "basic" as const,
    requestsUsed: 0,
    requestsLimit: 30,
    isPaid: false,
  };
}

function normalizePlan(value: unknown): "normal" | "medium" | "intelligence" {
  const plan = String(value ?? "normal").trim().toLowerCase();

  if (plan === "intelligence" || plan === "premium" || plan === "paid") {
    return "intelligence";
  }
  if (plan === "medium" || plan === "limited" || plan === "standard") {
    return "medium";
  }
  return "normal";
}

function getIntelligenceLevel(plan: string): "basic" | "full" {
  return plan === "intelligence" ? "full" : "basic";
}

function shouldResetFreeTierUsage(lastResetAt: unknown): boolean {
  if (!lastResetAt) return true;

  const ms = new Date(String(lastResetAt)).getTime();
  if (!Number.isFinite(ms)) return true;

  return Date.now() - ms >= FREE_MODE_RESET_MS;
}

async function resetFreeTierUsageIfNeeded(userId: string) {
  if (!supabase) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("requests_used, request_reset_at, plan, subscription_tier, account_tier, intelligence_level")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return;
  }

  const plan = normalizePlan(
    data?.plan ?? data?.subscription_tier ?? data?.account_tier,
  );
  const shouldReset = plan !== "intelligence" && shouldResetFreeTierUsage(data?.request_reset_at);

  if (!shouldReset) {
    return;
  }

  await supabase
    .from("profiles")
    .update({
      requests_used: 0,
      request_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function getUserAccessPlan(userId: string) {
  if (!userId || !supabase) {
    return defaultAccess();
  }

  try {
    await resetFreeTierUsageIfNeeded(userId);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_tier, account_tier, intelligence_level, requests_used, requests_limit, is_premium, subscription_status, stripe_customer_id, request_reset_at",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (error.code !== "PGRST116") {
        console.error("❌ getUserAccessPlan failed:", error.message);
      }
      return defaultAccess();
    }

    const plan = normalizePlan(
      data?.plan ?? data?.subscription_tier ?? data?.account_tier,
    );
    const tier = TIER_LIMITS[plan] ?? TIER_LIMITS.normal;
    const requestsUsed = Number(data?.requests_used ?? 0);
    const requestsLimit = Number(
      data?.requests_limit ?? tier.requestsLimit,
    );
    const intelligenceLevel =
      data?.intelligence_level ?? getIntelligenceLevel(plan);
    const subscriptionStatus = String(
      data?.subscription_status ?? "",
    ).trim().toLowerCase();
    const isPaid = Boolean(data?.is_premium) ||
      subscriptionStatus === "active" ||
      subscriptionStatus === "trialing" ||
      subscriptionStatus === "past_due" ||
      subscriptionStatus === "paid";

    return {
      plan,
      intelligenceLevel,
      requestsUsed,
      requestsLimit,
      isPaid,
    };
  } catch (err) {
    console.error("❌ getUserAccessPlan crashed:", err);
    return defaultAccess();
  }
}

export async function checkUserLimit(userId: string): Promise<boolean> {
  const access = await getUserAccessPlan(userId);

  if (access.plan === "intelligence") {
    return access.isPaid;
  }

  if (!Number.isFinite(access.requestsLimit) || access.requestsLimit <= 0) {
    return true;
  }

  return access.requestsUsed < access.requestsLimit;
}

export async function consumeUserRequest(userId: string): Promise<boolean> {
  if (!userId || !supabase) {
    return false;
  }

  const access = await getUserAccessPlan(userId);

  if (access.plan === "intelligence") {
    return access.isPaid;
  }

  if (!Number.isFinite(access.requestsLimit) || access.requestsLimit <= 0) {
    return true;
  }

  if (access.requestsUsed >= access.requestsLimit) {
    return false;
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        requests_used: access.requestsUsed + 1,
        request_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("❌ consumeUserRequest failed:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error("❌ consumeUserRequest crashed:", err);
    return false;
  }
}

export { getIntelligenceLevel };
