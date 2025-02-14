document.addEventListener('DOMContentLoaded', function() {
    console.log('Popup initialized');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const status = document.getElementById('status');
    const channelUrl = document.getElementById('channelUrl');
    const logContainer = document.getElementById('logContainer');

    // 載入儲存的頻道 URL
    chrome.storage.local.get(['channelUrl'], function(result) {
        console.log('Loading saved channel URL:', result.channelUrl);
        if (result.channelUrl) {
            channelUrl.value = result.channelUrl;
        }
    });

    // 監聽來自 content script 的訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Received message in popup:', message);
        if (message.type === 'videoProcessed') {
            console.log('Video processed successfully:', message.title);
            addLogEntry(message.title, 'success');
        } else if (message.type === 'error') {
            console.error('Error in video processing:', message.error);
            addLogEntry(message.error, 'error');
        }
    });

    function addLogEntry(text, type) {
        console.log(`Adding log entry: ${type} - ${text}`);
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = text;
        logContainer.insertBefore(entry, logContainer.firstChild);

        if (logContainer.children.length > 50) {
            console.log('Removing old log entry');
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    startBtn.addEventListener('click', function() {
        const url = channelUrl.value;
        console.log('Start button clicked with URL:', url);
        
        if (!url) {
            console.warn('No channel URL provided');
            status.textContent = 'Please enter a channel URL';
            return;
        }

        console.log('Saving channel URL and starting processing');
        chrome.storage.local.set({ channelUrl: url });
        chrome.runtime.sendMessage({
            action: 'startProcessing',
            channelUrl: url
        });

        status.textContent = 'Processing started...';
        logContainer.innerHTML = '';
    });

    stopBtn.addEventListener('click', function() {
        console.log('Stop button clicked');
        chrome.runtime.sendMessage({ action: 'stopProcessing' });
        status.textContent = 'Processing stopped';
    });
});