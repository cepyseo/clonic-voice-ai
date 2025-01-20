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
        this.isProcessing = false; // İşlem durumu kontrolü için
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.initAudioContext();
        this.lastProcessedText = '';
        this.processingTimeout = null;
        this.initParticles();
        this.confidenceThreshold = 0.7; // Konuşma algılama güven eşiği
        this.lastTranscript = ''; // Son algılanan metin
        this.transcriptBuffer = []; // Metin tamponu
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        } catch (error) {
            console.error('Audio Context oluşturulamadı:', error);
        }
    }

    setupRecognition() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3; // Alternatif sonuçları artır
        this.recognition.lang = this.currentLanguage;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.recordButton.classList.add('listening');
            this.updateStatus('listening');
        };

        this.recognition.onresult = async (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            // Sonuçları işle ve güven skorunu kontrol et
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const transcript = result[0].transcript;
                const confidence = result[0].confidence;

                if (confidence > this.confidenceThreshold) {
                    if (result.isFinal) {
                        finalTranscript += transcript;
                        this.transcriptBuffer.push(transcript.trim());
                    } else {
                        interimTranscript += transcript;
                    }
                }
            }

            // Ara sonuçları göster
            if (interimTranscript !== '') {
                this.updateStatus('interim', interimTranscript);
            }

            // Final sonucu işle
            if (finalTranscript !== '') {
                // Son 3 saniye içindeki metinleri birleştir
                clearTimeout(this.processingTimeout);
                this.processingTimeout = setTimeout(() => {
                    const completeText = this.transcriptBuffer.join(' ');
                    if (completeText !== this.lastTranscript) {
                        this.lastTranscript = completeText;
                        this.processCommand(completeText);
                        this.transcriptBuffer = [];
                    }
                }, 1000);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech') {
                this.updateStatus('error');
            } else {
                this.updateStatus('error');
            }
        };

        this.recognition.onend = () => {
            // Eğer hala dinleme modundaysak tekrar başlat
            if (this.isListening) {
                this.recognition.start();
            } else {
                this.recordButton.classList.remove('listening');
                this.updateStatus();
            }
        };
    }

    setupEventListeners() {
        this.recordButton.addEventListener('click', () => this.toggleListening());
    }

    toggleListening() {
        if (this.isListening) {
            this.isListening = false;
            this.recognition.stop();
            this.recordButton.classList.remove('listening');
            this.updateStatus();
        } else {
            this.isListening = true;
            this.recognition.start();
            this.recordButton.classList.add('listening');
        }
    }

    async detectLanguage(text) {
        // Daha gelişmiş dil algılama
        const turkishPattern = /[çğıöşüÇĞİÖŞÜ]/;
        const englishPattern = /^[a-zA-Z\s.,!?]+$/;
        
        if (turkishPattern.test(text)) {
            return 'tr-TR';
        } else if (englishPattern.test(text)) {
            return 'en-US';
        }
        
        // Belirsiz durumlarda mevcut dili koru
        return this.currentLanguage;
    }

    async processCommand(text) {
        if (this.isProcessing) return;
        
        try {
            this.isProcessing = true;
            this.updateStatus('processing');

            // Dili algıla ve güncelle
            const detectedLang = await this.detectLanguage(text);
            if (detectedLang !== this.currentLanguage) {
                this.currentLanguage = detectedLang;
                this.recognition.lang = this.currentLanguage;
            }

            const aiResponse = await fetch(`https://apilonic.netlify.app/api?prompt=${encodeURIComponent(text)}&lang=${this.currentLanguage}`);
            const aiData = await aiResponse.json();

            if (aiData.success) {
                const cleanResponse = aiData.response.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]/gu, '');

                this.responseDiv.textContent = aiData.response;

                // Ses çalınırken dinlemeyi geçici olarak durdur
                const wasSpeaking = this.isListening;
                if (wasSpeaking) {
                    this.recognition.stop();
                }

                // Dile göre sesi çal
                if (this.voiceModel === 'elevenlabs') {
                    await this.playElevenLabsAudio(cleanResponse);
                } else {
                    await this.playBasicAudio(cleanResponse);
                }

                // Dinlemeyi tekrar başlat
                if (wasSpeaking) {
                    setTimeout(() => {
                        this.recognition.start();
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Hata:', error);
            this.updateStatus('error');
        } finally {
            this.isProcessing = false;
        }
    }

    async playBasicAudio(text) {
        const voice = this.currentLanguage === 'tr-TR' ? 'tr-TR-Wavenet-E' : 'en-US-Wavenet-D';
        const voiceUrl = `https://tssvoice.istebutolga.workers.dev/?message=${encodeURIComponent(text)}&voice=${voice}&speed=1.1&pitch=1&volume=1.2`;
        
        const audio = new Audio(voiceUrl);
        
        this.updateStatus('processing');

        await this.playAudio(audio);
    }

    async playElevenLabsAudio(text) {
        try {
            this.updateStatus('processing');

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

    async connectAudioSource(audio) {
        try {
            const source = this.audioContext.createMediaElementSource(audio);
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            this.startVisualization();
        } catch (error) {
            console.error('Ses kaynağı bağlanamadı:', error);
        }
    }

    startVisualization() {
        const waves = document.querySelectorAll('.wave');
        const updateWaves = () => {
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // Ses seviyesini hesapla (0-1 arası)
            const average = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;
            const volume = average / 255;

            // Her dalga için farklı animasyon
            waves.forEach((wave, index) => {
                const scale = 1 + (volume * 0.5 * (index + 1));
                const opacity = Math.min(0.7, volume * (1 - index * 0.2));
                wave.style.transform = `scale(${scale})`;
                wave.style.opacity = opacity;
            });

            if (this.recordButton.classList.contains('speaking')) {
                requestAnimationFrame(updateWaves);
            } else {
                // Dalgaları sıfırla
                waves.forEach(wave => {
                    wave.style.transform = 'scale(1)';
                    wave.style.opacity = '0';
                });
            }
        };

        requestAnimationFrame(updateWaves);
    }

    async playAudio(audio) {
        return new Promise((resolve, reject) => {
            const setupAudio = async () => {
                try {
                    if (this.audioContext.state === 'suspended') {
                        await this.audioContext.resume();
                    }
                    await this.connectAudioSource(audio);
                    
                    this.recordButton.classList.add('speaking');
                    this.updateStatus('processing');
                    
                    await audio.play();
                } catch (error) {
                    console.error('Ses oynatma hatası:', error);
                    reject(error);
                }
            };

            audio.addEventListener('canplaythrough', setupAudio);

            audio.onended = () => {
                this.recordButton.classList.remove('speaking');
                this.updateStatus();
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

    initParticles() {
        const particles = document.querySelectorAll('.particle');
        particles.forEach((particle, i) => {
            const size = Math.random() * 5 + 3;
            const speed = Math.random() * 40 + 20;
            const distance = Math.random() * 200 + 100;
            
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.animation = `float ${speed}s infinite`;
            particle.style.opacity = Math.random() * 0.5 + 0.2;
            particle.style.transform = `translate(${distance}px, ${distance}px)`;
        });
    }

    updateStatus(type, text = '') {
        switch (type) {
            case 'listening':
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Sizi dinliyorum...' : 
                    'I\'m listening...';
                break;
            case 'interim':
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Algılanan: ' + text :
                    'Detected: ' + text;
                break;
            case 'processing':
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'İşleniyor...' : 
                    'Processing...';
                break;
            case 'error':
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Üzgünüm, sizi anlayamadım. Lütfen tekrar deneyin.' : 
                    'Sorry, I didn\'t understand. Please try again.';
                break;
            default:
                this.statusDiv.textContent = this.currentLanguage === 'tr-TR' ? 
                    'Başlamak için mikrofona tıklayın' : 
                    'Click microphone to start';
        }
    }
}

// Sayfa yüklendiğinde asistanı başlat
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
}); 