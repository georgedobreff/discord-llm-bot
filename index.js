require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('./config.js');
const initializeWaifu = require('./waifu.js'); 
const { startBot } = require('./bot.js');
const INTERACTION_FILE = path.join(__dirname, 'interactionTimes.json');
const { REST, Routes } = require('discord.js');

let lastInteractionTime = new Map();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Response Delay Calculation
function calculateDelay(responseText, msPer100Chars = 3000) {
    if (!responseText) return 0;
    const delay = (responseText.length / 100) * msPer100Chars;
    const MAX_DELAY_MS = 10000; 
    return Math.min(delay, MAX_DELAY_MS);
}

const deployCommands = async () => {
    try {
        const commands = [];
        const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            if ('data' in command && 'execute' in command){
                commands.push(command.data.toJSON());
            } else {
                console.log(`WARNING: The command at ${file} is missing a property.`);
            }
        }
        const rest = new REST().setToken(process.env.BOT_TOKEN);
        console.log(`Started refreshing ${commands.length} application slash commands globally.`);
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded all commands');
    } catch (error) {
        console.error(error)
    }
}

startBot({ 
    config, 
    delay, 
    calculateDelay, 
    lastInteractionTime, 
    initializeWaifu,
    deployCommands,
    interactionFilePath: INTERACTION_FILE
});
