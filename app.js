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
        this.setupSettingsUI();
        this.voiceModel = 'basic';
        this.elevenLabsVoice = 'ThT5KcBeYPX3keUQqHPh';
        this.elevenLabsApiKey = 'sk_21df53a86a2d5900460e00aafd396c757f6de5e752d50958';
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
            const aiResponse = await fetch(`https://apilonic.netlify.app/api?prompt=${encodeURIComponent(text)}`);
            const aiData = await aiResponse.json();

            if (aiData.success) {
                const cleanResponse = aiData.response.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]/gu, '');

                if (this.voiceModel === 'elevenlabs') {
                    // ElevenLabs API kullan
                    await this.playElevenLabsAudio(cleanResponse);
                } else {
                    // Mevcut ses API'sini kullan
                    await this.playBasicAudio(cleanResponse);
                }

                this.responseDiv.textContent = aiData.response;
            }
        } catch (error) {
            console.error('Hata:', error);
            this.responseDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                'Bir hata oluştu. Lütfen tekrar deneyin.' : 
                'An error occurred. Please try again.';
        }
    }

    async playBasicAudio(text) {
        const voice = this.currentLanguage === 'tr-TR' ? 'tr-TR-Wavenet-E' : 'en-US-Wavenet-D';
        const voiceUrl = `https://tssvoice.istebutolga.workers.dev/?message=${encodeURIComponent(text)}&voice=${voice}&speed=1.1&pitch=1&volume=1.2`;
        
        const audio = new Audio(voiceUrl);
        
        this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
            'Yanıt hazırlanıyor...' : 
            'Preparing response...';

        await this.playAudio(audio);
    }

    async playElevenLabsAudio(text) {
        try {
            this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                'Gelişmiş ses hazırlanıyor...' : 
                'Preparing enhanced voice...';

            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoice}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) throw new Error('ElevenLabs API error');

            const audioBlob = await response.blob();
            const audio = new Audio(URL.createObjectURL(audioBlob));
            
            await this.playAudio(audio);

        } catch (error) {
            console.error('ElevenLabs Error:', error);
            // Hata durumunda temel ses API'sine geri dön
            await this.playBasicAudio(text);
        }
    }

    async playAudio(audio) {
        return new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', () => {
                this.recordButton.classList.add('speaking');
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Yanıt veriliyor...' : 
                    'Responding...';
                audio.play();
            });

            audio.onended = () => {
                this.recordButton.classList.remove('speaking');
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Başlamak için mikrofona tıklayın' : 
                    'Click microphone to start';
                resolve();
            };

            audio.onerror = (error) => {
                console.error('Ses oynatma hatası:', error);
                this.recordButton.classList.remove('speaking');
                reject(error);
            };
        });
    }

    setupSettingsUI() {
        const settingsButton = document.getElementById('settingsButton');
        const settingsMenu = document.getElementById('settingsMenu');
        const closeSettings = document.getElementById('closeSettings');
        const devopsButton = document.getElementById('devopsButton');
        const devopsModal = document.getElementById('devopsModal');
        const closeDevops = document.getElementById('closeDevops');
        const languageSelect = document.getElementById('languageSelect');
        const voiceModelSelect = document.getElementById('voiceModelSelect');
        const elevenLabsVoiceSelect = document.getElementById('elevenLabsVoiceSelect');

        // Ayarlar menüsü
        settingsButton.addEventListener('click', () => {
            settingsMenu.classList.toggle('active');
        });

        closeSettings.addEventListener('click', () => {
            settingsMenu.classList.remove('active');
        });

        // Dil seçimi
        languageSelect.addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
            this.recognition.lang = this.currentLanguage;
            
            // Arayüz dilini güncelle
            this.updateUILanguage();
        });

        // DevOps modal
        devopsButton.addEventListener('click', () => {
            devopsModal.classList.add('active');
        });

        closeDevops.addEventListener('click', () => {
            devopsModal.classList.remove('active');
        });

        // Dışarı tıklandığında modalları kapat
        window.addEventListener('click', (e) => {
            if (e.target === devopsModal) {
                devopsModal.classList.remove('active');
            }
            if (!settingsMenu.contains(e.target) && e.target !== settingsButton) {
                settingsMenu.classList.remove('active');
            }
        });

        voiceModelSelect.addEventListener('change', (e) => {
            this.voiceModel = e.target.value;
            elevenLabsVoiceSelect.disabled = this.voiceModel !== 'elevenlabs';
        });

        elevenLabsVoiceSelect.addEventListener('change', (e) => {
            this.elevenLabsVoice = e.target.value;
        });
    }

    updateUILanguage() {
        const statusDiv = document.getElementById('status');
        if (this.currentLanguage === 'tr-TR') {
            statusDiv.textContent = 'Başlamak için mikrofona tıklayın';
            // Diğer Türkçe metinler
        } else {
            statusDiv.textContent = 'Click microphone to start';
            // Diğer İngilizce metinler
        }
    }
}

// Sayfa yüklendiğinde asistanı başlat
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
}); 