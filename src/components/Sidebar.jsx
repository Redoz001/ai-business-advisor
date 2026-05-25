import React from "react";

export default function Sidebar({
  sessions,
  activeChat,
  setActiveChat,
  createNewChat,
}) {
  return (
    <div className="w-72 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col">

      {/* HEADER */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-white font-semibold">ReubenAI</h1>
        <p className="text-xs text-zinc-500">SaaS Workspace</p>
      </div>

      {/* NEW CHAT */}
      <div className="p-3">
        <button
          onClick={createNewChat}
          className="w-full bg-[#00ffcc] text-black py-2 rounded-xl text-sm font-semibold"
        >
          + New Chat
        </button>
      </div>

      {/* CHAT LIST */}
      <div className="flex-1 overflow-y-auto px-2 space-y-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveChat(s.id)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
              activeChat === s.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            {s.title || "New Chat"}
          </button>
        ))}
      </div>
    </div>
  );
}