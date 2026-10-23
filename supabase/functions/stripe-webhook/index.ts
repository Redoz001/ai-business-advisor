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
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function updateProfile(
  userId: string,
  values: Record<string, string | boolean | null>,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new Error(`Could not update billing profile: ${error.message}`);
  }
}

async function updateSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) {
    console.error(
      "Stripe subscription is missing userId metadata:",
      subscription.id,
    );
    return;
  }

  const active = subscription.status === "active" ||
    subscription.status === "trialing";

  await updateProfile(userId, {
    plan: active ? "intelligence" : "normal",
    subscription_tier: active ? "intelligence" : "normal",
    account_tier: active ? "intelligence" : "normal",
    subscription_status: subscription.status,
    is_premium: active,
    stripe_customer_id: stripeId(subscription.customer),
    stripe_subscription_id: subscription.id,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!signature || !webhookSecret) {
      return jsonResponse(
        { error: "Missing Stripe webhook signature or secret." },
        400,
      );
    }

    const event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      webhookSecret,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId ?? session.client_reference_id;
        const subscriptionId = stripeId(session.subscription);

        if (userId) {
          if (subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(
              subscriptionId,
            );
            await updateSubscription(subscription);
          } else {
            await updateProfile(userId, {
              subscription_status: "pending",
              stripe_customer_id: stripeId(session.customer),
            });
          }
        } else {
          console.error(
            "Stripe Checkout session is missing userId:",
            session.id,
          );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await updateSubscription(event.data.object);
        break;
      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("stripe webhook failed:", error);
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "Webhook processing failed.",
      },
      400,
    );
  }
});
