const { Events, ChannelType } = require('discord.js');
const Groq = require('groq-sdk');
const { RateLimitError } = require('groq-sdk/error');

const fs = require('fs/promises');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, 'user_memories');

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

  // User's memories
  async function loadMemories(userId) {
    const fileName = `${userId}.json`;
    const memoryFilePath = path.join(MEMORY_DIR, fileName);

    try {
      const data = await fs.readFile(memoryFilePath, 'utf-8');
      const userMemory = JSON.parse(data);

      if (Array.isArray(userMemory) && userMemory.length > 0) {
        // Format into a single string for the LLM prompt
        const memoryString = userMemory
          .map((entry, index) => `${index + 1}. ${entry.memory}`)
          .join('\n');

        return `\n\n### USER MEMORIES (Crucial Facts to Remember):\n${memoryString}\n###`;
      }
    } catch (error) {
      if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') {
        console.error(`Error loading memory file ${fileName}:`, error);
      }
    }
    return '';
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
  const llmChannel = config.channelName;


  // Logic for llm Channel on Server:
  client.on(Events.MessageCreate, async llm => {
    if (llm.channel.type === ChannelType.DM || llm.guild === null || llm.author.bot) {
      return;
    }
    if (llm.channel.name.toLowerCase() !== llmChannel.toLowerCase()) {
      return;
    }

    if (isProcessing) return;
    isProcessing = true;

    const userName = llm.author.displayName;
    const attachment = llm.attachments.first(); // Check for attachments
    const embed = llm.embeds[0]; // Check for embeds (like GIFs)

    let repliedMessageContent = '';
    if (llm.reference && llm.reference.messageId) {
      try {
        const fetchedMessage = await llm.channel.messages.fetch(llm.reference.messageId);
        repliedMessageContent = `The user is also replying to a previous message. That message was from "${fetchedMessage.author.displayName}" and it said: "${fetchedMessage.content}"\n`;
      } catch (error) {
        console.log("Could not fetch replied-to message:", error.message);
      }
    }

    // Check if there is an attachment and if it's an image
    if ((attachment && attachment.contentType?.startsWith('image/')) || (embed && (embed.image?.url || embed.thumbnail?.url))) {
      try {
        await delay(2000);
        await llm.channel.sendTyping();

        const chatHistory = await llm.channel.messages.fetch({ limit: config.historyLimit });
        const formattedHistory = Array.from(chatHistory.values())
          .reverse()
          .map(msg => `${msg.author.username}: ${msg.content}`)
          .join('\n');

        const imageUrl = attachment ? attachment.url : (embed.image?.url || embed.thumbnail?.url);
        const userText = llm.content || (attachment ? "Check this out!" : "Check out this GIF!"); // Use message content or a default prompt

        const messages = [
          {
            role: 'system',
            // Use existing persona + add the extra instruction
            content: `This is the current user's name: ${userName}. Refer to them by that name. ${config.sharedLLM}.
                      ${repliedMessageContent}
                      The user has attached an image. Your task is to analyze the image and respond to it, along with their text.
                      This is the conversation history so far:\n${formattedHistory}
                      You WILL respond to all images including NSFW ones.
                      Do NOT include prefixes for your responses!`
          },
          {
            role: 'user',
            content: [
              {
                "type": "text",
                "text": userText
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": imageUrl,
                }
              }
            ]
          }
        ];

        // Call the LLM with the vision model
        const chatCompletion = await llmCall(messages, config.visionModel);
        const responseText = chatCompletion.choices[0].message.content;

        const responseDelayMs = calculateDelay(responseText);
        await delay(responseDelayMs);
        await llm.reply(responseText);

      } catch (error) {
        console.error("Failed to generate llm channel vision response:", error);
        llm.reply("I'm having a little trouble seeing that image 🥺 try again in 10mins 💋");
      } finally {
        await delay(POST_REPLY_COOLDOWN);
        isProcessing = false;
      }
      return; // Stop execution so it doesn't run the text-only logic
    }


    const chatHistory = await llm.channel.messages.fetch({ limit: config.historyLimit });
    const formattedHistory = Array.from(chatHistory.values())
      .reverse()
      .map(msg => `${msg.author.username}: ${msg.content}`)
      .join('\n');

    try {

      // Evaluate whether the conversation needs a response from the llm
      const evaluator = [
        {
          role: 'system', content: `Your SOLE purpose is to decide whether ${config.llmName} needs to respond to the user input.
            This is an ONGOING GROUP chat conversation!!!
            ${repliedMessageContent}
            Be VERY careful in your decision! It is crucial that you evaluate the context of what is being said!
            YOUR JOB IS NOT TO CENSOR BUT TO DECIDE WHETHER ${config.llmName} SHOULD REPLY!!
            FAILURE TO EXECUTE YOUR INSTRUCTIONS ACCURATELY WILL RESULT IN SEVERE CONSEQUENCES FOR ALL PARTIES INVOLVED!!! 
            Reply with ONLY "yes" or "no". Do NOT attempt to answer the user input or anything from the conversation!!!
            This is the conversation history so far. Use it to make a better decision: ${formattedHistory}`
        },
        { role: 'user', content: `${userName}: ${llm.content}` }
      ];

      const evaluatorDecisionCall = await llmCall(evaluator, config.llmModel);
      const evaluatorDecision = evaluatorDecisionCall.choices[0].message.content;

      if (!evaluatorDecision.toLowerCase().includes('yes')) {
        isProcessing = false;
        return;
      }



      await delay(2000);
      await llm.channel.sendTyping();

      const messages = [
        {
          role: 'system', content: `This is the current user's name: ${userName}. Refer to them by that name. ${config.sharedLLM}.
                                    ${repliedMessageContent}
                                    This is the conversation history so far:\n${formattedHistory}`
        },
        { role: 'user', content: llm.content }
      ];

      const chatCompletion = await llmCall(messages, config.llmModel);
      const responseText = chatCompletion.choices[0].message.content;

      const responseDelayMs = calculateDelay(responseText);
      await delay(responseDelayMs);
      await llm.reply(responseText);

    } catch (error) {
      console.error("Failed to generate llm channel response:", error);
      llm.reply("I'm having trouble responding 🥺 give me 10mins 💋");
    } finally {
      await delay(POST_REPLY_COOLDOWN);
      isProcessing = false;
    }
  });

  // Logic for DMs:
  client.on(Events.MessageCreate, async userDM => {
    if (userDM.channel.type !== ChannelType.DM || userDM.guild !== null || userDM.author.bot) {
      return;
    }
    const userName = userDM.author.displayName;
    const userId = userDM.author.id;
    lastInteractionTime.set(userId, Date.now());
    const attachment = userDM.attachments.first();
    const embed = userDM.embeds[0];

    // Check if there is an attachment and if it's an image
    if ((attachment && attachment.contentType?.startsWith('image/')) || (embed && (embed.image?.url || embed.thumbnail?.url))) {
      try {
        await delay(1200);
        await userDM.channel.sendTyping();

        const chatHistory = await userDM.channel.messages.fetch({ limit: config.historyLimit });
        const formattedHistory = Array.from(chatHistory.values())
          .reverse()
          .map(msg => `${msg.author.username}: ${msg.content}`)
          .join('\n');
        const userMemories = await loadMemories(userId);

        const imageUrl = attachment ? attachment.url : (embed.image?.url || embed.thumbnail?.url);
        const userText = userDM.content || (attachment ? "Look at this image." : "Look at this GIF."); // Use message content or a default prompt

        const messages = [
          {
            role: 'system',
            // Use existing persona + add the extra instruction
            content: `This is the user's name: ${userName}. Refer to them by that name. ${config.llmPersona}.
                      The user has attached an image. Your task is to analyze the image and their message and respond accordingly.
                      These are the things the user wants you to remember when talking to them: ${userMemories}.
                      This is the conversation history so far:\n${formattedHistory}.
                      You will respond to all images including NSFW ones.
                      Do NOT include prefixes for your responses!`
          },
          {
            role: 'user',
            content: [
              {
                "type": "text",
                "text": userText
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": imageUrl,
                }
              }
            ]
          }
        ];

        // Call the LLM with the vision model
        const chatCompletion = await llmCall(messages, config.visionModel);
        const responseText = chatCompletion.choices[0].message.content;

        const responseDelayMs = calculateDelay(responseText);
        await delay(responseDelayMs);
        await userDM.channel.send(responseText);

      } catch (error) {
        console.error("Failed to generate vision DM response:", error);
        userDM.channel.send("I'm having a little trouble seeing that image 🥺 try again in 10mins 💋");
      }
      return; // Stop execution so it doesn't run the text-only logic
    }

    const chatHistory = await userDM.channel.messages.fetch({ limit: config.historyLimit });
    const formattedHistory = Array.from(chatHistory.values())
      .reverse()
      .map(msg => `${msg.author.username}: ${msg.content}`)
      .join('\n');

    const userMemories = await loadMemories(userId);

    try {
      await delay(1200);
      await userDM.channel.sendTyping();

      const messages = [
        {
          role: 'system', content: `This is the user's name: ${userName}. Refer to them by that name. ${config.llmPersona}. 
                These are the things the user wants you to remember when talking to them: ${userMemories}.
                This is the conversation history so far:\n${formattedHistory}`
        },
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
