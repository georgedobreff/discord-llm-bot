const { SlashCommandBuilder } = require('discord.js');

// Mock dependencies
jest.mock('@discordjs/voice');
jest.mock('../voice-handler-gemini-rotation.js', () => ({ handleVoiceConnection: jest.fn() }));
jest.mock('../config.js', () => ({
  llmName: 'TestBot'
}));

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} = require('@discordjs/voice');

const { handleVoiceConnection } = require('../voice-handler-gemini-rotation.js');

describe('commands/join.js', () => {
  let joinCommand;
  let mockInteraction;
  let mockConnection;
  let mockChannel;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Setup mocks
    mockChannel = {
      id: 'channel-123',
      guild: {
        id: 'guild-456',
        voiceAdapterCreator: jest.fn()
      }
    };
    
    mockInteraction = {
      member: {
        voice: {
          channel: mockChannel
        }
      },
      guildId: 'guild-456',
      reply: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined)
    };
    
    mockConnection = {
      on: jest.fn(),
      subscribe: jest.fn(),
      destroy: jest.fn()
    };
    
    joinVoiceChannel.mockReturnValue(mockConnection);
    entersState.mockResolvedValue(mockConnection);
    getVoiceConnection.mockReturnValue(null);
    handleVoiceConnection.mockImplementation(() => {});
    
    joinCommand = require('../commands/join.js');
  });

  describe('Command Definition', () => {
    it('should have valid data property', () => {
      expect(joinCommand.data).toBeDefined();
      expect(joinCommand.data).toBeInstanceOf(SlashCommandBuilder);
    });

    it('should have execute function', () => {
      expect(joinCommand.execute).toBeDefined();
      expect(typeof joinCommand.execute).toBe('function');
    });

    it('should have correct command name', () => {
      const commandJSON = joinCommand.data.toJSON();
      expect(commandJSON.name).toBe('join');
    });

    it('should have description', () => {
      const commandJSON = joinCommand.data.toJSON();
      expect(commandJSON.description).toBeDefined();
      expect(commandJSON.description.length).toBeGreaterThan(0);
    });

    it('should include bot name in description', () => {
      const commandJSON = joinCommand.data.toJSON();
      expect(commandJSON.description).toContain('TestBot');
    });
  });

  describe('Command Execution', () => {
    it('should reply if user is not in voice channel', async () => {
      mockInteraction.member.voice.channel = null;
      
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('need to be in a voice channel'),
        ephemeral: true
      });
      expect(joinVoiceChannel).not.toHaveBeenCalled();
    });

    it('should defer reply before joining channel', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(mockInteraction.deferReply).toHaveBeenCalledBefore(joinVoiceChannel);
    });

    it('should call joinVoiceChannel with correct parameters', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(joinVoiceChannel).toHaveBeenCalledWith({
        channelId: 'channel-123',
        guildId: 'guild-456',
        adapterCreator: mockChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
    });

    it('should wait for connection to be ready', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(entersState).toHaveBeenCalledWith(
        mockConnection,
        VoiceConnectionStatus.Ready,
        30e3
      );
    });

    it('should call handleVoiceConnection with connection and interaction', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(handleVoiceConnection).toHaveBeenCalledWith(
        mockConnection,
        mockInteraction
      );
    });

    it('should edit reply with success message', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith('Joined');
    });

    it('should handle errors during join', async () => {
      const error = new Error('Failed to join');
      joinVoiceChannel.mockImplementation(() => {
        throw error;
      });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await joinCommand.execute(mockInteraction);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error joining voice channel'),
        error
      );
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('trouble joining')
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should destroy existing connection on error', async () => {
      const existingConnection = {
        destroy: jest.fn()
      };
      
      getVoiceConnection.mockReturnValue(existingConnection);
      joinVoiceChannel.mockImplementation(() => {
        throw new Error('Join failed');
      });
      
      jest.spyOn(console, 'error').mockImplementation();
      
      await joinCommand.execute(mockInteraction);
      
      expect(existingConnection.destroy).toHaveBeenCalled();
    });

    it('should handle timeout waiting for connection', async () => {
      entersState.mockRejectedValue(new Error('Timeout'));
      
      jest.spyOn(console, 'error').mockImplementation();
      
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('trouble joining')
      );
    });
  });

  describe('Voice Channel Validation', () => {
    it('should check if member has voice property', async () => {
      mockInteraction.member.voice = null;
      
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalled();
      expect(joinVoiceChannel).not.toHaveBeenCalled();
    });

    it('should check if member is in a channel', async () => {
      mockInteraction.member.voice.channel = undefined;
      
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.any(String),
        ephemeral: true
      });
    });

    it('should proceed if user is in valid voice channel', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(joinVoiceChannel).toHaveBeenCalled();
      expect(handleVoiceConnection).toHaveBeenCalled();
    });
  });

  describe('Connection Configuration', () => {
    it('should not self-deaf the bot', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(joinVoiceChannel).toHaveBeenCalledWith(
        expect.objectContaining({ selfDeaf: false })
      );
    });

    it('should not self-mute the bot', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(joinVoiceChannel).toHaveBeenCalledWith(
        expect.objectContaining({ selfMute: false })
      );
    });

    it('should use guild voice adapter', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(joinVoiceChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          adapterCreator: mockChannel.guild.voiceAdapterCreator
        })
      );
    });
  });

  describe('Error Messages', () => {
    it('should show friendly error message to user', async () => {
      joinVoiceChannel.mockImplementation(() => {
        throw new Error('Network error');
      });
      
      jest.spyOn(console, 'error').mockImplementation();
      
      await joinCommand.execute(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringMatching(/trouble|try again/i)
      );
    });

    it('should show ephemeral message when not in voice channel', async () => {
      mockInteraction.member.voice.channel = null;
      
      await joinCommand.execute(mockInteraction);
      
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.ephemeral).toBe(true);
    });

    it('should include emoji in user-facing messages', async () => {
      mockInteraction.member.voice.channel = null;
      
      await joinCommand.execute(mockInteraction);
      
      const replyCall = mockInteraction.reply.mock.calls[0][0];
      expect(replyCall.content).toMatch(/😳|🙂|😊/);
    });
  });

  describe('Integration with voice-handler-gemini-rotation', () => {
    it('should import handleVoiceConnection from correct module', () => {
      expect(handleVoiceConnection).toBeDefined();
    });

    it('should pass connection to voice handler', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(handleVoiceConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          on: expect.any(Function),
          subscribe: expect.any(Function)
        }),
        mockInteraction
      );
    });

    it('should pass interaction context to voice handler', async () => {
      await joinCommand.execute(mockInteraction);
      
      expect(handleVoiceConnection).toHaveBeenCalledWith(
        mockConnection,
        expect.objectContaining({
          member: expect.any(Object),
          guildId: 'guild-456'
        })
      );
    });
  });

  describe('Cleanup on Errors', () => {
    it('should attempt cleanup even if interaction fails', async () => {
      const existingConnection = {
        destroy: jest.fn()
      };
      
      getVoiceConnection.mockReturnValue(existingConnection);
      mockInteraction.editReply.mockRejectedValue(new Error('Discord error'));
      entersState.mockRejectedValue(new Error('Connection timeout'));
      
      jest.spyOn(console, 'error').mockImplementation();
      
      await expect(joinCommand.execute(mockInteraction)).rejects.toThrow();
      
      expect(existingConnection.destroy).toHaveBeenCalled();
    });

    it('should log error before cleanup', async () => {
      const error = new Error('Test error');
      joinVoiceChannel.mockImplementation(() => {
        throw error;
      });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await joinCommand.execute(mockInteraction);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌'),
        error
      );
    });
  });
});