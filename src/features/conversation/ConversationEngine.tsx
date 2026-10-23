"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import ChatInput from "./components/ChatInput";
import Conversation from "./components/Conversation";

import { useConversation } from "./hooks/useConversation";

import type {
  ConversationEngineProps,
} from "./types/Conversation";

export default function ConversationEngine(
  props: ConversationEngineProps
) {
  const conversation =
    useConversation(props);

  const [lastAiResponse, setLastAiResponse] =
    useState("");
  const [plan, setPlan] = useState("normal");
  const [usageUsed, setUsageUsed] = useState(0);
  const [usageLimit, setUsageLimit] = useState(20);
  const [requestResetAt, setRequestResetAt] = useState<string | null>(null);

  useEffect(() => {
    if (!props.user?.id) {
      setPlan("normal");
      setUsageUsed(0);
      setUsageLimit(20);
      setRequestResetAt(null);
      return;
    }

    let active = true;

    const loadUsage = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("plan, requests_used, requests_limit, request_reset_at, subscription_status, is_premium")
        .eq("id", props.user.id)
        .maybeSingle();

      if (!active || error) {
        return;
      }

      const normalizedPlan = String(data?.plan ?? "normal").toLowerCase();
      const isPaid = Boolean(data?.is_premium) ||
        String(data?.subscription_status ?? "").toLowerCase() === "active" ||
        String(data?.subscription_status ?? "").toLowerCase() === "trialing";

      const resolvedPlan = isPaid || normalizedPlan === "intelligence" ? "intelligence" : normalizedPlan;

      setPlan(resolvedPlan);
      setUsageUsed(Number(data?.requests_used ?? 0));
      setUsageLimit(Number(data?.requests_limit ?? 20));
      setRequestResetAt(data?.request_reset_at ?? null);
    };

    loadUsage();

    const channel = supabase
      .channel(`usage-sync-${props.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${props.user.id}`,
        },
        async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("plan, requests_used, requests_limit, request_reset_at, subscription_status, is_premium")
            .eq("id", props.user.id)
            .maybeSingle();

          if (!active || error || !data) {
            return;
          }

          const normalizedPlan = String(data?.plan ?? "normal").toLowerCase();
          const isPaid = Boolean(data?.is_premium) ||
            String(data?.subscription_status ?? "").toLowerCase() === "active" ||
            String(data?.subscription_status ?? "").toLowerCase() === "trialing";

          setPlan(isPaid || normalizedPlan === "intelligence" ? "intelligence" : normalizedPlan);
          setUsageUsed(Number(data?.requests_used ?? 0));
          setUsageLimit(Number(data?.requests_limit ?? 20));
          setRequestResetAt(data?.request_reset_at ?? null);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [props.user?.id]);

  const handleQuickSend = (message: string) => {
    conversation.setInput(message);
    // Need to wait a tick for state to update
    setTimeout(() => {
      conversation.sendMessage();
    }, 50);
  };

  const handleUpgradeToIntelligence = async () => {
    if (!props.user?.id) {
      window.location.href = "/auth";
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("billing-checkout", {
        body: {
          userId: props.user.id,
          email: props.user.email,
          plan: "intelligence",
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error("Checkout URL was not returned.");
      }

      window.location.href = data.url;
    } catch (upgradeError) {
      console.error("Upgrade failed:", upgradeError);
      alert("Could not start the Intelligence checkout. Please try again.");
    }
  };

  // Watch for new assistant messages to speak them
  const latestAssistant =
    conversation.messages.findLast(
      (m) => m.role === "assistant"
    );

  useEffect(() => {
    if (
      latestAssistant?.content &&
      latestAssistant.content !== lastAiResponse &&
      latestAssistant.content !== "Generating image..." &&
      latestAssistant.content !== "Generating video..."
    ) {
      setLastAiResponse(latestAssistant.content);
    }
  }, [latestAssistant?.content]);

  const username =
    props.user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950 text-white">
      <Conversation
        messages={conversation.messages}
        welcome={conversation.welcome}
        username={username}
        userId={props.user?.id}
        chatId={props.activeChat}
        loadingHistory={
          conversation.historyLoading
        }
        onDownloadImage={
          conversation.handleDownloadImage
        }
        onDownloadVideo={
          conversation.handleDownloadVideo
        }
      />

      {conversation.error && (
        <div className="px-3 pb-2 text-sm text-red-400">
          {conversation.error}
        </div>
      )}

      <ChatInput
        input={conversation.input}
        loading={conversation.loading}
        onInputChange={
          conversation.setInput
        }
        onSend={conversation.sendMessage}
        onStop={conversation.stop}
        onImageUpload={
          conversation.handleImageUpload
        }
        onCameraCapture={
          conversation.handleCameraCapture
        }
        onQuickSend={handleQuickSend}
        aiResponseText={lastAiResponse}
        plan={plan}
        usageUsed={usageUsed}
        usageLimit={usageLimit}
        requestResetAt={requestResetAt}
        onUpgradeToIntelligence={handleUpgradeToIntelligence}
      />
    </div>
  );
}
