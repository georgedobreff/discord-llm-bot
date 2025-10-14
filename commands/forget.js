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

// helper to write the updated memories back to the file
async function writeMemories(userId, memories) {
    const filePath = path.join(MEMORY_DIR, `${userId}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify(memories, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error writing memory file for ${userId}:`, error);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forget')
        .setDescription('Deletes a stored memory. Use /memories to see a list of memories.')
        .addIntegerOption(option =>
            option.setName('number')
                .setDescription('The number of the memory to delete (1, 2, 3, etc.).')
                .setRequired(true)),

    async execute(interaction) {
        // Only allow command in DMs
        if (interaction.guild !== null) {
            await interaction.reply({ 
                content: 'You can only use the /forget in a Direct Message with me.', 
                ephemeral: true
            });
            return;
        }

        const userId = interaction.user.id;
        const numberToDelete = interaction.options.getInteger('number');
        const indexToDelete = numberToDelete - 1; 

        await interaction.deferReply({ ephemeral: true });
        
        const memories = await readMemories(userId);

        if (memories.length === 0) {
            await interaction.editReply("I don't remember anything about you :disappointed_relieved: \n Use /remember to help me get to know you!");
            return;
        }

        if (indexToDelete < 0 || indexToDelete >= memories.length) {
            await interaction.editReply(`Oops! That's not a memory. Check the list with /memories.`);
            return;
        }

        const forgottenMemory = memories[indexToDelete].memory;
        
        // Remove the memory using the calculated index
        memories.splice(indexToDelete, 1); 
        
        const success = await writeMemories(userId, memories);

        if (success) {
            await interaction.editReply(`Done. I don't remember.. uhh what was it?`);
        } else {
            await interaction.editReply('Something went wrong.');
        }
    },
};