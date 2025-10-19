export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
}

export interface PluginContext {
  agentId: string;
  agentType: string;
  executionId: string;
  timestamp: Date;
  [key: string]: any;
}

export interface PluginHooks {
  beforeExecution?: (input: any, context: PluginContext) => Promise<any>;
  afterExecution?: (response: any, context: PluginContext) => Promise<any>;
  onError?: (error: Error, context: PluginContext) => Promise<void>;
  onInit?: () => Promise<void>;
  onDestroy?: () => Promise<void>;
}

export abstract class BasePlugin implements PluginHooks {
  protected metadata: PluginMetadata;
  protected enabled: boolean = true;
  protected initialized: boolean = false;

  constructor(metadata: PluginMetadata) {
    this.metadata = { ...metadata };
  }

  // Plugin lifecycle methods
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.onInit) {
      await this.onInit();
    }
    
    this.initialized = true;
  }

  public async destroy(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    if (this.onDestroy) {
      await this.onDestroy();
    }
    
    this.initialized = false;
  }

  // Plugin control methods
  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled && this.initialized;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  // Metadata access
  public getMetadata(): PluginMetadata {
    return { ...this.metadata };
  }

  public getName(): string {
    return this.metadata.name;
  }

  public getVersion(): string {
    return this.metadata.version;
  }

  public getDescription(): string | undefined {
    return this.metadata.description;
  }

  // Hook methods - can be overridden by concrete plugins
  public async beforeExecution(input: any, context: PluginContext): Promise<any> {
    return input; // Default: pass through unchanged
  }

  public async afterExecution(response: any, context: PluginContext): Promise<any> {
    return response; // Default: pass through unchanged
  }

  public async onError(error: Error, context: PluginContext): Promise<void> {
    // Default: do nothing
  }

  public async onInit(): Promise<void> {
    // Default: do nothing
  }

  public async onDestroy(): Promise<void> {
    // Default: do nothing
  }

  // Utility method for plugin-specific configuration
  protected validateConfig(config: any, requiredFields: string[]): void {
    if (!config || typeof config !== 'object') {
      throw new Error(`Plugin ${this.metadata.name}: Invalid configuration object`);
    }

    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Plugin ${this.metadata.name}: Missing required configuration field: ${field}`);
      }
    }
  }

  // Utility method for safe async execution
  protected async safeExecute<T>(
    operation: () => Promise<T>, 
    fallback: T, 
    errorMessage?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.warn(
        `Plugin ${this.metadata.name}: ${errorMessage || 'Operation failed'}`,
        error instanceof Error ? error.message : error
      );
      return fallback;
    }
  }
}