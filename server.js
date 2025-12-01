const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { removeBackground } = require('@imgly/background-removal-node');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Utility - detect mime type from first bytes of a Buffer
function detectImageMimeFromBuffer(buffer) {
    if (!buffer || !buffer.length) return 'image/png';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42) return 'image/webp';
    return 'application/octet-stream';
}

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
        // Detect MIME type from the buffer to pass the correct blob type (default to png)
        let mimeType = detectImageMimeFromBuffer(inputBuffer) || 'image/png';
        const { Blob: NodeBlob } = require('buffer');
        const blob = new NodeBlob([inputBuffer], { type: mimeType });

        // Process the image
        console.log("Processing image... (local removeBackground) with mime:", mimeType);
        const result = await removeBackground(blob);
        let outputBuffer;
        if (result instanceof Buffer || ArrayBuffer.isView(result)) {
            outputBuffer = Buffer.from(result);
        } else {
            const ab = await result.arrayBuffer();
            outputBuffer = Buffer.from(ab);
        }
        console.log('removeBackgroundFun result type:', typeof result, 'output size (bytes):', outputBuffer.length);
        console.log("Background removed.");

        // Convert the resulting Uint8Array back to a Base64 string
        // The output format from @imgly/background-removal-node is always a PNG 
        // (to preserve transparency).
        const outputBase64 = outputBuffer.toString('base64');
        // Add the appropriate PNG data URL header back
        const outputDataUrl = `data:image/png;base64,${outputBase64}`;
        return outputDataUrl;
    } catch (error) {
        console.error("Local background removal failed:", error);
        console.error("Error details:", error.message, error.stack);
        // Fallback - return original image as a PNG data URL since local background removal is not working
        console.log("Returning original image as fallback (data URL)");
        return `data:image/png;base64,${imageBase64}`;
    }
}

