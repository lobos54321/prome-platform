#!/usr/bin/env node

/**
 * 追踪从开始节点到LLM3的完整执行路径
 */

console.log('🔍 Tracing execution path from 开始 to LLM3...\n');

// 从yml分析得出的节点连接关系
const nodeConnections = {
  // 开始节点 (1738052599424) -> 文档提取器 (1738168561064)
  '1738052599424': ['1738168561064'],
  
  // 文档提取器 (1738168561064) -> 条件分支4 (1754655521595)
  '1738168561064': ['1754655521595'],
  
  // 条件分支4 (1754655521595): true->条件分支0, false->LLM18
  '1754655521595': {
    'true': ['1752203307415'],   // 条件分支0
    'false': ['1754637575709']   // LLM18
  },
  
  // 条件分支0 (1752203307415): true->LLM7, biubiu->LLM7, false->条件分支3  
  '1752203307415': {
    'true': ['1752154438971'],     // LLM7
    '2b6daa55-807e-4545-a440-210d1d43dc97': ['1752154438971'], // biubiu case -> LLM7
    'false': ['1752204479047']     // 条件分支3
  },
  
  // 条件分支3 (1752204479047): true->LLM7, 确认->条件分支2, false->LLM3
  '1752204479047': {
    'true': ['1752154438971'],     // LLM7 (执行分支)
    '30e88a17-3c3d-4b82-91e3-8a9900fd2576': ['1751775891113'], // 确认 -> 条件分支2
    'false': ['1752204584264']     // LLM3
  }
};

const nodeNames = {
  '1738052599424': '开始',
  '1738168561064': '文档提取器', 
  '1754655521595': '条件分支 4',
  '1752203307415': '条件分支 0',
  '1752204479047': '条件分支 3',
  '1754637575709': 'LLM 18',
  '1752204584264': 'LLM 3',
  '1752154438971': 'LLM 7',
  '1751775891113': '条件分支 2'
};

console.log('📋 Node Connection Map:');
Object.keys(nodeConnections).forEach(nodeId => {
  const nodeName = nodeNames[nodeId];
  const connections = nodeConnections[nodeId];
  
  if (Array.isArray(connections)) {
    console.log(`  ${nodeName} -> ${connections.map(id => nodeNames[id]).join(', ')}`);
  } else {
    console.log(`  ${nodeName}:`);
    Object.keys(connections).forEach(condition => {
      const targets = connections[condition];
      console.log(`    ${condition}: ${targets.map(id => nodeNames[id]).join(', ')}`);
    });
  }
});

console.log('\n🛤️  Execution Path Analysis:');
console.log('Path 1 (Expected for first-time user):');
console.log('  开始 -> 文档提取器 -> 条件分支4 -> [false] -> LLM18');
console.log('  (conversation_info_completeness < 4)');

console.log('\nPath 2 (Advanced user):');
console.log('  开始 -> 文档提取器 -> 条件分支4 -> [true] -> 条件分支0 -> [false] -> 条件分支3 -> [false] -> LLM3');
console.log('  (conversation_info_completeness >= 4)');

console.log('\n🔍 ANALYSIS:');
console.log('If LLM3 is being executed, it means:');
console.log('  1. ❌ conversation_info_completeness >= 4 (user has complete info)');
console.log('  2. ✅ 条件分支0 false branch (no special keywords)');  
console.log('  3. ✅ 条件分支3 false branch (no "执行" or "确认" keywords)');

console.log('\n💡 CONCLUSION:');
console.log('The issue is likely that conversation_info_completeness is being');
console.log('incorrectly set to >= 4 on first interaction, causing the flow to');
console.log('skip the basic info collection (LLM18) and jump to advanced processing (LLM3).');

console.log('\n🔧 SOLUTION:');
console.log('Check why conversation_info_completeness is not starting at 0 as expected.');

export {};