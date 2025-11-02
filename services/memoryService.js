const fs = require('fs/promises');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'user_memories');

async function loadMemories(userId) {
  const fileName = `${userId}.json`;
  const memoryFilePath = path.join(MEMORY_DIR, fileName);

  try {
    const data = await fs.readFile(memoryFilePath, 'utf-8');
    const userMemory = JSON.parse(data);

    if (Array.isArray(userMemory) && userMemory.length > 0) {
      const memoryString = userMemory
        .map((entry, index) => `${index + 1}. ${entry.memory}`)
        .join('\n');
      return `\n\n### USER MEMORIES (Crucial Facts to Remember):\n${memoryString}\n###`;
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && error.name !== 'SyntaxError') {
      console.error(`Error loading memory file ${fileName}:`, error);
    }
  }
  return '';
}

module.exports = {
  loadMemories
};
