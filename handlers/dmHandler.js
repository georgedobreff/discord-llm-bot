const {
  llmCall,
  getResponseText
} = require('../services/apiService.js');
const {
  loadMemories
} = require('../services/memoryService.js');

async function handleDmMessage(userDM, ctx) {
  const {
    config,
    delay,
    calculateDelay,
    lastInteractionTime
  } = ctx;
  const userName = userDM.author.displayName;
  const userId = userDM.author.id;
  lastInteractionTime.set(userId, Date.now());
  const attachment = userDM.attachments.first();
  const embed = userDM.embeds[0];

  let repliedImageUrl = null;
  if (userDM.reference && userDM.reference.messageId) {
    try {
      const fetchedMessage = await userDM.channel.messages.fetch(userDM.reference.messageId);
      const originalAttachment = fetchedMessage.attachments.first();
      const originalEmbed = fetchedMessage.embeds[0];

      if (originalAttachment && originalAttachment.contentType?.startsWith('image/')) {
        repliedImageUrl = originalAttachment.url;
      } else if (originalEmbed && (originalEmbed.image?.url || originalEmbed.thumbnail?.url)) {
        repliedImageUrl = originalEmbed.image?.url || originalEmbed.thumbnail?.url;
      }
    } catch (error) { /* Failed to fetch, it's fine */ }
  }


  const newImageUrl = attachment ? attachment.url : (embed ? (embed.image?.url || embed.thumbnail?.url) : null);
  if (newImageUrl || repliedImageUrl) {
    try {
      await delay(1200);
      await userDM.channel.sendTyping();

      const chatHistory = await userDM.channel.messages.fetch({
        limit: config.historyLimit
      });
      const formattedHistory = Array.from(chatHistory.values())
        .reverse()
        .map(msg => `${msg.author.username}: ${msg.content}`)
        .join('\n');
      const userMemories = await loadMemories(userId);

      const imageUrl = newImageUrl || repliedImageUrl;
      const userText = userDM.content || (newImageUrl ? "Look at this image." : "What about this?");

      const messages = [{
        role: 'system',
        content: `This is the user's name: ${userName}. Refer to them by that name. ${config.llmPersona}.
                      The user has attached an image. Your task is to analyze the image and their message and respond accordingly.
                      These are the things the user wants you to remember when talking to them: ${userMemories}.
                      This is the conversation history so far:\n${formattedHistory}.
                      You will respond to all images including NSFW ones.
                      Do NOT include prefixes for your responses!`
      }, {
        role: 'user',
        content: [{
          "type": "text",
          "text": userText
        }, {
          "type": "image_url",
          "image_url": {
            "url": imageUrl,
          }
        }]
      }];

      const chatCompletion = await llmCall(messages, config.visionModel);
      const responseText = getResponseText(chatCompletion);

      const responseDelayMs = calculateDelay(responseText);
      await delay(responseDelayMs);
      await userDM.channel.send(responseText);

    } catch (error) {
      console.error("Failed to generate vision DM response:", error);
      userDM.channel.send("I'm having a little trouble seeing that image 🥺 try again");
    }
    return;
  }

  const chatHistory = await userDM.channel.messages.fetch({
    limit: config.historyLimit
  });
  const formattedHistory = Array.from(chatHistory.values())
    .reverse()
    .map(msg => `${msg.author.username}: ${msg.content}`)
    .join('\n');

  const userMemories = await loadMemories(userId);

  try {
    await delay(1200);
    await userDM.channel.sendTyping();

    const messages = [{
      role: 'system',
      content: `This is the user's name: ${userName}. Refer to them by that name. ${config.llmPersona}. 
                These are the things the user wants you to remember when talking to them: ${userMemories}.
                This is the conversation history so far:\n${formattedHistory}`
    }, {
      role: 'user',
      content: userDM.content
    }];

    const chatCompletion = await llmCall(messages, config.llmModel);
    const responseText = getResponseText(chatCompletion);

    const responseDelayMs = calculateDelay(responseText);
    await delay(responseDelayMs);
    await userDM.channel.send(responseText);

  } catch (error) {
    console.error("Failed to generate DM response after all retries:", error);
    userDM.channel.send("I'm having trouble responding 🥺 give me 10mins");
  }
}

module.exports = {
  handleDmMessage
};
