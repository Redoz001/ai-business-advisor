import React, {
  useState,
  useRef,
  useEffect,
} from "react";
import { supabase } from "../lib/supabase";
import { sendMessageToAI } from "../services/aiService";

export default function ReubenAI({
  user,
  activeChat,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] =
    useState(false);

  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const text = input;
    setInput("");
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
      },
      {
        role: "ai",
        content: "...",
      },
    ]);

    try {
      const res = await sendMessageToAI({
        message: text,
        userId: user.id,
        chatId: activeChat,
      });

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1].content =
          res.reply;
        return copy;
      });
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1].content =
          err.message;
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl max-w-[80%] ${
              m.role === "user"
                ? "bg-green-400 text-black ml-auto"
                : "bg-zinc-900"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="text-gray-400">
            Thinking...
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="p-3 flex gap-2 border-t border-zinc-800">
        <textarea
          className="flex-1 bg-zinc-900 p-3 rounded-xl"
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          placeholder="Message ReubenAI..."
        />

        <button
          onClick={sendMessage}
          className="bg-green-400 text-black px-4 rounded-xl font-bold"
        >
          Send
        </button>
      </div>
    </div>
  );
}