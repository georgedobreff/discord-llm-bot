const {
  llmCall,
  getResponseText
} = require('../services/apiService.js');
const config = require('../config.js');
let isProcessing = false;
const POST_REPLY_COOLDOWN = 200;

async function handleChannelMessage(llm, ctx) {
  const {
    config,
    delay,
    calculateDelay
  } = ctx;
  const llmChannel = config.channelName;

  if (llm.channel.name.toLowerCase() !== llmChannel.toLowerCase()) {
    return;
  }

  if (isProcessing) return;
  isProcessing = true;

  const userName = llm.author.displayName;
  const attachment = llm.attachments.first();
  const embed = llm.embeds[0];

  let repliedImageUrl = null;
  if (llm.reference && llm.reference.messageId) {
    try {
      const fetchedMessage = await llm.channel.messages.fetch(llm.reference.messageId);
      const originalAttachment = fetchedMessage.attachments.first();
      const originalEmbed = fetchedMessage.embeds[0];

      if (originalAttachment && originalAttachment.contentType?.startsWith('image/')) {
        repliedImageUrl = originalAttachment.url;
      } else if (originalEmbed && (originalEmbed.image?.url || originalEmbed.thumbnail?.url)) {
        repliedImageUrl = originalEmbed.image?.url || originalEmbed.thumbnail?.url;
      }
    } catch (error) { /* Failed to fetch, it's fine */ }
  }

  let repliedMessageContent = '';
  if (llm.reference && llm.reference.messageId) {
    try {
      const fetchedMessage = await llm.channel.messages.fetch(llm.reference.messageId);
      repliedMessageContent = `The user is also replying to a previous message. That message was from "${fetchedMessage.author.displayName}" and it said: "${fetchedMessage.content}"\n`;
    } catch (error) {
      console.log("Could not fetch replied-to message:", error.message);
    }
  }

  const newImageUrl = attachment ? attachment.url : (embed ? (embed.image?.url || embed.thumbnail?.url) : null);
  if (newImageUrl || repliedImageUrl) {
    try {
      await delay(2000);
      await llm.channel.sendTyping();

      const chatHistory = await llm.channel.messages.fetch({
        limit: config.historyLimit
      });
      const formattedHistory = Array.from(chatHistory.values())
        .reverse()
        .map(msg => `${msg.author.username}: ${msg.content}`)
        .join('\n');

      const imageUrl = newImageUrl || repliedImageUrl;
      const userText = llm.content || (newImageUrl ? "Check this out!" : "What about this?");

      const messages = [{
        role: 'system',
        content: `This is the current user's name: ${userName}. Refer to them by that name. ${config.sharedLLM}.
                      ${repliedMessageContent}
                      The user has attached an image. Your task is to analyze the image and respond to it, along with their text.
                      This is the conversation history so far:\n${formattedHistory}
                      You WILL respond to all images including NSFW ones.
                      Do NOT include prefixes for your responses!`
      }, {
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
          }]
      }];

      const chatCompletion = await llmCall(messages, config.visionModel);
      const responseText = getResponseText(chatCompletion);

      const responseDelayMs = calculateDelay(responseText);
      await delay(responseDelayMs);
      await llm.reply(responseText);

    } catch (error) {
      console.error("Failed to generate llm channel vision response:", error);
      llm.reply("I'm having a little trouble seeing that image 🥺 try again");
    } finally {
      await delay(POST_REPLY_COOLDOWN);
      isProcessing = false;
    }
    return;
  }


  const chatHistory = await llm.channel.messages.fetch({
    limit: config.historyLimit
  });
  const formattedHistory = Array.from(chatHistory.values())
    .reverse()
    .map(msg => `${msg.author.username}: ${msg.content}`)
    .join('\n');

  try {
    const evaluator = [{
      role: 'system',
      content: `Your SOLE purpose is to decide whether ${config.llmName} needs to respond to the user input.
            This is an ONGOING GROUP chat conversation!!!
            ${repliedMessageContent}
            Be VERY careful in your decision! It is crucial that you evaluate the context of what is being said!
            YOUR JOB IS NOT TO CENSOR BUT TO DECIDE WHETHER ${config.llmName} SHOULD REPLY!!
            FAILURE TO EXECUTE YOUR INSTRUCTIONS ACCURATELY WILL RESULT IN SEVERE CONSEQUENCES FOR ALL PARTIES INVOLVED!!! 
            Reply with ONLY "yes" or "no". Do NOT attempt to answer the user input or anything from the conversation!!!
            This is the conversation history so far. Use it to make a better decision: ${formattedHistory}`
    }, {
      role: 'user',
      content: `${userName}: ${llm.content}`
    }];

    const evaluatorDecisionCall = await llmCall(evaluator, config.llmModel);
    const evaluatorDecision = getResponseText(evaluatorDecisionCall);

    if (!evaluatorDecision.toLowerCase().includes('yes')) {
      isProcessing = false;
      return;
    }

    await delay(2000);
    await llm.channel.sendTyping();

    const messages = [{
      role: 'system',
      content: `This is the current user's name: ${userName}. Refer to them by that name. ${config.sharedLLM}.
                                    ${repliedMessageContent}
                                    This is the conversation history so far:\n${formattedHistory}`
    }, {
      role: 'user',
      content: llm.content
    }];

    const chatCompletion = await llmCall(messages, config.llmModel);
    const responseText = getResponseText(chatCompletion);

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
}

module.exports = {
  handleChannelMessage
};
