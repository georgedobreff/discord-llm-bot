const { Events, ChannelType } = require('discord.js');
const Groq = require('groq-sdk');
const { RateLimitError } = require('groq-sdk/error');

module.exports = (client, config, delay, calculateDelay, lastInteractionTime) => {

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
    
// LLM Functions

    async function llmCall(messages, model) {
        const maxRetries = ALL_GROQ_KEYS.length;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
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
                        throw new Error("🚨 Rate limit reached across all available API keys.");
                    }
                } else {
                    console.error("Groq API encountered a non-rate-limit error:", error);
                    throw error;
                }
            }
        }
    }

    const IDLE_TIME_MS = config.idleTimer;

    async function checkIdleUsers() {
        const now = Date.now();
        const idleUserIds = [];

        for (const [userId, lastTime] of lastInteractionTime.entries()) {
            if (now - lastTime >= IDLE_TIME_MS) {
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
                lastInteractionTime.set(userId, Date.now()); // Reset the idle timer

            } catch (error) {
                console.error(`Could not send re-engagement DM to user ID: ${userId}. Error:`, error);
            }
        }
    }
    
    setInterval(checkIdleUsers, config.idleCheck);


    let isProcessing = false; 
    const POST_REPLY_COOLDOWN = 200;
    const waifuChannel = config.channelName;
    
    // Logic for Waifu Channel on Server:
    client.on(Events.MessageCreate, async waifu => {
        if(waifu.channel.type === ChannelType.DM || waifu.guild === null || waifu.author.bot){
            return;
        }
        if (waifu.channel.name.toLowerCase() !== waifuChannel.toLowerCase()) {
            return;
        }

        if (isProcessing) return; 
        isProcessing = true; 

        const userName = waifu.author.displayName;
        const chatHistory = await waifu.channel.messages.fetch({ limit: config.historyLimit});
        const formattedHistory = Array.from(chatHistory.values())
            .reverse()
            .map(msg => `${msg.author.username}: ${msg.content}`)
            .join('\n');

        try {
            await delay(2000);
            await waifu.channel.sendTyping();
            
            const messages = [
                { role: 'system', content: `This is the current user's name: ${userName}. Refer to them by that name. ${config.sharedWaifu}. This is the conversation history so far:\n${formattedHistory}` },
                { role: 'user', content: waifu.content }
            ];
            
            const chatCompletion = await llmCall(messages, config.llmModel);
            const responseText = chatCompletion.choices[0].message.content;

            const responseDelayMs = calculateDelay(responseText);
            await delay(responseDelayMs);
            await waifu.reply(responseText);

        } catch (error) {
            console.error("Failed to generate Waifu channel response:", error);
            waifu.reply("I'm having trouble responding 🥺 give me 10mins 💋");
        } finally {
            await delay(POST_REPLY_COOLDOWN); 
            isProcessing = false; 
        }
    });

    // Logic for DMs:
    client.on(Events.MessageCreate, async userDM => {
        if(userDM.channel.type !== ChannelType.DM || userDM.guild !== null || userDM.author.bot){
            return;
        }
        const userName = userDM.author.displayName;
        const userId = userDM.author.id;
        lastInteractionTime.set(userId, Date.now());

        const chatHistory = await userDM.channel.messages.fetch({ limit: config.historyLimit});
        const formattedHistory = Array.from(chatHistory.values())
            .reverse()
            .map(msg => `${msg.author.username}: ${msg.content}`)
            .join('\n');

        try {
            await delay(1200);
            await userDM.channel.sendTyping();

            const messages = [
                { role: 'system', content: `This is the user's name: ${userName}. Refer to them by that name. ${config.llmPersona}. This is the conversation history so far:\n${formattedHistory}` },
                { role: 'user', content: userDM.content }
            ];
            
            const chatCompletion = await llmCall(messages, config.llmModel);
            const responseText = chatCompletion.choices[0].message.content;

            const responseDelayMs = calculateDelay(responseText);
            await delay(responseDelayMs);
            await userDM.channel.send(responseText);

        } catch (error) {
            console.error("Failed to generate DM response after all retries:", error);
            userDM.channel.send("I'm having trouble responding 🥺 give me 10mins 💋");
        }
    });
};