import React, { useState } from 'react';

export default function ReubenAI() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep these configurations clean and explicit
  const SUPABASE_URL = "https://whvzdutfyydshamwfhvu.supabase.co";
  const FUNCTION_NAME = "reuben-ai";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndodnpkdXRmeXlkc2hhbXdmaHZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NjQ5MDAsImV4cCI6MjA5NDE0MDkwMH0.KEVgU3l-d9glmFf0n4oO3nOnLnvbxTu98gdwh3hyWmo";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({ message: message.trim() })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }

      setResponse(data.reply);
    } catch (err) {
      console.error("AI Communication Failure:", err);
      setError(err.message || "Failed to establish context with Reuben AI.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2 style={{ marginBottom: '1rem' }}>🤖 Reuben AI Assistant</h2>
      
      {/* Interaction Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask Reuben AI something..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid #ccc',
            fontSize: '1rem'
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !message.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: isLoading ? '#ccc' : '#0070f3',
            color: '#fff',
            fontSize: '1rem',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </form>

      {/* Error Interface Output */}
      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fff5f5', color: '#e53e3e', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #fed7d7' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Response Interface Output */}
      {response && (
        <div style={{ padding: '1.25rem', backgroundColor: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: '1.5' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568' }}>Response:</strong>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#2d3748' }}>{response}</p>
        </div>
      )}
    </div>
  );
}