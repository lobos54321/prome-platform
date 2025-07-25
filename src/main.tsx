import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeAuthOnLoad } from './lib/auth'

// 在应用启动前初始化认证状态
async function startApp() {
  try {
    // 初始化认证状态
    await initializeAuthOnLoad();
    
    // 渲染应用
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (error) {
    console.error('Failed to start app:', error);
    
    // 如果初始化失败，仍然渲染应用但确保清除认证状态
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  }
}

startApp();
