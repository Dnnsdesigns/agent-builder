# Agent Builder Framework - AI Coding Assistant Guide

## Project Overview
This is an **Agent Builder Framework** - a TypeScript-based system for creating, managing, and executing AI agents with plugin support. The framework provides a plugin-based architecture where agents can be dynamically created, configured, and executed.

## Core Architecture

### Engine & Agent Management
- **AgentEngine** (`./core/engine.ts`) - Central orchestrator managing agent lifecycle, type registration, and execution
- **Agent Types**: `ChatAgent` (conversational AI) and `TaskAgent` (task scheduling/automation)
- Agents are registered by type: `engine.registerAgentType('chat', ChatAgent)`
- Created with unique IDs: `engine.createAgent('agent-id', 'type', config)`

### Plugin System
- **Plugin Architecture**: `src/plugins/` contains extensible plugin system
- **Built-in Plugins**: 
  - `LoggingPlugin` - Execution logging and monitoring
  - `CachePlugin` - Response caching with TTL (default 30s)
- **Plugin Registration**: `pluginLoader.registerPlugin(plugin)`
- Plugins enhance agent functionality transparently

### Configuration Patterns
Agent configs follow this structure:
```typescript
{
  name: string,
  version: string,
  description: string,
  capabilities: string[],
  settings: { /* agent-specific settings */ },
  maxExecutionTime?: number,
  retryPolicy?: { maxRetries: number, backoffMs: number }
}
```

## Development Patterns

### Agent Execution Flow
1. Input validation and context creation
2. Plugin pre-processing (logging, caching)
3. Agent-specific execution logic
4. Response generation with metrics
5. Plugin post-processing

### Error Handling & Metrics
- All executions return: `{ success: boolean, data?: any, error?: string, executionTime: number }`
- Automatic metrics tracking: execution count, success rate, average time
- Built-in retry logic with exponential backoff
- Event system: `agent.on('execution-start|complete|error', handler)`

### Testing Approach
Use the tutorial notebook (`agent-builder-tutorial.ipynb`) as the testing harness:
- Demonstrates all core functionality patterns
- Performance testing with concurrent executions
- Plugin behavior validation
- Error condition testing

## Key Files & Directories

### Core Implementation (Missing - Need Creation)
- `src/core/engine.ts` - Main AgentEngine class
- `src/agents/` - ChatAgent, TaskAgent implementations  
- `src/agents/base.ts` - Abstract Agent base class
- `src/config/loader.ts` - ConfigLoader for JSON/YAML configs
- `src/plugins/base.ts` - BasePlugin interface

### Current State
- `src/plugins/cache.ts` & `logging.ts` - Empty plugin files (need implementation)
- `agent-builder-tutorial.ipynb` - Comprehensive usage examples and test patterns

## Build & Development Commands
The project expects:
- `npm run build` - TypeScript compilation to `./dist/`
- `npm install` - Dependency management
- MSBuild integration (Windows-focused project)

## Common Implementation Patterns

### Creating Custom Agents
```typescript
class CustomAgent extends Agent {
  async execute(input: any, context: ExecutionContext): Promise<AgentResponse> {
    // Agent-specific logic
    return { success: true, data: result, executionTime: Date.now() - start };
  }
}
```

### Plugin Development
```typescript
class CustomPlugin extends BasePlugin {
  async beforeExecution(input: any): Promise<any> { /* pre-processing */ }
  async afterExecution(response: any): Promise<any> { /* post-processing */ }
}
```

### Configuration Loading
Support both JSON and YAML configs via `ConfigLoader.loadFromFile()` - enables external agent configuration management.

## Integration Points
- Agents communicate through the Engine's execution pipeline
- Plugin system provides cross-cutting concerns (logging, caching, monitoring)
- Event-driven architecture for monitoring and debugging
- Metrics collection for performance analysis

Focus on the **plugin-based extensibility** and **agent lifecycle management** when making changes - these are the core architectural principles driving all implementation decisions.