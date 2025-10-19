# Test Suite

This directory contains comprehensive unit tests for the Discord AI Chatbot.

## Running Tests

```bash
npm install
npm test
```

## Test Coverage

- `voice-handler-gemini-rotation.test.js` - Tests for voice handler with API key rotation
- `waifu.test.js` - Tests for the waifu message handler module
- `config.test.js` - Tests for configuration validation
- `join.test.js` - Tests for the /join command
- `env-example.test.js` - Validation tests for .env.example file

## Test Framework

- **Jest** - Testing framework
- Mocking for external dependencies (Discord.js, Groq SDK, Google Gemini)
- Coverage reporting enabled