const {
  entersState,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  StreamType,
  AudioPlayerStatus
} = require('@discordjs/voice');
const { EndBehaviorType } = require('@discordjs/voice');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const config = require('./config.js');
const prism = require('prism-media');
const { pipeline } = require('stream');
const wav = require('wav');
const { GoogleGenAI } = require('@google/genai');



const USER_SPEECH_DIR = path.join(__dirname, 'user_speech');
const VOICE_HISTORY_DIR = path.join(__dirname, 'voice_history');
const TTS_OUTPUT_DIR = path.join(__dirname, 'tts_output');

async function setupDirectories() {
  try {
    await fs.mkdir(USER_SPEECH_DIR, { recursive: true });
    await fs.mkdir(VOICE_HISTORY_DIR, { recursive: true });
    await fs.mkdir(TTS_OUTPUT_DIR, { recursive: true });
    console.log("Directories for voice handling are ready.");
  } catch (error) {
    console.error("Error creating voice directories:", error);
  }
}
setupDirectories();

// Groq Keys
const ALL_GROQ_KEYS = [
  process.env.GROQ_API_KEY1, process.env.GROQ_API_KEY2, process.env.GROQ_API_KEY3,
  process.env.GROQ_API_KEY4, process.env.GROQ_API_KEY5, process.env.GROQ_API_KEY6,
  process.env.GROQ_API_KEY7
].filter(key => key);

if (ALL_GROQ_KEYS.length === 0) {
  console.error("Please add an API_KEY to your .env file for voice features.");
}

let currentKeyIndex = 0;
let groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });

function rotateGroqKey() {
  currentKeyIndex = (currentKeyIndex + 1) % ALL_GROQ_KEYS.length;
  console.warn(`⚠️ Groq rate limit hit. Switching to key index: ${currentKeyIndex + 1}/${ALL_GROQ_KEYS.length}`);
  groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });
}

// Gemini Keys Rotation
const ALL_GEMINI_KEYS = [
  process.env.GEMINI_API_KEY1,
  process.env.GEMINI_API_KEY2,
  process.env.GEMINI_API_KEY3,
  process.env.GEMINI_API_KEY4,
  process.env.GEMINI_API_KEY5,
  process.env.GEMINI_API_KEY6,
  process.env.GEMINI_API_KEY7,
  process.env.GEMINI_API_KEY8,
  process.env.GEMINI_API_KEY9,
  process.env.GEMINI_API_KEY10,
].filter(key => typeof key === 'string' && key.trim() !== '');

console.log("Loaded All Gemini Keys");

if (ALL_GEMINI_KEYS.length === 0) {
  console.error("Please add at least one GEMINI_API_KEY to your .env file for TTS.");
}

let currentGeminiKeyIndex = 0;
let genAI;


function initializeGeminiClient(keyIndex) {
  const key = ALL_GEMINI_KEYS[keyIndex];
  if (!key) {
    console.error(`🚨 Attempted to initialize Gemini client with invalid key index: ${keyIndex}`);
    // Handle this error appropriately - maybe disable TTS or try next key
    return false; // Indicate failure
  }
  try {
    console.log(`Initializing Gemini client with Key Index ${keyIndex}`);
    genAI = new GoogleGenAI(key);
    return true; // Indicate success
  } catch (initError) {
    console.error(`🚨 Error initializing Gemini client with Key Index ${keyIndex}:`, initError);
    return false; // Indicate failure
  }
}

// Initial initialization
if (!initializeGeminiClient(currentGeminiKeyIndex)) {
  console.error("🚨 Failed to initialize Gemini client with the first key.");
  // Handle failure - maybe disable TTS
}


function rotateGeminiKey() {
  const previousKeyIndex = currentGeminiKeyIndex;
  currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % ALL_GEMINI_KEYS.length;
  console.warn(`⚠️ Gemini rate limit likely hit. Switching from key index ${previousKeyIndex} to ${currentGeminiKeyIndex} (${currentGeminiKeyIndex + 1}/${ALL_GEMINI_KEYS.length})`);

  // Try to initialize with the new key
  if (!initializeGeminiClient(currentGeminiKeyIndex)) {
    console.error(`🚨 Failed to initialize Gemini client after rotating to Key Index ${currentGeminiKeyIndex}. TTS might be unavailable.`);
    // Potentially cycle through remaining keys or disable TTS
  }
}

