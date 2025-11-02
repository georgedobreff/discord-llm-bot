const {
  GoogleGenAI
} = require('@google/genai');
const wav = require('wav');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const config = require('../config.js');
const ttsClient = new textToSpeech.TextToSpeechClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let genAI;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenAI(GEMINI_API_KEY);
    console.log("Gemini client initialized with single API Key.");
  } catch (initError) {
    console.error("🚨 Error initializing Gemini client:", initError);
    genAI = null; // Ensure client is null if init fails
  }
} else {
  console.warn("🚨 No GEMINI_API_KEY found. Using Google Cloud TTS for all TTS requests.");
  genAI = null;
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

// Fallback function
async function _generateAndSaveGoogleTTS(textToSpeak, ttsFilePath) {
  console.log("Attempting fallback to Google Cloud TTS...");
  try {
    //cleanup the tone instructions when using google tts
    const cleanedText = textToSpeak.replace(/Say .*?:/g, '').replace(/\*.*?\*/g, '').trim();

    const request = {
      prompt: `${config.ttsPrompt}`,
      input: { text: cleanedText },
      voice: { languageCode: 'en-US', name: 'en-US-Chirp-HD-F' },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 24000
      },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    await fs.writeFile(ttsFilePath, response.audioContent, 'binary');
  } catch (googleError) {
    console.error(`🚨 CRITICAL: Primary Gemini TTS failed AND Google Cloud TTS fallback also failed:`, googleError);
    throw googleError; // Re-throw the error if the fallback also fails
  }
}

async function generateAndSaveTTS(textToSpeak, ttsFilePath) {
  if (!genAI) {
    console.warn("Gemini unavailable. Fallback to Google TTS");
    await _generateAndSaveGoogleTTS(textToSpeak, ttsFilePath);
    return;
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{
        parts: [{
          text: textToSpeak
        }]
      }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore'
            },
          },
        },
      },
    });

    let data;
    if (response &&
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].content &&
      response.candidates[0].content.parts &&
      response.candidates[0].content.parts[0] &&
      response.candidates[0].content.parts[0].inlineData &&
      response.candidates[0].content.parts[0].inlineData.data) {

      data = response.candidates[0].content.parts[0].inlineData.data;

    } else {
      throw new Error("No audio data received from Gemini-TTS despite successful API call.");
    }

    const audioBuffer = Buffer.from(data, 'base64');
    await saveWaveFile(ttsFilePath, audioBuffer);
    return;

  } catch (error) {
    console.error(`Failed Gemini TTS generation:`, error.message);

    if (error.status === 429 || error.status === 403) {
      console.warn("Gemini TTS rate limit hit. Fallback to Google Cloud TTS.");
    } else {
      console.warn("Error during TTS generation. Fallback to Google TTS");
    }

    // Immediately fall back to Google TTS
    await _generateAndSaveGoogleTTS(textToSpeak, ttsFilePath);
  }
}

module.exports = {
  generateAndSaveTTS,
};
