import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Sidebar({ isOpen, onClose, onSelectSession }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const { data } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      setSessions(data || []);
    };
    if (isOpen) fetchSessions();
  }, [isOpen]);

  return (
    <div className={`fixed top-0 left-0 h-full w-64 bg-gray-950 border-r border-gray-800 transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-5">
        <button onClick={onClose} className="text-white mb-6">Close</button>
        <h2 className="text-gray-400 mb-4">Recent Chats</h2>
        {sessions.map(s => (
          <button 
            key={s.id} 
            onClick={() => onSelectSession(s.id)}
            className="block w-full text-left p-2 hover:bg-gray-800 rounded text-sm text-white"
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}