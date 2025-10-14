## Discord AI Waifu

<img src='./Lilly banner.png' height = 250px;>

<br>

**This is a work in progress and a practice project while I'm learning JS**

The end goal is to have a ``` completely free ``` and customizable AI agent with chat, voice and image generation capabilities all inside a discord bot that you can add to your server. 

The bot uses the ```chat.completions``` framework so you can use any provider that supports it.

## Features (so far):

* Private DMs including a welcome DM upon joining a server. <br>
*Note*: ```Discord requires users to share at least 1 common server with the bot for DMs to be initiated.```

* Multi-user conversations in a specific server channel. Skips some messages like a human would.

* Web search via ```/search``` command.

* Artificial delay based on response length to simulate typing.

* Separate configurable personalities for DMs and Server-wide bot.

* Checks up on you after 3 hours of silence.

* API keys rotation to ensure conversation continues after free tier limits are hit.<br>
*``You would need multiple accounts or multiple providers with free tiers for this.If you can afford it by all means just pay to your chosen provider. This feature is here simply to ensure that the bot adheres to the goal of being free without compromising uptime too much.``*<br>
 If you just want one API key simply leave the rest blank.



## Installation: 

### Discord App Setup: 

Visit <a href ='https://discord.com/developers/' target=_blank > Discord Developer Portal </a>, register and create an app.

Go to Bot, Reset Token and make a note of your Bot Token.

Enable Presence Intent, Server Members Intent and Message Content Intent permissions under Priviliged Gateway Intents.
The specific Bot Permissions are up to you but you can just tick Administrator.

Under OAuth2 copy and make a note of the Client ID. Under OAuth2 URL Generator tick "Bot" and copy the link at the bottom. Paste that in your browser and add the bot to your server.

### API Keys:

Go to <a href='https://console.groq.com/home' target = _blank> Groq.com </a> and register an account.

Click API keys top right. Create API key and name it whatever you want. Make a note of the key.

Repeat this whole process as many times as you want. The more API keys you have the longer the rotation can be, ensuring free usage of the models. 

I still recommend you just sign up for the paid tier as Groq are offering a fantastic service and low prices.

### Setting up the bot code:

0. Clone the repo or download and extract zip
1. Make sure you have <a href='https://nodejs.org/en/download' target=_blank >Node.js</a> installed
2. Edit the ```.env.example``` file and add your Bot Token, ClientID, and API key(s) then save the file as ``.env``
3. Open a terminal in the project folder or navigate there
4. Run ```npm install``` to install all dependencies
5. Run ```npm start```

## LLM Customization:

Edit the *config.js* file it is very straightforward.

#### You can:
1. Set the AI's name
2. Set the llm model
3. Set the max prior messages used for chat history
4. Set the max characters for the LLMs response.
5. Set how often the LLM will check-in on you.
6. Set how often to check for inactive users (idleness).
7. Set how often to log idle users.
8. Define the personality for DMs.
9. Define the personality for the server-side waifu.
10. Define the name of the channel where you want the server-side waifu.
11. Define the prompt used to generate the check-in DM message.
12. Set the bot activity and status on Discord.
13. Change the LLM used for web search.


## WARNING!

### The default LLM model can engage in NSFW conversations! You've been warned!

If you don't want that I recommend you use ```openai/gpt-oss-120b``` for a lot stricter content filters or setting restrictions via the personality prompt (not recommended).


### Planned feature updates:
- One-on-One Voice calls using STT-TTS and maybe even in a server vc
- Image generation
- Server commands to perform different tasks like web searches, playing music, image generation, etc.
- Vision capability a.k.a the bot responding to you sharing screen or turning on your camera.

#### *Disclaimer: Exercise discretion when using this bot. I am not responsible for what you do with it.*