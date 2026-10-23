import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.1.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const authorization = req.headers.get("Authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return jsonResponse({ error: "Sign in before starting checkout." }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(
      accessToken,
    );
    if (authError || !authData.user) {
      return jsonResponse({
        error: "Your session is invalid. Please sign in again.",
      }, 401);
    }

    const { plan = "intelligence" } = await req.json();

    if (plan !== "intelligence") {
      return jsonResponse({
        error: "Only the Intelligence plan can be purchased.",
      }, 400);
    }

    const priceId = Deno.env.get("STRIPE_INTELLIGENCE_PRICE_ID");
    if (!priceId) {
      return jsonResponse(
        { error: "INTELLIGENCE pricing is not configured." },
        500,
      );
    }

    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) {
      return jsonResponse({ error: "APP_URL is not configured." }, 500);
    }
    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      throw new Error(
        `Could not load billing profile: ${profileError.message}`,
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id
        ? undefined
        : authData.user.email ?? undefined,
      client_reference_id: userId,
      metadata: {
        userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId,
          plan,
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/?checkout=success&plan=intelligence`,
      cancel_url: `${appUrl}/?checkout=cancelled&plan=intelligence`,
      allow_promotion_codes: true,
    });

    const { error: updateError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        subscription_status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (updateError) {
      throw new Error(
        `Could not update billing profile: ${updateError.message}`,
      );
    }

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return jsonResponse({ url: session.url });
  } catch (error: any) {
    console.error("billing checkout failed:", error);
    return jsonResponse({ error: error?.message ?? "Checkout failed." }, 500);
  }
});
