/**
 * API Request Queue Manager
 * 
 * Handles API request batching, retry logic, and synchronization
 * optimization for better frontend-backend data sync performance.
 */

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  resolve: (value: Response) => void;
  reject: (reason: any) => void;
  retries: number;
  timestamp: number;
}

class APIRequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private readonly maxRetries = 3;
  private readonly batchDelay = 100; // ms
  private readonly maxQueueSize = 50;
  private batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Add request to queue with automatic retry and batching
   */
  async enqueue(url: string, options: RequestInit = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `req-${Date.now()}-${Math.random()}`,
        url,
        options,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      };

      // Check queue size limit
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Request queue is full. Please try again later.'));
        return;
      }

      this.queue.push(request);
      this.scheduleProcessing();
    });
  }

  /**
   * Schedule batch processing with debouncing
   */
  private scheduleProcessing(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }

  /**
   * Process batch of requests
   */
  private async processBatch(): void {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = [...this.queue];
    this.queue = [];

    console.log(`[APIQueue] Processing batch of ${batch.length} requests`);

    // Process requests concurrently but with limited concurrency
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(batch, concurrencyLimit);

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(request => this.executeRequest(request))
      );
    }

    this.processing = false;

    // Process any new requests that arrived during batch processing
    if (this.queue.length > 0) {
      this.scheduleProcessing();
    }
  }

  /**
   * Execute individual request with retry logic
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(request.url, {
        ...request.options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok && this.shouldRetry(response.status) && request.retries < this.maxRetries) {
        // Retry with exponential backoff
        request.retries++;
        const delay = Math.min(1000 * Math.pow(2, request.retries), 10000);
        
        console.log(`[APIQueue] Retrying request ${request.id} (attempt ${request.retries}/${this.maxRetries}) after ${delay}ms`);
        
        setTimeout(() => {
          this.queue.push(request);
          this.scheduleProcessing();
        }, delay);
        
        return;
      }

      request.resolve(response);
    } catch (error) {
      if (request.retries < this.maxRetries && this.shouldRetryError(error)) {
        request.retries++;
        const delay = Math.min(1000 * Math.pow(2, request.retries), 10000);
        
        console.log(`[APIQueue] Retrying request ${request.id} due to error (attempt ${request.retries}/${this.maxRetries}) after ${delay}ms`);
        
        setTimeout(() => {
          this.queue.push(request);
          this.scheduleProcessing();
        }, delay);
        
        return;
      }

      request.reject(error);
    }
  }

  /**
   * Determine if HTTP status should trigger retry
   */
  private shouldRetry(status: number): boolean {
    return status >= 500 || status === 429 || status === 408;
  }

  /**
   * Determine if error should trigger retry
   */
  private shouldRetryError(error: any): boolean {
    if (error.name === 'AbortError') {
      return false; // Don't retry aborted requests
    }
    
    return error.name === 'NetworkError' || 
           error.name === 'TypeError' ||
           (error.message && error.message.includes('fetch'));
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Clear queue (useful for cleanup or reset)
   */
  public clearQueue(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled - queue cleared'));
    });
    this.queue = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Get queue status
   */
  public getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      oldestRequest: this.queue.length > 0 ? Date.now() - this.queue[0].timestamp : null
    };
  }
}

// Export singleton instance
export const apiRequestQueue = new APIRequestQueue();
export default apiRequestQueue;