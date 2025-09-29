# ProMe - AI Marketing Content Generator

A sophisticated AI-powered marketing content generation platform built with React, TypeScript, and Dify AI integration.

## 🚀 Features

- **AI-Powered Content Generation**: Leverages Dify AI workflows for intelligent marketing content creation
- **Multi-Stage Workflow**: Guides users through product information collection, pain point analysis, and content strategy development
- **Real-time Streaming**: Server-Sent Events (SSE) for responsive AI interactions
- **Conversation Management**: Cloud-based conversation history with Supabase integration
- **Token Monitoring**: Built-in usage tracking and billing integration
- **Pain Point Branching**: Multiple content generation paths with version management
- **Mobile Responsive**: Fully responsive design with TailwindCSS and shadcn/ui

## 🛠 Tech Stack

### Frontend
- **React 18.3.1** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** + **shadcn/ui** for styling
- **Lucide React** for icons
- **Sonner** for notifications

### Backend
- **Express.js** API proxy server
- **Node-fetch** for API communication
- **CORS** enabled for cross-origin requests

### Database & Auth
- **Supabase** for user management and conversation storage
- Row Level Security (RLS) policies for data protection

### AI Integration
- **Dify AI** ChatFlow workflows
- Streaming response processing
- Conversation state management

## 📋 Prerequisites

- Node.js 18+ and PNPM 8+
- Dify AI account with app configured
- Supabase project with authentication enabled

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd prome-platform
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your configuration:
   ```env
   # Dify AI Configuration
   VITE_DIFY_API_URL=https://api.dify.ai/v1
   VITE_DIFY_APP_ID=your_dify_app_id
   VITE_DIFY_API_KEY=your_dify_api_key
   
   # Supabase Configuration  
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Server Configuration
   PORT=8080
   ```

4. **Start Development Servers**
   ```bash
   # Frontend development server (port 5173)
   pnpm run dev
   
   # Backend API server (port 8080) 
   node server.js
   ```

5. **Access the Application**
   - Chat Interface: `http://localhost:8080/chat/dify`
   - Development Preview: `http://localhost:5173`

## 🏗 Build & Deploy

### Production Build
```bash
pnpm run build
```

### Start Production Server
```bash
pnpm start
```

### Deploy to Zeabur
1. Connect your GitHub repository to Zeabur
2. Configure environment variables in Zeabur dashboard
3. Deploy with automatic build detection

## 🔗 API Endpoints

### Chat API
- `POST /api/dify` - Start new conversation
- `POST /api/dify/:conversationId` - Continue existing conversation

### System API
- `GET /api/health` - Health check
- `GET /api/env-info` - Environment info (development only)

## 🎯 Usage Guide

### Basic Chat Flow
1. Visit `/chat/dify` route
2. Provide product information (4 key details required)
3. Generate pain points using "Start Generating Pain Points" button
4. Select preferred pain point for detailed analysis
5. Confirm content strategy and generate final marketing content

### Workflow Stages
1. **Information Collection**: Product details gathering
2. **Pain Point Generation**: AI-generated customer pain points
3. **Pain Point Refinement**: Detailed analysis and content strategy
4. **Content Generation**: Final marketing copy creation

### Conversation Management
- Conversations are automatically saved to Supabase
- Access conversation history via header button
- Create new conversations with Ctrl+N (or Cmd+N on Mac)
- Cloud sync with offline capability

## 🔧 Development

### Key Components
- `DifyChatInterface.tsx` - Main chat interface (3,683 lines)
- `PainPointBranchContent.tsx` - Workflow button management
- `useTokenMonitoring.ts` - Token usage tracking
- `cloudChatHistory.ts` - Conversation persistence

### Debugging
Development console commands available at `window.debugChat`:
- `debugWorkflowStatus()` - Check workflow state
- `checkLocalStorage()` - Inspect local storage
- `hardReset()` - Reset all chat state

### Workflow Button Integration
```typescript
// Trigger workflow stages with specific Chinese phrases
onWorkflowButtonClick('开始生成痛点')  // Start pain point generation
onWorkflowButtonClick('痛点1')        // Select pain point 1
onWorkflowButtonClick('biubiu')       // Generate content strategy
onWorkflowButtonClick('确认')         // Confirm and continue
```

## 🚨 Known Limitations

### Dify API Constraints
- No message regeneration API - requires new conversations for clean regeneration
- Conversation variables cannot be reset via API
- Workflow routing depends on conversation state preservation

### Performance Considerations
- Large component (3,683 lines) - consider code splitting for production
- Streaming responses require stable WebSocket-like connections
- LocalStorage used for session persistence (10MB limit)

## 🔐 Security

- Environment variables prefixed with `VITE_` for frontend access
- Supabase RLS policies enforce data access controls
- CORS configured for specific origins
- API key validation on server startup

## 📞 Support

For issues related to:
- **Dify Integration**: Check API keys and app configuration
- **Supabase Connection**: Verify database connection and RLS policies  
- **Deployment Issues**: Review environment variables and build logs
- **Workflow Problems**: Use debugging tools in development mode

## 📄 License

This project is proprietary software developed for ProMe platform.

---

Built with ❤️ using React, TypeScript, and Dify AI