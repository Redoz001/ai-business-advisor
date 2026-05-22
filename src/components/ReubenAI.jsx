import React, { useState, useRef, useEffect } from 'react';
import { askReuben } from '../services/aiService';

export default function ReubenAI({ session }) {

  const [messages, setMessages] = useState([
    {
      role: 'ai',
      content: 'System Ready. Type a message.'
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const bottomRef = useRef(null);

  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages, isLoading]);

  // =========================
  // SEND MESSAGE
  // =========================
  const handleSend = async (e) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage = input;

    // SAFE MESSAGE SNAPSHOT
    const updatedMessages = [
      ...messages,
      {
        role: 'user',
        content: userMessage
      }
    ];

    // UPDATE UI IMMEDIATELY
    setMessages(updatedMessages);

    setInput('');
    setIsLoading(true);

    try {

      // AI REQUEST
      const reply = await askReuben(
        userMessage,
        session?.user?.id,
        updatedMessages
      );

      // ADD AI RESPONSE
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: reply || 'No response received.'
        }
      ]);

    } catch (error) {

      console.error(error);

      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: 'Error: AI not responding.'
        }
      ]);

    } finally {

      setIsLoading(false);

    }
  };

  return (

    <div className="flex flex-col h-[calc(100vh-90px)] bg-black text-white rounded-xl border border-zinc-800 overflow-hidden">

      {/* CHAT MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {messages.map((m, i) => (

          <div
            key={i}
            className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-lg ${
              m.role === 'user'
                ? 'ml-auto bg-[#00ffcc] text-black'
                : 'mr-auto bg-zinc-900 border border-zinc-800 text-white'
            }`}
          >

            <div className="text-xs opacity-70 mb-1 font-bold">
              {m.role === 'user' ? 'YOU' : 'REUBEN AI'}
            </div>

            <div className="whitespace-pre-wrap break-words">
              {m.content}
            </div>

          </div>

        ))}

        {isLoading && (

          <div className="mr-auto bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-sm animate-pulse">
            REUBEN AI is thinking...
          </div>

        )}

        <div ref={bottomRef}></div>

      </div>

      {/* INPUT BAR */}
      <form
        onSubmit={handleSend}
        className="border-t border-zinc-800 bg-zinc-950 p-4"
      >

        <div className="flex items-center gap-3">

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Reuben AI anything..."
            className="
              flex-1
              bg-zinc-900
              border
              border-zinc-700
              text-white
              rounded-xl
              px-4
              py-3
              outline-none
              focus:border-[#00ffcc]
            "
          />

          <button
            type="submit"
            disabled={isLoading}
            className="
              px-5
              py-3
              rounded-xl
              bg-[#00ffcc]
              text-black
              font-bold
              hover:opacity-90
              transition
              disabled:opacity-50
            "
          >
            SEND
          </button>

        </div>

      </form>

    </div>
  );
}