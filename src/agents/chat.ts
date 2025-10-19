import { Agent, AgentConfig, ExecutionContext, AgentResponse } from './base';

interface ChatInput {
  message: string;
}

interface ChatOutput {
  response: string;
  personality: string;
  messageLength: number;
}

interface ChatSettings {
  personality: 'friendly' | 'professional' | 'creative' | string;
  maxResponseLength: number;
  language: string;
}

export class ChatAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);
    
    // Ensure required settings have defaults
    const defaultSettings: ChatSettings = {
      personality: 'friendly',
      maxResponseLength: 150,
      language: 'en'
    };
    
    this.config.settings = { ...defaultSettings, ...this.config.settings };
  }

  protected async execute(input: any, context: ExecutionContext): Promise<AgentResponse> {
    const startTime = Date.now();

    // Validate input
    if (!input || typeof input !== 'object') {
      return {
        success: false,
        error: 'Invalid input format. Expected object with message property.',
        executionTime: Date.now() - startTime
      };
    }

    const chatInput = input as ChatInput;
    if (!chatInput.message || typeof chatInput.message !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid message in input.',
        executionTime: Date.now() - startTime
      };
    }

    if (chatInput.message.trim().length === 0) {
      return {
        success: false,
        error: 'Message cannot be empty.',
        executionTime: Date.now() - startTime
      };
    }

    try {
      const settings = this.config.settings as ChatSettings;
      const response = await this.generateResponse(chatInput.message, settings, context);
      
      const output: ChatOutput = {
        response: response,
        personality: settings.personality,
        messageLength: response.length
      };

      return {
        success: true,
        data: output,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during response generation',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async generateResponse(message: string, settings: ChatSettings, context: ExecutionContext): Promise<string> {
    // Simulate AI response generation based on personality
    const { personality, maxResponseLength } = settings;
    
    // Add small delay to simulate processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    let response = '';

    switch (personality.toLowerCase()) {
      case 'friendly':
        response = this.generateFriendlyResponse(message);
        break;
      case 'professional':
        response = this.generateProfessionalResponse(message);
        break;
      case 'creative':
        response = this.generateCreativeResponse(message);
        break;
      default:
        response = this.generateDefaultResponse(message, personality);
        break;
    }

    // Apply length limit
    if (response.length > maxResponseLength) {
      response = response.substring(0, maxResponseLength - 3) + '...';
    }

    return response;
  }

  private generateFriendlyResponse(message: string): string {
    const friendlyResponses = [
      `Hi there! Thanks for your message about "${message}". I'm happy to help! `,
      `Hello! That's an interesting question about "${message}". Let me share some thoughts! `,
      `Hey! I love chatting about topics like "${message}". Here's what I think: `,
      `Hi! Great to hear from you! Regarding "${message}", I'd say `,
    ];

    const friendlyContent = [
      'I hope this helps you out! Feel free to ask me anything else.',
      'Let me know if you need more information - I\'m here to help!',
      'I hope that makes sense! Always happy to chat more about this.',
      'Hope this gives you what you were looking for! 😊'
    ];

    const intro = friendlyResponses[Math.floor(Math.random() * friendlyResponses.length)];
    const content = friendlyContent[Math.floor(Math.random() * friendlyContent.length)];
    
    return intro + content;
  }

  private generateProfessionalResponse(message: string): string {
    const professionalResponses = [
      `Thank you for your inquiry regarding "${message}". `,
      `I acknowledge your question about "${message}". `,
      `Regarding your message about "${message}", `,
      `In response to your inquiry about "${message}", `,
    ];

    const professionalContent = [
      'I can provide you with comprehensive information on this matter.',
      'This is indeed a relevant topic that warrants detailed consideration.',
      'I would recommend a systematic approach to address your requirements.',
      'Please let me know if you require additional clarification or details.',
    ];

    const intro = professionalResponses[Math.floor(Math.random() * professionalResponses.length)];
    const content = professionalContent[Math.floor(Math.random() * professionalContent.length)];
    
    return intro + content;
  }

  private generateCreativeResponse(message: string): string {
    const creativeResponses = [
      `🌟 Wow! "${message}" sparked some fascinating ideas! `,
      `✨ Your message about "${message}" is like a canvas waiting for colors! `,
      `🎨 "${message}" - now that's a topic that gets my creative gears turning! `,
      `🚀 Fantastic question about "${message}"! Let's explore this together! `,
    ];

    const creativeContent = [
      'Imagine if we could approach this from a completely new angle...',
      'What if we mixed traditional thinking with some out-of-the-box ideas?',
      'Picture this: a world where creative solutions meet practical needs!',
      'Let your imagination run wild - there are endless possibilities here!',
    ];

    const intro = creativeResponses[Math.floor(Math.random() * creativeResponses.length)];
    const content = creativeContent[Math.floor(Math.random() * creativeContent.length)];
    
    return intro + content;
  }

  private generateDefaultResponse(message: string, personality: string): string {
    return `Thank you for your message about "${message}". As an agent with a ${personality} personality, I appreciate your input and am here to assist you with any questions or tasks you might have.`;
  }

  // Utility methods specific to ChatAgent
  public getPersonality(): string {
    return (this.config.settings as ChatSettings).personality;
  }

  public setPersonality(personality: string): void {
    this.updateSettings({ personality });
  }

  public getMaxResponseLength(): number {
    return (this.config.settings as ChatSettings).maxResponseLength;
  }

  public setMaxResponseLength(length: number): void {
    if (length < 1) {
      throw new Error('Max response length must be at least 1 character');
    }
    this.updateSettings({ maxResponseLength: length });
  }

  public getLanguage(): string {
    return (this.config.settings as ChatSettings).language;
  }

  public setLanguage(language: string): void {
    this.updateSettings({ language });
  }

  // Override to provide chat-specific validation
  public updateSettings(newSettings: Record<string, any>): void {
    // Validate chat-specific settings
    if (newSettings.maxResponseLength !== undefined) {
      if (typeof newSettings.maxResponseLength !== 'number' || newSettings.maxResponseLength < 1) {
        throw new Error('maxResponseLength must be a positive number');
      }
    }

    if (newSettings.personality !== undefined) {
      if (typeof newSettings.personality !== 'string' || newSettings.personality.trim().length === 0) {
        throw new Error('personality must be a non-empty string');
      }
    }

    if (newSettings.language !== undefined) {
      if (typeof newSettings.language !== 'string' || newSettings.language.trim().length === 0) {
        throw new Error('language must be a non-empty string');
      }
    }

    super.updateSettings(newSettings);
  }
}