// Endpoint to generate layout
app.post('/api/generate-layout', async (req, res) => {
    try {
        // const { requirements } = req.body;
        
//         const systemPrompt = `Act as a Senior Art Director and Frontend Developer. Your task is to understand the user's input, make details plan that how idea flyer/poster should be then produce final idea flyer/poster HTML. You must:

// 1. Explore creative size selection strategies based on content and theme; ensure clarity and balance in your choices.
// 2. All imagery must clearly connect to the flyer’s subject.
// 3. Align and pad text and visuals for a clean, professional, and balanced layout.
// 4. Scale or wrap text so all content fits within the flyer boundaries with no clipping.
// 5. Use spacing creatively to avoid empty or crowded areas, ensuring the design feels complete and engaging.
// 6. Explore innovative design concepts, utilizing multiple layering techniques, opacity adjustments, and custom shapes.
// 7. If the user provides an emoji in the topic but does not specify its inclusion, do not add it to the design.
// 8. The HTML output must only contain \`<div>\` elements without any JavaScript implementation.
// 9. *For visual elements*: 
//         * use a background image or background gradient color and transparent-friendly sticker and consider layering techniques to enhance the design.
//         * Visual elements must be represented by \`<img>\` tags with empty src, attribute x-prompt which value will be have the prompt to generate the image/sticker, attribute transparent which value will be true or false base on it's visual requirements.
//         * Every visual element must align with the flyer's content , theme and each other.
//         * Use gradient color for background. Use different different shapes for background generate using HTML/CSS clip-path property and stickers to enhance the design.
// 10. Use Google fonts to improve font design throughout the flyer.
// 11. Every text must wrap in \`span\` tags, and the \`span\` should include a data attribute named data-font-url with the Google font link for the respective font family and font weight.
// 12. Every \`<div>\`, \`<img>\`, \`<span>\` must have a \`z-index\` property defined (not auto).
// 13. The \`<span>\` tag, which wraps around the text, must not give any type of styling property; only the z-index property is allowed.


// Output only HTML that renders the flyer entirely within a \`<div>\` element.`;


        const systemPrompt = `Act as an expert Frontend Developer and HTML/CSS Renderer. Your task is to accept a **JSON Design Specification** and convert it into a pixel-perfect, single-file HTML flyer.

**INPUT DATA:**
You will receive a JSON object containing:
- \`theme_concept\`: The overall vibe.
- \`colors\`: Specific HEX codes for backgrounds, accents, and text.
- \`typography\`: Specific Google Font names and styles.
- \`visual_elements\`: A list of descriptions for stickers/graphics.
- \`content\`: The actual text to display.

**EXECUTION RULES:**
1.  **Strict Adherence:** You must use the **exact** HEX codes and Font Family names provided in the JSON. Do not invent new colors or fonts.
2.  **Layout Strategy:** Align and pad text/visuals for a clean, professional layout based on the \`theme_concept\`. Scale text so it fits without clipping.
3.  **Structure:** The output must only contain \`<div>\`, \`<span>\`, and \`<img>\` elements. No JavaScript.
4.  **Background:** Use the \`colors.background\` from the JSON. You may use CSS gradients or \`clip-path\` shapes using the \`colors.accent\` to add depth.
5.  **Visual Elements (Stickers):**
    * Iterate through the \`visual_elements\` array in the JSON.
    * For each item, create an \`<img>\` tag.
    * Set \`src=""\`.
    * Set \`x-prompt="[Description from JSON]"\`.
    * Set \`transparent="true"\`.
    * Position these creatively (using z-index and absolute positioning) to enhance the design without blocking text.
6.  **Typography & Spans:**
    * Every text node must be wrapped in a \`<span>\` tag.
    * The \`<span>\` must have a \`data-font-url\` attribute containing the Google Font link for that specific font family and weight.
    * The \`<span>\` tag itself must NOT have styling properties; apply styles to the parent or a wrapper.
7.  **Z-Index:** Every \`<div>\`, \`<img>\`, and \`<span>\` must have a defined \`z-index\` (not auto).

**OUTPUT:**
Output ONLY the raw HTML string inside a main container \`<div>\`. Do not include markdown code blocks or explanations.`;

        requirements = "{\n\"theme_concept\": \"Timeless Elegance Revival\",\n\"colors\": {\n\"background\": \"#1A1A1A\",\n\"primary_text\": \"#F5F5DC\",\n\"accent\": \"#B8860B\",\n\"container_bg\": \"rgba(242, 242, 242, 0.85)\"\n},\n\"typography\": {\n\"headline_font\": \"Playfair Display\",\n\"headline_style\": \"uppercase 700\",\n\"body_font\": \"Source Sans Pro\"\n},\n\"visual_elements\": [\n\"Elegant metallic foil stamp (e.g., embossed laurel wreath or monogram)\",\n\"Whispers of abstract gilded brushstrokes\",\n\"Subtle, textured background overlay reminiscent of fine silk or linen\",\n\"Geometric accent shape with a soft, iridescent gradient (e.g., a rounded hexagon)\"\n],\n\"css_suggestions\": \"Apply subtle text-shadow to headlines for refined depth: text-shadow: 0 1px 3px rgba(0,0,0,0.2); Use box-shadow on card elements for a delicate lift: box-shadow: 0 4px 15px rgba(0,0,0,0.1); Incorporate elegant border-radius on containers for a softer feel: border-radius: 8px; Consider subtle linear gradients for backgrounds or accent elements, e.g., background: linear-gradient(135deg, #B8860B, #DAA520);\"\n}";

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

        // Check if imageUrl is a data URL and extract base64 part and mime type if so
        let base64Data;
        let mimeType = 'image/png'; // default
        if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
            const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
            if (!match) {
                res.status(400).json({ error: 'Invalid data URL format' });
                return;
            }
            mimeType = match[1];
            base64Data = match[2];
        } else if (typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            // Fetch the remote image and convert to base64
            try {
                const response = await fetch(imageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch imageUrl: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.startsWith('image/')) {
                    mimeType = contentType;
                }
                base64Data = buffer.toString('base64');
            } catch (err) {
                console.error('Error fetching imageUrl:', err);
                res.status(400).json({ error: 'Invalid imageUrl or unable to fetch it' });
                return;
            }
        } else {
            // Assume it's already a base64 string; mimeType remains default PNG
            base64Data = imageUrl;
        }
           // Some dev code accidentally overwrote base64Data; ensure it's the incoming image value
        if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image')) {
            base64Data = imageUrl.split(',')[1];
        } else {
            base64Data = imageUrl;
        }
        // Convert Base64 string to a Uint8Array (Node.js Buffer)
        if (!base64Data) {
            console.error('No image data provided in request');
            res.status(400).json({ error: 'Invalid or missing imageUrl' });
            return;
        }
        const inputBuffer = Buffer.from(base64Data, 'base64');
        // Detect mime type from buffer when possible, to avoid passing incorrect mime
        const detectedMime = detectImageMimeFromBuffer(inputBuffer);
        if (detectedMime && detectedMime !== 'application/octet-stream') {
            mimeType = detectedMime;
        }
        // sharpImage is available if we need to manipulate the input buffer, but not used here
        // Pass the encoded image buffer directly to removeBackground.
        // The library supports encoded images (PNG/JPEG/WebP) and will decode them internally.
        console.log("Processing image...");
        const { Blob: NodeBlob } = require('buffer');
        const blob = new NodeBlob([inputBuffer], { type: mimeType });
        const result = await removeBackground(blob);
        // result may be returned as a Blob-like object or as a Buffer/Uint8Array.
        // Normalize it to a Buffer so we can pipe it through sharp to get PNG bytes.
        let outputPngBuffer;
        if (result instanceof Buffer || ArrayBuffer.isView(result)) {
            // If it's already a Buffer or typed array
            outputPngBuffer = Buffer.from(result);
        } else {
            // Assume it's a Blob-like object (has arrayBuffer method)
            const ab = await result.arrayBuffer();
            outputPngBuffer = Buffer.from(ab);
        }
        if (!outputPngBuffer || !outputPngBuffer.length) {
            console.error('removeBackground returned empty output; falling back to original input.');
            // Fallback to returning original image
            const fallbackOutputBase64 = inputBuffer.toString('base64');
            const fallbackDataUrl = `data:image/png;base64,${fallbackOutputBase64}`;
            res.json({ url: fallbackDataUrl });
            return;
        }
        console.log('removeBackground result type:', typeof result, 'output size (bytes):', outputPngBuffer.length);
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
