// utils.js
const utils = {
    // 隨機延遲
    async randomDelay(min = 2000, max = 5000) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(r => setTimeout(r, delay));
    },

    // 檢查是否被 YouTube 限制
    checkRestrictions() {
        const restrictionSigns = [
            'unusual traffic',
            'please try again later',
            'temporary hold'
        ];
        
        const pageText = document.body.innerText.toLowerCase();
        return restrictionSigns.some(sign => pageText.includes(sign));
    },

    // 模擬人類行為
    async simulateHumanBehavior() {
        // 隨機滾動
        window.scrollTo(0, 
            Math.random() * document.documentElement.scrollHeight);
        
        // 隨機暫停
        await this.randomDelay();
        
        // 其他隨機行為...
    }
};