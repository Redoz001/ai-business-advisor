import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createConversationMessage,
} from "../types/Message";

import type {
  ConversationMessage,
} from "../types/Message";

import type {
  ConversationEngineProps,
} from "../types/Conversation";

import { MessageService } from "../services/MessageService";
import { RequestPipeline } from "../services/RequestPipeline";
import { useStreaming } from "./useStreaming";

const WELCOME_MESSAGES = [
  "Ask me anything and I’ll break it down step by step.",
  "What are we building today?",
  "I can help you code, design, or think faster.",
  "Drop a problem — I’ll solve it with you.",
  "Need ideas? I’ve got plenty.",
  "Let’s turn your thoughts into code.",
  "Ask me to explain anything simply.",
  "I’m here to help you build smarter.",
  "What challenge are we solving today?",
  "I can debug, design, and optimize your ideas.",
  "Let’s create something powerful.",
  "What do you want to understand better?",
  "Ask me anything technical or creative.",
  "I’ll guide you step by step.",
  "No limits — just ask.",
  "Let’s build something interesting.",
  "Tell me your idea — I’ll shape it.",
  "I can simplify complex topics instantly.",
  "Ready when you are.",
  "Let’s ship something amazing today.",
];

export function useConversation({
  user,
  activeChat,
  setActiveChat,
}: ConversationEngineProps) {
  const [messages, setMessages] =
    useState<ConversationMessage[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [welcomeKey, setWelcomeKey] = useState(0);

  const abortRef =
    useRef<AbortController | null>(null);

  const pipelineRef = useRef(
    new RequestPipeline()
  );

  const { stream } = useStreaming();

  const welcome = useMemo(() => {
    return WELCOME_MESSAGES[
      Math.floor(
        Math.random() * WELCOME_MESSAGES.length
      )
    ];
  }, [welcomeKey]);

  useEffect(() => {
    let alive = true;

    setMessages([]);
    setError(null);
    setWelcomeKey((value) => value + 1);

    if (!activeChat) {
      return () => {
        alive = false;
      };
    }

    async function loadHistory() {
      setHistoryLoading(true);

      try {
        const history =
          await MessageService.loadMessages(
            activeChat
          );

        if (alive) {
          setMessages(history);
        }
      } catch (loadError) {
        if (alive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this conversation."
          );
        }
      } finally {
        if (alive) {
          setHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [activeChat]);

  const updateMessage = useCallback(
    (
      messageId: string,
      update: Partial<ConversationMessage>
    ) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...update,
              }
            : message
        )
      );
    },
    []
  );

  const sendMessage = useCallback(async () => {
    const prompt = input.trim();

    if (!prompt || loading) return;

    setInput("");
    setError(null);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let chatId = activeChat;

    try {
      if (!chatId) {
        chatId = await MessageService.createChat(
          user?.id
        );

        setActiveChat(chatId);
      }

      const userMessage =
        createConversationMessage(
          "user",
          prompt,
          {
            type: "text",
          }
        );

      const assistantMessage =
        createConversationMessage(
          "assistant",
          "",
          {
            type: "text",
            status: "pending",
          }
        );

      const currentContext = [
        ...messages,
        userMessage,
      ];

      setMessages((current) => [
        ...current,
        userMessage,
        assistantMessage,
      ]);

      await MessageService.updateChatTitle(
        chatId,
        prompt
      );

      const result =
        await pipelineRef.current.execute(
          {
            prompt,
            chatId,
            userId: user?.id,
            messages: currentContext,
            signal: controller.signal,
          },
          (input) =>
            MessageService.requestTextResponse(
              input
            ),
          (input, onDelta) =>
            MessageService.streamTextResponse(
              input,
              onDelta
            )
        );

      // For image/video, keep loading state until the visual is actually rendered
      if (result.type === "image" || result.type === "video") {
        // Show a "generating" message while the visual is being prepared
        updateMessage(
          assistantMessage.id,
          {
            type: result.type,
            content: result.type === "video" ? "Generating video..." : "Generating image...",
            metadata: result.metadata,
            status: "pending",
          }
        );

        // Wait for the browser to actually load/display the visual
        if (result.type === "image" && result.image?.url) {
          const imageUrl = result.image.url;
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = imageUrl;
          });
        } else if (result.type === "video" && result.video?.url) {
          // Small buffer to ensure the video element can start loading
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      updateMessage(
        assistantMessage.id,
        {
          type: result.type,
          image: result.image,
          video: result.video,
          metadata: result.metadata,
          status: result.shouldStream
            ? "streaming"
            : "complete",
        }
      );

      if (result.shouldStream) {
        await stream(
          result.content,
          (value) => {
            updateMessage(
              assistantMessage.id,
              {
                content: value,
                status: "streaming",
              }
            );
          },
          controller.signal
        );
      }

      const completedAssistant: ConversationMessage = {
        ...assistantMessage,
        type: result.type,
        content: result.content,
        image: result.image,
        video: result.video,
        metadata: result.metadata,
        status: "complete",
      };

      updateMessage(
        assistantMessage.id,
        completedAssistant
      );

      await MessageService.saveMessages(
        chatId,
        [
          userMessage,
          completedAssistant,
        ]
      );
    } catch (sendError) {
      if (
        sendError instanceof DOMException &&
        sendError.name === "AbortError"
      ) {
        updateMessageByPending(
          setMessages,
          "Generation stopped."
        );

        return;
      }

      const message =
        sendError instanceof Error
          ? sendError.message
          : "An unexpected error occurred.";

      setError(message);

      setMessages((current) => [
        ...current.filter(
          (item) =>
            item.status !== "pending" &&
            item.status !== "streaming"
        ),
        createConversationMessage(
          "assistant",
          `⚠️ ${message}`,
          {
            type: "system",
            status: "error",
          }
        ),
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [
    activeChat,
    input,
    loading,
    messages,
    setActiveChat,
    stream,
    updateMessage,
    user?.id,
  ]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Convert file to data URL and send as a message
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const prompt = `I uploaded an image. Please analyze this image and help me with it.`;

      // Add user message with the uploaded image
      const userMessage = createConversationMessage("user", prompt, {
        type: "text",
        image: { url: dataUrl },
      });

      setMessages((current) => [...current, userMessage]);

      // Trigger AI response
      setInput(prompt);
      await sendMessage();
    };
    reader.readAsDataURL(file);
  }, [sendMessage, setInput]);

  const handleCameraCapture = useCallback(async (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const prompt = `I took a photo. Please analyze this image and help me with it.`;

      const userMessage = createConversationMessage("user", prompt, {
        type: "text",
        image: { url: dataUrl },
      });

      setMessages((current) => [...current, userMessage]);
      setInput(prompt);
      await sendMessage();
    };
    reader.readAsDataURL(file);
  }, [sendMessage, setInput]);

  const handleDownloadImage = useCallback((url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "reunexus-image.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleDownloadVideo = useCallback((url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "reunexus-video.webm";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    messages,
    input,
    setInput,
    loading,
    historyLoading,
    error,
    welcome,
    sendMessage,
    stop,
    handleImageUpload,
    handleCameraCapture,
    handleDownloadImage,
    handleDownloadVideo,
  };
}

function updateMessageByPending(
  setter: React.Dispatch<
    React.SetStateAction<ConversationMessage[]>
  >,
  content: string
) {
  setter((current) =>
    current.map((message) =>
      message.status === "pending" ||
      message.status === "streaming"
        ? {
            ...message,
            content:
              message.content || content,
            status: "complete",
          }
        : message
    )
  );
}
