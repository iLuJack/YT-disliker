console.log('Background script initialized');

let isProcessing = false;
let processedVideos = new Set();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    if (request.action === 'startProcessing') {
        console.log('Starting processing with URL:', request.channelUrl);
        isProcessing = true;
        processChannel(request.channelUrl);
    } else if (request.action === 'stopProcessing') {
        console.log('Stopping processing');
        isProcessing = false;
    } else if (request.type === 'videoProcessed' || request.type === 'error') {
        console.log('Forwarding message to popup:', request);
        chrome.runtime.sendMessage(request);
    } else if (request.action === 'getProcessingState') {
        sendResponse({ isProcessing: isProcessing });
        return true; // Important: keeps the message channel open for async response
    }
});

async function processChannel(channelUrl) {
    if (!isProcessing) {
        console.log('Processing stopped before starting');
        return;
    }

    try {
        console.log('Creating new tab for channel:', channelUrl);
        const videosUrl = `${channelUrl}/videos`;
        const tab = await chrome.tabs.create({ url: videosUrl, active: false });

        console.log('Waiting for channel page to load');
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                console.log('Channel page loaded, sending message to content script');
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'getVideoUrls' 
                });
            }
        });
    } catch (error) {
        console.error('Error in processChannel:', error);
        chrome.runtime.sendMessage({
            type: 'error',
            error: `Error processing channel: ${error.message}`
        });
    }
}