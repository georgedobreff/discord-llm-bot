require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes} = require('discord.js');
const deployCommands = async () => {
    try {
        const commands = [];
        const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            if ('data' in command && 'execute' in command){
                commands.push(command.data.toJSON());
            } else {
                console.log(`WARNING: The command at ${file} is missing a property.`);
            }
        }
    
    const rest = new REST().setToken(process.env.BOT_TOKEN);

    console.log(`Started refreshing ${commands.length} application slash commands globally.`);

    const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
    );

    console.log('Successfully reloaded all commands');
    } catch (error) {
        console.error(error)
    }
}


const { 
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    ActivityType,
    PresenceUpdateStatus,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles){
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command){
        client.commands.set(command.data.name, command)
    } else {
        console.log(`The command ${filePath} is missing a required "data" or "execute" property.`)
    }
}
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Deploy Commands
    await deployCommands();
    console.log('Commands deployed globally.');

    const statusType = process.env.BOT_STATUS || 'online';
    const activityType = process.env.ACTIVITY_TYPE || 'PLAYING';
    const activityName = process.env.ACTIVITY_NAME || 'Discord';

    const activityTypeMap = {
        'PLAYING' : ActivityType.Playing,
        'WATCHING' : ActivityType.Watching,
        'LISTENING' : ActivityType.Listening,
        'STREAMING' : ActivityType.Streaming,
        'COMPETING' : ActivityType.Competing
    };


    const statusMap = {
        'online' : PresenceUpdateStatus.Online,
        'idle' : PresenceUpdateStatus.Idle,
        'dnd' : PresenceUpdateStatus.DoNotDisturb,
        'invisible' : PresenceUpdateStatus.Invisible
    };

    client.user.setPresence({
        status: statusMap[statusType],
        activities: [{
            name: activityName,
            type: activityTypeMap[activityType],
        }]
    });

    console.log(`Bot status set to: ${statusType}`);
    console.log(`Bot activity set to: ${activityType} ${activityName}`);
})


client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`${interaction.commandName} is not a valid command`)
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({content: 'Error executing command!', ephemeral: true})
        } else {
            await interaction.reply({content: 'Error executing command!', ephemeral: true})
        }
    }
});

client.login(process.env.BOT_TOKEN);