# N8n Chat Integration Guide

This document explains how to integrate and use the N8n chat widget in the ProMe AI platform.

## Overview

The N8n chat integration allows users to interact with AI-powered workflows through an embedded chat interface. Users can execute workflows, get AI assistance, and automate tasks directly from the ProMe platform.

## Features

- **Embedded Chat Widget**: Seamless N8n chat integration with React components
- **Window & Fullscreen Modes**: Flexible chat display options
- **Authentication Integration**: Works with existing user authentication
- **Internationalization**: Full support for English and Chinese languages
- **Error Handling**: Graceful handling of configuration and connection issues
- **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### 1. N8n Workflow Configuration

First, you need to set up an N8n workflow with a Chat Trigger:

1. **Create a new workflow** in your N8n instance
2. **Add a "Chat Trigger" node** as the starting point
3. **Configure the Chat Trigger**:
   - Set allowed origins to include your ProMe platform domain
   - Configure the webhook URL (you'll need this later)
4. **Build your workflow** with AI nodes, processing logic, etc.
5. **Activate the workflow**

### 2. Environment Configuration

Add the following environment variables to your `.env` file:

```env
# Enable N8n integration
VITE_ENABLE_N8N_INTEGRATION=true

# N8n webhook URL from your Chat Trigger node
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-webhook-id
```

### 3. Access the Chat Interface

Once configured, users can access the N8n chat through:

- **Direct URL**: `http://localhost:5175/chat/n8n`
- **Navigation**: Through the main navigation or dashboard links

## Technical Implementation

### Components Created

1. **`N8nChatWidget.tsx`** - React wrapper component for the @n8n/chat library
2. **`N8nChat.tsx`** - Full page interface for N8n chat interactions
3. **Route Configuration** - Added `/chat/n8n` route in App.tsx
4. **Internationalization** - Added translations for English and Chinese

### Key Features

- **Authentication Required**: Users must be logged in to access N8n chat
- **Error Handling**: Shows helpful error messages if N8n is not configured
- **Loading States**: Displays loading indicators during initialization
- **Mode Switching**: Toggle between window and fullscreen chat modes
- **User Context**: Displays current user information and ID

### Integration Points

- **Auth Service**: Integrates with existing authentication system
- **Router**: Accessible via React Router navigation
- **Translations**: Uses react-i18next for multilingual support
- **UI Components**: Built with shadcn/ui component library

## Configuration Options

The N8n chat widget supports various configuration options:

```typescript
{
  webhookUrl: string;           // Required: N8n webhook URL
  mode: 'window' | 'fullscreen'; // Display mode
  enableStreaming: boolean;     // Enable streaming responses
  allowFileUploads: boolean;    // Allow file uploads
  initialMessages: string[];    // Custom welcome messages
}
```

## Error Handling

The integration includes comprehensive error handling:

- **Missing Configuration**: Shows setup instructions if environment variables are missing
- **Connection Errors**: Displays helpful error messages for connection issues
- **Authentication**: Redirects to login if user is not authenticated
- **Integration Disabled**: Shows configuration help when N8n is disabled

## Troubleshooting

### Common Issues

1. **"N8n Integration Disabled"**
   - Solution: Set `VITE_ENABLE_N8N_INTEGRATION=true` in your `.env` file

2. **"N8n webhook URL is not configured"**
   - Solution: Add `VITE_N8N_WEBHOOK_URL` to your `.env` file with your webhook URL

3. **Chat not loading**
   - Check that your N8n workflow is active
   - Verify the webhook URL is correct
   - Ensure allowed origins are configured in the Chat Trigger node

4. **CORS errors**
   - Add your ProMe platform domain to the allowed origins in the N8n Chat Trigger node

### Getting Help

If you encounter issues:

1. Check the browser console for error messages
2. Verify your N8n workflow configuration
3. Ensure environment variables are set correctly
4. Check the N8n instance is accessible from your ProMe platform

## Best Practices

1. **Workflow Design**: Design your N8n workflows with clear user prompts and responses
2. **Error Handling**: Include error handling nodes in your N8n workflows
3. **Performance**: Keep workflows efficient to ensure good chat response times
4. **Security**: Use proper authentication and authorization in your N8n workflows
5. **User Experience**: Provide clear instructions and help text in your chat responses

## Future Enhancements

Potential improvements for the N8n integration:

- Custom styling for chat widget
- Integration with ProMe's billing system
- Workflow templates and examples
- Advanced configuration options
- Analytics and usage tracking