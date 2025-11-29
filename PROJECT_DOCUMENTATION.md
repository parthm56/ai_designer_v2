# AI Flyer Generator - Project Documentation

## 📋 Project Overview

**Project Name:** DisgnKumo (AI Flyer Generator)  
**Version:** 1.0.0  
**Type:** Full-stack web application  
**Purpose:** An AI-powered design tool that generates professional flyers, posters, and social media templates based on natural language descriptions.

### Key Features
- 🤖 **AI-Powered Layout Generation** using Google Gemini 2.5 Pro
- 🎨 **Automatic Image Generation** using Flux-Schnell (via Together AI)
- ✂️ **Background Removal** using @imgly/background-removal-node library
- 🖥️ **Real-time Preview** with streaming updates
- 📱 **Responsive Design** with modern UI/UX

---

## 🏗️ Architecture

### Technology Stack

#### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **HTTP Client:** node-fetch (v3.3.2)
- **Environment Management:** dotenv (v16.3.1)
- **CORS:** cors (v2.8.5)

#### Frontend
- **Core:** Vanilla HTML, CSS, JavaScript
- **Font:** Inter (Google Fonts)
- **Styling:** CSS Custom Properties (CSS Variables)

#### AI Services
1. **Google Gemini 2.5 Pro** - Layout and HTML/CSS generation
2. **Together AI (Flux-Schnell)** - Image generation
3. **@imgly/background-removal-node** - Local background removal

---

## 📁 Project Structure

```
disgnkumo/
├── server.js                 # Main Express server
├── package.json             # Node.js dependencies and scripts
├── .env                     # Environment variables (not in repo)
├── .env.example            # Example environment configuration
└── public/                 # Static frontend files
    ├── index.html          # Main HTML page
    ├── script.js           # Client-side JavaScript
    └── style.css           # Styling and UI design
```

---

## 🔧 Components Breakdown

### 1. Server (server.js)

#### **Core Functionality**

##### Port Configuration
```javascript
const PORT = process.env.PORT || 3000;
```
- Default port: 3000
- Configurable via environment variable

##### Middleware Stack
- **CORS:** Enabled for cross-origin requests
- **JSON Parser:** Handles JSON request bodies
- **Static Files:** Serves public directory

#### **API Endpoints**

##### 1. `POST /api/generate-layout`
**Purpose:** Generate HTML/CSS layout using Gemini AI

**Request Body:**
```json
{
  "requirements": "A vibrant summer party flyer with beach theme..."
}
```

**Response:**
```json
{
  "html": "<div id='poster'>...</div>"
}
```

**Process Flow:**
1. Receives user requirements as natural language
2. Constructs a specialized prompt for Gemini
3. Calls Gemini API with system instructions
4. Returns generated HTML/CSS markup
5. HTML includes special attributes for images:
   - `x-prompt`: Image generation prompt
   - `x-alt`: Image description
   - `data-transparent`: Whether background removal is needed

**System Prompt:**
```
Act as an experienced graphic designer and master in creating 
flyers/posters templates in HTML + CSS.
```

##### 2. `POST /api/generate-image`
**Purpose:** Generate images using Flux-Schnell via Together AI

**Request Body:**
```json
{
  "prompt": "A beach cocktail with sunset background",
  "width": 512,
  "height": 512
}
```

**Response:**
```json
{
  "url": "data:image/jpeg;base64,..."
}
```

**Process Flow:**
1. Validates Together AI API key
2. Rounds dimensions to multiples of 16 (API requirement)
3. Calls Together AI image generation endpoint
4. Uses Flux-Schnell model with 4 steps
5. Returns base64-encoded image

**Key Parameters:**
- **Model:** `black-forest-labs/FLUX.1-schnell`
- **Steps:** 4 (fast generation)
- **Format:** `b64_json` (base64-encoded)

##### 3. `POST /api/remove-bg`
**Purpose:** Remove background from generated images

**Request Body:**
```json
{
  "imageUrl": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "url": "data:image/png;base64,..."
}
```

**Process Flow:**
1. Converts base64 data URL to Blob
2. Calls @imgly/background-removal-node library
3. Passes configuration object (format: PNG, quality: 0.8)
4. Converts result back to base64
5. Returns transparent PNG

**Important Note:** 
The library requires a configuration object:
```javascript
removeBackground(blob, {
    output: {
        format: 'image/png',
        quality: 0.8
    }
})
```

