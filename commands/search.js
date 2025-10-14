const { SlashCommandBuilder } = require('discord.js');
const Groq = require('groq-sdk');
const config = require('../config'); // Import config to get the search model

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
        console.error("🚨 Please add at least one API KEY to your .env file.");
        return;
    }

    let currentKeyIndex = 0;
    let groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });

    function rotateGroqKey() {
        currentKeyIndex = (currentKeyIndex + 1) % ALL_GROQ_KEYS.length;
        console.warn(`⚠️ Rate limit hit. Switching to key index: ${currentKeyIndex + 1}/${ALL_GROQ_KEYS.length}`);
        groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });
    }
    

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

        try {
            const messages = [
                {
                    role: 'system',
                    content: `You are ${config.llmPersona}. 
                    Perform an online search using your search tool and reference the search results to formulate your answer.
                    Try to keep your response limited to ${config.searchCharacterLimit} characters.
                    DO NOT include any search reference markers, source numbers, or citations (e.g., [1], 【0†L4-L6】) in your final response.
                    However, if you deem it necessary you can exceed this limit.`
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

        } catch (error) {
            if (error instanceof RateLimitError || error.status === 429) {
                if (attempt < maxRetries - 1) {
                        rotateGroqKey();
                    } else {
                        throw new Error("🚨 Rate limit reached across all available API keys.");
                    }
                } else {
                        console.error('❌ Error executing /search:', error);
                        await interaction.editReply({ 
                            content: "Something's wrong I can't search right now. Try again in a bit :kiss:", 
                    }
            )};
        }
    },
};