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
                // AI yanıtını göster
                this.responseDiv.textContent = aiData.response;
                
                // Ses API'sine istek at - parametreleri güncelledik
                const voiceUrl = `https://tssvoice.istebutolga.workers.dev/?message=${encodeURIComponent(aiData.response)}&voice=tr-TR-Wavenet-E&speed=1.2&pitch=1.1`;
                
                // Ses çalma sırasında animasyonu başlat
                this.recordButton.classList.add('speaking');
                
                // Ses yanıtını çal
                const audio = new Audio(voiceUrl);
                
                audio.onended = () => {
                    this.recordButton.classList.remove('speaking');
                };
                
                audio.play();
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