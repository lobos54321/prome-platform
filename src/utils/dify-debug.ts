export async function checkWorkflowStatus(conversationId: string) {
  try {
    const response = await fetch(`${process.env.VITE_DIFY_API_URL}/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_DIFY_API_KEY}`,
      },
      params: {
        conversation_id: conversationId,
        limit: 100,
      }
    });

    const data = await response.json();
    console.log('Conversation history:', data);
    
    // Analyze workflow node status
    data.data?.forEach((msg: any) => {
      if (msg.metadata?.workflow_run_id) {
        console.log(`Message ${msg.id}:`, {
          node: msg.metadata.node_id,
          status: msg.metadata.status,
          inputs: msg.metadata.inputs,
          outputs: msg.metadata.outputs,
        });
      }
    });
  } catch (error) {
    console.error('Failed to check workflow status:', error);
  }
}