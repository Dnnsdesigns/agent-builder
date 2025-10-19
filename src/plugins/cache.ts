import { BasePlugin, PluginMetadata, PluginContext } from './base';

interface CacheEntry {
  value: any;
  timestamp: Date;
  ttl: number;
  hits: number;
}

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}

interface CacheConfig {
  defaultTtl?: number;
  maxEntries?: number;
  cleanupInterval?: number;
  keyGenerator?: (input: any, context: PluginContext) => string;
}

export class CachePlugin extends BasePlugin {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private totalHits = 0;
  private totalMisses = 0;
  private config: Required<CacheConfig>;

  constructor(defaultTtl: number = 30000, config: CacheConfig = {}) {
    super({
      name: 'cache-plugin',
      version: '1.0.0',
      description: 'Provides response caching with TTL support'
    });

    this.config = {
      defaultTtl,
      maxEntries: config.maxEntries || 1000,
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator
    };
  }

  public async onInit(): Promise<void> {
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  public async onDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
  }

  public async beforeExecution(input: any, context: PluginContext): Promise<any> {
    if (!this.isEnabled()) {
      return input;
    }

    const cacheKey = this.config.keyGenerator(input, context);
    const entry = this.cache.get(cacheKey);

    if (entry && this.isEntryValid(entry)) {
      // Cache hit
      entry.hits++;
      this.totalHits++;
      
      // Modify the input to signal that this is a cached response
      return {
        ...input,
        __cached: true,
        __cacheKey: cacheKey,
        __cachedResponse: entry.value
      };
    }

    // Cache miss
    this.totalMisses++;
    return {
      ...input,
      __cached: false,
      __cacheKey: cacheKey
    };
  }

  public async afterExecution(response: any, context: PluginContext): Promise<any> {
    if (!this.isEnabled()) {
      return response;
    }

    // If this was a cached response, return the cached value
    if (context && (context as any).__cached) {
      return (context as any).__cachedResponse;
    }

    // Store successful responses in cache
    if (response && response.success && context && (context as any).__cacheKey) {
      const cacheKey = (context as any).__cacheKey;
      this.setCacheEntry(cacheKey, response);
    }

    return response;
  }

  private defaultKeyGenerator(input: any, context: PluginContext): string {
    // Create a cache key based on agent ID, input, and relevant context
    const inputStr = JSON.stringify(input);
    const contextStr = JSON.stringify({
      agentId: context.agentId,
      agentType: context.agentType
    });
    
    // Simple hash function for the key
    return this.simpleHash(inputStr + contextStr);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `cache_${Math.abs(hash).toString(16)}`;
  }

  private setCacheEntry(key: string, value: any, ttl?: number): void {
    // Ensure we don't exceed max entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldestEntry();
    }

    const entry: CacheEntry = {
      value: JSON.parse(JSON.stringify(value)), // Deep copy
      timestamp: new Date(),
      ttl: ttl || this.config.defaultTtl,
      hits: 0
    };

    this.cache.set(key, entry);
  }

  private isEntryValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const entryTime = entry.timestamp.getTime();
    return (now - entryTime) < entry.ttl;
  }

  private cleanupExpiredEntries(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isEntryValid(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private evictOldestEntry(): void {
    // Simple LRU: remove the oldest entry by timestamp
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // Public API methods
  public getCacheStats(): CacheStats {
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (this.isEntryValid(entry)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    const totalRequests = this.totalHits + this.totalMisses;
    const hitRate = totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses
    };
  }

  public clearCache(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  public deleteCacheEntry(key: string): boolean {
    return this.cache.delete(key);
  }

  public getCacheEntry(key: string): any {
    const entry = this.cache.get(key);
    if (entry && this.isEntryValid(entry)) {
      return { ...entry.value };
    }
    return null;
  }

  public setCacheEntryManual(key: string, value: any, ttl?: number): void {
    this.setCacheEntry(key, value, ttl);
  }

  public getDefaultTtl(): number {
    return this.config.defaultTtl;
  }

  public setDefaultTtl(ttl: number): void {
    if (ttl < 0) {
      throw new Error('TTL must be non-negative');
    }
    this.config.defaultTtl = ttl;
  }

  public getMaxEntries(): number {
    return this.config.maxEntries;
  }

  public setMaxEntries(maxEntries: number): void {
    if (maxEntries < 1) {
      throw new Error('Max entries must be at least 1');
    }
    
    this.config.maxEntries = maxEntries;
    
    // If we're over the limit, evict entries
    while (this.cache.size > maxEntries) {
      this.evictOldestEntry();
    }
  }

  public preloadCache(entries: Record<string, { value: any; ttl?: number }>): void {
    for (const [key, data] of Object.entries(entries)) {
      this.setCacheEntry(key, data.value, data.ttl);
    }
  }

  public exportCache(): Record<string, { value: any; timestamp: string; ttl: number; hits: number }> {
    const exported: Record<string, any> = {};
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isEntryValid(entry)) {
        exported[key] = {
          value: entry.value,
          timestamp: entry.timestamp.toISOString(),
          ttl: entry.ttl,
          hits: entry.hits
        };
      }
    }
    
    return exported;
  }
}