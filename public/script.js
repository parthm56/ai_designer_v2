document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const userInput = document.getElementById('user-input');
    const posterContainer = document.getElementById('poster-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingText = document.getElementById('loading-text');

    generateBtn.addEventListener('click', async () => {
        const requirements = userInput.value.trim();
        if (!requirements) {
            alert('Please enter your requirements first.');
            return;
        }

        // Reset state
        posterContainer.innerHTML = '';
        generateBtn.disabled = true;
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = 'Generating layout with Gemini...';

        try {
            // Step 1: Generate Layout
            const layoutResponse = await fetch('/api/generate-layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requirements })
            });

            if (!layoutResponse.ok) throw new Error('Failed to generate layout');
            
            const layoutData = await layoutResponse.json();
            posterContainer.innerHTML = layoutData.html;

            // Step 2: Process Images
            const images = posterContainer.querySelectorAll('img[x-prompt]');
            if (images.length > 0) {
                loadingText.textContent = `Generating ${images.length} images...`;
                
                for (let i = 0; i < images.length; i++) {
                    const img = images[i];
                    const prompt = img.getAttribute('x-prompt');
                    const isTransparent = img.getAttribute('transparent') === 'true';
                    const width = img.width || img.clientWidth || 300; // Default or computed width
                    const height = img.height || img.clientHeight || 300;

                    console.log({
                        'width' : width,
                        'height' : height,
                        'prompt' : prompt,
                        'isTransparent' : isTransparent
                    });
                    loadingText.textContent = `Generating image ${i + 1} of ${images.length}...`;

                    try {
                        // Generate Image
                        const imageResponse = await fetch('/api/generate-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt, width, height, isTransparent })
                        });

                        if (!imageResponse.ok) throw new Error('Failed to generate image');
                        const imageData = await imageResponse.json();
                        let imageUrl = imageData.url;

                        // Remove Background if requested
                        /*if (isTransparent) {
                            loadingText.textContent = `Removing background for image ${i + 1}...`;
                            const bgResponse = await fetch('/api/remove-bg', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageUrl })
                            });
                            
                            if (bgResponse.ok) {
                                const bgData = await bgResponse.json();
                                imageUrl = bgData.url;
                            }
                        }*/

                        // Update Image
                        img.src = imageUrl;
                        img.setAttribute('data-x-image-generated', '1');
                        
                    } catch (imgError) {
                        console.error('Error processing image:', imgError);
                        img.alt = 'Image generation failed';
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while generating the flyer. Please try again.');
        } finally {
            loadingIndicator.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });
});
