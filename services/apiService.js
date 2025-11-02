const Groq = require('groq-sdk');
const {
  RateLimitError
} = require('groq-sdk/error');
const fsSync = require('fs');

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
  console.error("🚨 Please add at least one GROQ_API_KEY to your .env file.");
  throw new Error("No Groq API keys found.");
}

let currentKeyIndex = 0;
let groq = new Groq({
  apiKey: ALL_GROQ_KEYS[currentKeyIndex]
});

function rotateGroqKey() {
  currentKeyIndex = (currentKeyIndex + 1) % ALL_GROQ_KEYS.length;
  console.warn(`⚠️ Groq rate limit hit. Switching to key index: ${currentKeyIndex + 1}/${ALL_GROQ_KEYS.length}`);
  groq = new Groq({
    apiKey: ALL_GROQ_KEYS[currentKeyIndex]
  });
}

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
      if ((error instanceof RateLimitError || error.status === 429) && attempt < maxRetries - 1) {
        rotateGroqKey();
      } else {
        console.error("Groq API error (llmCall) after all retries:", error);
        throw error;
      }
    }
  }
}

function getResponseText(completion) {
  if (!completion || !completion.choices || completion.choices.length === 0) {
    throw new Error("Invalid completion object received from LLM.");
  }
  return completion.choices[0].message.content;
}

async function transcribeAudio(audioFilePath) {
  const maxRetries = ALL_GROQ_KEYS.length;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: fsSync.createReadStream(audioFilePath),
        model: "whisper-large-v3",
      });
      return transcription.text;
    } catch (error) {
      if ((error instanceof RateLimitError || error.status === 429) && attempt < maxRetries - 1) {
        rotateGroqKey();
      } else {
        console.error("Groq API error (transcribeAudio) after all retries:", error);
        throw error;
      }
    }
  }
}

module.exports = {
  llmCall,
  getResponseText,
  transcribeAudio
};
