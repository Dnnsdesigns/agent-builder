import { Agent, AgentConfig, ExecutionContext, AgentResponse } from './base';
import { v4 as uuidv4 } from 'uuid';

interface Task {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  result?: any;
  error?: string;
}

interface TaskInput {
  action: 'create' | 'execute' | 'list' | 'get' | 'update' | 'delete';
  taskId?: string;
  name?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  data?: any;
}

interface TaskSettings {
  maxConcurrentTasks: number;
  defaultPriority: 'low' | 'medium' | 'high';
  autoSchedule: boolean;
}

export class TaskAgent extends Agent {
  private tasks: Map<string, Task> = new Map();
  private runningTasks: Set<string> = new Set();

  constructor(config: AgentConfig) {
    super(config);
    
    // Ensure required settings have defaults
    const defaultSettings: TaskSettings = {
      maxConcurrentTasks: 3,
      defaultPriority: 'medium',
      autoSchedule: false
    };
    
    this.config.settings = { ...defaultSettings, ...this.config.settings };
  }

  protected async execute(input: any, context: ExecutionContext): Promise<AgentResponse> {
    const startTime = Date.now();

    // Validate input
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: 'Invalid input format. Expected object with action property.',
        executionTime: Date.now() - startTime
      };
    }

    const taskInput = input as TaskInput;
    if (!taskInput.action) {
      return {
        success: false,
        error: 'Missing action in input.',
        executionTime: Date.now() - startTime
      };
    }

    try {
      let result: any;

      switch (taskInput.action) {
        case 'create':
          result = await this.createTask(taskInput);
          break;
        case 'execute':
          result = await this.executeTask(taskInput);
          break;
        case 'list':
          result = await this.listTasks(taskInput);
          break;
        case 'get':
          result = await this.getTask(taskInput);
          break;
        case 'update':
          result = await this.updateTask(taskInput);
          break;
        case 'delete':
          result = await this.deleteTask(taskInput);
          break;
        default:
          throw new Error(`Unknown action: ${taskInput.action}`);
      }

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during task operation',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async createTask(input: TaskInput): Promise<any> {
    if (!input.name) {
      throw new Error('Task name is required for creation');
    }

    const settings = this.config.settings as TaskSettings;
    const taskId = uuidv4();
    
    const task: Task = {
      id: taskId,
      name: input.name,
      description: input.description || '',
      priority: input.priority || settings.defaultPriority,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tasks.set(taskId, task);

    return {
      taskId,
      task: { ...task },
      message: `Task '${task.name}' created successfully`
    };
  }

  private async executeTask(input: TaskInput): Promise<any> {
    if (!input.taskId) {
      throw new Error('Task ID is required for execution');
    }

    const task = this.tasks.get(input.taskId);
    if (!task) {
      throw new Error(`Task with ID '${input.taskId}' not found`);
    }

    if (task.status === 'completed') {
      return {
        taskId: input.taskId,
        message: 'Task already completed',
        result: task.result
      };
    }

    if (task.status === 'running') {
      throw new Error('Task is already running');
    }

    const settings = this.config.settings as TaskSettings;
    if (this.runningTasks.size >= settings.maxConcurrentTasks) {
      throw new Error(`Maximum concurrent tasks limit reached (${settings.maxConcurrentTasks})`);
    }

    // Mark task as running
    task.status = 'running';
    task.updatedAt = new Date();
    this.runningTasks.add(input.taskId);

    try {
      // Simulate task execution
      const result = await this.performTaskWork(task, input.data);
      
      // Mark as completed
      task.status = 'completed';
      task.result = result;
      task.updatedAt = new Date();
      this.runningTasks.delete(input.taskId);

      return {
        taskId: input.taskId,
        message: `Task '${task.name}' completed successfully`,
        result: result
      };

    } catch (error) {
      // Mark as failed
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown execution error';
      task.updatedAt = new Date();
      this.runningTasks.delete(input.taskId);

      throw error;
    }
  }

  private async listTasks(input: TaskInput): Promise<any> {
    const taskList = Array.from(this.tasks.values()).map(task => ({
      ...task,
      // Create a clean copy without internal references
    }));

    // Sort by priority and creation date
    taskList.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // High priority first
      }
      
      return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
    });

    return {
      tasks: taskList,
      totalTasks: taskList.length,
      runningTasks: this.runningTasks.size,
      pendingTasks: taskList.filter(t => t.status === 'pending').length,
      completedTasks: taskList.filter(t => t.status === 'completed').length,
      failedTasks: taskList.filter(t => t.status === 'failed').length
    };
  }

  private async getTask(input: TaskInput): Promise<any> {
    if (!input.taskId) {
      throw new Error('Task ID is required');
    }

    const task = this.tasks.get(input.taskId);
    if (!task) {
      throw new Error(`Task with ID '${input.taskId}' not found`);
    }

    return {
      task: { ...task }
    };
  }

  private async updateTask(input: TaskInput): Promise<any> {
    if (!input.taskId) {
      throw new Error('Task ID is required for update');
    }

    const task = this.tasks.get(input.taskId);
    if (!task) {
      throw new Error(`Task with ID '${input.taskId}' not found`);
    }

    if (task.status === 'running') {
      throw new Error('Cannot update a running task');
    }

    // Update allowed fields
    if (input.name) task.name = input.name;
    if (input.description !== undefined) task.description = input.description;
    if (input.priority) task.priority = input.priority;
    
    task.updatedAt = new Date();

    return {
      taskId: input.taskId,
      task: { ...task },
      message: `Task '${task.name}' updated successfully`
    };
  }

  private async deleteTask(input: TaskInput): Promise<any> {
    if (!input.taskId) {
      throw new Error('Task ID is required for deletion');
    }

    const task = this.tasks.get(input.taskId);
    if (!task) {
      throw new Error(`Task with ID '${input.taskId}' not found`);
    }

    if (task.status === 'running') {
      throw new Error('Cannot delete a running task');
    }

    this.tasks.delete(input.taskId);
    this.runningTasks.delete(input.taskId);

    return {
      taskId: input.taskId,
      message: `Task '${task.name}' deleted successfully`
    };
  }

  private async performTaskWork(task: Task, data?: any): Promise<any> {
    // Simulate different types of work based on task name/description
    const workTime = this.calculateWorkTime(task);
    
    // Add some realistic delay
    await new Promise(resolve => setTimeout(resolve, workTime));

    // Generate mock results based on task type
    const result = this.generateTaskResult(task, data);
    
    return result;
  }

  private calculateWorkTime(task: Task): number {
    // Simulate work time based on priority
    const baseTime = 100;
    const priorityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 1.5
    };
    
    const randomFactor = 0.5 + Math.random(); // 0.5 to 1.5
    return baseTime * priorityMultiplier[task.priority] * randomFactor;
  }

  private generateTaskResult(task: Task, inputData?: any): any {
    // Generate different types of results based on task characteristics
    const taskType = this.determineTaskType(task);
    
    switch (taskType) {
      case 'data-processing':
        return {
          type: 'data-processing',
          processedRecords: Math.floor(Math.random() * 1000) + 100,
          processingTime: Math.floor(Math.random() * 5000) + 1000,
          status: 'success',
          inputData: inputData
        };
      
      case 'report-generation':
        return {
          type: 'report-generation',
          reportSize: Math.floor(Math.random() * 50) + 10 + ' MB',
          pagesGenerated: Math.floor(Math.random() * 100) + 20,
          format: 'PDF',
          status: 'generated'
        };
      
      case 'backup':
        return {
          type: 'backup',
          backupSize: Math.floor(Math.random() * 500) + 100 + ' GB',
          filesBackedUp: Math.floor(Math.random() * 10000) + 1000,
          compressionRatio: (Math.random() * 0.3 + 0.7).toFixed(2),
          status: 'completed'
        };
      
      default:
        return {
          type: 'general-task',
          executionTime: Date.now(),
          status: 'completed',
          message: `Task '${task.name}' executed successfully`,
          priority: task.priority,
          inputData: inputData
        };
    }
  }

  private determineTaskType(task: Task): string {
    const name = task.name.toLowerCase();
    const description = task.description.toLowerCase();
    const combined = name + ' ' + description;
    
    if (combined.includes('data') || combined.includes('process')) {
      return 'data-processing';
    } else if (combined.includes('report') || combined.includes('generate')) {
      return 'report-generation';
    } else if (combined.includes('backup') || combined.includes('database')) {
      return 'backup';
    }
    
    return 'general-task';
  }

  // Utility methods specific to TaskAgent
  public getTaskCount(): number {
    return this.tasks.size;
  }

  public getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  public getTasksByStatus(status: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  public getTasksByPriority(priority: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.priority === priority);
  }

  public clearCompletedTasks(): number {
    const completed = this.getTasksByStatus('completed');
    completed.forEach(task => this.tasks.delete(task.id));
    return completed.length;
  }

  public getMaxConcurrentTasks(): number {
    return (this.config.settings as TaskSettings).maxConcurrentTasks;
  }

  public setMaxConcurrentTasks(max: number): void {
    if (max < 1) {
      throw new Error('Max concurrent tasks must be at least 1');
    }
    this.updateSettings({ maxConcurrentTasks: max });
  }

  // Override shutdown to stop running tasks
  public shutdown(): void {
    // In a real implementation, you might want to gracefully stop running tasks
    this.runningTasks.clear();
    super.shutdown();
  }
}