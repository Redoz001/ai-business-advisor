import React, { useState, useEffect, useRef } from 'react';
import aiService from './services/aiService';
import ghostProtocol from './lib/ghostProtocol';

export default function Chat() {
  const [messages, setMessages] = useState([{ 
    role: 'assistant', 
    content: "🚀 Reuben Murimi Intelligence Active. Unlimited domains online." 
  }]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // Optimized for Windows/Dell hardware environment
    ghostProtocol.optimizeHardwareResources(); 
  }, [messages]);

  const handleExecute = async () => {
    if (!input.trim() || isProcessing) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setIsProcessing(true);

    try {
      // This now hits your Supabase Edge Function URL
      const response = await aiService.forge(input, context);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error("Neural Core Link Failure:", err);
      const patch = await ghostProtocol.autoPatch("EXECUTION_HALT");
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ System Patched: ${patch}` }]);
    } finally {
      setIsProcessing(false);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="p-3">
        <div className="system-status mb-2 text-xs opacity-50">
          NEURAL CORE: {isProcessing ? 'PROCESSING...' : 'READY'} | ENDPOINT: whvzdutfyydshamwfhvu
        </div>
        <input 
          className="context-input w-full" 
          placeholder="Injection Context (e.g., Security Audit, Scaling)..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>
      <div className="chat-messages flex-1 overflow-auto p-3">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role} mb-3 fade-in`}>
            <div className="p-2 rounded bg-secondary">{m.content}</div>
          </div>
        ))}
        {isProcessing && <div className="message assistant mb-3 animate-pulse">Initializing response...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 flex gap-2">
        <textarea 
          className="chat-input flex-1"
          placeholder="Enter command..."
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleExecute()}
        />
        <button onClick={handleExecute} disabled={isProcessing} className="send-btn p-3">
          {isProcessing ? '...' : 'EXECUTE'}
        </button>
      </div>
    </div>
  );
}