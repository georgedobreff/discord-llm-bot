const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const config = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription(`Kick ${config.llmName} out of the vc`),

  async execute(interaction) {
    const connection = getVoiceConnection(interaction.guildId);

    if (!connection) {
      await interaction.reply({
        content: "I'm not in a voice channel right now. 🤔",
        ephemeral: true,
      });
      return;
    }

    try {
      connection.destroy();
      await interaction.reply({
        content: 'Okay, I\'ll leave... talk to you later! 💋',
      });
    } catch (error) {
      console.error('❌ Error leaving voice channel:', error);
      await interaction.reply({
        content: 'Something went wrong while trying to leave.',
        ephemeral: true,
      });
    }
  },
};
