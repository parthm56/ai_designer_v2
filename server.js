const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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
    const model = process.env.IMAGE_GEN_MODEL || 'black-forest-labs/FLUX.1-schnell';

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
            steps: 4, // Schnell is fast, 4 steps is usually enough
            n: 1,
            response_format: 'b64_json'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Together AI Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.data && data.data[0].b64_json) {
        if (isTransparent) {
            return removeBackground(`data:image/jpeg;base64,${data.data[0].b64_json}`);
        }   
        return `data:image/jpeg;base64,${data.data[0].b64_json}`;
    } else {
        throw new Error("Invalid response from Together AI");
    }
}

// Placeholder function for background removal since @imgly/background-removal-node has issues
async function removeBackground(imageBase64) {
    console.log("Skipping local background removal due to library issues.");
    // For now, return the original image since the library is causing errors
    // In the future, this could be replaced with a working background removal service
    return imageBase64;
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
        
        const processedImageUrl = await removeBackground(imageUrl);
        res.json({ url: processedImageUrl });
    } catch (error) {
        console.error('Error removing background:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
