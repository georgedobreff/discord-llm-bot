const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');
const { handleVoiceConnection } = require('../voice-handler-gemini.js');
const config = require('../config.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription(`${config.llmName} joins the vc you're currently in.`),

  async execute(interaction) {
    const channel = interaction.member.voice.channel;

    if (!channel) {
      await interaction.reply({
        content: 'You need to be in a voice channel for me to join you! 😳',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      // Wait until the connection is fully established
      await entersState(connection, VoiceConnectionStatus.Ready, 30e3);

      // Hand off the connection to our main voice logic handler
      handleVoiceConnection(connection, interaction);

      await interaction.editReply(`Joined`);

    } catch (error) {
      console.error('❌ Error joining voice channel:', error);
      await interaction.editReply('I had trouble joining the channel. Please try again!');
      if (getVoiceConnection(interaction.guildId)) {
        getVoiceConnection(interaction.guildId).destroy();
      }
    }
  },
};
