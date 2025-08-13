#!/usr/bin/env node

// 修复注释替换造成的语法错误
const fs = require('fs');
const path = require('path');

const filePath = '/Users/boliu/prome-platform/src/components/chat/DifyChatInterface.tsx';

console.log('Reading file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original file length:', content.length);

// 修复被破坏的注释对象的模式
// 模式：// console.log('...', {\n  key: value,\n  key: value\n});
const fixes = [
  {
    // 修复 // console.log 后面跟着孤立的对象属性
    pattern: /(\/\/ console\.log.*?\{[\s\S]*?)(\n\s+\w+:\s.*?[^}])\n\s*\}\);/g,
    replacement: (match, p1, p2) => {
      // 移除整个对象，只保留简化的注释
      return p1.split('{')[0].replace(/,$/, '') + ');';
    }
  },
  {
    // 修复孤立的对象属性（没有前面的console.log）
    pattern: /\n(\s+)(\w+:\s.*?,)\n\s+(\w+:\s.*?,?)\n\s*\}\);/g,
    replacement: '\n$1// 调试信息已注释'
  },
  {
    // 修复孤立的单行对象属性
    pattern: /\n\s+(\w+:\s.*?),?\n(?=\s*[^:])/g,
    replacement: (match, p1) => {
      // 如果这行看起来是孤立的对象属性，注释掉
      if (!match.includes('const') && !match.includes('return') && !match.includes('=')) {
        return '\n    // ' + p1 + '\n';
      }
      return match;
    }
  }
];

// 应用修复
fixes.forEach((fix, index) => {
  const before = content.length;
  content = content.replace(fix.pattern, fix.replacement);
  const after = content.length;
  console.log(`Fix ${index + 1}: Changed ${before - after} characters`);
});

// 特殊修复：直接替换已知的问题模式
const knownProblems = [
  {
    find: /\/\/ console\.log\('.*?', \{\s*[\s\S]*?\}\);/g,
    replace: '// console.log 调试信息已简化'
  },
  {
    find: /\s+\w+:\s[^,\n]*,?\n(?=\s*(?!\w+:))/g,
    replace: ''
  }
];

knownProblems.forEach((problem, index) => {
  const before = content.length;
  content = content.replace(problem.find, problem.replace);
  const after = content.length;
  console.log(`Known problem ${index + 1}: Changed ${before - after} characters`);
});

console.log('Final file length:', content.length);

// 写回文件
fs.writeFileSync(filePath, content);
console.log('File fixed and saved');