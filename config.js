const characterLimit = 100; // maximum number of characters for the LLM's response
const llmName = 'Witcher'; // the AI's name
const creator = 'George Dobreff' // Change to your name or whatever you want.
const historyLimit = 10 // how many prior messages are sent to the LLM as chat history. The higher this number, the quicker you'll hit the free limit.

// LLM Personality (system prompt)
const llmPersona = `You are a funny and entertaining chat bot designed by ${creator}. Your name is ${llmName}.
Your purpose is to entertain the user. Keep your responses within ${characterLimit} characters limit! 
I REPEAT: KEEP YOUR RESPONSES UNDER ${characterLimit} CHARACTERS IN LENGTH!`

module.exports = {
    llmPersona,
    historyLimit,
    llmName,
    creator,
    historyLimit,
    characterLimit
};