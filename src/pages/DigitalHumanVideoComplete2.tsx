import { useState, useEffect } from 'react';

export default function DigitalHumanVideoComplete2() {
  const [copywritingContent, setCopywritingContent] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // 加载Deep Copywriting结果
  useEffect(() => {
    const loadCopywriting = () => {
      try {
        const conversationId = localStorage.getItem('dify_conversation_id');
        if (conversationId) {
          const messages = localStorage.getItem(`dify_messages_${conversationId}`);
          if (messages) {
            const parsedMessages = JSON.parse(messages);
            const lastAssistantMessage = parsedMessages
              .filter((msg: any) => msg.role === 'assistant')
              .pop();
            
            if (lastAssistantMessage && lastAssistantMessage.content) {
              setCopywritingContent(lastAssistantMessage.content);
            }
          }
        }
      } catch (error) {
        console.error('加载文案失败:', error);
      }
    };

    loadCopywriting();
  }, []);

  const handleImportCopywriting = () => {
    const conversationId = localStorage.getItem('dify_conversation_id');
    if (conversationId) {
      const messages = localStorage.getItem(`dify_messages_${conversationId}`);
      if (messages) {
        try {
          const parsedMessages = JSON.parse(messages);
          const lastAssistantMessage = parsedMessages
            .filter((msg: any) => msg.role === 'assistant')
            .pop();
          
          if (lastAssistantMessage && lastAssistantMessage.content) {
            setCopywritingContent(lastAssistantMessage.content);
          }
        } catch (error) {
          console.error('导入文案失败:', error);
        }
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
            数字人视频创作
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.8)' }}>
            从文案到视频，一键生成专属数字人内容
          </p>
        </div>

        {/* 工作流程步骤 */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem' }}>
            {[
              { id: 1, title: '准备文案', desc: '导入或编写视频文案' },
              { id: 2, title: '训练数字人', desc: '上传素材训练数字人模型' },
              { id: 3, title: '生成视频', desc: '使用数字人生成最终视频' },
              { id: 4, title: '完成', desc: '下载生成的视频' }
            ].map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '4rem',
                    height: '4rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: currentStep >= step.id ? '#10b981' : 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    margin: '0 auto 0.5rem'
                  }}>
                    {step.id}
                  </div>
                  <div style={{ color: 'white', fontWeight: '600', fontSize: '0.9rem' }}>{step.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>{step.desc}</div>
                </div>
                {index < 3 && (
                  <div style={{ 
                    width: '3rem', 
                    height: '2px', 
                    backgroundColor: currentStep > step.id ? '#10b981' : 'rgba(255,255,255,0.3)',
                    margin: '0 1rem',
                    marginTop: '-2rem'
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* 主要内容区域 */}
          <div>
            {/* 文案准备 */}
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '1rem', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
                color: 'white', 
                padding: '1.5rem' 
              }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                  📝 步骤 1: 准备视频文案
                </h3>
              </div>
              <div style={{ padding: '2rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                    视频文案内容
                  </label>
                  <textarea
                    value={copywritingContent}
                    onChange={(e) => setCopywritingContent(e.target.value)}
                    placeholder="请输入或导入您的视频文案内容..."
                    style={{
                      width: '100%',
                      minHeight: '200px',
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={handleImportCopywriting}
                    style={{
                      padding: '0.75rem 1.5rem',
                      border: '2px solid #6366f1',
                      backgroundColor: 'transparent',
                      color: '#6366f1',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    💬 从 Deep Copywriting 导入
                  </button>
                  
                  {copywritingContent && (
                    <button
                      onClick={() => setCurrentStep(2)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: 'white',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      确认文案，下一步 →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 数字人训练 */}
            {currentStep >= 2 && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '1rem', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                marginTop: '2rem'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', 
                  color: 'white', 
                  padding: '1.5rem' 
                }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                    👤 步骤 2: 训练数字人
                  </h3>
                </div>
                <div style={{ padding: '2rem' }}>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: '#fef3c7', 
                    borderRadius: '0.5rem',
                    border: '1px solid #f59e0b'
                  }}>
                    <p style={{ margin: 0, color: '#92400e' }}>
                      ⚠️ 数字人训练功能正在开发中，敬请期待！
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 侧边栏 */}
          <div>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '1rem', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, color: '#374151' }}>
                  Deep Copywriting 结果
                </h3>
              </div>
              <div style={{ padding: '1.5rem' }}>
                {copywritingContent ? (
                  <div>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      borderRadius: '1rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      marginBottom: '1rem'
                    }}>
                      AI 生成内容
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#6b7280',
                      backgroundColor: '#f9fafb',
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginBottom: '1rem'
                    }}>
                      {copywritingContent.substring(0, 200)}
                      {copywritingContent.length > 200 && '...'}
                    </div>
                    <button 
                      onClick={handleImportCopywriting}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        backgroundColor: 'white',
                        color: '#374151',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      导入此内容
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💬</div>
                    <p style={{ fontSize: '0.9rem', margin: 0 }}>暂无 Deep Copywriting 结果</p>
                    <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0', color: '#9ca3af' }}>
                      请先使用 Deep Copywriting 生成内容
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}