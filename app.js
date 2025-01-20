class VoiceAssistant {
    constructor() {
        this.recordButton = document.getElementById('recordButton');
        this.statusDiv = document.getElementById('status');
        this.responseDiv = document.getElementById('response');
        this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        this.setupRecognition();
        this.setupEventListeners();
        this.isListening = false;
        this.currentLanguage = 'tr-TR'; // Varsayılan dil
    }

    setupRecognition() {
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript;
            // Dili algıla ve recognition'ı güncelle
            this.currentLanguage = await this.detectLanguage(text);
            this.recognition.lang = this.currentLanguage;
            
            this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                'Söylediğiniz: ' + text : 
                'You said: ' + text;
            
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

    async detectLanguage(text) {
        // Basit dil algılama: Türkçe karakterler içeriyorsa Türkçe, değilse İngilizce
        const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
        return turkishChars.test(text) ? 'tr-TR' : 'en-US';
    }

    async processCommand(text) {
        try {
            // Dili algıla
            this.currentLanguage = await this.detectLanguage(text);
            
            // AI API'sine istek at
            const aiResponse = await fetch(`https://apilonic.netlify.app/api?prompt=${encodeURIComponent(text)}`);
            const aiData = await aiResponse.json();

            if (aiData.success) {
                // Emojileri temizle
                const cleanResponse = aiData.response.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]/gu, '');
                
                // Dile göre ses seçimi
                const voice = this.currentLanguage === 'tr-TR' ? 'tr-TR-Wavenet-E' : 'en-US-Wavenet-D';
                
                // Ses API'sine istek at
                const voiceUrl = `https://tssvoice.istebutolga.workers.dev/?message=${encodeURIComponent(cleanResponse)}&voice=${voice}&speed=1.1&pitch=1&volume=1.2`;
                
                // Ses yanıtını hazırla
                const audio = new Audio(voiceUrl);
                
                // Yükleme durumunu göster
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Yanıt hazırlanıyor...' : 
                    'Preparing response...';
                
                // Ses yüklendiğinde çal ve animasyonu başlat
                audio.addEventListener('canplaythrough', () => {
                    this.recordButton.classList.add('speaking');
                    this.responseDiv.textContent = aiData.response;
                    this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                        'Yanıt veriliyor...' : 
                        'Responding...';
                    audio.play();
                });

                // Ses bittiğinde
                audio.onended = () => {
                    this.recordButton.classList.remove('speaking');
                    this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                        'Başlamak için mikrofona tıklayın' : 
                        'Click microphone to start';
                };

                // Hata durumunda
                audio.onerror = () => {
                    console.error('Ses yüklenirken hata oluştu');
                    this.recordButton.classList.remove('speaking');
                    this.responseDiv.textContent = cleanResponse;
                    this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                        'Ses oynatılamadı' : 
                        'Could not play audio';
                };
            }
        } catch (error) {
            console.error('Hata:', error);
            this.responseDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                'Bir hata oluştu. Lütfen tekrar deneyin.' : 
                'An error occurred. Please try again.';
        }
    }
}

// Sayfa yüklendiğinde asistanı başlat
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
}); 