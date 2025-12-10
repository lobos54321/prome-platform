import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, X, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MaterialUploadProps {
    supabaseUuid: string;
    initialImages?: string[];
    initialDocuments?: string[];
    initialAnalysis?: string;
    onMaterialsChange: (materials: {
        images: string[];
        documents: string[];
        analysis: string;
    }) => void;
    compact?: boolean;  // 紧凑模式，用于嵌入其他组件
}

export function MaterialUpload({
    supabaseUuid,
    initialImages = [],
    initialDocuments = [],
    initialAnalysis = '',
    onMaterialsChange,
    compact = false,
}: MaterialUploadProps) {
    const [images, setImages] = useState<string[]>(initialImages);
    const [documents, setDocuments] = useState<string[]>(initialDocuments);
    const [analysis, setAnalysis] = useState<string>(initialAnalysis);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState('');

    // 上传图片到 Supabase Storage
    const uploadImage = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${supabaseUuid}/images/${fileName}`;

        const { data, error } = await supabase.storage
            .from('product-materials')
            .upload(filePath, file, {
                // 添加 upsert 选项避免 RLS 问题
                upsert: true
            });

        if (error) {
            throw new Error(`上传失败: ${error.message}`);
        }

        // 获取公共 URL
        const { data: urlData } = supabase.storage
            .from('product-materials')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    };

    // 上传文档到 Supabase Storage
    const uploadDocument = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        // 生成安全的文件名，避免中文字符导致 invalid key
        const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${supabaseUuid}/documents/${safeFileName}`;

        const { data, error } = await supabase.storage
            .from('product-materials')
            .upload(filePath, file, {
                // 添加 upsert 选项避免重复文件冲突
                upsert: true
            });

        if (error) {
            throw new Error(`上传失败: ${error.message}`);
        }

        const { data: urlData } = supabase.storage
            .from('product-materials')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    };

    // 处理图片上传
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (images.length + files.length > 10) {
            setError('最多上传 10 张图片');
            return;
        }

        setError('');
        setUploading(true);

        try {
            const uploadPromises = Array.from(files).map(uploadImage);
            const urls = await Promise.all(uploadPromises);
            const newImages = [...images, ...urls];
            setImages(newImages);
            onMaterialsChange({ images: newImages, documents, analysis });
        } catch (err) {
            setError(err instanceof Error ? err.message : '上传失败');
        } finally {
            setUploading(false);
        }
    };

    // 处理文档上传
    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (documents.length + files.length > 5) {
            setError('最多上传 5 个文档');
            return;
        }

        setError('');
        setUploading(true);

        try {
            const uploadPromises = Array.from(files).map(uploadDocument);
            const urls = await Promise.all(uploadPromises);
            const newDocuments = [...documents, ...urls];
            setDocuments(newDocuments);
            onMaterialsChange({ images, documents: newDocuments, analysis });
        } catch (err) {
            setError(err instanceof Error ? err.message : '上传失败');
        } finally {
            setUploading(false);
        }
    };

    // 删除图片
    const removeImage = (index: number) => {
        const newImages = images.filter((_, i) => i !== index);
        setImages(newImages);
        onMaterialsChange({ images: newImages, documents, analysis });
    };

    // 删除文档
    const removeDocument = (index: number) => {
        const newDocuments = documents.filter((_, i) => i !== index);
        setDocuments(newDocuments);
        onMaterialsChange({ images, documents: newDocuments, analysis });
    };

    // AI 分析素材
    const handleAnalyze = async () => {
        if (images.length === 0 && documents.length === 0) {
            setError('请先上传素材');
            return;
        }

        setAnalyzing(true);
        setError('');

        try {
            // 调用 AI 分析 API
            const response = await fetch('/api/dify/analyze-materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supabaseUuid,
                    images,
                    documents,
                }),
            });

            const data = await response.json();

            if (data.success && data.analysis) {
                setAnalysis(data.analysis);
                onMaterialsChange({ images, documents, analysis: data.analysis });
            } else {
                throw new Error(data.error || 'AI 分析失败');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'AI 分析失败');
        } finally {
            setAnalyzing(false);
        }
    };

    // 获取文件名从 URL
    const getFileName = (url: string) => {
        const parts = url.split('/');
        const fileName = parts[parts.length - 1];
        // 移除时间戳前缀
        return fileName.replace(/^\d+-/, '');
    };

    // 紧凑模式 UI
    if (compact) {
        return (
            <div className="space-y-3">
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* 图片上传 - 紧凑版 */}
                <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex-1">
                        <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleImageUpload}
                            disabled={uploading || images.length >= 10}
                            className="hidden"
                        />
                        <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${uploading ? 'bg-gray-100 border-gray-300' : 'border-gray-300 hover:border-pink-400'
                            }`}>
                            {uploading ? (
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                            ) : (
                                <>
                                    <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
                                    <span className="text-xs text-gray-500">
                                        点击上传图片/视频 ({images.length}/10)
                                    </span>
                                </>
                            )}
                        </div>
                    </label>
                </div>

                {/* 图片预览 - 紧凑版 */}
                {images.length > 0 && (
                    <div className="grid grid-cols-6 gap-1">
                        {images.map((url, index) => (
                            <div key={index} className="relative aspect-square rounded overflow-hidden border">
                                <img
                                    src={url}
                                    alt={`素材 ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 hover:bg-red-600"
                                >
                                    <X className="w-2 h-2" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    产品素材
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* 图片上传区域 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            产品图片 ({images.length}/10)
                        </span>
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageUpload}
                                disabled={uploading || images.length >= 10}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploading || images.length >= 10}
                                asChild
                            >
                                <span>
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                    添加图片
                                </span>
                            </Button>
                        </label>
                    </div>

                    {/* 图片预览 */}
                    <div className="grid grid-cols-5 gap-2">
                        {images.map((url, index) => (
                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                                <img
                                    src={url}
                                    alt={`产品图 ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    onClick={() => removeImage(index)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 文档上传区域 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            产品资料 ({documents.length}/5)
                        </span>
                        <label className="cursor-pointer">
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt"
                                multiple
                                onChange={handleDocumentUpload}
                                disabled={uploading || documents.length >= 5}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={uploading || documents.length >= 5}
                                asChild
                            >
                                <span>
                                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                    添加文档
                                </span>
                            </Button>
                        </label>
                    </div>

                    {/* 文档列表 */}
                    <div className="space-y-1">
                        {documents.map((url, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                            >
                                <span className="text-sm truncate flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    {getFileName(url)}
                                </span>
                                <button
                                    onClick={() => removeDocument(index)}
                                    className="text-red-500 hover:text-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI 分析按钮 */}
                <div className="pt-2 border-t">
                    <Button
                        onClick={handleAnalyze}
                        disabled={analyzing || (images.length === 0 && documents.length === 0)}
                        className="w-full"
                        variant="secondary"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                AI 正在分析...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                AI 分析素材
                            </>
                        )}
                    </Button>
                </div>

                {/* AI 分析结果 */}
                {analysis && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1">
                            <Sparkles className="w-4 h-4" />
                            AI 分析结果
                        </div>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap">{analysis}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
