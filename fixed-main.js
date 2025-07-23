import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'

// 添加错误处理的安全初始化函数
function safeInitializeSupabase() {
  try {
    // 首先检查环境变量是否存在
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    // 如果没有提供URL和密钥，则使用空字符串以避免运行时错误
    console.log('Supabase配置状态:', supabaseUrl ? 'URL已配置' : 'URL未配置', 
                supabaseAnonKey ? '密钥已配置' : '密钥未配置');
    
    // 创建客户端时添加额外检查
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase未完全配置，将使用空URL。应用可能无法连接到后端。');
      // 返回一个模拟的客户端，避免未定义错误
      return {
        from: () => ({
          select: () => Promise.resolve({ data: [], error: new Error('未配置') }),
          insert: () => Promise.resolve({ data: null, error: new Error('未配置') }),
          update: () => Promise.resolve({ data: null, error: new Error('未配置') }),
          delete: () => Promise.resolve({ data: null, error: new Error('未配置') })
        }),
        auth: {
          signUp: () => Promise.resolve({ data: null, error: new Error('未配置') }),
          signIn: () => Promise.resolve({ data: null, error: new Error('未配置') }),
          signOut: () => Promise.resolve({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        },
        storage: {
          from: () => ({
            upload: () => Promise.resolve({ data: null, error: new Error('未配置') }),
            getPublicUrl: () => ({ data: { publicUrl: '' } })
          })
        }
      };
    }

    // 创建真实的Supabase客户端
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('初始化Supabase时出错:', error);
    // 返回一个安全的模拟客户端
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error('初始化错误') }),
        insert: () => Promise.resolve({ data: null, error: new Error('初始化错误') }),
        update: () => Promise.resolve({ data: null, error: new Error('初始化错误') }),
        delete: () => Promise.resolve({ data: null, error: new Error('初始化错误') })
      }),
      auth: {
        signUp: () => Promise.resolve({ data: null, error: new Error('初始化错误') }),
        signIn: () => Promise.resolve({ data: null, error: new Error('初始化错误') }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: new Error('初始化错误') }),
          getPublicUrl: () => ({ data: { publicUrl: '' } })
        })
      }
    };
  }
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误捕获:', event.error);
});

// 安全地初始化Supabase
const supabase = safeInitializeSupabase();

// 将supabase添加到window以便调试
window.supabase = supabase;

// 包装React应用初始化在try-catch中
try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App supabaseClient={supabase} />
      </BrowserRouter>
    </React.StrictMode>,
  );
} catch (error) {
  console.error('渲染应用时出错:', error);
  
  // 显示友好的错误消息
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="text-align: center; padding: 50px; font-family: sans-serif;">
        <h2>应用加载出错</h2>
        <p>抱歉，应用加载过程中遇到了问题。请稍后再试。</p>
        <p><button onclick="window.location.reload()">重新加载</button></p>
      </div>
    `;
  }
}
