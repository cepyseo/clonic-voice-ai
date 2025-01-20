class VoiceAssistant {
    constructor() {
        this.recordButton = document.getElementById('recordButton');
        this.statusDiv = document.getElementById('status');
        this.responseDiv = document.getElementById('response');
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.setupRecognition();
        this.setupEventListeners();
        this.isListening = false;
    }

    setupRecognition() {
        this.recognition.continuous = false;
        this.recognition.lang = 'tr-TR';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript;
            this.statusDiv.textContent = 'Söylediğiniz: ' + text;
            await this.processCommand(text);
        };

        this.recognition.onerror = (event) => {
            this.statusDiv.textContent = 'Hata oluştu: ' + event.error;
            this.toggleListening();
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.toggleListening();
            }
        };
    }

    setupEventListeners() {
        this.recordButton.addEventListener('click', () => this.toggleListening());
    }

    toggleListening() {
        if (this.isListening) {
            this.recognition.stop();
            this.recordButton.classList.remove('listening');
            this.statusDiv.textContent = 'Başlamak için mikrofona tıklayın';
        } else {
            this.recognition.start();
            this.recordButton.classList.add('listening');
            this.statusDiv.textContent = 'Dinleniyor...';
        }
        this.isListening = !this.isListening;
    }

    async processCommand(text) {
        try {
            // AI API'sine istek at
            const aiResponse = await fetch(`https://apilonic.netlify.app/api?prompt=${encodeURIComponent(text)}`);
            const aiData = await aiResponse.json();

            if (aiData.success) {
                // Emojileri temizle ve AI yanıtını hazırla
                const cleanResponse = aiData.response.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]/gu, '');
                
                // Önce ses API'sine istek at
                const voiceUrl = `https://tssvoice.istebutolga.workers.dev/?message=${encodeURIComponent(cleanResponse)}&voice=tr-TR-Wavenet-E&speed=1.1&pitch=1&volume=1.2`;
                
                // Ses yanıtını hazırla
                const audio = new Audio(voiceUrl);
                
                // Ses yüklendiğinde çal ve animasyonu başlat
                audio.addEventListener('canplaythrough', () => {
                    // Animasyonu başlat
                    this.recordButton.classList.add('speaking');
                    // Yanıtı göster (emojiler dahil orijinal yanıt)
                    this.responseDiv.textContent = aiData.response;
                    // Sesi çal
                    audio.play();
                });

                // Ses bittiğinde animasyonu durdur
                audio.onended = () => {
                    this.recordButton.classList.remove('speaking');
                };

                // Hata durumunda
                audio.onerror = () => {
                    console.error('Ses yüklenirken hata oluştu');
                    this.recordButton.classList.remove('speaking');
                    this.responseDiv.textContent = cleanResponse;
                };
            }
        } catch (error) {
            console.error('Hata:', error);
            this.responseDiv.textContent = 'Bir hata oluştu. Lütfen tekrar deneyin.';
        }
    }
}

// Sayfa yüklendiğinde asistanı başlat
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
}); 