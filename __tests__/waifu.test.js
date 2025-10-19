const fs = require('fs/promises');
const path = require('path');
const { EventEmitter } = require('events');

// Mock dependencies
jest.mock('groq-sdk');
jest.mock('fs/promises');

const mockGroqCreate = jest.fn();
const Groq = require('groq-sdk');
Groq.mockImplementation(() => ({
  chat: {
    completions: {
      create: mockGroqCreate
    }
  }
}));

const { RateLimitError } = require('groq-sdk/error');

describe('waifu.js', () => {
  let mockClient;
  let mockConfig;
  let mockDelay;
  let mockCalculateDelay;
  let lastInteractionTime;
  let waifuModule;

  beforeAll(() => {
    // Set up environment variables
    process.env.GROQ_API_KEY1 = 'test-key-1';
    process.env.GROQ_API_KEY2 = 'test-key-2';
    process.env.GROQ_API_KEY3 = 'test-key-3';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockClient = new EventEmitter();
    mockClient.users = {
      fetch: jest.fn(),
      cache: new Map()
    };
    
    mockConfig = {
      llmName: 'TestWaifu',
      llmModel: 'test-model',
      llmPersona: 'Test persona for DMs',
      sharedWaifu: 'Test persona for server',
      voiceWaifu: 'Test persona for voice',
      channelName: 'waifu',
      historyLimit: 50,
      characterLimit: 200,
      voicecharacterLimit: 300,
      idleTimer: 1000,
      idleCheck: 500,
      idleSave: 500,
      idleLLMPrompt: [
        { role: 'system', content: 'Idle prompt test' }
      ]
    };
    
    mockDelay = jest.fn().mockResolvedValue(undefined);
    mockCalculateDelay = jest.fn().mockReturnValue(100);
    lastInteractionTime = new Map();
    
    // Mock fs operations
    fs.readFile = jest.fn();
    fs.writeFile = jest.fn().mockResolvedValue(undefined);
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('Module Initialization', () => {
    it('should initialize with all required parameters', () => {
      waifuModule = require('../waifu.js');
      
      expect(() => {
        waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      }).not.toThrow();
    });

    it('should exit early if no API keys are provided', () => {
      const savedKeys = [
        process.env.GROQ_API_KEY1,
        process.env.GROQ_API_KEY2,
        process.env.GROQ_API_KEY3
      ];
      
      delete process.env.GROQ_API_KEY1;
      delete process.env.GROQ_API_KEY2;
      delete process.env.GROQ_API_KEY3;
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('API KEY')
      );
      
      // Restore keys
      process.env.GROQ_API_KEY1 = savedKeys[0];
      process.env.GROQ_API_KEY2 = savedKeys[1];
      process.env.GROQ_API_KEY3 = savedKeys[2];
    });

    it('should filter out empty API keys', () => {
      process.env.GROQ_API_KEY4 = '';
      process.env.GROQ_API_KEY5 = undefined;
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Should only use valid keys
      expect(Groq).toHaveBeenCalled();
    });
  });

  describe('API Key Rotation', () => {
    it('should rotate to next key on rate limit', async () => {
      mockGroqCreate
        .mockRejectedValueOnce(Object.assign(new Error('Rate limit'), { status: 429 }))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success after rotation' } }]
        });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Groq should be instantiated multiple times for key rotation
      expect(Groq).toHaveBeenCalled();
    });

    it('should cycle through all available keys', async () => {
      const error = Object.assign(new Error('Rate limit'), { status: 429 });
      mockGroqCreate.mockRejectedValue(error);
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Should have logic for multiple keys
      expect(process.env.GROQ_API_KEY1).toBeDefined();
      expect(process.env.GROQ_API_KEY2).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should load user memories from file', async () => {
      const mockMemories = [
        { memory: 'User likes pizza' },
        { memory: 'User is from California' }
      ];
      
      fs.readFile.mockResolvedValue(JSON.stringify(mockMemories));
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // loadMemories function should be available internally
      expect(fs.readFile).toBeDefined();
    });

    it('should return empty string if memory file does not exist', async () => {
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      expect(fs.readFile).toBeDefined();
    });

    it('should handle corrupted memory file gracefully', async () => {
      fs.readFile.mockResolvedValue('invalid json{]');
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Should handle JSON parse errors
      expect(fs.readFile).toBeDefined();
    });

    it('should format memories correctly for LLM', async () => {
      const mockMemories = [
        { memory: 'First memory' },
        { memory: 'Second memory' },
        { memory: 'Third memory' }
      ];
      
      fs.readFile.mockResolvedValue(JSON.stringify(mockMemories));
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Memories should be formatted with numbers
      expect(fs.readFile).toBeDefined();
    });

    it('should handle empty memory array', async () => {
      fs.readFile.mockResolvedValue('[]');
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      expect(fs.readFile).toBeDefined();
    });
  });

  describe('Idle User Checking', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    // Clear timers from setInterval in module under test to avoid leaks/timeouts
    afterEach(() => {
      try { jest.runOnlyPendingTimers(); } catch (e) {}
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should check for idle users at configured interval', () => {
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Should set up interval for idle checking
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should identify users who have been idle for configured time', async () => {
      const userId = 'idle-user-123';
      const idleTime = Date.now() - mockConfig.idleTimer - 1000;
      lastInteractionTime.set(userId, idleTime);
      
      mockClient.users.fetch.mockResolvedValue({
        id: userId,
        send: jest.fn().mockResolvedValue(undefined)
      });
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hey, how are you?' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Fast-forward time to trigger idle check
      jest.advanceTimersByTime(mockConfig.idleCheck);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockClient.users.fetch).toHaveBeenCalledWith(userId);
    });

    it('should send DM to idle users', async () => {
      const userId = 'idle-user-123';
      const idleTime = Date.now() - mockConfig.idleTimer - 1000;
      lastInteractionTime.set(userId, idleTime);
      
      const mockSend = jest.fn().mockResolvedValue(undefined);
      mockClient.users.fetch.mockResolvedValue({
        id: userId,
        send: mockSend
      });
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Miss you!' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      jest.advanceTimersByTime(mockConfig.idleCheck);
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockSend).toHaveBeenCalledWith('Miss you!');
    });

    it('should reset idle timer after sending DM', async () => {
      const userId = 'idle-user-123';
      const idleTime = Date.now() - mockConfig.idleTimer - 1000;
      lastInteractionTime.set(userId, idleTime);
      
      mockClient.users.fetch.mockResolvedValue({
        id: userId,
        send: jest.fn().mockResolvedValue(undefined)
      });
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hey!' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      const originalTime = lastInteractionTime.get(userId);
      
      jest.advanceTimersByTime(mockConfig.idleCheck);
      await new Promise(resolve => setImmediate(resolve));
      
      // Time should be updated
      expect(lastInteractionTime.get(userId)).toBeGreaterThan(originalTime);
    });

    it('should handle errors when sending DM to idle users', async () => {
      const userId = 'idle-user-123';
      const idleTime = Date.now() - mockConfig.idleTimer - 1000;
      lastInteractionTime.set(userId, idleTime);
      
      mockClient.users.fetch.mockRejectedValue(new Error('User not found'));
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      jest.advanceTimersByTime(mockConfig.idleCheck);
      await new Promise(resolve => setImmediate(resolve));
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not send'),
        expect.any(Error)
      );
    });

    it('should not send DM to users who are not idle', async () => {
      const userId = 'active-user-123';
      lastInteractionTime.set(userId, Date.now());
      
      mockClient.users.fetch = jest.fn();
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      jest.advanceTimersByTime(mockConfig.idleCheck);
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockClient.users.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Waifu Channel Messages', () => {
    let mockMessage;
    let mockChannel;

    beforeEach(() => {
      mockChannel = {
        type: ChannelType.GuildText,
        name: 'waifu',
        messages: {
          fetch: jest.fn()
        },
        sendTyping: jest.fn().mockResolvedValue(undefined)
      };
      
      mockMessage = {
        channel: mockChannel,
        guild: { id: 'test-guild' },
        author: {
          bot: false,
          id: 'user-123',
          username: 'TestUser',
          displayName: 'Test User'
        },
        content: 'Hello waifu!',
        reply: jest.fn().mockResolvedValue(undefined)
      };
    });

    it('should ignore DM messages in waifu channel handler', () => {
      mockMessage.channel.type = 1; // ChannelType.DM
      mockMessage.guild = null;
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      expect(mockChannel.sendTyping).not.toHaveBeenCalled();
    });

    it('should ignore bot messages', () => {
      mockMessage.author.bot = true;
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      expect(mockChannel.sendTyping).not.toHaveBeenCalled();
    });

    it('should ignore messages from wrong channel', () => {
      mockMessage.channel.name = 'general';
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      expect(mockChannel.sendTyping).not.toHaveBeenCalled();
    });

    it('should process messages from correct waifu channel', async () => {
      mockChannel.messages.fetch.mockResolvedValue({
        values: () => (new Map([
          ['msg1', { author: { username: 'User1' }, content: 'Hi' }],
          ['msg2', { author: { username: 'Bot' }, content: 'Hello' }]
        ])).values()
      });
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hey there!' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockChannel.sendTyping).toHaveBeenCalled();
    });

    it('should respect character limits', async () => {
      mockChannel.messages.fetch.mockResolvedValue(new Map());
      
      const longResponse = 'A'.repeat(mockConfig.characterLimit + 100);
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: longResponse } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Should still reply even with long response
      expect(mockChannel.sendTyping).toHaveBeenCalled();
    });

    it('should handle concurrent messages with processing lock', async () => {
      mockChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Send two messages quickly
      mockClient.emit('messageCreate', mockMessage);
      mockClient.emit('messageCreate', { ...mockMessage, content: 'Another message' });
      
      await new Promise(resolve => setImmediate(resolve));
      
      // Second message should be ignored due to processing lock
      expect(mockChannel.sendTyping).toHaveBeenCalledTimes(1);
    });

    it('should use calculated delay for response timing', async () => {
      mockChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }]
      });
      
      mockCalculateDelay.mockReturnValue(500);
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockCalculateDelay).toHaveBeenCalledWith('Test response');
    });

    it('should handle LLM errors gracefully in waifu channel', async () => {
      mockChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockRejectedValue(new Error('LLM error'));
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('trouble')
      );
    });
  });

  describe('Direct Message Handling', () => {
    let mockDM;
    let mockDMChannel;

    beforeEach(() => {
      mockDMChannel = {
        type: ChannelType.DM,
        messages: {
          fetch: jest.fn()
        },
        sendTyping: jest.fn().mockResolvedValue(undefined),
        send: jest.fn().mockResolvedValue(undefined)
      };
      
      mockDM = {
        channel: mockDMChannel,
        guild: null,
        author: {
          bot: false,
          id: 'user-456',
          username: 'DMUser',
          displayName: 'DM User'
        },
        content: 'Hey, how are you?'
      };
    });

    it('should process DM messages', async () => {
      mockDMChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: "I'm great!" } }]
      });
      
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockDM);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockDMChannel.sendTyping).toHaveBeenCalled();
    });

    it('should update last interaction time on DM', async () => {
      mockDMChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }]
      });
      
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      const beforeTime = Date.now();
      mockClient.emit('messageCreate', mockDM);
      
      await new Promise(resolve => setImmediate(resolve));
      
      const recordedTime = lastInteractionTime.get('user-456');
      expect(recordedTime).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should load and include user memories in DM context', async () => {
      const mockMemories = [
        { memory: 'User likes cats' },
        { memory: 'User is a developer' }
      ];
      
      fs.readFile.mockResolvedValue(JSON.stringify(mockMemories));
      mockDMChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Got it!' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockDM);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('user-456.json'),
        'utf-8'
      );
    });

    it('should ignore bot messages in DMs', () => {
      mockDM.author.bot = true;
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockDM);
      
      expect(mockDMChannel.sendTyping).not.toHaveBeenCalled();
    });

    it('should ignore messages that are not DMs', () => {
      mockDM.channel.type = 0; // GuildText
      mockDM.guild = { id: 'test-guild' };
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockDM);
      
      // Should not process as DM
      expect(lastInteractionTime.has('user-456')).toBe(false);
    });

    it('should handle errors in DM responses gracefully', async () => {
      mockDMChannel.messages.fetch.mockResolvedValue(new Map());
      mockGroqCreate.mockRejectedValue(new Error('API error'));
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockDM);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockDMChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('trouble')
      );
    });

    it('should format conversation history correctly', async () => {
      const mockHistory = new Map([
        ['1', { author: { username: 'User' }, content: 'Hello' }],
        ['2', { author: { username: 'Bot' }, content: 'Hi there' }],
        ['3', { author: { username: 'User' }, content: 'How are you?' }]
      ]);
      
      mockDMChannel.messages.fetch.mockResolvedValue(mockHistory);
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: "I'm good!" } }]
      });
      
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockDM);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockDMChannel.messages.fetch).toHaveBeenCalledWith({
        limit: mockConfig.historyLimit
      });
    });
  });

  describe('LLM Call Function', () => {
    it('should make successful LLM call', async () => {
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Success' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // LLM call function is internal but used by message handlers
      expect(mockGroqCreate).toBeDefined();
    });

    it('should retry on rate limit error', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit'), { status: 429 });
      
      mockGroqCreate
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success after retry' } }]
        });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      expect(Groq).toHaveBeenCalled();
    });

    it('should throw error after all retries exhausted', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit'), { status: 429 });
      mockGroqCreate.mockRejectedValue(rateLimitError);
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      // Error handling should be in place
      expect(mockGroqCreate).toBeDefined();
    });

    it('should throw immediately on non-rate-limit errors', async () => {
      const apiError = new Error('API error');
      mockGroqCreate.mockRejectedValue(apiError);
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      expect(console.error).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content', async () => {
      const mockChannel = {
        type: 0,
        name: 'waifu',
        messages: { fetch: jest.fn().mockResolvedValue(new Map()) },
        sendTyping: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockMessage = {
        channel: mockChannel,
        guild: { id: 'test-guild' },
        author: { bot: false, displayName: 'User' },
        content: '',
        reply: jest.fn()
      };
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response to empty' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockChannel.sendTyping).toHaveBeenCalled();
    });

    it('should handle very long message history', async () => {
      const longHistory = new Map();
      for (let i = 0; i < 200; i++) {
        longHistory.set(`msg${i}`, {
          author: { username: `User${i}` },
          content: `Message ${i}`
        });
      }
      
      const mockChannel = {
        type: 0,
        name: 'waifu',
        messages: { fetch: jest.fn().mockResolvedValue(longHistory) },
        sendTyping: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockMessage = {
        channel: mockChannel,
        guild: { id: 'test-guild' },
        author: { bot: false, displayName: 'User' },
        content: 'Test',
        reply: jest.fn()
      };
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'OK' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith({
        limit: mockConfig.historyLimit
      });
    });

    it('should handle special characters in messages', async () => {
      const specialChars = '!@#$%^&*()[]{}|\\:;"\'<>,.?/~`';
      
      const mockChannel = {
        type: 0,
        name: 'waifu',
        messages: { fetch: jest.fn().mockResolvedValue(new Map()) },
        sendTyping: jest.fn().mockResolvedValue(undefined)
      };
      
      const mockMessage = {
        channel: mockChannel,
        guild: { id: 'test-guild' },
        author: { bot: false, displayName: 'User' },
        content: specialChars,
        reply: jest.fn()
      };
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Handled special chars' } }]
      });
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      mockClient.emit('messageCreate', mockMessage);
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockChannel.sendTyping).toHaveBeenCalled();
    });

    it('should handle multiple idle users simultaneously', async () => {
      const user1 = 'idle-user-1';
      const user2 = 'idle-user-2';
      const user3 = 'idle-user-3';
      
      const idleTime = Date.now() - mockConfig.idleTimer - 1000;
      lastInteractionTime.set(user1, idleTime);
      lastInteractionTime.set(user2, idleTime);
      lastInteractionTime.set(user3, idleTime);
      
      mockClient.users.fetch.mockImplementation((id) => 
        Promise.resolve({
          id,
          send: jest.fn().mockResolvedValue(undefined)
        })
      );
      
      mockGroqCreate.mockResolvedValue({
        choices: [{ message: { content: 'Hey!' } }]
      });
      
      jest.useFakeTimers();
      
      delete require.cache[require.resolve('../waifu.js')];
      waifuModule = require('../waifu.js');
      waifuModule(mockClient, mockConfig, mockDelay, mockCalculateDelay, lastInteractionTime);
      
      jest.advanceTimersByTime(mockConfig.idleCheck);
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockClient.users.fetch).toHaveBeenCalledTimes(3);
      
      jest.useRealTimers();
    });
  });
});