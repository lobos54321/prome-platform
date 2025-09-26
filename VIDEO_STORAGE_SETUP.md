# 视频记录数据库设置指南

## 🎯 目标
将视频历史记录从浏览器localStorage迁移到Supabase数据库，实现永久存储和跨设备同步。

## 📊 当前存储状况分析

### 视频记录（元数据）
- **当前**：localStorage（浏览器本地）
- **问题**：清除浏览器数据会丢失、无法跨设备同步
- **解决方案**：迁移到Supabase数据库

### 实际视频文件
- **存储位置**：N8n工作流生成后的外部服务
- **⚠️ 重要**：需要确认视频文件的保存时间和删除策略
- **建议**：联系N8n工作流提供商确认存储期限

## 🗄️ 数据库表创建

### 1. 进入Supabase SQL编辑器
访问：https://app.supabase.com/project/lfjslsygnitdgdnfboiy
左侧菜单 → **SQL Editor** → **New Query**

### 2. 执行以下SQL创建表
```sql
-- 创建视频记录表
CREATE TABLE IF NOT EXISTS video_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  video_url TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  product_description TEXT NOT NULL,
  character_gender TEXT NOT NULL,
  duration TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_video_records_user_id ON video_records(user_id);
CREATE INDEX IF NOT EXISTS idx_video_records_created_at ON video_records(created_at DESC);

-- 启用RLS (Row Level Security)
ALTER TABLE video_records ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：允许匿名用户操作（适用于当前无登录系统的情况）
CREATE POLICY "Allow anonymous users to manage video records" ON video_records
  FOR ALL USING (true);
```

### 3. 验证表创建
执行以下查询验证表是否创建成功：
```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'video_records' 
ORDER BY ordinal_position;
```

## 📱 前端集成

前端代码已经准备好，包含：
- `SupabaseVideoHistoryManager` - 数据库操作管理器
- 自动从localStorage迁移到数据库的逻辑
- 跨设备同步功能

## 🔍 视频文件存储时间调查

### 需要确认的问题
1. **N8n工作流视频存储位置**：
   - 视频文件存储在哪个云服务？
   - 是否有自动删除策略？
   - 存储时间是多久？

2. **建议的确认方法**：
   - 检查N8n工作流的输出配置
   - 查看视频URL的域名（可能是AWS S3、Google Cloud等）
   - 联系N8n工作流提供商确认存储策略

### 示例视频URL分析
根据之前的视频URL格式，我们可以分析存储位置：
```
示例：https://example-bucket.s3.amazonaws.com/videos/xxx.mp4
分析：存储在AWS S3，需要确认bucket的生命周期策略
```

## 🛡️ 数据备份建议

### 1. 定期备份视频记录
- 从Supabase导出视频记录元数据
- 保存为JSON或CSV格式

### 2. 视频文件备份
- 如果视频文件有删除风险，建议：
  - 下载重要视频到本地
  - 或迁移到自己的云存储

### 3. 自动备份脚本
```javascript
// 备份视频记录到JSON文件
async function backupVideoRecords() {
  const records = await SupabaseVideoHistoryManager.getHistory();
  const backup = {
    exportDate: new Date().toISOString(),
    totalRecords: records.length,
    records: records
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `video-records-backup-${Date.now()}.json`;
  a.click();
}
```

## ✅ 设置完成后的优势

1. **永久存储**：记录保存在云数据库中
2. **跨设备同步**：任何设备都能看到历史记录
3. **数据安全**：Supabase自动备份
4. **无限制**：不再限制50个记录
5. **用户关联**：未来可以关联用户账户

## 🚨 重要提醒

**视频文件保存时间是关键问题**，建议：
1. 立即检查当前生成的视频URL有效期
2. 联系N8n工作流提供商确认存储策略  
3. 如有需要，制定视频文件的长期保存方案

---

执行完数据库设置后，告诉我结果，我会启用新的存储系统！