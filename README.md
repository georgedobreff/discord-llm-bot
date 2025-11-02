# 💖Lilly💖 - Discord AI Bot

<img src='./Lilly banner.png' align="center" width="100%">

<br>

This a **completely free** and customizable AI Discord bot with chat, voice, search and vision capabilities.

### <a href="https://discord.gg/fDdpWm3Ab8" target="_blank"> See it in action in the Tavern 🍻 </a>


The bot uses the ```chat.completions``` framework so you can use any provider that supports it.

I use this project to practice JavaScript while I'm studying it. Feel free to contribute :)



# Features


* Group chat with conversation awareness inside a specific server channel.

* Group voice call with conversation awareness.

* Sees and understands images and GIFs.

* Understands context of replies including to images/gifs.

* Direct Messages support for private conversations with users.

* Memory system which allows the user to customize the LLM to their liking (available only in DMs to protect personal information). Used with slash commands `/remember`, `/forget`, `/memories` (lists all stored memories).

* Web search via slash command `/search`

    #### Quality of life features

    * Artificial delay based on response length to simulate realistic typing.

    * Separate configurable personalities for DMs and Server AI.

    * Checks up on users after 12 hours of silence.(via DM)

    * Conversation evaluator to prevent the LLM from responding to every single message. Implemented for voice calls too.

    * Fallback too GoogleTTS if Gemini-TTS rate limit is hit for voice calls.

    #### Optional

    * API keys rotation to ensure conversation continues after free tier limits are hit.<br>
    *This feature is here simply to ensure that the bot adheres to the goal of being free without compromising uptime too much. **Creating multiple accounts is against the Groq.com Terms of Service and Acceptable Use Policy**. I am not responsible for your actions.*
    
    * Trigger phrase for voice calls. Listens for a phrase like "Hey Lilly" before it responds. 

<br>



# Installation

## Prerequisites

### Discord App Setup

- Visit <a href ='https://discord.com/developers/' target=_blank > Discord Developer Portal </a>, register and create an app.

- Go to `Bot`, `Reset Token` and **make a note** of your `Bot Token`.

- Enable `Presence Intent`, `Server Members Intent` and `Message Content Intent` permissions under *Priviliged Gateway Intents*.
- The specific Bot Permissions are up to you but you can just tick `Administrator`.

- Under *OAuth2* copy and **make a note** of the `Client ID`. 
- Under *OAuth2 URL Generator* tick `Bot` and copy the link at the bottom. Paste that in your browser and add the bot to your server.

### Groq API Key

- Go to <a href='https://console.groq.com/home' target = _blank> Groq.com </a> and register an account.

- Click `API keys` top right. `Create API key` and name it whatever you want.
- Make a note of the API key.


### Google TTS

- Visit <a href='https://console.cloud.google.com/welcome/new?project' target=_blank> Google Cloud Console</a> and create a new project.

- Enable the API: In your project, search for and enable the "Cloud Text-to-Speech API."

    #### Create a Service Account:

    * Go to `IAM & Admin` > `Service Accounts`.

    * Click `Create Service Account`. Give it any name (e.g., "discord-bot").

    * Grant it the `Cloud Text-to-Speech User` role.

    * Click `Done`. Then, find your new service account, click the `three dots` under `Actions`, and select `Manage keys`.

    * Click `Add Key` > `Create new key`. Choose `JSON` and create it. A .json key file will be downloaded.

    #### Set Environment Variable:

    * Move the downloaded JSON key file into the project's `root` directory.
    * Rename it to `google-credentials.json`

### Gemini TTS

* Go to <a href='https://aistudio.google.com/' target=_blank> Google AI Studio</a>

* Log in and click `Get API key` in the bottom left.

* Click `Create API key in new project` (or use an existing one).

* Make a note of the API key somewhere.

<br>

## Setting up 💖Lilly💖

- Clone the repo or download and extract zip
- Make sure you have <a href='https://nodejs.org/en/download' target=_blank >Node.js</a> installed
- Download and Install <a href="https://www.ffmpeg.org/download.html" targe="_blank">ffmpeg</a> or use your package manager (eg. `sudo pacman -S ffmpeg`)
- Edit the ```.env.example``` file and add your Bot Token, ClientID, and API key then save the file as ``.env``
- Open a terminal in the project folder or navigate there
- `npm install` to install all dependencies
- `npm start` to launch the bot.

    ### Customization

    Edit the `config.js` file to customize the bot.

    #### Here's what you can change there

    - LLM name
    - LLM model
    - Character limits
    - Time before LLM checks up on a user via DM (idle timer)
    - System prompt for the check up (affects how the LLM messages the user)
    - Personality prompts for DMs, Server chat, Voice chat and Web Search responses
    - TTS instructions for tone and emotion.
    - Trigger phrase for voice calls. Disabled by default.


# Roadmap

- [ ] Add support for multiple simultaneous voice channels
    - [ ] Including support for multiple simultaneous servers and channels
- [ ] Add image generation capability
- [ ] Explore the possibility of LLM "seeing" shared screen in VC.
- [ ] Explore the possibility of LLM "seeing" user's camera feed.


## ⚠ WARNING ⚠

### The default model can and will engage in NSFW conversations if prompted by the user!

If you don't want that I recommend you use `openai/gpt-oss-120b` for a lot stricter content filters or setting restrictions via the personality prompt (not recommended).

