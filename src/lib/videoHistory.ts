// 视频历史记录管理
export interface VideoRecord {
  id: string;
  title: string;
  videoUrl: string;
  imageUrl: string;
  productDescription: string;
  characterGender: string;
  duration: string;
  createdAt: Date;
  isCompleted: boolean;
}

const VIDEO_HISTORY_KEY = 'prome_video_history';

export class VideoHistoryManager {
  static getHistory(): VideoRecord[] {
    try {
      const stored = localStorage.getItem(VIDEO_HISTORY_KEY);
      if (!stored) return [];
      
      const records = JSON.parse(stored);
      return records.map((record: any) => ({
        ...record,
        createdAt: new Date(record.createdAt)
      }));
    } catch (error) {
      console.error('Failed to load video history:', error);
      return [];
    }
  }

  static addRecord(record: Omit<VideoRecord, 'id' | 'createdAt' | 'isCompleted'>): VideoRecord {
    const newRecord: VideoRecord = {
      ...record,
      id: Date.now().toString(),
      createdAt: new Date(),
      isCompleted: false,
      title: record.productDescription.slice(0, 50) + (record.productDescription.length > 50 ? '...' : '')
    };

    const history = this.getHistory();
    history.unshift(newRecord); // 添加到开头
    
    // 限制最多保存50个记录
    if (history.length > 50) {
      history.splice(50);
    }

    try {
      localStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save video history:', error);
    }

    return newRecord;
  }

  static updateRecord(id: string, updates: Partial<VideoRecord>): void {
    const history = this.getHistory();
    const index = history.findIndex(record => record.id === id);
    
    if (index !== -1) {
      history[index] = { ...history[index], ...updates };
      
      try {
        localStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history));
      } catch (error) {
        console.error('Failed to update video history:', error);
      }
    }
  }

  static deleteRecord(id: string): void {
    const history = this.getHistory();
    const filtered = history.filter(record => record.id !== id);
    
    try {
      localStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to delete video record:', error);
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(VIDEO_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear video history:', error);
    }
  }
}