const fs = require('fs');
const path = require('path');

describe('.env.example', () => {
  let envExampleContent;
  let envExampleLines;

  beforeAll(() => {
    const envPath = path.join(__dirname, '../.env.example');
    envExampleContent = fs.readFileSync(envPath, 'utf-8');
    envExampleLines = envExampleContent.split('\n');
  });

  describe('File Structure', () => {
    it('should exist', () => {
      expect(envExampleContent).toBeDefined();
      expect(envExampleContent.length).toBeGreaterThan(0);
    });

    it('should be a text file', () => {
      expect(typeof envExampleContent).toBe('string');
    });

    it('should have multiple lines', () => {
      expect(envExampleLines.length).toBeGreaterThan(1);
    });
  });

  describe('Required Environment Variables', () => {
    it('should document BOT_TOKEN', () => {
      expect(envExampleContent).toMatch(/BOT_TOKEN/);
    });

    it('should document CLIENT_ID', () => {
      expect(envExampleContent).toMatch(/CLIENT_ID/);
    });

    it('should document GROQ API keys', () => {
      expect(envExampleContent).toMatch(/GROQ_API_KEY/);
    });

    it('should document multiple GROQ API keys', () => {
      const groqKeyMatches = envExampleContent.match(/GROQ_API_KEY\d+/g);
      expect(groqKeyMatches).toBeDefined();
      expect(groqKeyMatches.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('New Gemini Configuration', () => {
    it('should document GOOGLE_APPLICATION_CREDENTIALS', () => {
      expect(envExampleContent).toMatch(/GOOGLE_APPLICATION_CREDENTIALS/);
    });

    it('should document Gemini API keys section', () => {
      expect(envExampleContent).toMatch(/Gemini API KEYS/i);
    });

    it('should document GEMINI_API_KEY1', () => {
      expect(envExampleContent).toMatch(/GEMINI_API_KEY1=/);
    });

    it('should document multiple Gemini API keys', () => {
      const geminiKeyMatches = envExampleContent.match(/GEMINI_API_KEY\d+/g);
      expect(geminiKeyMatches).toBeDefined();
      expect(geminiKeyMatches.length).toBeGreaterThanOrEqual(10);
    });

    it('should have Gemini keys numbered from 1 to 10', () => {
      for (let i = 1; i <= 10; i++) {
        expect(envExampleContent).toMatch(new RegExp(`GEMINI_API_KEY${i}=`));
      }
    });

    it('should point to google-credentials.json file', () => {
      expect(envExampleContent).toMatch(/google-credentials\.json/);
    });

    it('should have proper comment for Google Cloud section', () => {
      expect(envExampleContent).toMatch(/Google Cloud Credentials/i);
    });
  });

  describe('Key Format and Consistency', () => {
    it('should use KEY=VALUE format', () => {
      const keyValueLines = envExampleLines.filter(line => 
        line.trim() && !line.trim().startsWith('#')
      );
      
      keyValueLines.forEach(line => {
        expect(line).toMatch(/^[A-Z_0-9]+=/);
      });
    });

    it('should not contain real secrets in API key values (placeholders or empty allowed)', () => {
      const apiKeyLines = envExampleLines.filter(line =>
        line.includes('GROQ_API_KEY') || line.includes('GEMINI_API_KEY')
      );
      const suspiciousPatterns = [
        /[A-Za-z0-9]{32,}/,  // long opaque strings
        /sk-[A-Za-z0-9]+/,   // common secret formats
        /AIza[A-Za-z0-9_-]+/ // Google style keys
      ];
      apiKeyLines.forEach(line => {
        const value = (line.split('=')[1] || '').trim();
        const isPlaceholder = /your|placeholder|example/i.test(value);
        const looksSecret = suspiciousPatterns.some(p => p.test(value));
        expect(looksSecret && !isPlaceholder).toBe(false);
      });
    });

    it('should have consistent numbering for GROQ keys', () => {
      for (let i = 1; i <= 10; i++) {
        expect(envExampleContent).toMatch(new RegExp(`GROQ_API_KEY${i}=`));
      }
    });

    it('should not have gaps in key numbering', () => {
      const groqKeys = envExampleContent.match(/GROQ_API_KEY(\d+)/g);
      const geminiKeys = envExampleContent.match(/GEMINI_API_KEY(\d+)/g);
      
      expect(groqKeys).toBeDefined();
      expect(geminiKeys).toBeDefined();
      
      const groqNumbers = groqKeys.map(k => parseInt(k.match(/\d+/)[0])).sort((a, b) => a - b);
      const geminiNumbers = geminiKeys.map(k => parseInt(k.match(/\d+/)[0])).sort((a, b) => a - b);
      
      // Check consecutive numbering
      for (let i = 0; i < groqNumbers.length - 1; i++) {
        expect(groqNumbers[i + 1] - groqNumbers[i]).toBe(1);
      }
      
      for (let i = 0; i < geminiNumbers.length - 1; i++) {
        expect(geminiNumbers[i + 1] - geminiNumbers[i]).toBe(1);
      }
    });
  });

  describe('Comments and Documentation', () => {
    it('should have comments explaining sections', () => {
      const commentLines = envExampleLines.filter(line => 
        line.trim().startsWith('#')
      );
      
      expect(commentLines.length).toBeGreaterThan(0);
    });

    it('should have comment for Google Cloud section', () => {
      const googleCloudComment = envExampleLines.find(line =>
        line.includes('Google Cloud') && line.trim().startsWith('#')
      );
      
      expect(googleCloudComment).toBeDefined();
    });

    it('should have comment for Gemini API keys section', () => {
      const geminiComment = envExampleLines.find(line =>
        line.toLowerCase().includes('gemini') && 
        line.toLowerCase().includes('api') &&
        line.trim().startsWith('#')
      );
      
      expect(geminiComment).toBeDefined();
    });
  });

  describe('Line Formatting', () => {
    it('should not have trailing spaces on empty value lines', () => {
      const apiKeyLines = envExampleLines.filter(line =>
        (line.includes('GROQ_API_KEY') || line.includes('GEMINI_API_KEY')) &&
        !line.includes('GOOGLE_APPLICATION_CREDENTIALS')
      );
      
      apiKeyLines.forEach(line => {
        expect(line).not.toMatch(/=\s+$/);
      });
    });

    it('should have blank lines between sections', () => {
      const groqSectionEnd = envExampleLines.findIndex(line => 
        line.includes('GROQ_API_KEY10')
      );
      const geminiSectionStart = envExampleLines.findIndex(line =>
        line.includes('Google Cloud Credentials')
      );
      
      expect(geminiSectionStart).toBeGreaterThan(groqSectionEnd);
      
      // Check for blank lines between
      const between = envExampleLines.slice(groqSectionEnd + 1, geminiSectionStart);
      const hasBlankLines = between.some(line => line.trim() === '');
      expect(hasBlankLines).toBe(true);
    });
  });

  describe('Security Best Practices', () => {
    it('should not contain actual API keys', () => {
      // Check for patterns that look like real keys
      const suspiciousPatterns = [
        /[A-Za-z0-9]{32,}/,  // Long alphanumeric strings
        /sk-[A-Za-z0-9]+/,    // OpenAI style keys
        /AIza[A-Za-z0-9_-]+/  // Google API keys
      ];
      
      const nonCommentLines = envExampleLines.filter(line =>
        !line.trim().startsWith('#') && line.includes('=')
      );
      
      nonCommentLines.forEach(line => {
        const value = line.split('=')[1];
        if (value && value.trim() !== '' && !value.includes('.json')) {
          suspiciousPatterns.forEach(pattern => {
            expect(value).not.toMatch(pattern);
          });
        }
      });
    });

    it('should provide example path for credentials file', () => {
      const credentialsLine = envExampleLines.find(line =>
        line.includes('GOOGLE_APPLICATION_CREDENTIALS')
      );
      
      expect(credentialsLine).toBeDefined();
      expect(credentialsLine).toMatch(/\.json/);
    });
  });

  describe('Completeness', () => {
    it('should have all required Discord configuration', () => {
      expect(envExampleContent).toMatch(/BOT_TOKEN/);
      expect(envExampleContent).toMatch(/CLIENT_ID/);
    });

    it('should have all required LLM configuration', () => {
      expect(envExampleContent).toMatch(/GROQ_API_KEY/);
      expect(envExampleContent).toMatch(/GEMINI_API_KEY/);
    });

    it('should have all required TTS configuration', () => {
      expect(envExampleContent).toMatch(/GOOGLE_APPLICATION_CREDENTIALS/);
      expect(envExampleContent).toMatch(/GEMINI_API_KEY/);
    });

    it('should document at least 10 keys for rotation', () => {
      const groqKeys = envExampleContent.match(/GROQ_API_KEY\d+/g);
      const geminiKeys = envExampleContent.match(/GEMINI_API_KEY\d+/g);
      
      expect(groqKeys.length).toBeGreaterThanOrEqual(10);
      expect(geminiKeys.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('New Features in Branch', () => {
    it('should reflect changes from main branch', () => {
      // Gemini keys should be present (new feature)
      expect(envExampleContent).toMatch(/GEMINI_API_KEY/);
      
      // Google credentials should be documented
      expect(envExampleContent).toMatch(/GOOGLE_APPLICATION_CREDENTIALS/);
    });

    it('should maintain backward compatibility', () => {
      // Original GROQ keys should still be present
      expect(envExampleContent).toMatch(/GROQ_API_KEY1/);
      expect(envExampleContent).toMatch(/BOT_TOKEN/);
    });
  });
});