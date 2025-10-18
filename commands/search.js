const { SlashCommandBuilder } = require('discord.js');
const { Groq, RateLimitError } = require('groq-sdk');
const config = require('../config');

// API Keys Management

const ALL_GROQ_KEYS = [
  process.env.GROQ_API_KEY1,
  process.env.GROQ_API_KEY2,
  process.env.GROQ_API_KEY3,
  process.env.GROQ_API_KEY4,
  process.env.GROQ_API_KEY5,
  process.env.GROQ_API_KEY6,
  process.env.GROQ_API_KEY7
].filter(key => key);

if (ALL_GROQ_KEYS.length === 0) {
  console.error("Please add at least one API KEY to your .env file.");
  return;
}

let currentKeyIndex = 0;

module.exports = {

  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription(`Ask ${config.llmName} to do a web search for you.`)
    .addStringOption(option =>
      option.setName('o')
        .setDescription('What do you want to search for?')
        .setRequired(true)),

  async execute(interaction) {
    const userQuery = interaction.options.getString('o');

    await interaction.deferReply();
    const maxRetries = ALL_GROQ_KEYS.length;



    for (let attempt = 0; attempt < maxRetries; attempt++) {

      let groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });

      try {
        const messages = [
          {
            role: 'system',
            content: config.searchPersona
          },
          {
            role: 'user',
            content: userQuery,
          }
        ];

        const tools = [{ type: 'browser_search' }];

        const chatCompletion = await groq.chat.completions.create({
          messages: messages,
          model: config.searchModel,
          tools: tools
        });

        const responseText = chatCompletion.choices[0].message.content;

        await interaction.editReply(`${userQuery} \n\n${responseText}`);
        return;

      } catch (error) {
        if (error instanceof RateLimitError || error.status === 429) {
          if (attempt < maxRetries - 1) {
            // Check if there are more keys to try
            if (currentKeyIndex === ALL_GROQ_KEYS.length - 1) {
              currentKeyIndex = 0; // Reset back to the first key
            } else {
              currentKeyIndex++; // Otherwise, move to the next key
            }
            console.warn(`⚠️ Rate limit hit. Switching to key index: ${currentKeyIndex + 1}/${ALL_GROQ_KEYS.length}`);

          }
          else {

            console.error("🚨 Rate limit reached across all available API keys.");
            await interaction.editReply({
              content: "🚨 Rate limit reached across all available API keys. Try again later.",
            });
            return
          }
        } else {

          console.error('❌ Error executing /search:', error);
          await interaction.editReply({
            content: "Something's wrong I can't search right now. Try again in a bit :kiss:",
          });
          return;
        }
      }
    }
  },
};
