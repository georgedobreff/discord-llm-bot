const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { generateImage } = require('../services/imageService.js');
const config = require('../config.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription(`Ask ${config.llmName} to create an image for you.`)
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('What do you want me to create?')
        .setRequired(true)),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    await interaction.deferReply();

    try {
      const imageBuffer = await generateImage(prompt);

      // Create a Discord attachment from the image Buffer
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'image.png' });

      await interaction.editReply({
        content: `Here's your image for: **"${prompt}"**`,
        files: [attachment]
      });

    } catch (error) {
      console.error('Error in /image command execution:', error);
      await interaction.editReply({
        content: `I'm having a little trouble creating that image 🥺 \n*${error.message}*`,
      });
    }
  },
};
