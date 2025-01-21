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
        this.confidenceThreshold = 0.5; // Eşik değerini düşürdük
        this.retryAttempts = 3; // Yeniden deneme sayısı
        this.noiseThreshold = -50; // Gürültü eşiği (dB)
        this.setupAdvancedRecognition();
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

    setupAdvancedRecognition() {
        // Gelişmiş ses algılama ayarları
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 3; // Alternatif sonuçları artır
        this.recognition.lang = 'tr-TR';

        // Ses algılama hassasiyetini artır
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const microphone = this.audioCtx.createMediaStreamSource(stream);
                const analyser = this.audioCtx.createAnalyser();
                analyser.fftSize = 1024;
                microphone.connect(analyser);
                
                const dataArray = new Float32Array(analyser.frequencyBinCount);
                
                const checkAudioLevel = () => {
                    analyser.getFloatFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    
                    if (average > this.noiseThreshold) {
                        this.recognition.start();
                    }
                    
                    requestAnimationFrame(checkAudioLevel);
                };
                
                checkAudioLevel();
            });
    }

    setupRecognition() {
        this.recognition.onresult = async (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            let highestConfidence = 0;

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const alternatives = Array.from(result).sort((a, b) => b.confidence - a.confidence);
                
                if (result.isFinal) {
                    // En yüksek güvenilirliğe sahip sonucu al
                    const bestResult = alternatives[0];
                    if (bestResult.confidence > highestConfidence) {
                        highestConfidence = bestResult.confidence;
                        finalTranscript = bestResult.transcript;
                    }
                } else {
                    // Ara sonuçları birleştir
                    alternatives.forEach(alt => {
                        if (alt.confidence > 0.4) { // Düşük güvenilirlik eşiği
                            interimTranscript += alt.transcript + ' ';
                        }
                    });
                }
            }

            if (finalTranscript) {
                try {
                    await this.processCommand(finalTranscript.trim());
                } catch (error) {
                    console.error('İşleme hatası:', error);
                    this.retryRecognition();
                }
            } else if (interimTranscript) {
                this.updateStatus('interim', interimTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                this.retryRecognition();
            }
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (error) {
                        console.error('Yeniden başlatma hatası:', error);
                        this.retryRecognition();
                    }
                }, 100);
            }
        };
    }

    retryRecognition() {
        if (this.retryCount < this.retryAttempts) {
            this.retryCount++;
            setTimeout(() => {
                try {
                    this.recognition.start();
                } catch (error) {
                    console.error('Yeniden deneme hatası:', error);
                }
            }, 1000);
        } else {
            this.updateStatus('error');
            this.retryCount = 0;
        }
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

    detectLanguage(text) {
        // Hızlı dil algılama için regex cache
        const turkishRegex = /[çğıöşüÇĞİÖŞÜ]|^(merhaba|selam|nasıl|naber|evet|hayır|tamam|ne|neden|nasıl|kim|nerede|ne zaman|hangi|kaç|kadar)/i;
        
        if (turkishRegex.test(text)) {
            return 'tr-TR';
        }
        
        return 'tr-TR'; // Varsayılan olarak Türkçe
    }

    async processCommand(text) {
        if (!text || this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.updateStatus('processing');

            // Metin ön işleme
            text = text.toLowerCase().trim()
                .replace(/[.,!?]/g, '')
                .replace(/\s+/g, ' ');

            // API isteği
            const response = await fetch(`https://apilonic.netlify.app/api?prompt=${encodeURIComponent(text)}&lang=${this.currentLanguage}`, {
                method: 'GET',
                headers: {
                    'Accept-Language': this.currentLanguage,
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) throw new Error('API yanıt vermedi');

            const data = await response.json();
            
            if (data.success) {
                this.responseDiv.textContent = data.response;
                await this.playResponse(data.response);
            } else {
                throw new Error('API başarısız yanıt döndü');
            }
        } catch (error) {
            console.error('İşleme hatası:', error);
            this.retryRecognition();
        } finally {
            this.isProcessing = false;
        }
    }

    async playBasicAudio(text) {
        return new Promise(async (resolve, reject) => {
            try {
                const voice = 'tr-TR-Wavenet-E'; // Sabit Türkçe ses
                const voiceUrl = `https://tssvoice.istebutolga.workers.dev/?message=${encodeURIComponent(text)}&voice=${voice}&speed=1.2&pitch=1&volume=1.2&lang=tr-TR`;
                
                const audio = new Audio(voiceUrl);
                
                // Ses yüklenirken beklemeden devam et
                audio.oncanplaythrough = () => {
                    this.recordButton.classList.add('speaking');
                    audio.play().catch(reject);
                };

                audio.onended = () => {
                    this.recordButton.classList.remove('speaking');
                    resolve();
                };

                audio.onerror = reject;
            } catch (error) {
                reject(error);
            }
        });
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