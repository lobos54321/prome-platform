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

          {/* Workflow Mode */}
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Workflow Mode with Progress</h2>
            <div className="h-[400px]">
              <DifyChatInterface 
                className="h-full"
                mode="workflow"
                showWorkflowProgress={true}
                enableRetry={true}
                placeholder="Type a workflow command..."
                welcomeMessage="Hello! This is workflow mode with progress indicators."
              />
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Test Instructions:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Try sending messages in both modes to see the different loading indicators</li>
            <li>• The workflow mode should show detailed progress with node execution</li>
            <li>• Error handling includes retry buttons and timeout messages</li>
            <li>• API endpoints may return configuration errors without proper Dify setup</li>
          </ul>
        </div>
      </div>
    </div>
  );
}