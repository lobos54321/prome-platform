/**
 * ContentModeConfig - 内容形式偏好配置组件
 * 
 * 支持：
 * - 多选模式：用户可选择一个或多个内容形式
 * - 自动模式：系统根据素材自动匹配
 * - 图文 (IMAGE_TEXT)：可选择性上传图片
 * - UGC 视频 (UGC_VIDEO)：配置性别/语言/时长
 * - 数字人视频 (AVATAR_VIDEO)：需上传数字人照片和语音样本
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Upload, Image, Mic, Video, FileText, User, Clock, Globe, Sparkles, ImagePlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ContentMode = 'IMAGE_TEXT' | 'UGC_VIDEO' | 'AVATAR_VIDEO';

interface ContentModeConfigProps {
    supabaseUuid: string;
    initialModes?: ContentMode[];
    initialAutoMode?: boolean;
    initialAvatarPhoto?: string;
    initialVoiceSample?: string;
    initialUgcGender?: 'male' | 'female';
    initialUgcLanguage?: string;
    initialUgcDuration?: number;
    initialProductImages?: string[];
    onConfigChange?: (config: ContentModeConfigData) => void;
}

interface ContentModeConfigData {
    autoMode: boolean;
    selectedModes: ContentMode[];
    avatarPhotoUrl?: string;
    voiceSampleUrl?: string;
    ugcGender?: 'male' | 'female';
    ugcLanguage?: string;
    ugcDuration?: number;
    productImages?: string[];
}

export function ContentModeConfig({
    supabaseUuid,
    initialModes = ['IMAGE_TEXT'],
    initialAutoMode = false,
    initialAvatarPhoto,
    initialVoiceSample,
    initialUgcGender = 'female',
    initialUgcLanguage = 'zh-CN',
    initialUgcDuration = 60,
    initialProductImages = [],
    onConfigChange
}: ContentModeConfigProps) {
    const [autoMode, setAutoMode] = useState(initialAutoMode);
    const [selectedModes, setSelectedModes] = useState<ContentMode[]>(initialModes);
    const [avatarPhotoUrl, setAvatarPhotoUrl] = useState(initialAvatarPhoto || '');
    const [voiceSampleUrl, setVoiceSampleUrl] = useState(initialVoiceSample || '');
    const [ugcGender, setUgcGender] = useState<'male' | 'female'>(initialUgcGender);
    const [ugcLanguage, setUgcLanguage] = useState(initialUgcLanguage);
    const [ugcDuration, setUgcDuration] = useState(initialUgcDuration);
    const [productImages, setProductImages] = useState<string[]>(initialProductImages);

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const toggleMode = (mode: ContentMode) => {
        const newModes = selectedModes.includes(mode)
            ? selectedModes.filter(m => m !== mode)
            : [...selectedModes, mode];

        // 至少选择一个模式
        if (newModes.length === 0) {
            newModes.push('IMAGE_TEXT');
        }

        setSelectedModes(newModes);
        notifyChange({ selectedModes: newModes });
    };

    const handleAutoModeChange = (checked: boolean) => {
        setAutoMode(checked);
        if (checked) {
            // 自动模式：选择所有可用的模式
            const allModes: ContentMode[] = ['IMAGE_TEXT', 'UGC_VIDEO'];
            if (avatarPhotoUrl && voiceSampleUrl) {
                allModes.push('AVATAR_VIDEO');
            }
            setSelectedModes(allModes);
            notifyChange({ autoMode: true, selectedModes: allModes });
        } else {
            notifyChange({ autoMode: false });
        }
    };

    const notifyChange = (partialConfig: Partial<ContentModeConfigData>) => {
        const fullConfig: ContentModeConfigData = {
            autoMode,
            selectedModes,
            avatarPhotoUrl,
            voiceSampleUrl,
            ugcGender,
            ugcLanguage,
            ugcDuration,
            productImages,
            ...partialConfig
        };
        onConfigChange?.(fullConfig);
    };

    const uploadFile = async (file: File, type: 'avatar' | 'voice' | 'product'): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase();
            const fileName = `${supabaseUuid}/${type}_${Date.now()}.${fileExt}`;
            const bucketName = type === 'avatar' ? 'avatar-photos' : type === 'voice' ? 'voice-samples' : 'product-images';

            console.log(`[Upload] Starting upload to ${bucketName}:`, { fileName, fileType: file.type, fileSize: file.size });

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, file, { upsert: true });

            if (uploadError) {
                console.error(`[Upload] Error uploading to ${bucketName}:`, uploadError);
                // 设置更详细的错误信息
                if (uploadError.message.includes('Bucket not found')) {
                    setError(`存储桶 "${bucketName}" 不存在，请联系管理员创建`);
                } else if (uploadError.message.includes('mime type')) {
                    setError(`不支持的文件格式: ${file.type}`);
                } else if (uploadError.message.includes('size')) {
                    setError('文件太大，请上传更小的文件');
                } else {
                    setError(`上传失败: ${uploadError.message}`);
                }
                return null;
            }

            const { data: urlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);

            console.log(`[Upload] Success:`, urlData.publicUrl);
            return urlData.publicUrl;
        } catch (err) {
            console.error('[Upload] Unexpected error:', err);
            setError(err instanceof Error ? `上传错误: ${err.message}` : '上传失败，请重试');
            return null;
        }
    };

    const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('请上传图片文件');
            return;
        }

        setUploading(true);
        setError('');

        const url = await uploadFile(file, 'avatar');
        if (url) {
            setAvatarPhotoUrl(url);
            notifyChange({ avatarPhotoUrl: url });
        } else {
            setError('头像上传失败');
        }

        setUploading(false);
    }, [supabaseUuid]);

    const handleVoiceUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            setError('请上传音频文件');
            return;
        }

        setUploading(true);
        setError('');

        const url = await uploadFile(file, 'voice');
        if (url) {
            setVoiceSampleUrl(url);
            notifyChange({ voiceSampleUrl: url });
        } else {
            setError('语音上传失败');
        }

        setUploading(false);
    }, [supabaseUuid]);

    const handleProductImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('请上传图片文件');
            return;
        }

        setUploading(true);
        setError('');

        const url = await uploadFile(file, 'product');
        if (url) {
            const newImages = [...productImages, url];
            setProductImages(newImages);
            notifyChange({ productImages: newImages });
        } else {
            setError('图片上传失败');
        }

        setUploading(false);
    }, [supabaseUuid, productImages]);

    const removeProductImage = (index: number) => {
        const newImages = productImages.filter((_, i) => i !== index);
        setProductImages(newImages);
        notifyChange({ productImages: newImages });
    };

    const isAvatarModeReady = avatarPhotoUrl && voiceSampleUrl;
    const isModeSelected = (mode: ContentMode) => selectedModes.includes(mode);

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="h-5 w-5" />
                    内容形式偏好
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* 自动匹配开关 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
                    <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        <div>
                            <Label className="font-medium">系统自动匹配</Label>
                            <p className="text-sm text-gray-500">根据素材和内容自动选择最佳形式</p>
                        </div>
                    </div>
                    <Switch checked={autoMode} onCheckedChange={handleAutoModeChange} />
                </div>

                {!autoMode && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">选择一个或多个内容形式：</p>

                        {/* 图文模式 */}
                        <div className={`p-4 border rounded-lg transition-colors ${isModeSelected('IMAGE_TEXT') ? 'border-blue-300 bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="mode-image"
                                    checked={isModeSelected('IMAGE_TEXT')}
                                    onCheckedChange={() => toggleMode('IMAGE_TEXT')}
                                />
                                <div className="flex-1">
                                    <Label htmlFor="mode-image" className="flex items-center gap-2 cursor-pointer">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">图文</span>
                                    </Label>
                                    <p className="text-sm text-gray-500 mt-1">AI 自动生成图文内容，可选择性上传产品图片</p>

                                    {isModeSelected('IMAGE_TEXT') && (
                                        <div className="mt-4">
                                            <Label className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                                                <ImagePlus className="h-3 w-3" /> 产品图片（可选）
                                            </Label>
                                            <div className="flex flex-wrap gap-2">
                                                {productImages.map((url, index) => (
                                                    <div key={index} className="relative group">
                                                        <img src={url} alt={`产品图 ${index + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                                                        <button
                                                            onClick={() => removeProductImage(index)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                                {productImages.length < 10 && (
                                                    <div>
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleProductImageUpload}
                                                            className="hidden"
                                                            id="product-upload"
                                                            disabled={uploading}
                                                        />
                                                        <label
                                                            htmlFor="product-upload"
                                                            className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-50"
                                                        >
                                                            <Upload className="h-5 w-5 text-gray-400" />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* UGC 视频模式 */}
                        <div className={`p-4 border rounded-lg transition-colors ${isModeSelected('UGC_VIDEO') ? 'border-green-300 bg-green-50' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="mode-ugc"
                                    checked={isModeSelected('UGC_VIDEO')}
                                    onCheckedChange={() => toggleMode('UGC_VIDEO')}
                                />
                                <div className="flex-1">
                                    <Label htmlFor="mode-ugc" className="flex items-center gap-2 cursor-pointer">
                                        <Video className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">UGC 视频</span>
                                    </Label>
                                    <p className="text-sm text-gray-500 mt-1">系统自动生成 1 分钟内短视频</p>

                                    {isModeSelected('UGC_VIDEO') && (
                                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <Label className="text-xs text-gray-500 flex items-center gap-1">
                                                    <User className="h-3 w-3" /> 角色性别
                                                </Label>
                                                <Select value={ugcGender} onValueChange={(v: 'male' | 'female') => {
                                                    setUgcGender(v);
                                                    notifyChange({ ugcGender: v });
                                                }}>
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="female">女性</SelectItem>
                                                        <SelectItem value="male">男性</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <Label className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Globe className="h-3 w-3" /> 语言
                                                </Label>
                                                <Select value={ugcLanguage} onValueChange={(v) => {
                                                    setUgcLanguage(v);
                                                    notifyChange({ ugcLanguage: v });
                                                }}>
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="zh-CN">中文</SelectItem>
                                                        <SelectItem value="en-US">English</SelectItem>
                                                        <SelectItem value="ja-JP">日本語</SelectItem>
                                                        <SelectItem value="ko-KR">한국어</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div>
                                                <Label className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" /> 时长
                                                </Label>
                                                <Select value={String(ugcDuration)} onValueChange={(v) => {
                                                    const duration = parseInt(v);
                                                    setUgcDuration(duration);
                                                    notifyChange({ ugcDuration: duration });
                                                }}>
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="15">15 秒</SelectItem>
                                                        <SelectItem value="30">30 秒</SelectItem>
                                                        <SelectItem value="45">45 秒</SelectItem>
                                                        <SelectItem value="60">60 秒</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 数字人视频模式 */}
                        <div className={`p-4 border rounded-lg transition-colors ${isModeSelected('AVATAR_VIDEO') ? 'border-purple-300 bg-purple-50' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="mode-avatar"
                                    checked={isModeSelected('AVATAR_VIDEO')}
                                    onCheckedChange={() => toggleMode('AVATAR_VIDEO')}
                                    disabled={!isAvatarModeReady}
                                />
                                <div className="flex-1">
                                    <Label htmlFor="mode-avatar" className="flex items-center gap-2 cursor-pointer">
                                        <User className="h-4 w-4 text-purple-500" />
                                        <span className="font-medium">数字人视频</span>
                                        {!isAvatarModeReady && (
                                            <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">需上传素材</span>
                                        )}
                                        {isAvatarModeReady && (
                                            <span className="text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded">素材已就绪</span>
                                        )}
                                    </Label>
                                    <p className="text-sm text-gray-500 mt-1">使用您的形象和声音生成视频</p>

                                    <div className="mt-4 space-y-4">
                                        {/* 数字人照片上传 */}
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                                                    <Image className="h-3 w-3" /> 数字人照片 *
                                                </Label>
                                                {avatarPhotoUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <img src={avatarPhotoUrl} alt="Avatar" className="w-16 h-16 rounded-lg object-cover" />
                                                        <Button variant="outline" size="sm" onClick={() => setAvatarPhotoUrl('')}>
                                                            更换
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleAvatarUpload}
                                                            className="hidden"
                                                            id="avatar-upload"
                                                            disabled={uploading}
                                                        />
                                                        <Button variant="outline" asChild disabled={uploading}>
                                                            <label htmlFor="avatar-upload" className="cursor-pointer">
                                                                <Upload className="h-4 w-4 mr-2" />
                                                                {uploading ? '上传中...' : '上传照片'}
                                                            </label>
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 语音样本上传 */}
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <Label className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                                                    <Mic className="h-3 w-3" /> 语音样本 *
                                                </Label>
                                                {voiceSampleUrl ? (
                                                    <div className="flex items-center gap-2">
                                                        <audio src={voiceSampleUrl} controls className="h-8" />
                                                        <Button variant="outline" size="sm" onClick={() => setVoiceSampleUrl('')}>
                                                            更换
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Input
                                                            type="file"
                                                            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/aac"
                                                            onChange={handleVoiceUpload}
                                                            className="hidden"
                                                            id="voice-upload"
                                                            disabled={uploading}
                                                        />
                                                        <Button variant="outline" asChild disabled={uploading}>
                                                            <label htmlFor="voice-upload" className="cursor-pointer">
                                                                <Upload className="h-4 w-4 mr-2" />
                                                                {uploading ? '上传中...' : '上传语音'}
                                                            </label>
                                                        </Button>
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            支持 MP3/WAV/M4A/OGG，建议 10-30 秒清晰语音
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 选中模式汇总 */}
                <div className="text-sm text-gray-500 pt-4 border-t">
                    {autoMode ? (
                        <span className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            系统将自动选择最佳内容形式
                        </span>
                    ) : (
                        <span>
                            已选择：{selectedModes.map(m => {
                                switch (m) {
                                    case 'IMAGE_TEXT': return '图文';
                                    case 'UGC_VIDEO': return 'UGC视频';
                                    case 'AVATAR_VIDEO': return '数字人视频';
                                }
                            }).join('、')}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default ContentModeConfig;