// State management

let audioPlayer = null;
let ttsQueue = [];
let isPlaying = false;
let currentConnection = null;
const userRecordingState = new Map();
const userProcessingState = new Map();

function resetState() {
  if (audioPlayer) {
    audioPlayer.stop(true);
  }
  audioPlayer = null;
  ttsQueue = [];
  isPlaying = false;
  currentConnection = null;
  userRecordingState.clear();
  userProcessingState.clear();
  console.log("Voice state has been reset.");
}

// Main voice handling
function handleVoiceConnection(connection, interaction) {
  if (currentConnection) {
    currentConnection.destroy();
  }
  resetState();
  currentConnection = connection;

  audioPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
  connection.subscribe(audioPlayer);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch (error) {
      if (connection === currentConnection) connection.destroy();
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    if (connection === currentConnection) resetState();
  });

  audioPlayer.on(AudioPlayerStatus.Idle, () => {
    isPlaying = false;
    playNextInQueue();
  });

  audioPlayer.on('error', error => {
    console.error(`Error in audio player:`, error);
    isPlaying = false;
    playNextInQueue();
  });

  const receiver = connection.receiver;

  receiver.speaking.on('start', (userId) => {
    if (userRecordingState.get(userId)) {
      return;
    }
    if (userProcessingState.get(userId)) {
      console.log(`Already responding to user's speech. Ignoring new one.`);
      return;
    }

    const user = interaction.client.users.cache.get(userId);
    const member = interaction.guild.members.cache.get(userId);
    const displayName = member.displayName;
    if (user && !user.bot) {
      userRecordingState.set(userId, true);
      userProcessingState.set(userId, true);
      console.log(`🎤 ${displayName} started speaking. (Recording started)`);

      const audioFilePath = path.join(USER_SPEECH_DIR, `${userId}.wav`);
      const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 750 },
      });

      const pcmStream = opusStream.pipe(new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }));

      const wavWriter = new wav.FileWriter(audioFilePath, {
        channels: 2,
        sampleRate: 48000,
        bitDepth: 16
      });

      pipeline(pcmStream, wavWriter, (err) => {
        userRecordingState.set(userId, false);
        if (err) {
          console.error(`Error writing WAV file for ${user.username}:`, err);
          userProcessingState.set(userId, false);
        } else {
          console.log(`Finished recording for ${user.username}.`);
          processAudio(userId, user.username, displayName);
        }
      });
    }
  });
}

