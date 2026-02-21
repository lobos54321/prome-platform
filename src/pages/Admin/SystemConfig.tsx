import { useState, useEffect } from 'react';
import { Save, RefreshCw, Eye, EyeOff, Settings } from 'lucide-react';

interface ConfigItem {
  key: string;
  value: string;
  category: string;
  description: string | null;
  is_secret: boolean;
  updated_at: string;
  updated_by: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  api_keys: 'API 密钥',
  models: '模型配置',
  urls: '服务地址',
  general: '通用配置',
};

const BACKEND_URL = ((import.meta as any).env?.VITE_XHS_API_URL || 'https://xiaohongshu-automation-ai.zeabur.app').replace(/\/$/, '');

export default function SystemConfig() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/config`);
      const data = await res.json();
      if (data.success) {
        setConfigs(data.data);
        // 初始化编辑值
        const values: Record<string, string> = {};
        data.data.forEach((c: ConfigItem) => {
          values[c.key] = c.is_secret ? '' : c.value;
        });
        setEditValues(values);
      } else {
        setError(data.error || '获取配置失败');
      }
    } catch (e) {
      setError('无法连接到后端服务');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSave = async (key: string) => {
    const value = editValues[key];
    if (value === undefined || value === '') return;

    setSaving(key);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`${key} 已更新`);
        setTimeout(() => setSuccessMsg(null), 2000);
        fetchConfigs();
      } else {
        setError(data.error || '保存失败');
      }
    } catch (e) {
      setError('保存失败，无法连接到后端');
    } finally {
      setSaving(null);
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    const cat = config.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(config);
    return acc;
  }, {} as Record<string, ConfigItem[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-gray-600">加载配置...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">系统配置</h2>
        </div>
        <button
          onClick={fetchConfigs}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {Object.entries(groupedConfigs).map(([category, items]) => (
        <div key={category} className="bg-white border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h3 className="font-medium text-gray-700">
              {CATEGORY_LABELS[category] || category}
            </h3>
          </div>
          <div className="divide-y">
            {items.map((config) => (
              <div key={config.key} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        {config.key}
                      </code>
                      {config.is_secret && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                          密钥
                        </span>
                      )}
                    </div>
                    {config.description && (
                      <p className="text-sm text-gray-500 mb-2">{config.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={config.is_secret && !showSecrets[config.key] ? 'password' : 'text'}
                          value={editValues[config.key] ?? ''}
                          onChange={(e) =>
                            setEditValues((prev) => ({ ...prev, [config.key]: e.target.value }))
                          }
                          placeholder={config.is_secret ? '输入新值覆盖...' : '未设置'}
                          className="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        />
                        {config.is_secret && (
                          <button
                            onClick={() =>
                              setShowSecrets((prev) => ({
                                ...prev,
                                [config.key]: !prev[config.key],
                              }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showSecrets[config.key] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleSave(config.key)}
                        disabled={saving === config.key}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {saving === config.key ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        保存
                      </button>
                    </div>
                    {config.updated_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        最后更新: {new Date(config.updated_at).toLocaleString('zh-CN')}
                        {config.updated_by && ` · ${config.updated_by}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
