/**
 * Test Runner for Frontend Components
 * 
 * Runs all component and hook tests.
 */

import { testRunner } from '@/utils/test-helpers';

// Import test suites
import '@/components/chat/ChatHistory.test';
import '@/hooks/useDifyChat.test';

async function runAllTests() {
  console.log('🚀 Starting Frontend Performance and Optimization Tests\n');
  console.log('='.repeat(60));
  console.log('Testing optimized components and hooks...\n');
  
  const results = await testRunner.run();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Test Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${results.passed + results.failed > 0 ? 
    ((results.passed / (results.passed + results.failed)) * 100).toFixed(1) : '0'}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 All performance optimization tests passed!');
    console.log('✨ Frontend components are optimized and ready for production.');
  } else {
    console.log(`\n⚠️ ${results.failed} test(s) failed. Please review the issues above.`);
  }
  
  // Group results by suite for detailed reporting
  const suiteResults = results.results.reduce((acc, result) => {
    if (!acc[result.suite]) {
      acc[result.suite] = { passed: 0, failed: 0, tests: [] };
    }
    acc[result.suite][result.status === 'passed' ? 'passed' : 'failed']++;
    acc[result.suite].tests.push(result);
    return acc;
  }, {} as Record<string, any>);
  
  console.log('\n📋 Detailed Results by Suite:');
  Object.entries(suiteResults).forEach(([suiteName, suite]) => {
    const total = suite.passed + suite.failed;
    const rate = ((suite.passed / total) * 100).toFixed(1);
    console.log(`  ${suiteName}: ${suite.passed}/${total} (${rate}%)`);
  });
  
  return {
    success: results.failed === 0,
    passRate: results.passed + results.failed > 0 ? 
      (results.passed / (results.passed + results.failed)) * 100 : 0,
    results
  };
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined' && (window as any).runTests) {
  (window as any).runTests = runAllTests;
}

export default runAllTests;