async function processAudio(userId, userName, displayName) {
  const audioFilePath = path.join(USER_SPEECH_DIR, `${userId}.wav`);

  try {

    const transcription = await groq.audio.transcriptions.create({
      file: fsSync.createReadStream(audioFilePath),
      model: "whisper-large-v3",
    });
    const transcriptionText = transcription.text;
    console.log(`Transcription for ${displayName}: "${transcriptionText}"`);


    if (!transcriptionText || transcriptionText.trim().length <= 3 || transcriptionText === " you."
      || transcriptionText === " Thank you." || transcriptionText === " Okay.") {
      console.log("Empty or too short. Ignoring speech.");
      return;
    }

    // ====================================================
    // Commented out the trigger phrase condition but keeping it just in case.
    //-----------------------------------------------------
    // const triggerPhrase = `${config.voiceTriggerPhrase}`;

    // if (!transcriptionText.trim().toLowerCase().includes(triggerPhrase)) {
    // console.log(`No trigger phrase for "${userName}'s speech`);
    // return;
    // }
    // ===================================================


    const historyFilePath = path.join(VOICE_HISTORY_DIR, `${userId}.json`);
    let voiceHistory = [];

    try {
      const data = await fs.readFile(historyFilePath, 'utf-8');
      voiceHistory = JSON.parse(data);
    } catch (error) { /* File doesn't exist, will be created. */ }

    voiceHistory.push({ userId, displayName, text: transcriptionText });
    const formattedHistory = voiceHistory.map(entry => `${entry.displayName}: ${entry.text}`).join('\n');

    const evaluator = [
      {
        role: 'system', content: `Your SOLE purpose is to decide whether ${config.llmName} needs to respond to the user input.
            This is an ONGOING conversation!!!
            Be VERY careful in your decision! It is crucial that you read the conversation history and the current user input
            first to determine whether their input is addressed at or at least mentions ${config.llmName}.
            You must CAREFULLY examine the conversation history and if there are no other users logged in the last 5 entries there
            the user is most likely speaking to ${config.llmName} alone and a response is REQUIRED!
            YOUR JOB IS NOT TO CENSOR BUT TO DECIDE WHETHER ${config.llmName} SHOULD REPLY!!
            FAILURE TO EXECUTE YOUR INSTRUCTIONS ACCURATELY WILL RESULT IN SEVERE CONSEQUENCES FOR ALL PARTIES INVOLVED!!! 
            Reply with ONLY "yes" or "no". Do NOT attempt to answer the user input or anything from the conversation!!!
            Use this conversation history to make a better decision: ${config.llmName}:\n${formattedHistory}`
      },
      { role: 'user', content: `${displayName}: ${transcriptionText}` }
    ];

    const evaluatorDecisionCall = await llmCall(evaluator, config.llmModel);
    const evaluatorDecision = evaluatorDecisionCall.choices[0].message.content;
    console.log(`Evaluator decision: "${evaluatorDecision}"`);

    if (evaluatorDecision.toLowerCase().includes('yes')) {
      const messages = [
        { role: 'system', content: `${config.voiceLLM} This is the conversation history:\n${formattedHistory}` },
        { role: 'user', content: `${displayName}: ${transcriptionText}` }
      ];

      const completion = await llmCall(messages, config.llmModel);
      const responseText = completion.choices[0].message.content;
      console.log(`Replying to ${displayName}: "${responseText}"`);

      voiceHistory.push({
        userId: 'BOT',
        userName: config.llmName,
        text: responseText
      });

      await fs.writeFile(historyFilePath, JSON.stringify(voiceHistory, null, 2));
      const cleanedTextForTTS = responseText.replace(/\*.*?\*/g, '').trim();

      if (cleanedTextForTTS) {
        ttsQueue.push(cleanedTextForTTS);
        if (!isPlaying) {
          playNextInQueue();
        }
      }
    } else {
      console.log('No reponse necessary. Skipping.')
      return;
    }

  } catch (error) {
    console.error("Error during audio processing pipeline:", error);
  } finally {
    userProcessingState.set(userId, false);
  }
}

async function saveWaveFile(
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2,
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });
    writer.on('finish', resolve);
    writer.on('error', reject);
    writer.write(pcmData);
    writer.end();
  });
}


async function playNextInQueue() {
  if (isPlaying || ttsQueue.length === 0 || !audioPlayer || ALL_GEMINI_KEYS.length === 0) {
    if (ALL_GEMINI_KEYS.length === 0) console.error("No Gemini API keys available for TTS.");
    return;
  }

  isPlaying = true;
  const textToSpeak = ttsQueue.shift();
  const ttsFilePath = path.join(TTS_OUTPUT_DIR, `tts_output.wav`);

  const maxRetries = ALL_GEMINI_KEYS.length;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Attempting Gemini TTS generation (Attempt ${attempt + 1}/${maxRetries}, Key Index ${currentGeminiKeyIndex})`);
      const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) {
        throw new Error("No audio data received from Gemini-TTS despite successful API call.");
      }

      const audioBuffer = Buffer.from(data, 'base64');
      await saveWaveFile(ttsFilePath, audioBuffer);
      console.log(`Google Gemini-TTS audio file saved.`);

      const resource = createAudioResource(ttsFilePath, { inputType: StreamType.Arbitrary });
      audioPlayer.play(resource);

      return;

    } catch (error) {
      console.error(`Failed Gemini TTS generation (Attempt ${attempt + 1}/${maxRetries}):`, error.message);

      // Check if we hit the rate limit
      if (error.status === 429 || error.status === 403) {
        if (attempt < maxRetries - 1) {
          rotateGeminiKey();
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.error("Gemini TTS rate limit reached on all keys.");
          isPlaying = false; // Reset state
          return;
        }
      } else {
        console.error("Encountered non-rate-limit error during TTS generation.");
        isPlaying = false;
        return;
      }
    }
  }
  isPlaying = false;
}


async function llmCall(messages, model) {
  const maxRetries = ALL_GROQ_KEYS.length;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await groq.chat.completions.create({
        messages: messages,
        model: model,
      });
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries - 1) {
        rotateGroqKey();
      } else {
        console.error("Groq API error after all retries:", error);
        throw error;
      }
    }
  }
}

module.exports = { handleVoiceConnection };
