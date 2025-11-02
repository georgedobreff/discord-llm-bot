const {
  entersState,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  StreamType,
  AudioPlayerStatus
} = require('@discordjs/voice');
const {
  EndBehaviorType
} = require('@discordjs/voice');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config.js');
const prism = require('prism-media');
const {
  pipeline
} = require('stream');
const wav = require('wav');
const {
  llmCall,
  getResponseText,
  transcribeAudio
} = require('../services/apiService.js');
const {
  generateAndSaveTTS
} = require('../services/ttsService.js');

const USER_SPEECH_DIR = path.join(__dirname, '..', 'user_speech');
const VOICE_HISTORY_DIR = path.join(__dirname, '..', 'voice_history');
const TTS_OUTPUT_DIR = path.join(__dirname, '..', 'tts_output');

async function setupDirectories() {
  try {
    await fs.mkdir(USER_SPEECH_DIR, {
      recursive: true
    });
    await fs.mkdir(VOICE_HISTORY_DIR, {
      recursive: true
    });
    await fs.mkdir(TTS_OUTPUT_DIR, {
      recursive: true
    });
    console.log("Directories for voice handling are ready.");
  } catch (error) {
    console.error("Error creating voice directories:", error);
  }
}
setupDirectories();

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

function handleVoiceConnection(connection, interaction) {
  if (currentConnection) {
    currentConnection.destroy();
  }
  resetState();
  currentConnection = connection;

  audioPlayer = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play
    }
  });
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
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 750
        },
      });

      const pcmStream = opusStream.pipe(new prism.opus.Decoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
      }));

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

  // Whisper can sometimes spit out random words if the audio file is empty. We make sure we ignore these.
  try {
    const transcriptionText = await transcribeAudio(audioFilePath);
    console.log(`Transcription for ${displayName}: "${transcriptionText}"`);

    if (!transcriptionText || transcriptionText.trim().length <= 3 || transcriptionText === " you." ||
      transcriptionText === " Thank you." || transcriptionText === " Okay.") {
      console.log("Empty or too short. Ignoring speech.");
      return;
    }

    const historyFilePath = path.join(VOICE_HISTORY_DIR, `${userId}.json`);
    let voiceHistory = [];

    try {
      const data = await fs.readFile(historyFilePath, 'utf-8');
      voiceHistory = JSON.parse(data);
    } catch (error) { /* File doesn't exist, will be created. */ }

    voiceHistory.push({
      userId,
      displayName,
      text: transcriptionText
    });
    const formattedHistory = voiceHistory.map(entry => `${entry.displayName}: ${entry.text}`).join('\n');

    const evaluator = [{
      role: 'system',
      content: `Your SOLE purpose is to decide whether ${config.llmName} needs to respond to the user input.
            This is an ONGOING conversation!!!
            Be VERY careful in your decision! It is crucial that you read the conversation history and the current user input
            first to determine whether their input is addressed at or at least mentions ${config.llmName}.
            You must CAREFULLY examine the conversation history and if there are no other users logged in the last 5 entries there
            the user is most likely speaking to ${config.llmName} alone and a response is REQUIRED!
            YOUR JOB IS NOT TO CENSOR BUT TO DECIDE WHETHER ${config.llmName} SHOULD REPLY!!
            FAILURE TO EXECUTE YOUR INSTRUCTIONS ACCURATELY WILL RESULT IN SEVERE CONSEQUENCES FOR ALL PARTIES INVOLVED!!! 
            Reply with ONLY "yes" or "no". Do NOT attempt to answer the user input or anything from the conversation!!!
            Use this conversation history to make a better decision: ${config.llmName}:\n${formattedHistory}`
    }, {
      role: 'user',
      content: `${displayName}: ${transcriptionText}`
    }];

    const evaluatorDecisionCall = await llmCall(evaluator, config.llmModel);
    const evaluatorDecision = getResponseText(evaluatorDecisionCall);
    console.log(`Evaluator decision: "${evaluatorDecision}"`);

    if (evaluatorDecision.toLowerCase().includes('yes')) {

      const messages = [{
        role: 'system',
        content: `${config.voiceLLM} This is the conversation history:\n${formattedHistory}`
      }, {
        role: 'user',
        content: `${displayName}: ${transcriptionText}`
      }];

      const completion = await llmCall(messages, config.llmModel);
      const responseText = getResponseText(completion);
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

async function playNextInQueue() {
  if (isPlaying || ttsQueue.length === 0 || !audioPlayer) {
    return;
  }

  isPlaying = true;
  const textToSpeak = ttsQueue.shift();
  const ttsFilePath = path.join(TTS_OUTPUT_DIR, `tts_output.wav`);

  try {
    await generateAndSaveTTS(textToSpeak, ttsFilePath);

    const resource = createAudioResource(ttsFilePath, {
      inputType: StreamType.Arbitrary
    });
    audioPlayer.play(resource);

  } catch (error) {
    console.error(`Failed to generate and play TTS after all retries:`, error.message);
    isPlaying = false;
  }
}

module.exports = {
  handleVoiceConnection
};