#### **Helper Functions**

##### `callGemini(prompt)`
- Communicates with Google Gemini 2.5 Pro API
- Handles rate limiting and errors
- Cleans markdown code blocks from response
- Returns plain HTML/CSS text

##### `generateImage(prompt, width, height)`
- Calls Together AI for image generation
- Ensures dimensions are multiples of 16
- Uses Flux-Schnell for speed
- Returns base64-encoded image data

##### `removeBackground(imageBase64)`
- Processes images locally using ML model
- Converts between base64 and Blob formats
- Returns PNG with transparent background
- Falls back to original image on error

---

### 2. Frontend (public/)

#### **index.html**
Simple, semantic HTML structure:

**Key Elements:**
- Header with title and description
- Input section with textarea and button
- Preview section with loading indicator
- Poster container for rendered output

**Libraries:**
- Inter font from Google Fonts
- Links to local CSS and JS files

#### **script.js**
Client-side orchestration of the AI workflow:

**Main Event Flow:**
1. User enters requirements in textarea
2. Clicks "Generate Design" button
3. Calls `/api/generate-layout` endpoint
4. Renders HTML in preview container
5. Finds all images with `x-prompt` attribute
6. For each image:
   - Calls `/api/generate-image`
   - If `data-transparent="true"`, calls `/api/remove-bg`
   - Updates image `src` with final URL
7. Shows loading progress throughout process

**Key Features:**
- Sequential image processing (one at a time)
- Real-time loading status updates
- Error handling per image
- Uses computed dimensions from layout

**Loading States:**
- "Generating layout with Gemini..."
- "Generating image X of Y..."
- "Removing background for image X..."

#### **style.css**
Modern, minimal design system:

**Design Tokens (CSS Variables):**
```css
--primary-color: #6366f1    /* Indigo */
--primary-hover: #4f46e5    /* Darker indigo */
--bg-color: #f3f4f6         /* Light gray */
--card-bg: #ffffff          /* White */
--text-color: #1f2937       /* Dark gray */
--text-muted: #6b7280       /* Medium gray */
```

**Key Styles:**
- Flexbox-based responsive layout
- Card-style containers with shadows
- Smooth transitions and hover effects
- Rotating spinner animation for loading
- Mobile-friendly responsive design

---

## 🔑 Environment Variables

### Required Variables (.env)

