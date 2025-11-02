const {
  Events,
  ChannelType
} = require('discord.js');
const {
  startIdleMonitor
} = require('./services/idleService.js');
const {
  handleDmMessage
} = require('./handlers/dmHandler.js');
const {
  handleChannelMessage
} = require('./handlers/channelHandler.js');

module.exports = (client, config, delay, calculateDelay, lastInteractionTime) => {

  startIdleMonitor(client, config, lastInteractionTime);

  client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const ctx = {
      client,
      config,
      delay,
      calculateDelay,
      lastInteractionTime
    };

    try {
      if (message.channel.type === ChannelType.DM) {
        await handleDmMessage(message, ctx);
      } else if (message.guild) {
        await handleChannelMessage(message, ctx);
      }
    } catch (error) {
      console.error(`Unhandled error in message handler:`, error);
      try {
        await message.reply("I'm having trouble responding.. Please try again in a few minutes.");
      } catch (e) {
        console.error("Failed to send error reply:", e);
      }
    }
  });

  console.log("LLM text handlers initialized.");
};
