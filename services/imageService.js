const { InferenceClient } = require("@huggingface/inference");

const HF_TOKEN = process.env.HF_API_TOKEN;

if (!HF_TOKEN) {
    console.error("HF_API_TOKEN is not set in the .env file. Image generation will not work.");
}

const client = new InferenceClient(HF_TOKEN);

async function generateImage(prompt) {
    try {
        const imageBlob = await client.textToImage({
            model: "stabilityai/stable-diffusion-3-medium-diffusers",
            inputs: prompt,
            parameters: {
                num_inference_steps: 25 
            }
        });

        const arrayBuffer = await imageBlob.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        return imageBuffer;

    } catch (error) {
        console.error("Error generating image with Hugging Face:", error);
        throw new Error(error.message || "Failed to generate image.");
    }
}

module.exports = { generateImage };
