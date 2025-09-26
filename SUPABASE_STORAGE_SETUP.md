# Supabase Storage 公共上传配置指南

## 🎯 目标
配置Supabase Storage允许匿名用户上传图片到images存储桶。

## ⚠️ 重要说明
由于权限限制，我们无法通过SQL直接创建策略。需要通过Supabase Dashboard配置。

## 📋 正确配置步骤

### 方法1: 通过Storage Bucket设置（推荐）

#### 1. 登录Supabase控制台
访问：https://app.supabase.com/project/lfjslsygnitdgdnfboiy

#### 2. 进入Storage设置
左侧菜单 → **Storage** → 找到 `images` 存储桶

#### 3. 编辑存储桶设置
点击 `images` 存储桶右侧的设置图标 → **Edit bucket**

#### 4. 配置存储桶权限
设置以下选项：
- ✅ **Public bucket**: **启用**（这是关键设置）
- ✅ **File size limit**: 10MB
- ✅ **Allowed MIME types**: `image/jpeg,image/png,image/webp,image/gif`

#### 5. 保存设置
点击 **Save** 保存配置

### 方法2: 通过SQL编辑器创建安全的RLS策略（推荐）

基于Supabase的安全建议，使用以下SQL创建更安全的策略：

#### 1. 进入SQL编辑器
左侧菜单 → **SQL Editor** → **New Query**

#### 2. 执行安全的RLS策略SQL
复制以下SQL代码到编辑器并执行：

```sql
-- 启用RLS（如果尚未启用）
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户向images bucket的public/前缀上传（限制路径，防止任意覆盖）
CREATE POLICY "Allow public uploads to images bucket (restricted path)" 
ON storage.objects 
FOR INSERT TO anon 
WITH CHECK (
  bucket_id = 'images' 
  AND (name LIKE 'public/%') -- 强制所有匿名上传放在public/前缀下
);

-- 允许匿名和已认证用户读取images bucket的文件
CREATE POLICY "Allow public reads from images bucket" 
ON storage.objects 
FOR SELECT TO authenticated, anon 
USING (
  bucket_id = 'images'
);

-- 允许已认证用户更新images bucket的文件
CREATE POLICY "Allow authenticated updates to images bucket" 
ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'images'
) 
WITH CHECK (
  bucket_id = 'images'
);

-- 允许已认证用户删除images bucket的文件
CREATE POLICY "Allow authenticated deletes from images bucket" 
ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'images'
);
```

#### 3. 重要说明
- 📁 匿名上传的文件将自动保存到 `public/` 前缀下
- 🔒 这样可以防止匿名用户覆盖重要文件
- ✅ 所有用户都可以读取images bucket的文件
- 🛡️ 只有认证用户可以更新/删除文件

## 🧪 测试步骤

配置完成后，运行测试脚本：

```bash
node setup-supabase-rls.js
```

如果看到以下输出，说明配置成功：
```
✅ Anon upload successful!
📎 Public URL: https://lfjslsygnitdgdnfboiy.supabase.co/storage/v1/object/public/images/test-xxx.jpg
🎉 Supabase Storage is now ready for public uploads!
```

## 🔧 故障排除

### 错误：`new row violates row-level security policy`
- 检查SQL命令是否全部执行成功
- 确保没有语法错误
- 验证storage.objects表的RLS策略

### 错误：`mime type not supported`
- 检查存储桶的MIME类型限制
- 确保上传的是图片文件

### 错误：`Bucket not found`
- 确保images存储桶存在
- 检查存储桶名称拼写

## 📱 前端使用

配置完成后，前端的文件上传将：
1. ✅ **优先使用Supabase Storage**（本地云存储）
2. 🔄 **备用ImgBB服务**（如果Supabase失败）
3. ✅ **完全兼容N8n工作流**

## 🎉 配置完成后的优势

- ⚡ **更快的上传速度**（本地云存储）
- 🔒 **更好的隐私控制**（自己的存储桶）
- 💰 **更低的长期成本**（Supabase免费额度）
- 🛡️ **更高的可靠性**（不依赖第三方API）

---

**注意**: 完成配置后，请删除此文档中的敏感信息。