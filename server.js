const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { imageDecode, removeBackground } = require('@imgly/background-removal-node');
const sharp = require("sharp");
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper to call Gemini API
async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0].content) {
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```html/g, '').replace(/```/g, '');
        return text;
    } else {
        throw new Error("Invalid response structure from Gemini API");
    }
}

// Helper to call Together AI (Flux-Schnell)
async function generateImage(prompt, width, height, isTransparent) {
    width = width < 64 ? 64 : width;
    height = height < 64 ? 64 : height;
    console.log({
        'prompt' : prompt,
        'width' : width,
        'height' : height,
        'isTransparent' : isTransparent
    });
    const apiKey = process.env.TOGETHER_API_KEY;
    const model = 'black-forest-labs/FLUX.1-schnell-Free';

    if (!apiKey) {
        throw new Error("TOGETHER_API_KEY is not set.");
    }

    // Together AI requires dimensions to be multiples of 16
    // Round to nearest multiple of 16
    const roundToMultiple16 = (num) => Math.round((num || 1024) / 16) * 16;
    const validWidth = roundToMultiple16(width);
    const validHeight = roundToMultiple16(height);

    // Together AI standard image generation endpoint
    const url = 'https://api.together.xyz/v1/images/generations';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            width: validWidth,
            height: validHeight,
            n: 1,
            output_format: 'png',
            response_format: 'base64'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Together AI Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.data && data.data[0].b64_json) {
        if (isTransparent) {
            return removeBackgroundFun(data.data[0].b64_json);
        }   
        return `data:image/jpeg;base64,${data.data[0].b64_json}`;
    } else {
        throw new Error("Invalid response from Together AI");
    }
}

// Helper to remove background using @imgly/background-removal-node
async function removeBackgroundFun(imageBase64) {
    console.log("Starting background removal (local)...");
    try {
        // Convert Base64 to a Node.js Buffer (which is a Uint8Array)
        const inputBuffer = Buffer.from(imageBase64, 'base64');

        // Process the image
        console.log("Processing image...");
        const outputBuffer = await removeBackground(inputBuffer); 
        console.log("Background removed.");

        // Convert the resulting Uint8Array back to a Base64 string
        // The output format from @imgly/background-removal-node is always a PNG 
        // (to preserve transparency).
        const outputBase64 = Buffer.from(outputBuffer).toString('base64');
        // Add the appropriate PNG data URL header back
        const outputDataUrl = `data:image/png;base64,${outputBase64}`;
        return outputDataUrl;
    } catch (error) {
        console.error("Local background removal failed:", error);
        console.error("Error details:", error.message, error.stack);
        // Fallback - return original image since local background removal is not working
        console.log("Returning original image as fallback");
        return imageBase64;
    }
}

// Endpoint to generate layout
app.post('/api/generate-layout', async (req, res) => {
    try {
        const { requirements } = req.body;
        
        const systemPrompt = `Act as a Senior Art Director and Frontend Developer. Your task is to produce HTML \`<div>\` code for a professional, theme-accurate flyer. You must:


1. Explore creative size selection strategies based on content and theme; ensure clarity and balance in your choices.
2. All imagery must clearly connect to the flyer’s subject.
3. Align and pad text and visuals for a clean, professional, and balanced layout.
4. Scale or wrap text so all content fits within the flyer boundaries with no clipping.
5. Use spacing creatively to avoid empty or crowded areas, ensuring the design feels complete and engaging.
6. Explore innovative design concepts, utilizing multiple layering techniques, opacity adjustments, and custom shapes.
8. If the user provides an emoji in the topic but does not specify its inclusion, do not add it to the design.
9. The HTML output must only contain \`<div>\` elements without any JavaScript implementation.
10. *For visual elements*: 
        * use a background image or background gradient color and transparent-friendly sticker and consider layering techniques to enhance the design.
        * Visual elements must be represented by \`<img>\` tags with empty src, attribute x-prompt which value will be have the prompt to generate the image/sticker, attribute transparent which value will be true or false base on it's visual requirements.
        * Every visual element must align with the flyer's content , theme and each other.
11. Use Google fonts to improve font design throughout the flyer.
12. Every text must wrap in \`span\` tags, and the \`span\` should include a data attribute named data-font-url with the Google font link for the respective font family and font weight.
13. Every \`<div>\`, \`<img>\`, \`<span>\` must have a \`z-index\` property defined (not auto).
14. The \`<span>\` tag, which wraps around the text, must not give any type of styling property; only the z-index property is allowed.


Output only HTML that renders the flyer entirely within a \`<div>\` element.`;

        const fullPrompt = `${systemPrompt}\n\nUser Requirements: ${requirements}`;

        const htmlContent = await callGemini(fullPrompt);
        res.json({ html: htmlContent });

    } catch (error) {
        console.error('Error generating layout:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to generate image
app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, width, height, isTransparent } = req.body;
        console.log(`Generating image for prompt: ${prompt}`);

        const imageUrl = await generateImage(prompt, width, height, isTransparent);
        res.json({ url: imageUrl });
    } catch (error) {
        console.error('Error generating image:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to remove background
app.post('/api/remove-bg', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        console.log(`Removing background...`);

        // Check if imageUrl is a data URL and extract base64 part if so
        let base64Data;
        if (imageUrl.startsWith('data:image')) {
            // Data URL format: data:image/png;base64,iVBORw0KGgo...
            base64Data = imageUrl.split(',')[1];
        } else {
            // Assume it's already base64
            base64Data = imageUrl;
        }

        base64Data = "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";
        // Convert Base64 string to a Uint8Array (Node.js Buffer)
        const inputBuffer = Buffer.from(base64Data, 'base64');
        const sharpImage = sharp(inputBuffer);
        const { data, info } = await sharpImage.raw().toBuffer({ resolveWithObject: true });
        // Convert raw Buffer → Uint8Array
        const rawBytes = new Uint8Array(data);
        console.log("Processing image...");
         const output = await removeBackground({
            data: rawBytes,
            width: info.width,
            height: info.height
        });
        const outputPngBuffer = await sharp(Buffer.from(output), {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4
            }
        }).png().toBuffer();
        const outputBase64 = outputPngBuffer.toString("base64");
        console.log("Background removed.");
        const outputDataUrl = `data:image/png;base64,${outputBase64}`;
        res.json({ url: outputDataUrl });
    } catch (error) {
        console.error('Error removing background:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
