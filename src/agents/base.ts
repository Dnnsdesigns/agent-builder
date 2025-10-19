import { EventEmitter } from 'events';

export interface AgentConfig {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  settings: Record<string, any>;
  maxExecutionTime?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface ExecutionContext {
  userId?: string;
  sessionId?: string;
  environment?: string;
  [key: string]: any;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export interface AgentMetrics {
  executionsCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastExecution?: Date;
  errors: string[];
}

export type AgentStatus = 'idle' | 'running' | 'error' | 'shutdown';

export abstract class Agent extends EventEmitter {
  protected config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected metrics: AgentMetrics = {
    executionsCount: 0,
    successRate: 0,
    averageExecutionTime: 0,
    errors: []
  };
  protected totalExecutionTime = 0;
  protected successfulExecutions = 0;

  constructor(config: AgentConfig) {
    super();
    this.config = { ...config };
    
    // Set default retry policy if not provided
    if (!this.config.retryPolicy) {
      this.config.retryPolicy = {
        maxRetries: 2,
        backoffMs: 1000
      };
    }
  }

  public async executeWithRetry(input: any, context: ExecutionContext = {}): Promise<AgentResponse> {
    const { maxRetries, backoffMs } = this.config.retryPolicy!;
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeInternal(input, context);
        if (result.success) {
          return result;
        }
        lastError = result.error;
        
        // Don't retry on the last attempt
        if (attempt < maxRetries) {
          await this.sleep(backoffMs * Math.pow(2, attempt)); // Exponential backoff
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt < maxRetries) {
          await this.sleep(backoffMs * Math.pow(2, attempt));
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError}`,
      executionTime: 0
    };
  }

  private async executeInternal(input: any, context: ExecutionContext): Promise<AgentResponse> {
    const startTime = Date.now();
    this.status = 'running';
    
    try {
      // Add execution context
      const executionContext = {
        ...context,
        sessionId: context.sessionId || this.generateSessionId(),
        timestamp: new Date().toISOString()
      };

      this.emit('execution-start', { input, context: executionContext });

      // Apply timeout if specified
      const timeoutPromise = this.config.maxExecutionTime 
        ? this.createTimeoutPromise(this.config.maxExecutionTime)
        : null;

      const executionPromise = this.execute(input, executionContext);
      
      const result = timeoutPromise 
        ? await Promise.race([executionPromise, timeoutPromise])
        : await executionPromise;

      const executionTime = Date.now() - startTime;
      const response: AgentResponse = {
        ...result,
        executionTime
      };

      // Update metrics
      this.updateMetrics(response);
      this.status = 'idle';

      this.emit('execution-complete', response);
      return response;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const response: AgentResponse = {
        success: false,
        error: errorMessage,
        executionTime
      };

      this.updateMetrics(response);
      this.status = 'error';

      this.emit('execution-error', response);
      return response;
    }
  }

  private createTimeoutPromise(timeoutMs: number): Promise<AgentResponse> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private updateMetrics(response: AgentResponse): void {
    this.metrics.executionsCount++;
    this.totalExecutionTime += response.executionTime;
    this.metrics.averageExecutionTime = this.totalExecutionTime / this.metrics.executionsCount;
    this.metrics.lastExecution = new Date();

    if (response.success) {
      this.successfulExecutions++;
    } else if (response.error) {
      this.metrics.errors.push(response.error);
      // Keep only last 10 errors
      if (this.metrics.errors.length > 10) {
        this.metrics.errors = this.metrics.errors.slice(-10);
      }
    }

    this.metrics.successRate = (this.successfulExecutions / this.metrics.executionsCount) * 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Abstract method that must be implemented by subclasses
  protected abstract execute(input: any, context: ExecutionContext): Promise<AgentResponse>;

  // Public API methods
  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  public getSettings(): Record<string, any> {
    return { ...this.config.settings };
  }

  public updateSettings(newSettings: Record<string, any>): void {
    this.config.settings = { ...this.config.settings, ...newSettings };
  }

  public updateConfig(configUpdates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...configUpdates };
  }

  public shutdown(): void {
    this.status = 'shutdown';
    this.removeAllListeners();
  }

  public resetMetrics(): void {
    this.metrics = {
      executionsCount: 0,
      successRate: 0,
      averageExecutionTime: 0,
      errors: []
    };
    this.totalExecutionTime = 0;
    this.successfulExecutions = 0;
  }
}