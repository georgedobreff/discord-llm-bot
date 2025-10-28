const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  ActivityType,
  PresenceUpdateStatus,
  Events,
} = require('discord.js');
const fs = require('fs');
const path = require('path');


function fsPromise(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

async function loadInteractionData(lastInteractionTime, interactionFilePath) {
  try {
    const data = await fsPromise(fs.readFile, interactionFilePath, 'utf-8');
    // Clear existing data and set new data from file
    lastInteractionTime.clear();
    const loadedData = Object.entries(JSON.parse(data));
    loadedData.forEach(([key, value]) => lastInteractionTime.set(key, value));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log("Interaction file not found. Initializing new file.");
      await fsPromise(fs.writeFile, interactionFilePath, '{}', 'utf-8');
    } else {
      console.error("Error loading interaction data:", error);
    }
  }
}

async function saveInteractionData(lastInteractionTime, interactionFilePath) {
  try {
    const jsonString = JSON.stringify(Object.fromEntries(lastInteractionTime), null, 2);
    await fsPromise(fs.writeFile, interactionFilePath, jsonString, 'utf-8');
  } catch (error) {
    console.error("❌ Error saving interaction data:", error);
  }
}

async function startBot({ config, delay, calculateDelay, lastInteractionTime, initializeLLM, deployCommands, interactionFilePath }) {

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
  });

  // Load commands
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command)
    } else {
      console.log(`The command ${filePath} is missing a required "data" or "execute" property.`)
    }
  }


  client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    await loadInteractionData(lastInteractionTime, interactionFilePath);
    setInterval(() => saveInteractionData(lastInteractionTime, interactionFilePath), config.idleSave); // Periodic save

    await deployCommands();


    const statusMap = {
      'online': PresenceUpdateStatus.Online,
      'idle': PresenceUpdateStatus.Idle,
      'dnd': PresenceUpdateStatus.DoNotDisturb,
      'invisible': PresenceUpdateStatus.Invisible
    };
    const activityTypeMap = {
      'PLAYING': ActivityType.Playing,
      'WATCHING': ActivityType.Watching,
      'LISTENING': ActivityType.Listening,
      'STREAMING': ActivityType.Streaming,
      'COMPETING': ActivityType.Competing,
      'CUSTOM': ActivityType.Custom
    };

    client.user.setPresence({
      status: statusMap[config.BOT_STATUS || 'online'],
      activities: [{ name: config.ACTIVITY_NAME || 'Discord', type: activityTypeMap[config.ACTIVITY_TYPE || 'PLAYING'] }]
    });

    console.log(`Bot status set to: ${config.BOT_STATUS || 'online'}`);
    console.log(`Bot activity set to: ${config.ACTIVITY_TYPE || 'PLAYING'} ${config.ACTIVITY_NAME || 'with your feelings'}`);
  });


  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`${interaction.commandName} is not a valid command`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Error executing command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Error executing command!', ephemeral: true });
      }
    }
  });

  // Welcome DM From AI upon joining server
  client.on(Events.GuildMemberAdd, async member => {
    const user = member.user;
    const welcomeText = `Hey ${member.displayName} 💋 How are you feeling?`;
    try {
      await user.send(welcomeText);
    } catch (error) {
      console.warn(`Could not send welcome DM to ${member.displayName}. They likely have DMs disabled.`);
    }
  });


  initializeLLM(client, config, delay, calculateDelay, lastInteractionTime);


  try {
    await client.login(process.env.BOT_TOKEN);
  } catch (error) {
    console.error("Failed to log in to Discord:", error);
  }
}

module.exports = { startBot };
