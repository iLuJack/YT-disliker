console.log('Content script loaded');

// 監聽來自 background script 的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    if (request.action === 'getVideoUrls') {
        console.log('Starting to process videos');
        processVideos();
    }
});

async function processVideos() {
    console.log('Scrolling to bottom of page');
    await scrollToBottom();

    console.log('Getting video elements');
    const videoRenderers = document.querySelectorAll('#video-title-link');
    const urls = [...new Set(Array.from(videoRenderers).map(link => {
        return 'https://www.youtube.com' + link.getAttribute('href');
    }))];

    console.log('Found unique video URLs:', urls);

    const videos = urls.map(url => {
        // Find the corresponding link element
        const linkElement = Array.from(videoRenderers).find(link => 
            url.endsWith(link.getAttribute('href'))
        );
        // Get title from the formatted string element inside the link
        const titleElement = linkElement ? linkElement.querySelector('#video-title') : null;
        const title = titleElement ? titleElement.textContent.trim() : 'Unknown Title';
        
        return {
            url: url,
            title: title
        };
    });

    console.log('Video Details:');
    videos.forEach((video, index) => {
        console.log(`\nVideo ${index + 1}:`);
        console.log(`URL = ${video.url}`);
        console.log(`Title = ${video.title}`);
        console.log('-'.repeat(50));
    });

    console.log(`\nTotal videos to process: ${videos.length}`);
    
    // Process all videos initially
    let failedVideos = await processVideoBatch(videos);

    // Retry failed videos
    while (failedVideos.length > 0) {
        console.log(`Retrying ${failedVideos.length} failed videos...`);
        failedVideos = await processVideoBatch(failedVideos);
    }
}

async function processVideoBatch(videos) {
    const failedVideos = [];
    
    for (const video of videos) {
        try {
            const isProcessing = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: 'getProcessingState' }, response => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    if (!response) {
                        reject(new Error('No response from background script'));
                        return;
                    }
                    resolve(response.isProcessing);
                });
            });

            if (!isProcessing) {
                console.log('Processing stopped by user');
                return failedVideos;
            }

            const success = await processVideo(video);
            if (!success) {
                failedVideos.push(video);
            }

            // Add delay between attempts
            const delay = Math.random() * 4000 + 3000;
            console.log(`Waiting ${Math.round(delay/1000)} seconds before next video...`);
            await new Promise(r => setTimeout(r, delay));

        } catch (error) {
            console.error('Error processing video:', error);
            failedVideos.push(video);
        }
    }
    
    return failedVideos;
}

async function processVideo(video) {
    try {
        console.log(`Processing video: ${video.title}`);
        
        // Extract video ID from URL
        const videoId = video.url.split('v=')[1];
        if (!videoId) {
            throw new Error('Could not extract video ID');
        }

        // Send dislike request directly
        const response = await fetch(`https://www.youtube.com/youtubei/v1/like/dislike`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SAPISIDHASH ${await getAuthToken()}`,
                'X-Origin': 'https://www.youtube.com'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240214',
                        hl: "en",
                        gl: "US",
                    }
                },
                target: {
                    videoId: videoId
                }
            }),
            credentials: 'include'
        });

        // Log detailed response information
        console.log(`Response status: ${response.status}`);
        console.log(`Response status text: ${response.statusText}`);
        
        try {
            const responseData = await response.text();
            console.log('Response data:', responseData);
        } catch (e) {
            console.log('Could not parse response data');
        }

        if (response.ok) {
            console.log(`Successfully disliked video: ${video.title}`);
            chrome.runtime.sendMessage({
                type: 'videoProcessed',
                title: `Disliked: ${video.title}`
            });
            
            const delay = Math.random() * 4000 + 3000;
            console.log(`Waiting ${Math.round(delay/1000)} seconds before next video...`);
            await new Promise(r => setTimeout(r, delay));
            
            return true;
        } else {
            console.warn(`Failed to dislike video: ${video.title}`);
            console.warn(`Response status: ${response.status}`);
            console.warn(`Headers:`, Object.fromEntries(response.headers));
            
            chrome.runtime.sendMessage({
                type: 'error',
                error: `Failed to dislike ${video.title}: ${response.statusText} (${response.status})`
            });
            return false;
        }

    } catch (error) {
        console.error(`Error processing video ${video.title}:`, error);
        console.error('Error stack:', error.stack);
        chrome.runtime.sendMessage({
            type: 'error',
            error: `Error processing ${video.title}: ${error.message}`
        });
        return false;
    }
}

// Helper function to get authentication token
async function getAuthToken() {
    const SAPISID = document.cookie.split(';').find(c => c.trim().startsWith('SAPISID='))?.split('=')[1];
    if (!SAPISID) {
        throw new Error('Not logged in to YouTube');
    }
    
    const origin = 'https://www.youtube.com';
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const digest = await crypto.subtle.digest(
        'SHA-1',
        new TextEncoder().encode(`${timestamp} ${SAPISID} ${origin}`)
    );
    const hash = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    return `${timestamp}_${hash}`;
}

async function scrollToBottom() {
    console.log('Starting scroll to bottom');
    let lastHeight = document.documentElement.scrollHeight;
    let scrollCount = 0;
    
    return new Promise(resolve => {
        const interval = setInterval(() => {
            window.scrollTo(0, document.documentElement.scrollHeight);
            scrollCount++;
            console.log(`Scroll attempt ${scrollCount}`);
            
            const newHeight = document.documentElement.scrollHeight;
            if (newHeight === lastHeight) {
                console.log('Reached bottom of page');
                clearInterval(interval);
                resolve();
            }
            lastHeight = newHeight;
        }, 1000);
    });
}