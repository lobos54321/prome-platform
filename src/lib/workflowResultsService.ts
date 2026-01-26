/**
 * Workflow Results Service
 *
 * 保存和获取工作流生成的内容结果到 Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface WorkflowResult {
    id?: string;
    user_id: string;
    task_id: string;
    workflow_mode: 'image_text' | 'avatar_video' | 'ugc_video';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    overall_progress: number;
    result: {
        title?: string;
        text?: string;
        hashtags?: string[];
        images?: string[];
        variants?: Array<{ platform: string; content: string }>;
        engine?: string;
        [key: string]: any;
    };
    nodes: any[];
    content_strategy?: any;
    weekly_plan?: any;
    target_platforms: string[];
    created_at?: string;
    updated_at?: string;
}

class WorkflowResultsService {
    /**
     * 保存或更新工作流结果
     */
    async saveResult(data: Partial<WorkflowResult>): Promise<WorkflowResult | null> {
        if (!supabase) {
            console.warn('[WorkflowResultsService] Supabase not configured, using localStorage fallback');
            this.saveToLocalStorage(data);
            return data as WorkflowResult;
        }

        try {
            // 使用 upsert - 如果存在则更新，不存在则插入
            const { data: result, error } = await supabase
                .from('workflow_results')
                .upsert({
                    user_id: data.user_id,
                    task_id: data.task_id,
                    workflow_mode: data.workflow_mode || 'image_text',
                    status: data.status || 'completed',
                    overall_progress: data.overall_progress || 100,
                    result: data.result || {},
                    nodes: data.nodes || [],
                    content_strategy: data.content_strategy,
                    weekly_plan: data.weekly_plan,
                    target_platforms: data.target_platforms || ['xiaohongshu'],
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,task_id',
                })
                .select()
                .single();

            if (error) {
                console.error('[WorkflowResultsService] Save error:', error);
                // 降级到 localStorage
                this.saveToLocalStorage(data);
                return data as WorkflowResult;
            }

            console.log('[WorkflowResultsService] Saved to Supabase:', result?.id);
            return result;
        } catch (err) {
            console.error('[WorkflowResultsService] Save exception:', err);
            this.saveToLocalStorage(data);
            return data as WorkflowResult;
        }
    }

    /**
     * 获取工作流结果
     */
    async getResult(userId: string, taskId: string): Promise<WorkflowResult | null> {
        if (!supabase) {
            console.warn('[WorkflowResultsService] Supabase not configured, using localStorage');
            return this.getFromLocalStorage(taskId);
        }

        try {
            const { data, error } = await supabase
                .from('workflow_results')
                .select('*')
                .eq('user_id', userId)
                .eq('task_id', taskId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - try localStorage
                    return this.getFromLocalStorage(taskId);
                }
                console.error('[WorkflowResultsService] Get error:', error);
                return this.getFromLocalStorage(taskId);
            }

            return data;
        } catch (err) {
            console.error('[WorkflowResultsService] Get exception:', err);
            return this.getFromLocalStorage(taskId);
        }
    }

    /**
     * 获取用户最近的工作流结果列表
     */
    async getRecentResults(userId: string, limit: number = 10): Promise<WorkflowResult[]> {
        if (!supabase) {
            return [];
        }

        try {
            const { data, error } = await supabase
                .from('workflow_results')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('[WorkflowResultsService] GetRecent error:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('[WorkflowResultsService] GetRecent exception:', err);
            return [];
        }
    }

    /**
     * 删除工作流结果
     */
    async deleteResult(userId: string, taskId: string): Promise<boolean> {
        if (!supabase) return false;

        try {
            const { error } = await supabase
                .from('workflow_results')
                .delete()
                .eq('user_id', userId)
                .eq('task_id', taskId);

            if (error) {
                console.error('[WorkflowResultsService] Delete error:', error);
                return false;
            }

            // 同时清理 localStorage
            this.clearLocalStorage(taskId);
            return true;
        } catch (err) {
            console.error('[WorkflowResultsService] Delete exception:', err);
            return false;
        }
    }

    // LocalStorage 降级方法
    private saveToLocalStorage(data: Partial<WorkflowResult>): void {
        if (!data.task_id) return;
        try {
            localStorage.setItem(`prome_workflow_result_${data.task_id}`, JSON.stringify(data.result || {}));
            localStorage.setItem(`prome_workflow_nodes_${data.task_id}`, JSON.stringify(data.nodes || []));
            localStorage.setItem(`prome_workflow_progress_${data.task_id}`, String(data.overall_progress || 0));
            localStorage.setItem(`prome_workflow_completed_${data.task_id}`, String(data.status === 'completed'));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }

    private getFromLocalStorage(taskId: string): WorkflowResult | null {
        try {
            const result = localStorage.getItem(`prome_workflow_result_${taskId}`);
            const nodes = localStorage.getItem(`prome_workflow_nodes_${taskId}`);
            const progress = localStorage.getItem(`prome_workflow_progress_${taskId}`);
            const completed = localStorage.getItem(`prome_workflow_completed_${taskId}`);

            if (!result && !nodes) return null;

            return {
                user_id: '',
                task_id: taskId,
                workflow_mode: 'image_text',
                status: completed === 'true' ? 'completed' : 'processing',
                overall_progress: parseInt(progress || '0', 10),
                result: result ? JSON.parse(result) : {},
                nodes: nodes ? JSON.parse(nodes) : [],
                target_platforms: ['xiaohongshu'],
            };
        } catch (e) {
            console.warn('Failed to get from localStorage:', e);
            return null;
        }
    }

    private clearLocalStorage(taskId: string): void {
        try {
            localStorage.removeItem(`prome_workflow_result_${taskId}`);
            localStorage.removeItem(`prome_workflow_nodes_${taskId}`);
            localStorage.removeItem(`prome_workflow_progress_${taskId}`);
            localStorage.removeItem(`prome_workflow_completed_${taskId}`);
        } catch (e) {
            console.warn('Failed to clear localStorage:', e);
        }
    }
}

export const workflowResultsService = new WorkflowResultsService();
