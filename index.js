require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('./config.js')
const INTERACTION_FILE = path.join(__dirname, 'interactionTimes.json');
let lastInteractionTime = new Map();
const Groq = require('groq-sdk');

const ALL_GROQ_KEYS = [
    process.env.GROQ_API_KEY1,
    process.env.GROQ_API_KEY2,
    process.env.GROQ_API_KEY3,
    process.env.GROQ_API_KEY4,
    process.env.GROQ_API_KEY5,
    process.env.GROQ_API_KEY6,
    process.env.GROQ_API_KEY7
].filter(key => key); // Filter out undefined/empty keys

let currentKeyIndex = 0;

function initializeGroqClient() {
    if (ALL_GROQ_KEYS.length === 0) {
        console.error("FATAL: No Groq API keys found in .env file.");
        return null;
    }
    const apiKey = ALL_GROQ_KEYS[currentKeyIndex];
    console.log(`🔑 Initializing Groq client with key index: ${currentKeyIndex + 1}`);
    return new Groq({ apiKey });
}

let groq = initializeGroqClient();

function rotateGroqKey() {
    currentKeyIndex = (currentKeyIndex + 1) % ALL_GROQ_KEYS.length;
    console.warn(`⚠️ Rate limit hit. Switching to key index: ${currentKeyIndex + 1}/${ALL_GROQ_KEYS.length}`);
    groq = initializeGroqClient();
    return groq;
}
const { RateLimitError } = require('groq-sdk/error');


const { REST, Routes, DMChannel, ChannelType, WelcomeChannel} = require('discord.js');

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

    const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
    );

    console.log('Successfully reloaded all commands');
    } catch (error) {
        console.error(error)
    }
}


const { 
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    ActivityType,
    PresenceUpdateStatus,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles){
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command){
        client.commands.set(command.data.name, command)
    } else {
        console.log(`The command ${filePath} is missing a required "data" or "execute" property.`)
    }
}
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    await loadInteractionData();
    const SAVE_INTERVAL_MS = config.idleSave;
    setInterval(saveInteractionData, SAVE_INTERVAL_MS);// Start the periodic save
    const CHECK_INTERVAL_MS = config.idleCheck;
    setInterval(checkIdleUsers, CHECK_INTERVAL_MS);//Start the periodic idle check

    // Deploy Commands
    await deployCommands();
    console.log('Commands deployed globally.');

    const statusType = process.env.BOT_STATUS || 'online';
    const activityType = process.env.ACTIVITY_TYPE || 'PLAYING';
    const activityName = process.env.ACTIVITY_NAME || 'Discord';

    const activityTypeMap = {
        'PLAYING' : ActivityType.Playing,
        'WATCHING' : ActivityType.Watching,
        'LISTENING' : ActivityType.Listening,
        'STREAMING' : ActivityType.Streaming,
        'COMPETING' : ActivityType.Competing
    };


    const statusMap = {
        'online' : PresenceUpdateStatus.Online,
        'idle' : PresenceUpdateStatus.Idle,
        'dnd' : PresenceUpdateStatus.DoNotDisturb,
        'invisible' : PresenceUpdateStatus.Invisible
    };

    client.user.setPresence({
        status: statusMap[statusType],
        activities: [{
            name: activityName,
            type: activityTypeMap[activityType],
        }]
    });

    console.log(`Bot status set to: ${statusType}`);
    console.log(`Bot activity set to: ${activityType} ${activityName}`);
})


client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`${interaction.commandName} is not a valid command`)
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({content: 'Error executing command!', ephemeral: true})
        } else {
            await interaction.reply({content: 'Error executing command!', ephemeral: true})
        }
    }
});

// Welcoming message upon user authorization. Initiates DM.

client.on(Events.GuildMemberAdd, async member => {

    const user = member.displayName;
    const welcomeText = `Hey ${user} 💋 How are you feeling?`;

    try {
        await user.send(welcomeText);
        
    } catch (error) {
        console.warn(`Could not send welcome DM to ${user}. They likely have DMs disabled.`);

    }
});

// Re-Engagement DM logic:

function fsPromise(fn, ...args) {
    return new Promise((resolve, reject) => {
        fn(...args, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data);
        });
    });
}

async function loadInteractionData() {
    try {  
        const data = await fsPromise(fs.readFile, INTERACTION_FILE, 'utf-8'); 
        
        const jsonObject = JSON.parse(data);
        lastInteractionTime = new Map(Object.entries(jsonObject));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log("Interaction file not found. Initializing new file.");
            await fsPromise(fs.writeFile, INTERACTION_FILE, '{}', 'utf-8'); 
        } else {
            console.error("Error loading interaction data:", error);
        }
    }
}

async function saveInteractionData() {
    try {
        const jsonObject = Object.fromEntries(lastInteractionTime);
        const jsonString = JSON.stringify(jsonObject, null, 2);
        
        await fsPromise(fs.writeFile, INTERACTION_FILE, jsonString, 'utf-8'); 
    } catch (error) {
        console.error("❌ Error saving interaction data:", error);
    }
}

