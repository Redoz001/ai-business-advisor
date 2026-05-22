import React, { useState, useRef, useEffect } from 'react';
import { askReuben } from '../services/aiService';

export default function ReubenAI({ session }) {

  // =========================
  // STATE (UNCHANGED + ADDITIONS)
  // =========================
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      content: 'System Ready. Type a message.'
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 🧠 MEMORY (NEW - local session memory)
  const [memory, setMemory] = useState([]);

  const bottomRef = useRef(null);

  // 🎤 VOICE INPUT (NEW)
  const recognitionRef = useRef(null);

  // =========================
  // AUTO SCROLL (UNCHANGED)
  // =========================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages, isLoading]);

  // =========================
  // LOCAL AI RESPONSES (UNCHANGED BUT ENHANCED)
  // =========================
  const handleLocalAIResponses = (message) => {
    const msg = message.toLowerCase();

    if (msg.includes("who are you")) {
      return "I am Reuben AI, your assistant inside this system, designed to help you chat, automate tasks, and evolve with memory and tools.";
    }

    if (msg.includes("who created you")) {
      return "I was created by Redoz Muriz using React, Supabase, and AI API integration as a custom SaaS assistant system.";
    }

    return null;
  };

  // =========================
  // 🧠 MEMORY UPDATE SYSTEM (NEW)
  // =========================
  const updateMemory = (userMsg, aiMsg) => {
    const newMemory = {
      user: userMsg,
      ai: aiMsg,
      time: Date.now()
    };

    setMemory(prev => [...prev.slice(-10), newMemory]); // keep last 10
  };

  // =========================
  // 🎤 VOICE INPUT (NEW FEATURE)
  // =========================
  const startVoiceInput = () => {

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  // =========================
  // SEND MESSAGE (UPGRADED ONLY)
  // =========================
  const handleSend = async (e) => {

    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();

    const updatedMessages = [
      ...messages,
      { role: 'user', content: userMessage }
    ];

    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {

      // =========================
      // LOCAL RESPONSE FIRST
      // =========================
      const localReply = handleLocalAIResponses(userMessage);

      if (localReply) {

        setMessages(prev => [
          ...prev,
          { role: 'ai', content: localReply }
        ]);

        updateMemory(userMessage, localReply);
        return;
      }

      // =========================
      // REAL AI CALL
      // =========================
      const reply = await askReuben(
        userMessage,
        session?.user?.id,
        updatedMessages,
        memory // 🧠 memory passed for future AI upgrade
      );

      const finalReply = reply || 'No response received.';

      setMessages(prev => [
        ...prev,
        { role: 'ai', content: finalReply }
      ]);

      // 🧠 save memory
      updateMemory(userMessage, finalReply);

    } catch (error) {

      console.error('AI ERROR:', error);

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

  // =========================
  // UI
  // =========================
  return (

    <div className="flex flex-col h-full bg-black text-white rounded-xl border border-zinc-800 overflow-hidden">

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

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

      {/* INPUT AREA */}
      <form
        onSubmit={handleSend}
        className="border-t border-zinc-800 bg-zinc-950 p-4"
      >

        <div className="flex items-center gap-3">

          {/* INPUT */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Reuben AI anything..."
            className="flex-1 bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-3 outline-none focus:border-[#00ffcc]"
          />

          {/* 🎤 VOICE BUTTON (NEW) */}
          <button
            type="button"
            onClick={startVoiceInput}
            className="px-3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700"
          >
            🎤
          </button>

          {/* SEND */}
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-3 rounded-xl bg-[#00ffcc] text-black font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            SEND
          </button>

        </div>

      </form>

    </div>
  );
}