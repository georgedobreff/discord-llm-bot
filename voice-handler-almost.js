// voice-handler.js
// voice-handler.js

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

// --- Directory Setup ---
const USER_SPEECH_DIR = path.join(__dirname, 'user_speech');
const VOICE_HISTORY_DIR = path.join(__dirname, 'voice_history');
const TTS_OUTPUT_DIR = path.join(__dirname, 'tts_output');

async function setupDirectories() {
  try {
    await fs.mkdir(USER_SPEECH_DIR, { recursive: true });
    await fs.mkdir(VOICE_HISTORY_DIR, { recursive: true });
    await fs.mkdir(TTS_OUTPUT_DIR, { recursive: true });
    console.log("✅ Directories for voice handling are ready.");
  } catch (error) {
    console.error("❌ Error creating voice directories:", error);
  }
}
setupDirectories();

// --- Groq API Client & Key Rotation ---
const ALL_GROQ_KEYS = [
  process.env.GROQ_API_KEY1, process.env.GROQ_API_KEY2, process.env.GROQ_API_KEY3,
  process.env.GROQ_API_KEY4, process.env.GROQ_API_KEY5, process.env.GROQ_API_KEY6,
  process.env.GROQ_API_KEY7
].filter(key => key);

if (ALL_GROQ_KEYS.length === 0) {
  console.error("🚨 Please add at least one GROQ_API_KEY to your .env file for voice features.");
}

let currentKeyIndex = 0;
let groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });

function rotateGroqKey() {
  currentKeyIndex = (currentKeyIndex + 1) % ALL_GROQ_KEYS.length;
  console.warn(`⚠️ Groq rate limit hit. Switching to key index: ${currentKeyIndex + 1}/${ALL_GROQ_KEYS.length}`);
  groq = new Groq({ apiKey: ALL_GROQ_KEYS[currentKeyIndex] });
}

// --- Single Session State Management ---
let audioPlayer = null;
let ttsQueue = [];
let isPlaying = false;
let currentConnection = null;
const userRecordingState = new Map(); // <<< FIX: Lock to prevent multiple recordings

function resetState() {
  if (audioPlayer) {
    audioPlayer.stop(true);
    audioPlayer = null;
  }
  ttsQueue = [];
  isPlaying = false;
  currentConnection = null;
  userRecordingState.clear();
  console.log("Voice state has been reset.");
}

// --- Main Voice Connection Handler ---
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
    // --- FIX: Check if we are already recording this user ---
    if (userRecordingState.get(userId)) {
      return; // Ignore if already recording
    }

    const user = interaction.client.users.cache.get(userId);
    if (user && !user.bot) {
      // --- FIX: Set the lock to true ---
      userRecordingState.set(userId, true);
      console.log(`🎤 ${user.username} started speaking. (Recording started)`);

      const audioFilePath = path.join(USER_SPEECH_DIR, `${userId}.wav`);
      const opusStream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.AfterSilence, duration: 1500 },
      });

      const pcmStream = opusStream.pipe(new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }));
      const outStream = fsSync.createWriteStream(audioFilePath);

      pipeline(pcmStream, outStream, (err) => {
        // --- FIX: Release the lock once the file is written ---
        userRecordingState.set(userId, false);
        if (err) {
          console.error(`❌ Error writing audio file for ${user.username}:`, err);
        } else {
          console.log(`🔊 Finished recording for ${user.username}.`);
          processAudio(userId, user.username);
        }
      });
    }
  });
}


async function processAudio(userId, userName) {
  const audioFilePath = path.join(USER_SPEECH_DIR, `${userId}.wav`);

  try {
    // Ensure file has content before sending
    const stats = await fs.stat(audioFilePath);
    if (stats.size === 0) {
      console.warn(`Skipping empty audio file for ${userName}.`);
      return;
    }

    const transcription = await groq.audio.transcriptions.create({
      file: fsSync.createReadStream(audioFilePath),
      model: "whisper-large-v3",
    });
    const transcriptionText = transcription.text;
    console.log(`📝 Transcription for ${userName}: "${transcriptionText}"`);

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      console.log("Transcription is empty, skipping LLM call.");
      return;
    }

    const historyFilePath = path.join(VOICE_HISTORY_DIR, `${userId}.json`);
    let voiceHistory = [];

    try {
      const data = await fs.readFile(historyFilePath, 'utf-8');
      voiceHistory = JSON.parse(data);
    } catch (error) { /* File doesn't exist, will be created. */ }

    voiceHistory.push({ userId, userName, text: transcriptionText });
    const formattedHistory = voiceHistory.map(entry => `${entry.userName}: ${entry.text}`).join('\n');

    const messages = [
      { role: 'system', content: `${config.sharedWaifu} This is the current voice conversation history:\n${formattedHistory}` },
      { role: 'user', content: transcriptionText }
    ];

    const completion = await llmCall(messages, config.llmModel);
    const responseText = completion.choices[0].message.content;
    console.log(`🤖 LLM Response for ${userName}: "${responseText}"`);

    voiceHistory.push({
      userId: 'BOT',
      userName: config.llmName,
      text: responseText
    });
    await fs.writeFile(historyFilePath, JSON.stringify(voiceHistory, null, 2));

    ttsQueue.push(responseText);
    if (!isPlaying) {
      playNextInQueue();
    }

  } catch (error) {
    console.error("❌ Error during audio processing pipeline:", error);
  }
}

async function playNextInQueue() {
  if (isPlaying || ttsQueue.length === 0 || !audioPlayer) {
    return;
  }

  isPlaying = true;
  const textToSpeak = ttsQueue.shift();
  const ttsFilePath = path.join(TTS_OUTPUT_DIR, `tts_output.wav`);

  try {
    const response = await groq.audio.speech.create({
      model: "playai-tts-1",
      voice: "nova",
      input: textToSpeak,
      response_format: "wav",
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(ttsFilePath, buffer);

    const resource = createAudioResource(ttsFilePath, { inputType: StreamType.Arbitrary });
    audioPlayer.play(resource);

  } catch (error) {
    console.error(`❌ Failed to generate or play TTS:`, error);
    isPlaying = false;
    playNextInQueue();
  }
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
