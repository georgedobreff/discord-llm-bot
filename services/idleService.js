const {
  llmCall,
  getResponseText
} = require('./apiService.js');

function startIdleMonitor(client, config, lastInteractionTime) {
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
        const nudgeMessage = getResponseText(chatCompletion);

        await user.send(nudgeMessage);
        lastInteractionTime.set(userId, Date.now());
      } catch (error) {
        console.error(`Could not send re-engagement DM to user ID: ${userId}. Error:`, error);
      }
    }
  }

  setInterval(checkIdleUsers, config.idleCheck);
  console.log("Idle user monitor started.");
}

module.exports = {
  startIdleMonitor
};
