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
        this.confidenceThreshold = 0.2; // Daha da düşürdük
        this.retryAttempts = 3; // Yeniden deneme sayısı
        this.noiseThreshold = -70; // Daha hassas gürültü eşiği
        this.bufferSize = 8192; // Buffer boyutunu iki katına çıkardık
        this.minDecibels = -95; // Daha hassas minimum ses seviyesi
        this.maxDecibels = -5; // Daha yüksek maksimum ses seviyesi
        this.smoothingTimeConstant = 0.95; // Daha yumuşak geçişler
        this.transcriptBuffer = []; // Metin tamponu ekledik
        this.setupAdvancedRecognition();
        this.visualizer = null;
        this.visualizerCanvas = document.getElementById('visualizerCanvas');
        this.visualizerCtx = this.visualizerCanvas.getContext('2d');
        this.setupVisualizer();
        this.commandHistory = [];
        this.maxHistorySize = 10;
        this.lastResponseTime = 0;
        this.responseDelay = 500;
        this.setupKeyboardShortcuts();
        this.setupGestures();
        this.setupThemes();
        this.setupVoiceCommands();
        this.setupNotifications();
        this.setupTutorial();
        this.setupOfflineSupport();
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
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 15; // Daha fazla alternatif
        this.recognition.lang = 'tr-TR';

        // Gelişmiş ses ayarları
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext({
            latencyHint: 'interactive',
            sampleRate: 48000
        });

        navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
                sampleRate: 48000,
                latency: 0,
                volume: 1.0,
                deviceId: undefined // Varsayılan mikrofon
            }
        }).then(stream => {
            const microphone = this.audioCtx.createMediaStreamSource(stream);
            const analyser = this.audioCtx.createAnalyser();
            const gainNode = this.audioCtx.createGain();
            const scriptProcessor = this.audioCtx.createScriptProcessor(this.bufferSize, 1, 1);
            
            analyser.minDecibels = this.minDecibels;
            analyser.maxDecibels = this.maxDecibels;
            analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            analyser.fftSize = 2048;

            microphone.connect(gainNode);
            gainNode.connect(analyser);
            gainNode.connect(scriptProcessor);
            scriptProcessor.connect(this.audioCtx.destination);
            gainNode.gain.value = 2.0; // Mikrofon hassasiyetini daha da artırdık

            const dataArray = new Float32Array(analyser.frequencyBinCount);
            let silenceTimer = null;
            let voiceDetected = false;

            scriptProcessor.onaudioprocess = (e) => {
                analyser.getFloatFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const inputBuffer = e.inputBuffer.getChannelData(0);
                const outputBuffer = e.outputBuffer.getChannelData(0);
                
                // Ses sinyali işleme
                let sum = 0;
                for (let i = 0; i < inputBuffer.length; i++) {
                    sum += Math.abs(inputBuffer[i]);
                    outputBuffer[i] = inputBuffer[i];
                }
                
                const rms = Math.sqrt(sum / inputBuffer.length);
                if (rms > 0.01 || average > this.noiseThreshold) {
                    if (!voiceDetected) {
                        voiceDetected = true;
                        this.startListening();
                    }
                    clearTimeout(silenceTimer);
                } else if (voiceDetected) {
                    clearTimeout(silenceTimer);
                    silenceTimer = setTimeout(() => {
                        voiceDetected = false;
                        this.processCurrentTranscript();
                    }, 700); // Sessizlik süresini azalttık
                }
            };
        });
    }

    setupRecognition() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 15; // Daha fazla alternatif
        
        this.recognition.onresult = async (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const alternatives = Array.from(result).sort((a, b) => b.confidence - a.confidence);
                
                if (result.isFinal) {
                    // Tüm alternatifleri değerlendir
                    const validAlternatives = alternatives.filter(alt => alt.confidence > 0.15);
                    
                    if (validAlternatives.length > 0) {
                        // En iyi sonuçları birleştir
                        finalTranscript = validAlternatives
                            .slice(0, 3) // En iyi 3 alternatifi al
                            .map(alt => alt.transcript.trim())
                            .join(' ');
                            
                            // Metin tamponuna ekle
                            this.transcriptBuffer.push(finalTranscript);
                            
                            // Son 3 algılamayı birleştir
                            if (this.transcriptBuffer.length >= 3) {
                                const combinedText = this.transcriptBuffer
                                    .slice(-3)
                                    .join(' ')
                                    .toLowerCase()
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                    
                                await this.processCommand(combinedText);
                                this.transcriptBuffer = []; // Tamponu temizle
                            }
                    }
                } else {
                    interimTranscript = alternatives[0].transcript;
                    this.updateStatus('interim', interimTranscript);
                }
            }
        };

        // Gelişmiş hata yönetimi
        this.recognition.onerror = (event) => {
            console.error('Recognition error:', event.error);
            if (event.error === 'no-speech' || event.error === 'audio-capture') {
                setTimeout(() => this.restartRecognition(), 100);
            }
        };

        this.recognition.onend = () => {
            if (this.isListening && !this.isProcessing) {
                setTimeout(() => this.restartRecognition(), 50);
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
            text = text.toLowerCase()
                .replace(/[.,!?]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            // API isteği
            const response = await fetch('https://apilonic.netlify.app/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Accept-Language': this.currentLanguage
                },
                body: JSON.stringify({
                    message: text,
                    language: this.currentLanguage,
                    voice_type: this.voiceModel,
                    voice_id: this.voiceModel === 'elevenlabs' ? this.elevenLabsVoice : 'basic'
                })
            });

            if (!response.ok) {
                throw new Error(`API Hatası: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.message) {
                // Yanıtı göster
                this.responseDiv.textContent = data.message;
                
                // Ses yanıtını çal
                try {
                    if (this.voiceModel === 'elevenlabs') {
                        await this.playElevenLabsAudio(data.message);
                    } else {
                        await this.playBasicAudio(data.message);
                    }
                } catch (audioError) {
                    console.error('Ses çalma hatası:', audioError);
                    // Ses hatası durumunda temel ses API'sini dene
                    try {
                        await this.playBasicAudio(data.message);
                    } catch (fallbackError) {
                        console.error('Yedek ses hatası:', fallbackError);
                    }
                }
                
                // Komut geçmişine ekle
                this.commandHistory.unshift({
                    command: text,
                    response: data.message,
                    timestamp: new Date().toISOString()
                });
            } else {
                throw new Error('Geçersiz API yanıtı');
            }
        } catch (error) {
            console.error('İşleme hatası:', error);
            this.updateStatus('error');
            this.responseDiv.textContent = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
        } finally {
            this.isProcessing = false;
            if (this.isListening) {
                setTimeout(() => {
                    this.restartRecognition();
                }, 1000);
            }
        }
    }

    async playBasicAudio(text) {
        try {
            const voice = this.currentLanguage === 'tr-TR' ? 'tr-TR-Standard-A' : 'en-US-Standard-B';
            const url = `https://apilonic.netlify.app/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&lang=${this.currentLanguage}`;
            
            const audio = new Audio(url);
            
            return new Promise((resolve, reject) => {
                audio.oncanplaythrough = () => {
                    this.recordButton.classList.add('speaking');
                    audio.play().catch(reject);
                };
                
                audio.onended = () => {
                    this.recordButton.classList.remove('speaking');
                    resolve();
                };
                
                audio.onerror = (error) => {
                    console.error('Ses çalma hatası:', error);
                    this.recordButton.classList.remove('speaking');
                    reject(error);
                };

                // 5 saniye içinde ses yüklenemezse hata ver
                setTimeout(() => {
                    if (audio.readyState !== 4) {
                        reject(new Error('Ses yükleme zaman aşımı'));
                    }
                }, 5000);
            });
        } catch (error) {
            console.error('Ses oluşturma hatası:', error);
            throw error;
        }
    }

    async playElevenLabsAudio(text) {
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + this.elevenLabsVoice, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                body: JSON.stringify({
                    text: text,
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.8
                    }
                })
            });

            if (!response.ok) {
                throw new Error('ElevenLabs API hatası');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            return new Promise((resolve, reject) => {
                audio.oncanplaythrough = () => {
                    this.recordButton.classList.add('speaking');
                    audio.play();
                };
                
                audio.onended = () => {
                    this.recordButton.classList.remove('speaking');
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                
                audio.onerror = (error) => {
                    URL.revokeObjectURL(audioUrl);
                    reject(error);
                };
            });
        } catch (error) {
            console.error('ElevenLabs ses hatası:', error);
            throw error;
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

    setupVisualizer() {
        this.visualizerCanvas.width = window.innerWidth;
        this.visualizerCanvas.height = 200;
        
        const drawVisualizer = () => {
            requestAnimationFrame(drawVisualizer);
            
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            this.visualizerCtx.fillStyle = 'rgba(13, 17, 23, 0.2)';
            this.visualizerCtx.fillRect(0, 0, this.visualizerCanvas.width, this.visualizerCanvas.height);
            
            const barWidth = (this.visualizerCanvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for(let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                
                const gradient = this.visualizerCtx.createLinearGradient(0, 0, 0, this.visualizerCanvas.height);
                gradient.addColorStop(0, '#4f5b93');
                gradient.addColorStop(1, '#00ff9d');
                
                this.visualizerCtx.fillStyle = gradient;
                this.visualizerCtx.fillRect(x, this.visualizerCanvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
        };
        
        drawVisualizer();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'm') {
                this.toggleListening();
            }
            if (e.ctrlKey && e.key === 'h') {
                this.showCommandHistory();
            }
        });
    }

    setupGestures() {
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchmove', (e) => {
            const touchEndY = e.touches[0].clientY;
            const diff = touchStartY - touchEndY;
            
            if (Math.abs(diff) > 100) {
                if (diff > 0) {
                    this.startListening();
                } else {
                    this.stopListening();
                }
            }
        });
    }

    showCommandHistory() {
        const historyModal = document.createElement('div');
        historyModal.className = 'history-modal';
        
        const content = document.createElement('div');
        content.className = 'history-content';
        
        const title = document.createElement('h3');
        title.textContent = 'Komut Geçmişi';
        content.appendChild(title);
        
        const list = document.createElement('ul');
        this.commandHistory.forEach(item => {
            const li = document.createElement('li');
            const time = new Date(item.timestamp).toLocaleTimeString();
            li.textContent = `${time}: ${item.command} - ${item.response}`;
            list.appendChild(li);
        });
        
        content.appendChild(list);
        historyModal.appendChild(content);
        document.body.appendChild(historyModal);
        
        setTimeout(() => {
            historyModal.classList.add('active');
        }, 10);
        
        historyModal.addEventListener('click', () => {
            historyModal.classList.remove('active');
            setTimeout(() => {
                historyModal.remove();
            }, 300);
        });
    }

    setupThemes() {
        const themes = {
            cyber: {
                primary: '#00ff9d',
                secondary: '#4f5b93',
                background: 'linear-gradient(45deg, #000000, #1a1a2e, #16213e, #0f3460)'
            },
            neon: {
                primary: '#ff00ff',
                secondary: '#00ffff',
                background: 'linear-gradient(45deg, #000000, #1a002e, #16003e, #0f0060)'
            },
            matrix: {
                primary: '#00ff00',
                secondary: '#003300',
                background: 'linear-gradient(45deg, #000000, #001100, #002200, #003300)'
            }
        };

        const themeSelector = document.createElement('div');
        themeSelector.className = 'theme-selector';
        Object.keys(themes).forEach(theme => {
            const button = document.createElement('button');
            button.className = `theme-button ${theme}`;
            button.onclick = () => this.applyTheme(themes[theme]);
            themeSelector.appendChild(button);
        });
        document.body.appendChild(themeSelector);
    }

    setupVoiceCommands() {
        this.commands = {
            'tema değiştir': () => this.showThemeSelector(),
            'geçmişi göster': () => this.showCommandHistory(),
            'yardım': () => this.showTutorial(),
            'temizle': () => this.clearHistory(),
            'ses seviyesi': (level) => this.adjustVolume(level)
        };
    }

    setupNotifications() {
        if ('Notification' in window) {
            Notification.requestPermission();
        }
    }

    setupTutorial() {
        const steps = [
            {
                element: '#recordButton',
                title: 'Mikrofon',
                content: 'Konuşmaya başlamak için tıklayın'
            },
            {
                element: '.voice-level',
                title: 'Ses Seviyesi',
                content: 'Sesinizin şiddetini gösterir'
            },
            {
                element: '.visualizer',
                title: 'Ses Görselleştirici',
                content: 'Sesinizin frekans analizi'
            }
        ];

        const tutorial = document.createElement('div');
        tutorial.className = 'tutorial';
        // Tutorial adımları...
    }

    setupOfflineSupport() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
        }
    }
}

// Sayfa yüklendiğinde asistanı başlat
document.addEventListener('DOMContentLoaded', () => {
    new VoiceAssistant();
}); 