const IDLE_TIME_MS = config.idleTimer;

async function checkIdleUsers() {
    const now = Date.now();
    const idleUserIds = [];

    for (const [userId, lastTime] of lastInteractionTime.entries()) {
        const timeElapsed = now - lastTime;

        if (timeElapsed >= IDLE_TIME_MS) {
            idleUserIds.push(userId);
        }
    }

    for (const userId of idleUserIds) {
        try {
            const user = await client.users.fetch(userId);
            
            const messages = config.idleLLMPrompt;

            const chatCompletion = await llmCall(messages, config.llmModel);
            const nudgeMessage = chatCompletion.choices[0].message.content;

            await user.send(nudgeMessage);
            
            lastInteractionTime.set(userId, Date.now()); //Reset the idle timer

        } catch (error) {
            console.error(`Could not send re-engagement DM to user ID: ${userId}. Error:`, error);
        }
    }
}


// Main LLM Call function:

async function llmCall(messages, model) {
    const maxRetries = ALL_GROQ_KEYS.length;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (!groq) {
            throw new Error("Groq client not initialized. Cannot make API call.");
        }
        
        try {
            const completion = await groq.chat.completions.create({
                messages: messages,
                model: model,
            });
            return completion;
        } catch (error) {
            if (error instanceof RateLimitError || error.status === 429) {
                if (attempt < maxRetries - 1) {
                    rotateGroqKey();
                } else {
                    // All keys exhausted
                    console.error("🚨 All Groq API keys exhausted. Unable to fulfill request.");
                    throw new Error("Rate limit reached across all available API keys.");
                }
            } else {
                // Not a rate limit error
                console.error("❌ Groq API encountered a non-rate-limit error:", error);
                throw error;
            }
        }
    }
}

// Response delay calculation

function calculateDelay(responseText, msPer100Chars = 5000) {
    if (!responseText) return 0;
    
    const delay = (responseText.length / 100) * msPer100Chars;
    
    const MAX_DELAY_MS = 10000; 
    
    return Math.min(delay, MAX_DELAY_MS);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// LLM Logic for DMs:

client.on(Events.MessageCreate, async userDM => {
   if(userDM.channel.type !== ChannelType.DM || userDM.guild !== null || userDM.author.bot){
    return;
   }
   const userName = userDM.author.displayName;

   const userId = userDM.author.id;
   lastInteractionTime.set(userId, Date.now());//log interaction time

   const chatHistory = await userDM.channel.messages.fetch({ limit: config.historyLimit});
   const chatHistoryArray = Array.from(chatHistory.values()).reverse();
   try {
    await delay(1200)
    await userDM.channel.sendTyping();

    const messages = [
            { role: 'system', content: `This is the user's name: ${userName}. Refer to them by that name.
             ${config.llmPersona}. This is the conversation history so far: ${chatHistoryArray}` },
            { role: 'user', content: userDM.content }
        ];
    
    const chatCompletion = await llmCall(messages, config.llmModel);

    const responseText = chatCompletion.choices[0].message.content;

    const responseDelayMs = calculateDelay(responseText);
    await delay(responseDelayMs);
    
    await userDM.channel.send(responseText);

}
    catch (error) {
        console.error("Failed to generate DM response after all retries:", error);
        userDM.channel.send("I'm so sorry babe something came up text me in 10mins 💋");
}});

// LLM Logic for Waifu Channel on Server:

const waifuChannel = config.channelName;

client.on(Events.MessageCreate, async waifu => {
    if(waifu.channel.type === ChannelType.DM || waifu.guild === null || waifu.author.bot){
    return;
   }
   if (waifu.channel.name.toLowerCase() !== waifuChannel.toLowerCase()) {
        return;
    }
   const userName = waifu.author.displayName;
   const chatHistory = await waifu.channel.messages.fetch({ limit: config.historyLimit});
   const chatHistoryArray = Array.from(chatHistory.values()).reverse();
   try {
    await delay(1200)
    await waifu.channel.sendTyping();
    const messages = [
            { role: 'system', content: `This is the current user's name: ${userName}. Refer to them by that name. 
            ${config.sharedWaifu}. This is the conversation history so far: ${chatHistoryArray}` },
            { role: 'user', content: waifu.content }
        ];
    const chatCompletion = await llmCall(messages, config.llmModel);
    const responseText = chatCompletion.choices[0].message.content;

    const responseDelayMs = calculateDelay(responseText);
    await delay(responseDelayMs);

    await waifu.channel.send(responseText);

}
    catch (error) {
        console.error("Failed to generate DM response after all retries:", error);
        userDM.channel.send("sorry boys I can't talk rn 🥺 ttys ok 💋");
}});

client.login(process.env.BOT_TOKEN);
