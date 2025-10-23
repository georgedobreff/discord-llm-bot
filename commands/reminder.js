const { SlashCommandBuilder } = require('discord.js');
const config = require('../config.js');
const fs = require('fs/promises');
const path = require('path');
const REMINDER_DIR = path.join(__dirname, '..', 'user_reminders');

// Save a user's reminders
async function saveReminder(userId, userName, reminderContent) {
  try {
    await fs.mkdir(REMINDER_DIR, { recursive: true });
    const reminderFilePath = path.join(REMINDER_DIR, `${userId}.json`);

    const reminderEntry = {
      timestamp: new Date().toISOString(),
      user: userName,
      memory: reminderContent.trim()
    };

    let reminderMemory = [];
    try {
      const data = await fs.readFile(memoryFilePath, 'utf-8');
      reminderMemory = JSON.parse(data);
      if (!Array.isArray(reminderMemory)) {
        reminderMemory = [];
      }
    } catch (error) {
      // Ignore ENOENT (file not found)
      if (error.code !== 'ENOENT') {
        console.error(`Error reading reminder file ${userId}.json:`, error);
      }
    }


    reminderMemory.push(reminderEntry);
    const MAX_REMINDERS = 50;
    if (userMemory.length > MAX_REMINDERS) {
      userMemory = userMemory.slice(-MAX_REMINDERS);
    }

    await fs.writeFile(memoryFilePath, JSON.stringify(reminderMemory, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ Error saving reminder for user ${userId}:`, error);
    return false;
  }
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindMe')
    .setDescription(`Things you want ${config.llmName} to remind you about.`)
    .addStringOption(option =>
      option.setName('reminder')
        .setDescription('The reminder:')
        .setRequired(true)),

  async execute(interaction) {
    // Only allow command in DMs
    if (interaction.guild !== null) {
      await interaction.reply({
        content: 'You can only add reminders in a Direct Message with me.',
        ephemeral: true
      });
      return;
    }

    const reminderContent = interaction.options.getString('reminder');
    const userId = interaction.user.id;
    const userName = interaction.user.displayName;

    // Limit reminder size
    if (reminderContent.length > 100) {
      await interaction.reply({
        content: `I can't remember that much! Please keep it under 100 characters.`,
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const success = await saveReminder(userId, userName, reminderContent);

    if (success) {
      await interaction.editReply(`Got it! I'll remind you: " **${reminderContent}** "`);
    } else {
      await interaction.editReply('Something went wrong.');
    }
  },
};
