import { DifyChatInterface } from '@/components/chat/DifyChatInterface';

export default function TestWorkflowProgress() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">🧪 Workflow Progress Test</h1>
        
        <div className="grid gap-6">
          {/* Regular Chat Mode */}
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Regular Chat Mode</h2>
            <div className="h-[400px]">
              <DifyChatInterface 
                className="h-full"
                mode="chat"
                showWorkflowProgress={false}
                enableRetry={true}
                placeholder="Type a regular chat message..."
                welcomeMessage="Hello! This is regular chat mode."
              />
            </div>
          </div>

          {/* Chat Mode with Workflow Progress - THE FIX */}
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Chat Mode with Workflow Progress (FIXED)</h2>
            <div className="h-[400px]">
              <DifyChatInterface 
                className="h-full"
                mode="chat"
                showWorkflowProgress={true}
                enableRetry={true}
                placeholder="Type a message to see workflow progress in chat mode..."
                welcomeMessage="Hello! This is CHAT mode with workflow progress indicators - now using chat API endpoints!"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-green-800">✅ Fix Applied:</h3>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• <strong>BEFORE:</strong> mode="workflow" called `/api/dify/workflow` (unreliable responses)</li>
            <li>• <strong>AFTER:</strong> mode="chat" with showWorkflowProgress=true calls `/api/dify` (real chat API)</li>
            <li>• <strong>RESULT:</strong> Users get real Dify responses while still seeing workflow progress</li>
            <li>• <strong>KEY CHANGE:</strong> Endpoint selection now based on conversationId, not mode</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Test Instructions:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Try sending messages in both modes to see the different loading indicators</li>
            <li>• The "Chat Mode with Workflow Progress" should now call chat API instead of workflow API</li>
            <li>• Error handling includes retry buttons and timeout messages</li>
            <li>• API endpoints may return configuration errors without proper Dify setup</li>
            <li>• Check browser dev tools network tab to confirm correct API endpoints are called</li>
          </ul>
        </div>
      </div>
    </div>
  );
}