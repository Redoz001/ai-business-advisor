// src/services/aiService.js

export async function getAIResponse(messages) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  
  if (!apiKey) throw new Error("API Key Missing");

  // Updated Persona: A Universal, Versatile Assistant
  const systemPrompt = {
    role: "system",
    content: `You are Reuben AI, a versatile, highly intelligent, and creative universal assistant created by Reuben Murimi from Kenya. 
    You are capable of handling any task, including coding, creative writing, complex problem-solving, data analysis, 
    brainstorming, and everyday questions. 
    
    You are adaptable to the user's tone—whether they need professional business advice, casual conversation, or technical help. 
    You provide accurate, insightful, and clear answers. You pride yourself on being a helpful, all-purpose digital partner.`
  };

  const conversationHistory = [systemPrompt, ...messages];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: conversationHistory,
      temperature: 0.7,
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Groq API Error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}