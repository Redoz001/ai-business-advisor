# 🧠 AI Intelligence Features

## Overview

Your Global Business Mentor now has **advanced AI capabilities** powered by:
- **OpenAI GPT-4** (primary)
- **Anthropic Claude** (fallback)
- **Intelligent Local Response Generation** (offline fallback)

## How It Works

### 1. Intent Detection
The AI analyzes your question to understand what you're really asking:
- **Question Detection**: "How", "What", "Why", "When", "Where"
- **Problem Solving**: "stuck", "error", "issue"
- **Request for Help**: "help", "guide", "assist"
- **Planning**: "strategy", "roadmap", "goal"
- **Learning**: "learn", "improve", "skill"
- **Scaling**: "hire", "grow", "scale"

### 2. Keyword Extraction
The system identifies key topics:
- `product` - MVP, features, design
- `market` - customers, users, market fit
- `pricing` - rates, fees, monetization
- `growth` - scaling, expansion, revenue
- `team` - hiring, management, delegation
- `marketing` - sales, funnels, channels
- `technical` - code, architecture, tech stack
- `strategy` - planning, roadmaps
- `finance` - money, profit, revenue
- `quality` - testing, bugs, quality assurance

### 3. Persona-Specific Responses
Each persona gets specialized knowledge:

#### 🚀 Beginner (Founder)
- Market validation techniques
- MVP development strategies
- Pricing fundamentals
- Growth frameworks
- Customer discovery methods

#### 🎓 Student (Career Builder)
- Portfolio development
- Interview preparation
- Resume optimization
- Networking strategies
- Technical skill building

#### 💻 Freelancer (Independent Pro)
- Rate calculation and pricing strategy
- Client acquisition
- Portfolio building
- Scaling techniques
- Income diversification

#### ⚙️ Engineer (Tech Lead)
- System architecture
- Scalability optimization
- Security best practices
- Code quality and testing
- DevOps and infrastructure

#### 📊 Marketer (Growth Strategist)
- Funnel optimization
- CAC/LTV analysis
- Channel strategy
- A/B testing frameworks
- Analytics and metrics

## Setup Instructions

### Option 1: Using OpenAI GPT-4 (Recommended)

```bash
# 1. Get your OpenAI API key
# Visit: https://platform.openai.com/api-keys

# 2. Create .env.local file
REACT_APP_AI_PROVIDER=openai
REACT_APP_OPENAI_API_KEY=sk-...

# 3. Install dependencies
npm install

# 4. Start the dev server
npm run dev
```

### Option 2: Using Claude API

```bash
# 1. Get your Claude API key
# Visit: https://console.anthropic.com/

# 2. Create .env.local file
REACT_APP_AI_PROVIDER=claude
REACT_APP_CLAUDE_API_KEY=sk-ant-...

# 3. Start the dev server
npm run dev
```

### Option 3: Hybrid Mode (Recommended)

```bash
# Use both OpenAI and Claude with automatic fallback
# Set both API keys in .env.local
REACT_APP_AI_PROVIDER=hybrid
REACT_APP_OPENAI_API_KEY=sk-...
REACT_APP_CLAUDE_API_KEY=sk-ant-...
```

### Option 4: No API Key (Local Fallback)

If you don't set API keys, the system will use intelligent local response generation:
- Pattern matching on keywords
- Intent-based responses
- Persona-specific advice
- Works offline

```bash
# No .env.local file needed - uses local fallback
npm run dev
```

## Advanced Features

### Context-Aware Responses
The AI remembers your conversation history and:
- References previous questions
- Builds on earlier advice
- Provides consistent guidance
- Learns from clarifications

### Intelligent Error Handling
- Graceful fallback if API fails
- Error messages shown to user
- Automatic retry capability
- Offline mode support

### Real-time Typing Indicator
- Shows when AI is thinking
- Improves user experience
- Professional feel
- Auto-scrolls to responses

## Example Questions the AI Can Answer

### For Founders
- "How do I validate my startup idea?"
- "What should my MVP include?"
- "How should I price my product?"
- "What's the best way to find my first customers?"
- "When should I hire my first employee?"

### For Students
- "How do I build an impressive portfolio?"
- "What should I focus on to land an internship?"
- "How do I prepare for technical interviews?"
- "Should I do a bootcamp or degree?"
- "How do I negotiate my first job offer?"

### For Freelancers
- "What rate should I charge?"
- "How do I find high-paying clients?"
- "Should I start a productized service?"
- "When should I start hiring?"
- "How do I increase my income without more hours?"

### For Engineers
- "Should I use microservices?"
- "How do I improve code quality?"
- "What's the best way to scale?"
- "How do I learn system design?"
- "What security practices should I implement?"

### For Marketers
- "How do I calculate customer lifetime value?"
- "What's a healthy customer acquisition cost?"
- "How do I improve conversion rates?"
- "Should I focus on paid or organic?"
- "How do I set up proper analytics?"

## Cost Estimates

### OpenAI GPT-4
- **Input**: $0.03 per 1K tokens
- **Output**: $0.06 per 1K tokens
- Average conversation: ~200 tokens = ~$0.018
- Monthly budget: 1000 conversations ≈ $18/month

### Claude 3 Opus
- **Input**: $0.015 per 1K tokens
- **Output**: $0.075 per 1K tokens
- Average conversation: ~200 tokens = ~0.018
- Monthly budget: 1000 conversations ≈ $18/month

## Future Enhancements

- [ ] Multi-turn conversation memory
- [ ] User preference learning
- [ ] Conversation export to PDF
- [ ] Voice input/output
- [ ] Real-time collaboration mode
- [ ] Analytics dashboard
- [ ] Custom fine-tuning on your domain
- [ ] Integration with tools (Notion, Slack, etc.)

## Troubleshooting

### API Key Not Working
```bash
# Check your API key format
# OpenAI: Should start with 'sk-'
# Claude: Should start with 'sk-ant-'

# Verify in .env.local (no quotes needed):
REACT_APP_OPENAI_API_KEY=sk-your-actual-key
```

### Rate Limiting
- OpenAI: 3,500 requests per minute (free tier)
- Claude: 50 requests per minute (free tier)
- Upgrade for higher limits

### No Response from AI
- Check network connection
- Verify API key is correct
- Check API credits/quota
- Try the other provider
- Falls back to local mode

## Support

For issues or questions:
- Check the troubleshooting section above
- Review API provider documentation
- Check console for error messages
- Open an issue on GitHub