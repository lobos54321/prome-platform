import { useState, useRef } from 'react';

interface CreationStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

interface DigitalHumanData {
  name: string;
  description: string;
  avatar: File | null;
  voiceFile: File | null;
  personality: string;
  language: string;
  category: string;
  tags: string[];
}

export default function DigitalHumanCreation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [digitalHumanData, setDigitalHumanData] = useState<DigitalHumanData>({
    name: '',
    description: '',
    avatar: null,
    voiceFile: null,
    personality: 'friendly',
    language: 'zh',
    category: 'general',
    tags: []
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const steps: CreationStep[] = [
    {
      id: 1,
      title: '基本信息',
      description: '设置数字人的名称和描述',
      completed: digitalHumanData.name.length > 0 && digitalHumanData.description.length > 0
    },
    {
      id: 2,
      title: '外观设置',
      description: '上传头像或选择预设形象',
      completed: digitalHumanData.avatar !== null
    },
    {
      id: 3,
      title: '声音配置',
      description: '上传声音样本进行声音克隆',
      completed: digitalHumanData.voiceFile !== null
    },
    {
      id: 4,
      title: '个性化设置',
      description: '设置性格特征和行为模式',
      completed: digitalHumanData.personality.length > 0
    },
    {
      id: 5,
      title: '预览确认',
      description: '预览并确认创建数字人',
      completed: false
    }
  ];

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDigitalHumanData(prev => ({ ...prev, avatar: file }));
    }
  };

  const handleVoiceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setDigitalHumanData(prev => ({ ...prev, voiceFile: file }));
    }
  };

  const handleTagAdd = (tag: string) => {
    if (tag.trim() && !digitalHumanData.tags.includes(tag.trim())) {
      setDigitalHumanData(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }));
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    setDigitalHumanData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCreate = async () => {
    // TODO: 实现创建数字人的API调用
    console.log('创建数字人:', digitalHumanData);
    alert('数字人创建功能正在开发中...');
  };

  const renderStepIndicator = () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      marginBottom: '2rem',
      padding: '0 1rem'
    }}>
      {steps.map((step, index) => (
        <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div 
            style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: '50%',
              backgroundColor: currentStep >= step.id ? '#10b981' : 
                              step.completed ? '#10b981' : '#e5e7eb',
              color: currentStep >= step.id || step.completed ? 'white' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
            onClick={() => setCurrentStep(step.id)}
          >
            {step.completed ? '✓' : step.id}
          </div>
          <div style={{ 
            marginLeft: '0.75rem',
            flex: 1,
            minWidth: 0
          }}>
            <div style={{ 
              fontWeight: '600', 
              fontSize: '0.9rem',
              color: currentStep === step.id ? '#10b981' : '#374151'
            }}>
              {step.title}
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#6b7280',
              marginTop: '0.25rem'
            }}>
              {step.description}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div style={{
              width: '3rem',
              height: '2px',
              backgroundColor: step.completed ? '#10b981' : '#e5e7eb',
              margin: '0 1rem'
            }} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              基本信息设置
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '0.5rem' 
              }}>
                数字人名称 *
              </label>
              <input
                type="text"
                value={digitalHumanData.name}
                onChange={(e) => setDigitalHumanData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入数字人的名称"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '0.5rem' 
              }}>
                描述信息 *
              </label>
              <textarea
                value={digitalHumanData.description}
                onChange={(e) => setDigitalHumanData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="描述这个数字人的特点、用途或背景..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '0.5rem' 
              }}>
                分类
              </label>
              <select
                value={digitalHumanData.category}
                onChange={(e) => setDigitalHumanData(prev => ({ ...prev, category: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              >
                <option value="general">通用</option>
                <option value="business">商务</option>
                <option value="education">教育</option>
                <option value="entertainment">娱乐</option>
                <option value="customer-service">客服</option>
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              外观设置
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '1rem' 
              }}>
                头像上传
              </label>
              
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />

              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '3rem 2rem',
                  border: '2px dashed #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f9fafb',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}
              >
                {digitalHumanData.avatar ? (
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.5rem' }}>
                      ✅ {digitalHumanData.avatar.name}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      {(digitalHumanData.avatar.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🖼️</div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                      点击上传头像
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      支持 JPG, PNG, GIF (推荐尺寸: 512x512)
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '1rem' 
              }}>
                预设头像选择
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(4, 1fr)', 
                gap: '1rem' 
              }}>
                {['👨', '👩', '🧑', '👴', '👵', '👦', '👧', '🤖'].map((emoji, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      // TODO: 处理预设头像选择
                      console.log('选择预设头像:', emoji);
                    }}
                    style={{
                      padding: '1rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      textAlign: 'center',
                      fontSize: '2rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              声音配置
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '1rem' 
              }}>
                声音样本上传
              </label>
              
              <input
                ref={voiceInputRef}
                type="file"
                accept="audio/*,video/*"
                onChange={handleVoiceUpload}
                style={{ display: 'none' }}
              />

              <div
                onClick={() => voiceInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '3rem 2rem',
                  border: '2px dashed #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: '#f9fafb',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}
              >
                {digitalHumanData.voiceFile ? (
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.5rem' }}>
                      ✅ {digitalHumanData.voiceFile.name}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      {(digitalHumanData.voiceFile.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                      点击上传声音样本
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                      支持 MP3, WAV, MP4 (建议至少30秒清晰语音)
                    </div>
                  </div>
                )}
              </div>

              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #0ea5e9',
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.9rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>💡 声音克隆提示:</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>上传高质量的声音样本可以获得更好的克隆效果</li>
                  <li>建议录制30秒以上的清晰语音内容</li>
                  <li>避免背景噪音和回音</li>
                  <li>语音内容应包含丰富的音调变化</li>
                </ul>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '0.5rem' 
              }}>
                语言设置
              </label>
              <select
                value={digitalHumanData.language}
                onChange={(e) => setDigitalHumanData(prev => ({ ...prev, language: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </div>
          </div>
        );

      case 4:
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              个性化设置
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '1rem' 
              }}>
                性格特征
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '1rem' 
              }}>
                {[
                  { value: 'friendly', label: '友好亲切', emoji: '😊' },
                  { value: 'professional', label: '专业严谨', emoji: '👔' },
                  { value: 'energetic', label: '活泼开朗', emoji: '🌟' },
                  { value: 'calm', label: '沉稳冷静', emoji: '🧘' },
                  { value: 'humorous', label: '幽默风趣', emoji: '😄' },
                  { value: 'intelligent', label: '聪明睿智', emoji: '🤓' }
                ].map((personality) => (
                  <div
                    key={personality.value}
                    onClick={() => setDigitalHumanData(prev => ({ ...prev, personality: personality.value }))}
                    style={{
                      padding: '1rem',
                      border: `2px solid ${digitalHumanData.personality === personality.value ? '#10b981' : '#e5e7eb'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      backgroundColor: digitalHumanData.personality === personality.value ? '#f0fdf4' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                      {personality.emoji}
                    </div>
                    <div style={{ fontWeight: '600' }}>
                      {personality.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '0.5rem' 
              }}>
                标签管理
              </label>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.5rem',
                marginBottom: '1rem'
              }}>
                {digitalHumanData.tags.map((tag, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="输入标签后按回车添加"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleTagAdd((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              marginBottom: '2rem',
              textAlign: 'center'
            }}>
              预览确认
            </div>

            <div style={{
              border: '2px solid #e5e7eb',
              borderRadius: '1rem',
              padding: '2rem',
              backgroundColor: 'white'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '2rem',
                gap: '1.5rem'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem'
                }}>
                  {digitalHumanData.avatar ? '📷' : '👤'}
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    {digitalHumanData.name || '未设置名称'}
                  </div>
                  <div style={{ color: '#6b7280' }}>
                    {digitalHumanData.description || '未设置描述'}
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>分类</div>
                  <div style={{ color: '#6b7280' }}>{digitalHumanData.category}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>语言</div>
                  <div style={{ color: '#6b7280' }}>{digitalHumanData.language}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>性格</div>
                  <div style={{ color: '#6b7280' }}>{digitalHumanData.personality}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>声音文件</div>
                  <div style={{ color: '#6b7280' }}>
                    {digitalHumanData.voiceFile ? digitalHumanData.voiceFile.name : '未上传'}
                  </div>
                </div>
              </div>

              {digitalHumanData.tags.length > 0 && (
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>标签</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {digitalHumanData.tags.map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          backgroundColor: '#e5e7eb',
                          color: '#374151',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.9rem'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              backgroundColor: '#fef3cd',
              border: '1px solid #f59e0b',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginTop: '1.5rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>⚠️ 创建提醒:</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li>数字人创建过程可能需要几分钟时间</li>
                <li>创建完成后您将收到通知</li>
                <li>请确保所有信息准确无误</li>
              </ul>
            </div>
          </div>
        );

      default:
        return <div>未知步骤</div>;
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f9fafb',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '3rem' 
        }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: '800', 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            创建数字人
          </h1>
          <p style={{ 
            fontSize: '1.1rem', 
            color: '#6b7280' 
          }}>
            通过简单几步，创建属于您的专属数字人
          </p>
        </div>

        {renderStepIndicator()}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {renderStepContent()}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: currentStep === 1 ? '#f3f4f6' : '#6b7280',
              color: currentStep === 1 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            上一步
          </button>

          {currentStep < steps.length ? (
            <button
              onClick={nextStep}
              disabled={!steps[currentStep - 1].completed}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: steps[currentStep - 1].completed ? '#10b981' : '#f3f4f6',
                color: steps[currentStep - 1].completed ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: steps[currentStep - 1].completed ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleCreate}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              创建数字人
            </button>
          )}
        </div>
      </div>
    </div>
  );
}