import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { askReuben } from '../services/aiService';

export default function ReubenAI() {
  const [messages, setMessages] = useState([{ role: 'ai', content: 'System Ready. Type and hit Send.' }]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userText = input;
    const userMsg = { role: 'user', content: userText };
    
    // 1. Update UI with User message
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // 2. Save User message to Supabase
      await supabase.from('chat_messages').insert([{ role: 'user', content: userText }]);

      // 3. Get AI Reply
      const aiReply = await askReuben(userText);
      const aiMsg = { role: 'ai', content: aiReply };

      // 4. Update UI and Save AI message to Supabase
      setMessages(prev => [...prev, aiMsg]);
      await supabase.from('chat_messages').insert([{ role: 'ai', content: aiReply }]);
      
    } catch (error) {
      console.error("Error in handleSend:", error);
      setMessages(prev => [...prev, { role: 'ai', content: 'Error: Could not reach the AI.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ background: '#000', color: '#fff', padding: '20px', minHeight: '100vh' }}>
      <h1>Reuben AI</h1>
      
      <div style={{ border: '1px solid #333', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '10px 0', padding: '8px', borderBottom: '1px solid #222' }}>
            <strong style={{ color: m.role === 'user' ? '#888' : '#00ffcc' }}>{m.role}: </strong>
            {m.content}
          </div>
        ))}
        {isProcessing && <div style={{ color: '#00ffcc' }}>Reuben is thinking...</div>}
      </div>
      
      <form onSubmit={handleSend}>
        <input 
          style={{ width: '80%', padding: '10px', color: '#000' }}
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Ask Reuben anything..."
        />
        <button 
          disabled={isProcessing}
          type="submit" 
          style={{ padding: '10px', marginLeft: '10px', cursor: 'pointer' }}
        >
          {isProcessing ? '...' : 'SEND'}
        </button>
      </form>
    </div>
  );
}