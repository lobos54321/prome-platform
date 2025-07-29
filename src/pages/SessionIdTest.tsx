import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { db } from '@/lib/supabase';
import { mockDb } from '@/lib/mock-database';

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  sessionId?: string;
}

export default function SessionIdTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    const results: TestResult[] = [];

    try {
      // Test 1: Mock database with conversationId
      console.log('Testing mock database with conversationId...');
      const mockResult1 = await mockDb.addTokenUsageWithModel(
        'test-user-1',
        'gpt-4',
        1500, 800, 2300,
        0.045, 0.048, 0.093,
        'conv_12345', // conversationId provided
        'msg_67890'
      );

      results.push({
        test: 'Mock DB with conversationId',
        passed: mockResult1?.sessionId === 'conv_12345',
        details: `Expected: conv_12345, Got: ${mockResult1?.sessionId}`,
        sessionId: mockResult1?.sessionId
      });

      // Test 2: Mock database without conversationId
      console.log('Testing mock database without conversationId...');
      const mockResult2 = await mockDb.addTokenUsageWithModel(
        'test-user-2',
        'gpt-3.5-turbo',
        1000, 500, 1500,
        0.001, 0.001, 0.002,
        undefined, // no conversationId
        'msg_99999'
      );

      results.push({
        test: 'Mock DB without conversationId',
        passed: !!mockResult2?.sessionId && mockResult2.sessionId.startsWith('mock_session_'),
        details: `Generated sessionId: ${mockResult2?.sessionId}`,
        sessionId: mockResult2?.sessionId
      });

      // Test 3: Real database (if configured) with conversationId
      try {
        console.log('Testing real database with conversationId...');
        const realResult1 = await db.addTokenUsageWithModel(
          'test-user-3',
          'gpt-4',
          2000, 1000, 3000,
          0.06, 0.12, 0.18,
          'conv_real_123', // conversationId provided
          'msg_real_456'
        );

        results.push({
          test: 'Real DB with conversationId',
          passed: !!realResult1?.sessionId,
          details: `SessionId: ${realResult1?.sessionId}`,
          sessionId: realResult1?.sessionId
        });
      } catch (error) {
        results.push({
          test: 'Real DB with conversationId',
          passed: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      // Test 4: Real database without conversationId
      try {
        console.log('Testing real database without conversationId...');
        const realResult2 = await db.addTokenUsageWithModel(
          'test-user-4',
          'gpt-3.5-turbo',
          1200, 600, 1800,
          0.0012, 0.0012, 0.0024,
          undefined, // no conversationId
          'msg_real_789'
        );

        results.push({
          test: 'Real DB without conversationId',
          passed: !!realResult2?.sessionId && realResult2.sessionId.startsWith('dify_session_'),
          details: `Generated sessionId: ${realResult2?.sessionId}`,
          sessionId: realResult2?.sessionId
        });
      } catch (error) {
        results.push({
          test: 'Real DB without conversationId',
          passed: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }

    } catch (error) {
      console.error('Test execution error:', error);
      results.push({
        test: 'Test Execution',
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  const allTestsPassed = testResults.length > 0 && testResults.every(r => r.passed);
  const anyTestsFailed = testResults.some(r => !r.passed);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Session ID Constraint Fix Test</CardTitle>
          <p className="text-sm text-muted-foreground">
            This test verifies that the session_id constraint issue has been fixed
            and that token usage records can be inserted successfully.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running Tests...' : 'Run Session ID Tests'}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${
                allTestsPassed ? 'bg-green-50 border-green-200' : 
                anyTestsFailed ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
              }`}>
                <h3 className="font-semibold mb-2">
                  Test Summary: {testResults.filter(r => r.passed).length}/{testResults.length} Passed
                  {allTestsPassed && ' 🎉'}
                </h3>
              </div>

              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={result.passed ? 'text-green-600' : 'text-red-600'}>
                      {result.passed ? '✅' : '❌'}
                    </span>
                    <span className="font-medium">{result.test}</span>
                  </div>
                  <p className="text-sm text-gray-600">{result.details}</p>
                  {result.sessionId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Session ID: <code className="bg-gray-100 px-1 rounded">{result.sessionId}</code>
                    </p>
                  )}
                </div>
              ))}

              {allTestsPassed && (
                <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                  <h4 className="text-green-800 font-semibold mb-2">🎉 All Tests Passed!</h4>
                  <p className="text-green-700 text-sm">
                    The session_id constraint issue has been successfully fixed. 
                    Token usage records can now be inserted without database errors.
                  </p>
                  <ul className="text-green-700 text-sm mt-2 list-disc list-inside space-y-1">
                    <li>Session ID is properly set using conversationId when available</li>
                    <li>Session ID is auto-generated when conversationId is missing</li>
                    <li>Both mock and real database implementations work correctly</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}