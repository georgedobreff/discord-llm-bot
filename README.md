## Discord AI Bot

**This is a work in progress**

The end goal is to have a **completely free** AI agent with chat, web search, voice and image generation capabilities all inside a discord bot that you can add to your server.

I'm doing this so I can practice JS and LLM implementation while making something cool.

## Features (so far):

### DM Features:
1. Direct Messages with the bot, powered by ChatGPT.
2. The A.I. remembers the last 10 messages from your conversation.
3. The bot is capable of performing a web search.
4. Max character limit for the LLM response to keep it fast.

### Server Commands:
1. ping. used for testing.

more commands to come soon.

## How to install:

0. Clone the repo or download and extract zip (duh)
1. Make sure you have <a href='https://nodejs.org/en/download'>Node.js</a> installed
2. Edit the *.env.example* file and add your keys and IDs, then rename it to just *.env*
3. Open a terminal in the project folder
4. Run ```npm start```

## LLM Customization:

Edit the *config.js* file it is very straightforward.

#### You can:
1. Set the AI's name
2. Change the creator's name
3. Set the max prior messages used for chat history
4. Set the max characters for the LLMs response.