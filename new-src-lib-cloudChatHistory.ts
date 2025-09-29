export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ChatConversation {
  id: string;
  title: string;
  last_message: string;
  last_message_time: string;
  message_count: number;
  messages: ChatMessage[];
  workflow_state?: any;
  dify_conversation_id?: string;
}

class CloudChatHistory {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    this.supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  async getConversations(): Promise<ChatConversation[]> {
    try {
      console.log('[Cloud Chat History] Loading conversations from cloud');
      
      const response = await fetch(`${this.supabaseUrl}/rest/v1/chat_conversations`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const conversations = await response.json();
      console.log('[Cloud Chat History] Loaded conversations:', conversations.length);
      
      return conversations || [];
    } catch (error) {
      console.error('[Cloud Chat History] Error loading conversations:', error);
      return [];
    }
  }

  async saveConversation(
    title: string,
    messages: ChatMessage[],
    workflowState: any,
    difyConversationId?: string
  ): Promise<string> {
    try {
      console.log('[Cloud Chat History] Saving conversation:', title);

      const conversationData = {
        title,
        last_message: messages[messages.length - 1]?.content || '',
        last_message_time: new Date().toISOString(),
        message_count: messages.length,
        workflow_state: workflowState,
        dify_conversation_id: difyConversationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const response = await fetch(`${this.supabaseUrl}/rest/v1/chat_conversations`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const savedConversation = await response.json();
      const conversationId = savedConversation[0]?.id || 'temp-' + Date.now();

      // Save messages separately
      await this.saveMessages(conversationId, messages);

      console.log('[Cloud Chat History] Conversation saved:', conversationId);
      return conversationId;
    } catch (error) {
      console.error('[Cloud Chat History] Error saving conversation:', error);
      throw error;
    }
  }

  private async saveMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
    try {
      const messageData = messages.map(msg => ({
        conversation_id: conversationId,
        content: msg.content,
        role: msg.role,
        metadata: msg.metadata,
        created_at: msg.timestamp.toISOString()
      }));

      const response = await fetch(`${this.supabaseUrl}/rest/v1/chat_messages`, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('[Cloud Chat History] Messages saved:', messages.length);
    } catch (error) {
      console.error('[Cloud Chat History] Error saving messages:', error);
      throw error;
    }
  }

  async loadConversationFromHistory(conversationId: string): Promise<ChatConversation | null> {
    try {
      console.log('[Cloud Chat History] Loading conversation from history:', conversationId);

      // Load conversation metadata
      const convResponse = await fetch(`${this.supabaseUrl}/rest/v1/chat_conversations?id=eq.${conversationId}`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!convResponse.ok) {
        throw new Error(`HTTP error! status: ${convResponse.status}`);
      }

      const conversations = await convResponse.json();
      if (!conversations || conversations.length === 0) {
        return null;
      }

      const conversation = conversations[0];

      // Load messages
      const msgResponse = await fetch(`${this.supabaseUrl}/rest/v1/chat_messages?conversation_id=eq.${conversationId}&order=created_at.asc`, {
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!msgResponse.ok) {
        throw new Error(`HTTP error! status: ${msgResponse.status}`);
      }

      const messages = await msgResponse.json();

      return {
        ...conversation,
        messages: messages || []
      };
    } catch (error) {
      console.error('[Cloud Chat History] Error loading conversation from history:', error);
      return null;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      console.log('[Cloud Chat History] Deleting conversation:', conversationId);

      // Delete messages first
      await fetch(`${this.supabaseUrl}/rest/v1/chat_messages?conversation_id=eq.${conversationId}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      // Delete conversation
      await fetch(`${this.supabaseUrl}/rest/v1/chat_conversations?id=eq.${conversationId}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.supabaseKey,
          'Authorization': `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Cloud Chat History] Conversation deleted:', conversationId);
    } catch (error) {
      console.error('[Cloud Chat History] Error deleting conversation:', error);
      throw error;
    }
  }
}

export const cloudChatHistory = new CloudChatHistory();