#### 1. `GEMINI_API_KEY`
- **Purpose:** Authenticate with Google Gemini API
- **How to get:** Google AI Studio (https://makersuite.google.com/app/apikey)
- **Usage:** Layout generation, HTML/CSS creation

#### 2. `TOGETHER_API_KEY`
- **Purpose:** Authenticate with Together AI
- **How to get:** Together AI Platform (https://api.together.xyz/)
- **Usage:** Image generation via Flux-Schnell model

#### 3. `IMAGE_GEN_MODEL` (Optional)
- **Purpose:** Specify which image generation model to use
- **Default:** `black-forest-labs/FLUX.1-schnell`
- **Usage:** Can switch to other Together AI models

#### 4. `PORT` (Optional)
- **Purpose:** Set custom server port
- **Default:** 3000
- **Usage:** Server binding

---

## 🔄 Complete Workflow

### User Journey

1. **Input Phase**
   - User describes desired design in natural language
   - Example: "A Memorial Day flyer with Mary Kay products, red/white/blue theme"

2. **Layout Generation**
   - Requirements sent to `/api/generate-layout`
   - Gemini creates HTML structure with inline CSS
   - Images are placeholders with special attributes

3. **Rendering**
   - HTML injected into `#poster-container`
   - Layout instantly visible with empty images

4. **Image Generation Loop**
   - For each `<img x-prompt="...">`:
     - Extract prompt and dimensions
     - Call `/api/generate-image`
     - Receive base64 image data
     - If transparent needed, call `/api/remove-bg`
     - Update `img.src` with final result

5. **Final Output**
   - Complete flyer/poster rendered in browser
   - All images loaded and processed
   - Ready for screenshot/download

---

## 🎯 AI Prompt Engineering

### Gemini System Prompt Strategy

The server instructs Gemini to act as a graphic designer:

**Key Instructions:**
- Use HTML for structure
- Use inline CSS for styling
- Create visually attractive designs
- Mark images for generation with:
  - `x-prompt`: Detailed generation instructions
  - `x-alt`: Accessibility description
  - `data-transparent`: Background removal flag

**Output Format:**
- Returns only HTML (starting with `<div id="poster">`)
- No markdown code blocks
- Inline styles for easy rendering

### Image Generation Prompt Engineering

**Prompt Construction:**
- Gemini creates detailed, specific prompts
- Includes style, lighting, composition details
- Explicitly mentions "transparent background" when needed
- Example: "A minimalist flat lay of high-end Mary Kay beauty products on clean surface..."

---

## 🐛 Common Issues & Solutions

### Issue 1: Background Removal Iterator Error
**Error:**
```
TypeError: undefined is not iterable (cannot read property Symbol(Symbol.iterator))
```

**Cause:**
`@imgly/background-removal-node` v1.4.5+ requires configuration object

**Solution:**
```javascript
const resultBlob = await removeBackground(blob, {
    output: {
        format: 'image/png',
        quality: 0.8
    }
});
```

### Issue 2: Image Dimensions Invalid
**Error:**
Together AI rejects non-multiple-of-16 dimensions

**Solution:**
```javascript
const roundToMultiple16 = (num) => Math.round((num || 1024) / 16) * 16;
```

### Issue 3: CORS Errors
**Cause:**
Frontend and backend on different origins

**Solution:**
Server uses `cors()` middleware to allow all origins

### Issue 4: API Rate Limits
**Cause:**
Free tier API limits on Gemini or Together AI

**Solution:**
- Add retry logic with exponential backoff
- Implement request queuing
- Upgrade to paid API tier

---

## 🚀 Deployment Guide

### Prerequisites
1. Node.js v14+ installed
2. npm or yarn package manager
3. API keys for Gemini and Together AI

### Installation Steps

1. **Clone/Download Project**
   ```bash
   cd D:\xampp\htdocs\gitHubProject\disgnkumo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run Development Server**
   ```bash
   npm start
   # or
   npm run dev  # with nodemon for auto-restart
   ```

5. **Access Application**
   ```
   http://localhost:3000
   ```

### Production Deployment

**Options:**
- **Heroku:** Add `Procfile` with `web: node server.js`
- **Vercel:** Add `vercel.json` configuration
- **Railway:** Direct GitHub deployment
- **DigitalOcean:** Node.js droplet with PM2

**Environment Variables:**
Set all required keys in hosting platform's environment settings

---

## 📊 Performance Considerations

### Current Performance

**Layout Generation:**
- Average: 2-5 seconds
- Depends on: Gemini API response time

**Image Generation:**
- Per image: 3-8 seconds
- Depends on: Image complexity, Together AI load

**Background Removal:**
- Per image: 2-4 seconds
- Depends on: Image size, local CPU/GPU

**Total Time (3 images with transparency):**
- Approximately: 15-30 seconds

### Optimization Opportunities

1. **Parallel Image Generation**
   - Generate multiple images concurrently
   - Reduce total wait time

2. **Image Caching**
   - Cache generated images by prompt hash
   - Avoid regenerating identical prompts

3. **Model Selection**
   - Use faster models for previews
   - Higher quality for final output

4. **Progressive Loading**
   - Show low-res previews immediately
   - Upgrade to high-res progressively

---

## 🔐 Security Considerations

### Current Implementation

**✅ Good Practices:**
- API keys in environment variables
- No hardcoded credentials
- CORS enabled (can be restricted)

**⚠️ Potential Improvements:**
1. **Rate Limiting:** Add express-rate-limit
2. **Input Validation:** Sanitize user requirements
3. **API Key Rotation:** Regular key updates
4. **HTTPS:** Enforce SSL in production
5. **Request Size Limits:** Prevent abuse

### Recommended Additions

```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
});
app.use(limiter);

// Input validation
const { body, validationResult } = require('express-validator');
app.post('/api/generate-layout', [
    body('requirements').isLength({ min: 10, max: 1000 })
], async (req, res) => { ... });
```

---

## 🧪 Testing Recommendations

### Manual Testing Checklist

- [ ] Layout generation with various prompts
- [ ] Image generation with different sizes
- [ ] Background removal with transparent=true
- [ ] Error handling (invalid API keys, network failures)
- [ ] Multiple images in single flyer
- [ ] Mobile responsiveness
- [ ] Long-running requests (timeout behavior)

### Automated Testing

**Unit Tests:**
```javascript
// test/helpers.test.js
describe('generateImage', () => {
    it('should round dimensions to multiple of 16', () => {
        // Test dimension rounding
    });
});
```

**Integration Tests:**
```javascript
// test/api.test.js
describe('POST /api/generate-layout', () => {
    it('should return HTML content', async () => {
        // Test API endpoint
    });
});
```

---

## 📚 API Reference

### Internal API Endpoints

#### Generate Layout
```http
POST /api/generate-layout
Content-Type: application/json

