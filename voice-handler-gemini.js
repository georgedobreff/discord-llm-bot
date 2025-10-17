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
const textToSpeech = require('@google-cloud/text-to-speech');

const ttsClient = new textToSpeech.TextToSpeechClient();

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

// GROQ KEYS
const ALL_GROQ_KEYS = [
  process.env.GROQ_API_KEY1, process.env.GROQ_API_KEY2, process.env.GROQ_API_KEY3,
  process.env.GROQ_API_KEY4, process.env.GROQ_API_KEY5, process.env.GROQ_API_KEY6,
  process.env.GROQ_API_KEY7
].filter(key => key);

if (ALL_GROQ_KEYS.length === 0) {
  console.error("Add at least one GROQ_API_KEY to your .env file for voice features.");
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
const userRecordingState = new Map();

function resetState() {
  if (audioPlayer) {
    audioPlayer.stop(true);
  }
  audioPlayer = null;
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
    if (userRecordingState.get(userId)) {
      return;
    }

    const user = interaction.client.users.cache.get(userId);
    if (user && !user.bot) {
      userRecordingState.set(userId, true);
      console.log(`🎤 ${user.username} started speaking. (Recording started)`);

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
          console.error(`❌ Error writing WAV file for ${user.username}:`, err);
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
    const stats = await fs.stat(audioFilePath);
    const fileSizeInBytes = stats.size;
    const minimumFileSize = 12288; // 12KB

    if (fileSizeInBytes < minimumFileSize) {
      console.warn(`🗑️ Discarding silent/short audio file for ${userName}. Size: ${fileSizeInBytes} bytes.`);
      return;
    }

    const transcription = await groq.audio.transcriptions.create({
      file: fsSync.createReadStream(audioFilePath),
      model: "whisper-large-v3",
    });
    const transcriptionText = transcription.text;
    console.log(`📝 Transcription for ${userName}: "${transcriptionText}"`);

    if (!transcriptionText || transcriptionText.trim().length === 0 || transcriptionText === " you" || transcriptionText === " Thank you.") {
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
      { role: 'system', content: `${config.voiceWaifu} This is the current voice conversation history:\n${formattedHistory}` },
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

    // Clean text of asterisks *before* sending to TTS
    const cleanedTextForTTS = responseText.replace(/\*.*?\*/g, '').trim();

    if (cleanedTextForTTS) {
      ttsQueue.push(cleanedTextForTTS);
      if (!isPlaying) {
        playNextInQueue();
      }
    }

  } catch (error) {
    console.error("❌ Error during audio processing pipeline:", error);
  }
}

// <<< THIS FUNCTION IS NOW UPDATED FOR GEMINI-TTS >>>
async function playNextInQueue() {
  if (isPlaying || ttsQueue.length === 0 || !audioPlayer) {
    return;
  }

  isPlaying = true;
  const textToSpeak = ttsQueue.shift();
  const ttsFilePath = path.join(TTS_OUTPUT_DIR, `tts_output.wav`); // Google TTS outputs WAV as LINEAR16

  try {
    // Construct the Google TTS request
    const request = {
      prompt: 'Do NOT use EMOJIS!!! Speak with emotion based on what you are saying.',
      input: { text: textToSpeak },
      // This is a Gemini "Studio" voice. 
      // You can find a full list here: https://cloud.google.com/text-to-speech/docs/voices-list
      voice: { languageCode: 'en-US', name: 'en-US-Chirp-HD-F' },
      audioConfig: {
        audioEncoding: 'LINEAR16', // This is a .wav format
        sampleRateHertz: 24000 // Studio voices use 24000Hz
      },
    };

    // Performs the text-to-speech request
    const [response] = await ttsClient.synthesizeSpeech(request);

    // Write the binary audio content to a local file
    await fs.writeFile(ttsFilePath, response.audioContent, 'binary');
    console.log(`🔊 Google Gemini-TTS (Studio) audio file saved.`);

    const resource = createAudioResource(ttsFilePath, { inputType: StreamType.Arbitrary });
    audioPlayer.play(resource);

  } catch (error) {
    console.error(`❌ Failed to generate or play Google TTS:`, error);
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
