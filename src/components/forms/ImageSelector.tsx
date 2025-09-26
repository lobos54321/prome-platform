import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Link, 
  ShoppingBag, 
  Image as ImageIcon, 
  X, 
  Loader2,
  AlertCircle,
  CheckCircle 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface ImageSelectorProps {
  value: string;
  onChange: (imageUrl: string) => void;
  error?: string;
  className?: string;
}

type InputMode = 'upload' | 'smart-url';

export default function ImageSelector({ value, onChange, error, className = '' }: ImageSelectorProps) {
  const { t } = useTranslation();
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [tempInput, setTempInput] = useState('');
  const [extractedImages, setExtractedImages] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // 智能链接解析：自动识别图片直链或产品页面
  const parseSmartUrl = useCallback(async (input: string) => {
    if (!input) return;
    
    setIsProcessing(true);
    
    try {
      // 1. 清理和提取URL
      const cleanedUrl = extractAndCleanUrl(input);
      if (!cleanedUrl) {
        alert(t('imageSelector.noValidLink', 'No valid link found, please check your input'));
        return;
      }
      
      console.log('🔍 智能解析URL:', cleanedUrl);
      
      // 2. 判断是否为图片直链
      if (isDirectImageUrl(cleanedUrl)) {
        console.log('✅ Recognized as direct image link');
        onChange(cleanedUrl);
        setTempInput('');
        alert(t('imageSelector.imageUrlSuccess', 'Image link added successfully!'));
        return;
      }
      
      // 3. 判断是否为产品页面，尝试提取图片
      console.log('🔍 识别为网页链接，尝试提取图片...');
      await handleProductPageParse(cleanedUrl);
      
    } catch (error) {
      console.error('智能解析失败:', error);
      alert(`链接解析失败：${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [onChange]);

  // 从文本中提取和清理URL
  const extractAndCleanUrl = useCallback((input: string): string => {
    if (!input) return '';
    
    // 去除首尾空格和换行符
    let cleaned = input.trim().replace(/\n/g, ' ');
    
    // URL提取模式（优先级从高到低）
    const urlPatterns = [
      // 完整的图片URL（带扩展名）
      /https?:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif)(\?[^\s]*)?/gi,
      // 标准HTTP/HTTPS URL
      /https?:\/\/[^\s\u4e00-\u9fff]+/gi,
      // 处理可能包含中文字符的URL
      /https?:\/\/[^\s]+/gi
    ];
    
    for (const pattern of urlPatterns) {
      const matches = cleaned.match(pattern);
      if (matches && matches.length > 0) {
        let url = matches[0];
        
        // 清理URL末尾的标点符号和特殊字符
        url = url.replace(/[.,;!?。，；！？\s]+$/, '');
        
        // 验证URL格式
        try {
          new URL(url);
          return url;
        } catch {
          continue;
        }
      }
    }
    
    // 如果没有找到标准URL，尝试直接清理输入
    cleaned = cleaned.replace(/\s+/g, '').replace(/[，。]/g, '');
    
    // 最后尝试验证清理后的字符串
    try {
      if (cleaned.startsWith('http')) {
        new URL(cleaned);
        return cleaned;
      }
    } catch {
      // 忽略错误
    }
    
    return cleaned;
  }, []);

  // 判断是否为图片直链
  const isDirectImageUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // 检查文件扩展名
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
      
      // 检查常见图片域名
      const imageHosts = ['i.imgur.com', 'images.', 'img.', 'cdn.', 'static.'];
      const isImageHost = imageHosts.some(host => urlObj.hostname.includes(host));
      
      return hasImageExtension || isImageHost;
    } catch {
      return false;
    }
  }, []);

  // 验证图片URL格式
  const validateImageUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    const urlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
    return urlPattern.test(url);
  }, []);

  // 文件上传处理
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件！');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('图片文件不能超过10MB！');
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('开始上传文件:', file.name, file.type, file.size);
      
      // 通过后端API上传（避免CORS问题）
      await uploadToBackend(file);
    } catch (error) {
      console.error('图片上传失败:', error);
      alert(`图片上传失败：${error.message || '请重试或使用直接链接方式'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [onChange]);

  // Supabase Storage上传
  const uploadToSupabase = async (file: File): Promise<string | null> => {
    if (!supabase) {
      console.warn('Supabase not configured');
      return null;
    }

    try {
      // 生成唯一文件名
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = fileName; // 公共存储桶允许直接上传

      console.log('Uploading to Supabase Storage:', filePath);
      console.log('File size:', file.size, 'bytes');
      console.log('File type:', file.type);

      // 上传文件到Supabase Storage
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase Storage upload error:', error);
        
        // 如果是权限错误，提供更详细的信息
        if (error.message.includes('Policy')) {
          console.error('Storage policy error - bucket may not allow public uploads');
        }
        
        return null;
      }

      // 获取公共URL
      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        console.log('Supabase upload successful:', publicUrlData.publicUrl);
        return publicUrlData.publicUrl;
      }

      return null;
    } catch (error) {
      console.error('Supabase upload failed:', error);
      return null;
    }
  };

  // 通过后端API上传图片
  const uploadToBackend = async (file: File) => {
    try {
      console.log('通过后端API上传图片...');
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.imageUrl) {
          console.log('✅ 图片上传成功:', result.imageUrl);
          onChange(result.imageUrl);
          alert(result.message || '图片上传成功！');
        } else {
          throw new Error(result.error || '上传失败');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '服务器错误');
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      alert(`图片上传失败：${error.message}。请尝试使用图片链接方式`);
    }
  };

  // 文件转base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // 产品页面链接解析
  const handleProductPageParse = useCallback(async (pageUrl: string) => {
    if (!pageUrl.startsWith('http')) {
      alert('请输入完整的网址（以http://或https://开头）');
      return;
    }

    // 如果是从智能解析调用的，不需要重新设置processing状态
    const wasProcessing = isProcessing;
    if (!wasProcessing) {
      setIsProcessing(true);
    }
    setExtractedImages([]);
    
    try {
      // 调用后端API解析页面中的图片
      const response = await fetch('/api/extract-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pageUrl })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.images && result.images.length > 0) {
          setExtractedImages(result.images);
          console.log(`✅ 成功提取到 ${result.images.length} 张图片`);
        } else {
          alert('未在该页面找到合适的产品图片');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '页面解析失败');
      }
    } catch (error) {
      console.error('页面解析失败:', error);
      alert(`页面解析失败：${error.message || '请检查网址是否正确'}`);
    } finally {
      if (!wasProcessing) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing]);


  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      alert('请拖拽图片文件！');
    }
  }, [handleFileUpload]);

  return (
    <div className={className}>
      {/* 输入方式选择 */}
      <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
        <Button
          type="button"
          variant={inputMode === 'upload' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setInputMode('upload')}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-1" />
          {t('imageSelector.uploadImage', 'Upload Image')}
        </Button>
        <Button
          type="button"
          variant={inputMode === 'smart-url' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setInputMode('smart-url')}
          className="flex-1"
        >
          <Link className="h-4 w-4 mr-1" />
          {t('imageSelector.smartRecognition', 'Smart Recognition')}
        </Button>
      </div>

      {/* 文件上传模式 */}
      {inputMode === 'upload' && (
        <div className="space-y-3">
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
              isDragOver 
                ? 'border-purple-500 bg-purple-50' 
                : 'border-gray-300 hover:border-purple-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
              id="image-upload"
              disabled={isProcessing}
            />
            <Label htmlFor="image-upload" className="cursor-pointer">
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>上传中...</span>
                </div>
              ) : (
                <div>
                  <Upload className={`h-12 w-12 mx-auto mb-2 ${isDragOver ? 'text-purple-500' : 'text-gray-400'}`} />
                  <p className={`mb-1 ${isDragOver ? 'text-purple-700 font-medium' : 'text-gray-600'}`}>
                    {isDragOver ? t('imageSelector.dropToUpload', 'Drop to upload image') : t('imageSelector.dragOrClick', 'Drag image here or click to select file')}
                  </p>
                  <p className="text-sm text-gray-400">{t('imageSelector.supportedFormats', 'Supports JPG, PNG, WebP formats, max 10MB')}</p>
                </div>
              )}
            </Label>
          </div>
          
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{t('imageSelector.cloudStorage', 'Using ImgBB cloud storage service')}</span>
          </div>
        </div>
      )}

      {/* 智能链接识别模式 */}
      {inputMode === 'smart-url' && (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <Input
              type="text"
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
              placeholder={t('imageSelector.urlPlaceholder', 'Paste any link: direct image link or product page')}
              className="flex-1"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && tempInput && !isProcessing) {
                  parseSmartUrl(tempInput);
                }
              }}
            />
            <Button
              type="button"
              onClick={() => parseSmartUrl(tempInput)}
              disabled={!tempInput || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('imageSelector.smartRecognize', 'Smart Recognize')
              )}
            </Button>
          </div>
          
          {/* 解析结果图片选择 */}
          {extractedImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('imageSelector.extractedImages', 'Images extracted from webpage:')}:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {extractedImages.map((imgUrl, index) => (
                  <div
                    key={index}
                    className={`relative cursor-pointer border-2 rounded-lg overflow-hidden ${
                      value === imgUrl ? 'border-purple-500' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      onChange(imgUrl);
                      setTempInput('');
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt={`${t('imageSelector.extractedImage', 'Extracted Image')} ${index + 1}`}
                      className="w-full h-20 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    {value === imgUrl && (
                      <div className="absolute inset-0 bg-purple-500 bg-opacity-20 flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-purple-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              🤖 <strong>{t('imageSelector.smartRecognition', 'Smart Recognition')}</strong>: {t('imageSelector.autoDetect', 'Automatically detect image links or product pages')}<br/>
              📎 {t('imageSelector.supports', 'Supports')}: jpg/png/webp {t('imageSelector.imageLinks', 'image links')}, {t('imageSelector.ecommercePages', 'e-commerce pages like Amazon, Taobao')}<br/>
              ✨ {t('imageSelector.autoProcess', 'Auto-process')}: {t('imageSelector.spacesAndChars', 'spaces, special characters, mixed text')}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* 当前选中的图片预览 */}
      {value && validateImageUrl(value) && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-medium text-green-800">{t('imageSelector.currentSelected', 'Currently selected image')}:</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange('')}
              className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <img
            src={value}
            alt={t('imageSelector.selectedImage', 'Selected product image')}
            className="max-w-full h-32 object-cover rounded border"
            onError={() => setPreviewError(t('imageSelector.imageLoadFailed', 'Image load failed'))}
            onLoad={() => setPreviewError('')}
          />
          {previewError && (
            <p className="text-sm text-red-500 mt-1">{previewError}</p>
          )}
          <p className="text-xs text-green-600 mt-1 break-all">{value}</p>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-2">
          <p className="text-sm text-red-500 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" />
            {error}
          </p>
        </div>
      )}
    </div>
  );
}