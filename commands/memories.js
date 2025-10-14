const { SlashCommandBuilder, InteractionResponseFlags } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'user_memories');


async function readMemories(userId) {
    const filePath = path.join(MEMORY_DIR, `${userId}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const memories = JSON.parse(data);
        return Array.isArray(memories) ? memories : [];
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error(`Error reading memory file for ${userId}:`, error);
        }
        return [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('memories')
        .setDescription('Lists all the personal memories I have stored.'),

    async execute(interaction) {
        // Only allow command in DMs
        if (interaction.guild !== null) {
            await interaction.reply({ 
                content: 'You can only use the `/memories` command in a Direct Message with me.', 
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const memories = await readMemories(userId);

        if (memories.length === 0) {
            await interaction.editReply("I don't remember anything about you :disappointed_relieved: \n Use /remember to help me get to know you!");
            return;
        }

        let memoryList = "💖 Here are the memories I currently have stored for you:\n\n";
        
        memories.forEach((entry, index) => {
            memoryList += `**${index + 1}.** ${entry.memory}\n`;
        });
        
        memoryList += "\nUse `/forget [number]` to delete a specific memory.";

        await interaction.editReply(memoryList);
    },
};