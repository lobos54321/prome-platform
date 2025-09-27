/**
 * Digital Human Video Test Page - Minimal Version
 */

import React from 'react';

export default function DigitalHumanVideoTest() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1>数字人视频页面测试</h1>
      <p>这是一个简化的测试页面，用于验证路由是否正常工作。</p>
      <div style={{ marginTop: '20px' }}>
        <input 
          type="text" 
          placeholder="请输入文案内容..." 
          style={{ padding: '10px', width: '300px', marginRight: '10px' }}
        />
        <button style={{ padding: '10px 20px' }}>生成视频</button>
      </div>
    </div>
  );
}