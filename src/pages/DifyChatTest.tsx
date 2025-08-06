import { DifyChat } from '../components/DifyChat';

export default function DifyChatTest() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">New Dify Chat Test</h1>
        <DifyChat />
      </div>
    </div>
  );
}