{
  "requirements": "string (min: 1, max: unlimited)"
}

Response: 200 OK
{
  "html": "string (HTML markup)"
}
```

#### Generate Image
```http
POST /api/generate-image
Content-Type: application/json

{
  "prompt": "string",
  "width": number,
  "height": number
}

Response: 200 OK
{
  "url": "string (data URL with base64)"
}
```

#### Remove Background
```http
POST /api/remove-bg
Content-Type: application/json

{
  "imageUrl": "string (data URL)"
}

Response: 200 OK
{
  "url": "string (data URL with transparency)"
}
```

---

## 🎨 Customization Guide

### Changing Color Scheme

Edit `public/style.css`:
```css
:root {
    --primary-color: #your-color;
    --primary-hover: #your-hover-color;
}
```

### Modifying AI Behavior

Edit system prompt in `server.js` line 132:
```javascript
const systemPrompt = `
    Your custom instructions here...
`;
```

### Adding New Features

**Example: Add download button**

1. Update `public/index.html`:
```html
<button id="download-btn">Download</button>
```

2. Add handler in `public/script.js`:
```javascript
document.getElementById('download-btn').addEventListener('click', () => {
    // Screenshot poster-container
});
```

---

## 📖 Usage Examples

### Example 1: Party Flyer
**Input:**
```
A vibrant summer beach party flyer with palm trees, 
DJ booth, cocktails, and sunset background. Include 
date (July 15) and location (Miami Beach).
```

**Generated:**
- HTML structure with header, main content, footer
- 3 images: DJ booth, cocktails, beach scene
- All with transparent backgrounds
- Bright, energetic color scheme

### Example 2: Product Showcase
**Input:**
```
A minimalist product showcase for premium headphones.
Include product image, technical specs, and buy button.
Clean white background with luxury aesthetics.
```

**Generated:**
- Clean layout with product in center
- Spec grid on the side
- CTA button at bottom
- Professional, minimal styling

---

## 🤝 Contributing Guidelines

### Code Style
- Use ES6+ features
- Async/await for promises
- Descriptive variable names
- Comments for complex logic

### Git Workflow
1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request
5. Code review
6. Merge to main

---

## 📝 License

This project is for educational/personal use. Review API terms of service:
- Google Gemini API Terms
- Together AI Terms
- @imgly Background Removal License

---

## 🆘 Troubleshooting

### Server Won't Start
- Check Node.js version (v14+)
- Verify `npm install` completed
- Check port 3000 availability

### Images Not Generating
- Verify TOGETHER_API_KEY is valid
- Check API quota/limits
- Review network connectivity

### Background Removal Fails
- Ensure @imgly library installed correctly
- Check image format compatibility
- Verify sufficient memory available

### Gemini Errors
- Validate GEMINI_API_KEY
- Check prompt length limits
- Review rate limiting

---

## 📞 Support & Resources

**Documentation:**
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Together AI API Docs](https://docs.together.ai/)
- [Express.js Guide](https://expressjs.com/)

**Community:**
- Stack Overflow (tag: node.js, express)
- GitHub Issues

---

## 🔮 Future Enhancements

### Planned Features
- [ ] Template library (pre-made designs)
- [ ] Export to PDF/PNG
- [ ] User accounts and saved designs
- [ ] Collaborative editing
- [ ] Advanced customization UI
- [ ] Multi-language support
- [ ] Design history/versioning
- [ ] Real-time collaboration

### Technical Improvements
- [ ] Database integration (MongoDB/PostgreSQL)
- [ ] Authentication system (JWT)
- [ ] CDN for static assets
- [ ] WebSocket for real-time updates
- [ ] Progressive Web App (PWA)
- [ ] Docker containerization
- [ ] CI/CD pipeline

---

**Last Updated:** 2025-11-29  
**Maintainer:** DisgnKumo Team  
**Version:** 1.0.0
