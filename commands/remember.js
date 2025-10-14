const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');
const config = require('../config')
const MEMORY_DIR = path.join(__dirname, '..', 'user_memories');

// Save a user's memory
async function saveMemory(userId, userName, memoryContent) {
    try {
        await fs.mkdir(MEMORY_DIR, { recursive: true });
        const memoryFilePath = path.join(MEMORY_DIR, `${userId}.json`);

        const memoryEntry = {
            timestamp: new Date().toISOString(),
            user: userName,
            memory: memoryContent.trim()
        };

        let userMemory = [];
        try {
            const data = await fs.readFile(memoryFilePath, 'utf-8');
            userMemory = JSON.parse(data);
            if (!Array.isArray(userMemory)) {
                userMemory = [];
            }
        } catch (error) {
            // Ignore ENOENT (file not found)
            if (error.code !== 'ENOENT') {
                console.error(`Error reading memory file ${userId}.json:`, error);
            }
        }
        

        userMemory.push(memoryEntry);
        const MAX_MEMORIES = 50; 
        if (userMemory.length > MAX_MEMORIES) {
            userMemory = userMemory.slice(-MAX_MEMORIES); 
        }

        await fs.writeFile(memoryFilePath, JSON.stringify(userMemory, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`❌ Error saving memory for user ${userId}:`, error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remember')
        .setDescription(`Things you want ${config.llmName} to remember about you.`)
        .addStringOption(option =>
            option.setName('memory')
                .setDescription('The memory:')
                .setRequired(true)),
                
    async execute(interaction) {
        // Only allow command in DMs
        if (interaction.guild !== null) {
            await interaction.reply({ 
                content: 'You can only add memories in a Direct Message with me.', 
                ephemeral: true 
            });
            return;
        }

        const memoryContent = interaction.options.getString('memory');
        const userId = interaction.user.id;
        const userName = interaction.user.displayName;
        
        // Limit memory size
        if (memoryContent.length > 666) {
            await interaction.reply({ 
                content: `I can't remember that much! Please keep it under 666 characters.`, 
                ephemeral: true 
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const success = await saveMemory(userId, userName, memoryContent);

        if (success) {
            await interaction.editReply(`Got it! " **${memoryContent}** " helps me get to know you better 💖`);
        } else {
            await interaction.editReply('Something went wrong.');
        }
    },
};