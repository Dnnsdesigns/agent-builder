import { Agent, AgentConfig, ExecutionContext, AgentResponse } from '../agents/base';

export interface AgentConstructor {
  new (config: AgentConfig): Agent;
}

export interface EngineStats {
  totalAgents: number;
  totalExecutions: number;
  availableTypes: string[];
  agentsByStatus: Record<string, number>;
}

export class AgentEngine {
  private agentTypes: Map<string, AgentConstructor> = new Map();
  private agents: Map<string, Agent> = new Map();
  private totalExecutions = 0;

  constructor() {
    // Initialize the engine
  }

  /**
   * Register a new agent type with the engine
   */
  public registerAgentType(typeName: string, agentClass: AgentConstructor): void {
    if (this.agentTypes.has(typeName)) {
      throw new Error(`Agent type '${typeName}' is already registered`);
    }
    
    this.agentTypes.set(typeName, agentClass);
  }

  /**
   * Get all available agent types
   */
  public getAvailableTypes(): string[] {
    return Array.from(this.agentTypes.keys());
  }

  /**
   * Create a new agent instance
   */
  public async createAgent(agentId: string, typeName: string, config: AgentConfig): Promise<Agent> {
    if (this.agents.has(agentId)) {
      throw new Error(`Agent with ID '${agentId}' already exists`);
    }

    const AgentClass = this.agentTypes.get(typeName);
    if (!AgentClass) {
      throw new Error(`Unknown agent type: ${typeName}`);
    }

    try {
      const agent = new AgentClass(config);
      this.agents.set(agentId, agent);
      
      // Set up event forwarding for monitoring
      this.setupAgentEventForwarding(agentId, agent);
      
      return agent;
    } catch (error) {
      throw new Error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get an agent by ID
   */
  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  public getAllAgents(): Map<string, Agent> {
    return new Map(this.agents);
  }

  /**
   * Execute an agent with given input and context
   */
  public async executeAgent(
    agentId: string, 
    input: any, 
    context: ExecutionContext = {}
  ): Promise<AgentResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with ID '${agentId}' not found`);
    }

    if (agent.getStatus() === 'shutdown') {
      throw new Error(`Agent '${agentId}' has been shutdown`);
    }

    this.totalExecutions++;
    
    try {
      const response = await agent.executeWithRetry(input, context);
      return response;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime: 0
      };
    }
  }

  /**
   * Remove an agent from the engine
   */
  public async removeAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Shutdown the agent first
    agent.shutdown();
    
    // Remove from our registry
    this.agents.delete(agentId);
    
    return true;
  }

  /**
   * Get engine statistics
   */
  public getStats(): EngineStats {
    const agentsByStatus: Record<string, number> = {
      idle: 0,
      running: 0,
      error: 0,
      shutdown: 0
    };

    // Count agents by status
    for (const agent of this.agents.values()) {
      const status = agent.getStatus();
      agentsByStatus[status] = (agentsByStatus[status] || 0) + 1;
    }

    return {
      totalAgents: this.agents.size,
      totalExecutions: this.totalExecutions,
      availableTypes: this.getAvailableTypes(),
      agentsByStatus
    };
  }

  /**
   * Shutdown all agents and clean up the engine
   */
  public async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    for (const [agentId, agent] of this.agents) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          agent.shutdown();
          resolve();
        })
      );
    }

    await Promise.all(shutdownPromises);
    this.agents.clear();
  }

  /**
   * Get agents filtered by status
   */
  public getAgentsByStatus(status: string): Map<string, Agent> {
    const filteredAgents = new Map<string, Agent>();
    
    for (const [agentId, agent] of this.agents) {
      if (agent.getStatus() === status) {
        filteredAgents.set(agentId, agent);
      }
    }
    
    return filteredAgents;
  }

  /**
   * Get agents filtered by type
   */
  public getAgentsByType(typeName: string): Map<string, Agent> {
    const filteredAgents = new Map<string, Agent>();
    
    for (const [agentId, agent] of this.agents) {
      const config = agent.getConfig();
      // We don't store type directly, so we'll need to check the constructor
      // This is a simplified check - in a real implementation you might want to store type metadata
      if (this.agentTypes.has(typeName)) {
        const AgentClass = this.agentTypes.get(typeName)!;
        if (agent instanceof AgentClass) {
          filteredAgents.set(agentId, agent);
        }
      }
    }
    
    return filteredAgents;
  }

  /**
   * Update agent configuration
   */
  public updateAgentConfig(agentId: string, configUpdates: Partial<AgentConfig>): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.updateConfig(configUpdates);
    return true;
  }

  /**
   * Reset metrics for an agent
   */
  public resetAgentMetrics(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.resetMetrics();
    return true;
  }

  /**
   * Reset metrics for all agents
   */
  public resetAllMetrics(): void {
    for (const agent of this.agents.values()) {
      agent.resetMetrics();
    }
    this.totalExecutions = 0;
  }

  /**
   * Check if agent type is registered
   */
  public isAgentTypeRegistered(typeName: string): boolean {
    return this.agentTypes.has(typeName);
  }

  /**
   * Get detailed agent information
   */
  public getAgentInfo(agentId: string): any {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }

    return {
      id: agentId,
      config: agent.getConfig(),
      status: agent.getStatus(),
      metrics: agent.getMetrics(),
      settings: agent.getSettings()
    };
  }

  /**
   * Set up event forwarding from agent to engine level
   */
  private setupAgentEventForwarding(agentId: string, agent: Agent): void {
    agent.on('execution-start', (data) => {
      // Forward agent events with agent ID context
      // In a real implementation, you might want to emit these on the engine
      // for centralized monitoring
    });

    agent.on('execution-complete', (data) => {
      // Forward completion events
    });

    agent.on('execution-error', (data) => {
      // Forward error events
    });
  }
}