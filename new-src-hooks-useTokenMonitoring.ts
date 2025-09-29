import { useState, useCallback } from 'react';

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_price?: number;
  completion_price?: number;
  total_price?: number;
}

interface TokenProcessingResult {
  success: boolean;
  error?: string;
  newBalance?: number;
  pointsDeducted?: number;
}

export function useTokenMonitoring() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processTokenUsage = useCallback(async (
    usage: TokenUsage,
    conversationId: string,
    messageId: string,
    model: string
  ): Promise<TokenProcessingResult> => {
    if (isProcessing) {
      return { success: false, error: 'Already processing token usage' };
    }

    setIsProcessing(true);

    try {
      console.log('[Token Monitoring] Processing token usage:', {
        usage,
        conversationId,
        messageId,
        model
      });

      // Calculate points to deduct based on token usage
      const totalTokens = usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      const pointsToDeduct = Math.ceil(totalTokens / 10); // 10 tokens = 1 point

      // Simulate API call to update user balance
      const response = await fetch('/api/tokens/deduct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens: totalTokens,
          points: pointsToDeduct,
          conversationId,
          messageId,
          model,
          usage
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('[Token Monitoring] Successfully processed token usage:', result);

      return {
        success: true,
        newBalance: result.newBalance,
        pointsDeducted: pointsToDeduct
      };
    } catch (error) {
      console.error('[Token Monitoring] Error processing token usage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  return {
    processTokenUsage,
    isProcessing
  };
}