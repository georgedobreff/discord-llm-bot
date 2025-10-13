## Discord AI Waifu

**This is a work in progress and a practice project while I'm learning JS**

The end goal is to have a ``` completely free ``` and customizable AI agent with chat, voice and image generation capabilities all inside a discord bot that you can add to your server. 

The bot uses the ```chat.completions``` framework so you can use any provider that supports it.

#### WARNING! ``` The default LLM model can engage in NSFW conversations! You've been warned! ```

I recommend you use ```openai/gpt-oss-120b``` for stricter content filters.

## Features (so far):

* Private DMs including a welcome DM upon joining a server. <br>
* * ```Discord requires users to share at least 1 common server with the bot for DMs to be initiated.```
<br>

* Multi-user conversations in a specific server channel. **
<br>

* Separate configurable personalities for DMs and Server-wide bot.

* Checks up on you after 3 hours of silence.

* API keys rotation to ensure conversation continues after free tier limits are hit.<br>
* * ``` You would need multiple accounts for this.```<br>
* * If you just want one API key simply leave the rest blank.


*I had web search enabled previously but I don't really think it's necessary for this bot so I removed that feature.*



## Installation: 

0. Clone the repo or download and extract zip
1. Make sure you have <a href='https://nodejs.org/en/download'>Node.js</a> installed
2. Edit the ```.env.example``` file and add your keys and IDs, then rename it to just ``.env``
3. Open a terminal in the project folder or navigate there
4. Run ```npm install discord.js dotenv --save groq-sdk```
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


## If you want to host this on an android phone:

I'm running this bot on an old Samsung Galaxy S10e that I'm using for something else anyway so it's always on.

1. Download Termux from the play store. Everything below is done inside the Termux app.
2. ```termux-wake-lock```. This will ensure your Termux session runs in the background without the OS shutting it down.
3. ```pkg update``` and ```pkg upgrade```
4. ```pkg install nodejs```
5. ```pkg install git```
6. ```git clone https://github.com/georgedobreff/discord-ai-chatbot.git```
7. ```cd discord-ai-chatbot```
8. ```nano .env.example``` This is painful to edit on a phone but I believe in you.
9. Save the edited file as .env only and exit the editor
10. Run ```npm install discord.js dotenv --save groq-sdk```
11. Run ```npm start```

It should be obvious that this will drain your battery quickly so I recommend you only do this if you have an old phone you don't use and you can keep plugged in.