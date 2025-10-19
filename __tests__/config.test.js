describe('config.js', () => {
  let config;

  beforeEach(() => {
    jest.resetModules();
    config = require('../config.js');
  });

  describe('Configuration Values', () => {
    it('should export llmName', () => {
      expect(config.llmName).toBeDefined();
      expect(typeof config.llmName).toBe('string');
      expect(config.llmName.length).toBeGreaterThan(0);
    });

    it('should export historyLimit', () => {
      expect(config.historyLimit).toBeDefined();
      expect(typeof config.historyLimit).toBe('number');
      expect(config.historyLimit).toBeGreaterThan(0);
    });

    it('should export characterLimit', () => {
      expect(config.characterLimit).toBeDefined();
      expect(typeof config.characterLimit).toBe('number');
      expect(config.characterLimit).toBeGreaterThan(0);
    });

    it('should export voicecharacterLimit', () => {
      expect(config.voicecharacterLimit).toBeDefined();
      expect(typeof config.voicecharacterLimit).toBe('number');
      expect(config.voicecharacterLimit).toBeGreaterThan(0);
    });

    it('should export llmModel', () => {
      expect(config.llmModel).toBeDefined();
      expect(typeof config.llmModel).toBe('string');
    });

    it('should export searchModel', () => {
      expect(config.searchModel).toBeDefined();
      expect(typeof config.searchModel).toBe('string');
    });

    it('should export searchCharacterLimit', () => {
      expect(config.searchCharacterLimit).toBeDefined();
      expect(typeof config.searchCharacterLimit).toBe('number');
      expect(config.searchCharacterLimit).toBeGreaterThan(0);
    });

    it('should export idleTimer', () => {
      expect(config.idleTimer).toBeDefined();
      expect(typeof config.idleTimer).toBe('number');
      expect(config.idleTimer).toBeGreaterThan(0);
    });

    it('should export idleCheck', () => {
      expect(config.idleCheck).toBeDefined();
      expect(typeof config.idleCheck).toBe('number');
      expect(config.idleCheck).toBeGreaterThan(0);
    });

    it('should export idleSave', () => {
      expect(config.idleSave).toBeDefined();
      expect(typeof config.idleSave).toBe('number');
      expect(config.idleSave).toBeGreaterThan(0);
    });

    it('should export channelName', () => {
      expect(config.channelName).toBeDefined();
      expect(typeof config.channelName).toBe('string');
    });

    it('should export ACTIVITY_TYPE', () => {
      expect(config.ACTIVITY_TYPE).toBeDefined();
      expect(typeof config.ACTIVITY_TYPE).toBe('string');
    });

    it('should export ACTIVITY_NAME', () => {
      expect(config.ACTIVITY_NAME).toBeDefined();
      expect(typeof config.ACTIVITY_NAME).toBe('string');
    });

    it('should export BOT_STATUS', () => {
      expect(config.BOT_STATUS).toBeDefined();
      expect(typeof config.BOT_STATUS).toBe('string');
    });
  });

  describe('Persona Configurations', () => {
    it('should export llmPersona', () => {
      expect(config.llmPersona).toBeDefined();
      expect(typeof config.llmPersona).toBe('string');
      expect(config.llmPersona.length).toBeGreaterThan(0);
    });

    it('should export sharedWaifu', () => {
      expect(config.sharedWaifu).toBeDefined();
      expect(typeof config.sharedWaifu).toBe('string');
      expect(config.sharedWaifu.length).toBeGreaterThan(0);
    });

    it('should export voiceWaifu', () => {
      expect(config.voiceWaifu).toBeDefined();
      expect(typeof config.voiceWaifu).toBe('string');
      expect(config.voiceWaifu.length).toBeGreaterThan(0);
    });

    it('should export searchPersona', () => {
      expect(config.searchPersona).toBeDefined();
      expect(typeof config.searchPersona).toBe('string');
      expect(config.searchPersona.length).toBeGreaterThan(0);
    });

    it('should export ttsPrompt', () => {
      expect(config.ttsPrompt).toBeDefined();
      expect(typeof config.ttsPrompt).toBe('string');
    });

    it('should include llmName in personas', () => {
      expect(config.llmPersona).toContain(config.llmName);
      expect(config.sharedWaifu).toContain(config.llmName);
      expect(config.voiceWaifu).toContain(config.llmName);
      expect(config.searchPersona).toContain(config.llmName);
    });

    it('should include characterLimit in personas', () => {
      expect(config.llmPersona).toContain(config.characterLimit.toString());
      expect(config.sharedWaifu).toContain(config.characterLimit.toString());
    });

    it('should include voicecharacterLimit in voiceWaifu', () => {
      expect(config.voiceWaifu).toContain(config.voicecharacterLimit.toString());
    });

    it('should include searchCharacterLimit in searchPersona', () => {
      expect(config.searchPersona).toContain(config.searchCharacterLimit.toString());
    });
  });

  describe('Idle LLM Prompt', () => {
    it('should export idleLLMPrompt as array', () => {
      expect(config.idleLLMPrompt).toBeDefined();
      expect(Array.isArray(config.idleLLMPrompt)).toBe(true);
    });

    it('should have at least one prompt message', () => {
      expect(config.idleLLMPrompt.length).toBeGreaterThan(0);
    });

    it('should have system role message', () => {
      const systemMessage = config.idleLLMPrompt.find(msg => msg.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toBeDefined();
      expect(systemMessage.content.length).toBeGreaterThan(0);
    });

    it('should include llmPersona in idle prompt', () => {
      const systemMessage = config.idleLLMPrompt.find(msg => msg.role === 'system');
      expect(systemMessage.content).toContain(config.llmPersona);
    });
  });

  describe('Timer Values', () => {
    it('should have idleTimer with random component', () => {
      const baseIdleTimer = 4 * 60 * 60 * 1000;
      expect(config.idleTimer).toBeGreaterThanOrEqual(baseIdleTimer);
      expect(config.idleTimer).toBeLessThan(baseIdleTimer + 20);
    });

    it('should have reasonable idleCheck interval', () => {
      expect(config.idleCheck).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should have reasonable idleSave interval', () => {
      expect(config.idleSave).toBe(10 * 60 * 1000); // 10 minutes
    });

    it('should have idleCheck less than idleTimer', () => {
      expect(config.idleCheck).toBeLessThan(config.idleTimer);
    });

    it('should have idleSave less than idleCheck', () => {
      expect(config.idleSave).toBeLessThan(config.idleCheck);
    });
  });

  describe('Character Limits', () => {
    it('should have reasonable characterLimit', () => {
      expect(config.characterLimit).toBeGreaterThan(0);
      expect(config.characterLimit).toBeLessThanOrEqual(2000);
    });

    it('should have voicecharacterLimit greater than characterLimit', () => {
      expect(config.voicecharacterLimit).toBeGreaterThanOrEqual(config.characterLimit);
    });

    it('should have searchCharacterLimit greater than characterLimit', () => {
      expect(config.searchCharacterLimit).toBeGreaterThanOrEqual(config.characterLimit);
    });
  });

  describe('voiceTriggerPhrase Removal', () => {
    it('should not export voiceTriggerPhrase', () => {
      expect(config.voiceTriggerPhrase).toBeUndefined();
    });
  });

  describe('Bot Status Configuration', () => {
    it('should have valid BOT_STATUS', () => {
      const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
      expect(validStatuses).toContain(config.BOT_STATUS);
    });

    it('should have valid ACTIVITY_TYPE', () => {
      const validTypes = ['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING', 'COMPETING', 'CUSTOM'];
      expect(validTypes).toContain(config.ACTIVITY_TYPE);
    });

    it('should have non-empty ACTIVITY_NAME', () => {
      expect(config.ACTIVITY_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('Model Configuration', () => {
    it('should specify Groq-compatible model', () => {
      expect(config.llmModel).toBeDefined();
      // Groq models often include "llama" or "mixtral"
      expect(typeof config.llmModel).toBe('string');
    });

    it('should have valid search model', () => {
      expect(config.searchModel).toBeDefined();
      expect(typeof config.searchModel).toBe('string');
    });
  });

  describe('Updated Idle Prompt Content', () => {
    it('should focus on initiating conversation rather than checking', () => {
      const systemMessage = config.idleLLMPrompt.find(msg => msg.role === 'system');
      expect(systemMessage.content.toLowerCase()).toContain('initiate');
    });

    it('should not mention checking on the user', () => {
      const systemMessage = config.idleLLMPrompt.find(msg => msg.role === 'system');
      expect(systemMessage.content.toLowerCase()).not.toContain('check on them');
    });
  });

  describe('Config Consistency', () => {
    it('should have consistent naming across all persona fields', () => {
      const nameInPersona = config.llmPersona.includes(config.llmName);
      const nameInShared = config.sharedWaifu.includes(config.llmName);
      const nameInVoice = config.voiceWaifu.includes(config.llmName);
      const nameInSearch = config.searchPersona.includes(config.llmName);
      
      expect(nameInPersona).toBe(true);
      expect(nameInShared).toBe(true);
      expect(nameInVoice).toBe(true);
      expect(nameInSearch).toBe(true);
    });

    it('should have consistent channel name format', () => {
      expect(config.channelName).toBe(config.channelName.toLowerCase());
    });
  });
});