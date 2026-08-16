export class AudioManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.enabled = false;
        this.ambient = null;
        this.silent = false; // f 版设定：Level 6「熄灭」绝对寂静
    }

    setSilent(v) { this.silent = !!v; }

    _ok() { return this.enabled && !this.silent; }

    async init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.4;
            this.master.connect(this.ctx.destination);
            this.enabled = true;
        } catch (e) { this.enabled = false; }
    }

    playStep() {
        if (!this._ok()) return;
        this._noise(0.04, 0.06, 80 + Math.random() * 200);
    }

    // 水中脚步（Level 7 深海、Level 37 泳池）
    playStepWater() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sine';
        o.frequency.value = 220 + Math.random() * 80;
        f.type = 'lowpass'; f.frequency.value = 400;
        g.gain.setValueAtTime(0.07, t);
        g.gain.linearRampToValueAtTime(0, t + 0.09);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 0.1);
    }

    // 雪地脚步（Level 210 雪球）
    playStepSnow() {
        if (!this._ok()) return;
        this._noise(0.05, 0.08, 2600 + Math.random() * 900);
    }

    playEntityNearby() {
        if (!this._ok()) return;
        this._noise(0.08, 0.2, 40 + Math.random() * 80);
    }

    playDamage() {
        if (!this._ok()) return;
        this._noise(0.25, 0.4, 30 + Math.random() * 60);
    }

    playTransition() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 1.5);
        g.gain.setValueAtTime(0.2, t);
        g.gain.linearRampToValueAtTime(0, t + 1.5);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 1.5);
    }

    playCollect() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(440, t);
        o.frequency.setValueAtTime(660, t + 0.1);
        g.gain.setValueAtTime(0.1, t);
        g.gain.linearRampToValueAtTime(0, t + 0.25);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 0.25);
    }

    startAmbient(levelId) {
        if (!this.enabled || this.ambient) return;
        const freq = 50 + (levelId % 10) * 3;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = levelId <= 5 ? 'sine' : 'sawtooth';
        o.frequency.value = freq;
        f.type = 'lowpass'; f.frequency.value = 150; f.Q.value = 5;
        g.gain.value = 0.03;
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start();

        // 荧光灯电流嗡声（f 版设定：荧光灯嗡嗡作响）
        const hum = this.ctx.createOscillator();
        const humG = this.ctx.createGain();
        const humF = this.ctx.createBiquadFilter();
        hum.type = 'square';
        hum.frequency.value = 120;
        humF.type = 'lowpass'; humF.frequency.value = 300;
        humG.gain.value = 0.012;
        hum.connect(humF); humF.connect(humG); humG.connect(this.master);
        hum.start();

        this.ambient = { osc: o, gain: g, filter: f, hum, humG };
        this._modAmbient();
        this._startLevelAmbient(levelId);
    }

    // ---- f 版设定：层级专属音景 ----
    _startLevelAmbient(levelId) {
        this.levelSounds = this.levelSounds || [];
        // 清理旧的层级音
        for (const s of this.levelSounds) {
            try { s.stop(); } catch (e) {}
            clearInterval(s.iv);
        }
        this.levelSounds = [];
        if (!this._ok()) return;
        const mk = () => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            const f = this.ctx.createBiquadFilter();
            o.connect(f); f.connect(g); g.connect(this.master);
            o.start();
            return { o, g, f };
        };
        const t = () => this.ctx.currentTime;

        if (levelId === 999) {
            // Level 999「最后的延伸」：低沉的终局合唱
            const mk2 = (freq, detune) => {
                const s = mk();
                s.o.type = 'sine';
                s.o.frequency.value = freq;
                s.o.detune.value = detune;
                s.f.type = 'lowpass'; s.f.frequency.value = 400;
                s.g.gain.value = 0.02;
                return s;
            };
            this.levelSounds.push(mk2(98, 0));
            this.levelSounds.push(mk2(146.8, 4));
            this.levelSounds.push(mk2(196, -4));
            const iv = setInterval(() => {
                if (!this.enabled) return;
                const t2 = this.ctx.currentTime;
                for (const fq of [98, 130.8, 164.8]) {
                    const s = mk();
                    s.o.type = 'sine';
                    s.o.frequency.value = fq;
                    s.f.type = 'lowpass'; s.f.frequency.value = 300;
                    s.g.gain.setValueAtTime(0.025, t2);
                    s.g.gain.linearRampToValueAtTime(0.012, t2 + 2);
                    s.g.gain.linearRampToValueAtTime(0.001, t2 + 4);
                    s.o.stop(t2 + 4.2);
                    this.levelSounds.push(s);
                }
            }, 5200);
            this.levelSounds.push({ stop: () => clearInterval(iv), iv });
        } else if (levelId === 5) {
            // 恐怖酒店：走调的留声机圆舞曲
            const notes = [392, 330, 294, 330, 392, 330, 294, 262];
            const iv = setInterval(() => {
                if (!this._ok()) return;
                for (let i = 0; i < notes.length; i++) {
                    const s = mk();
                    s.o.type = 'triangle';
                    s.o.frequency.value = notes[i] * (1 + (Math.random() - 0.5) * 0.03);
                    s.f.type = 'lowpass'; s.f.frequency.value = 900;
                    s.g.gain.setValueAtTime(0.028, t() + i * 0.42);
                    s.g.gain.exponentialRampToValueAtTime(0.001, t() + i * 0.42 + 0.4);
                    s.o.stop(t() + i * 0.42 + 0.45);
                    this.levelSounds.push(s);
                }
            }, 7200);
            this.levelSounds.push({ stop: () => clearInterval(iv), iv });
        } else if (levelId === 8) {
            // 洞穴：远处滴水声（带回声感）
            const iv = setInterval(() => {
                if (!this._ok()) return;
                for (let i = 0; i < 2; i++) {
                    const s = mk();
                    s.o.type = 'sine';
                    s.o.frequency.setValueAtTime(1800 - i * 300, t() + i * 0.25);
                    s.o.frequency.linearRampToValueAtTime(400, t() + i * 0.25 + 0.12);
                    s.f.type = 'bandpass'; s.f.frequency.value = 1200; s.f.Q.value = 3;
                    s.g.gain.setValueAtTime(0.03, t() + i * 0.25);
                    s.g.gain.exponentialRampToValueAtTime(0.001, t() + i * 0.25 + 0.2);
                    s.o.stop(t() + i * 0.25 + 0.25);
                    this.levelSounds.push(s);
                }
            }, 3300);
            this.levelSounds.push({ stop: () => clearInterval(iv), iv });
        } else if (levelId === 3) {
            // 电气站：远处电流滋滋声
            const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
            const src = this.ctx.createBufferSource();
            src.buffer = buf; src.loop = true;
            const g2 = this.ctx.createGain();
            const f2 = this.ctx.createBiquadFilter();
            f2.type = 'highpass'; f2.frequency.value = 1800;
            g2.gain.value = 0.016;
            src.connect(f2); f2.connect(g2); g2.connect(this.master);
            src.start();
            this.levelSounds.push(src);
        } else if (levelId === 52) {
            // 学校：远处上课铃声
            const iv = setInterval(() => {
                if (!this._ok()) return;
                for (let i = 0; i < 3; i++) {
                    const s = mk();
                    s.o.type = 'sine';
                    s.o.frequency.value = 1240;
                    s.g.gain.setValueAtTime(0.02, t() + i * 0.9);
                    s.g.gain.exponentialRampToValueAtTime(0.001, t() + i * 0.9 + 0.8);
                    s.o.stop(t() + i * 0.9 + 0.85);
                    this.levelSounds.push(s);
                }
            }, 24000);
            this.levelSounds.push({ stop: () => clearInterval(iv), iv });
        } else if (levelId === 100) {
            // 工厂：远处机械轰鸣
            const s = mk();
            s.o.type = 'sawtooth';
            s.o.frequency.value = 55;
            s.f.type = 'lowpass'; s.f.frequency.value = 120;
            s.g.gain.value = 0.022;
            this.levelSounds.push(s);
            const iv = setInterval(() => {
                if (!this._ok()) return;
                const p = mk();
                p.o.type = 'square';
                p.o.frequency.value = 80;
                p.f.type = 'lowpass'; p.f.frequency.value = 200;
                p.g.gain.setValueAtTime(0.03, t());
                p.g.gain.exponentialRampToValueAtTime(0.001, t() + 0.25);
                p.o.stop(t() + 0.3);
                this.levelSounds.push(p);
            }, 2600);
            this.levelSounds.push({ stop: () => clearInterval(iv), iv });
        } else if (levelId === 7) {
            // 深海：水压声 + 低鸣
            const s = mk();
            s.o.type = 'sine';
            s.o.frequency.value = 38;
            s.f.type = 'lowpass'; s.f.frequency.value = 80;
            s.g.gain.value = 0.05;
            this.levelSounds.push(s);
            const iv = setInterval(() => {
                if (!this._ok()) return;
                const w = mk();
                w.o.type = 'sine';
                w.o.frequency.setValueAtTime(60, t());
                w.o.frequency.linearRampToValueAtTime(45, t() + 2);
                w.f.type = 'lowpass'; w.f.frequency.value = 200;
                w.g.gain.setValueAtTime(0.02, t());
                w.g.gain.exponentialRampToValueAtTime(0.001, t() + 2.2);
                w.o.stop(t() + 2.3);
                this.levelSounds.push(w);
            }, 5200);
            this.levelSounds.push({ stop: () => clearInterval(iv), iv });
        } else if (levelId === 399) {
            // 霓虹城：雨声（持续白噪）+ 电流
            const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
            const src = this.ctx.createBufferSource();
            src.buffer = buf; src.loop = true;
            const rainG = this.ctx.createGain();
            const rainF = this.ctx.createBiquadFilter();
            rainF.type = 'lowpass'; rainF.frequency.value = 700;
            rainG.gain.value = 0.03;
            src.connect(rainF); rainF.connect(rainG); rainG.connect(this.master);
            src.start();
            this.levelSounds.push(src);
        }
    }

    _modAmbient() {
        if (!this.ambient || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.ambient.osc.frequency.linearRampToValueAtTime(40 + Math.random() * 30, t + 2 + Math.random() * 3);
        this.ambient.gain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.04, t + 2 + Math.random() * 3);
        // 嗡声轻微波动
        if (this.ambient.humG) {
            this.ambient.humG.gain.linearRampToValueAtTime(0.008 + Math.random() * 0.01, t + 1.5);
        }
        setTimeout(() => this._modAmbient(), 3000);
    }

    stopAmbient() {
        if (this.ambient) {
            try { this.ambient.osc.stop(); this.ambient.hum.stop(); } catch (e) {}
            this.ambient = null;
        }
        // 清理层级音景
        if (this.levelSounds) {
            for (const s of this.levelSounds) {
                try { s.stop(); } catch (e) {}
                if (s.iv) clearInterval(s.iv);
            }
            this.levelSounds = [];
        }
    }

    _noise(vol, dur, freq) {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(t + dur);
    }

    // 猎犬吠叫（f 版设定：猎犬会发出类似犬吠的叫声）
    playBark() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.35);
        f.type = 'lowpass'; f.frequency.value = 500;
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 0.45);
    }

    // 抓挠者刮墙（f 版设定：长爪刮擦墙壁的声响）
    playScratch() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(2200, t);
        o.frequency.linearRampToValueAtTime(800, t + 0.15);
        f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 8;
        g.gain.setValueAtTime(0.1, t);
        g.gain.linearRampToValueAtTime(0, t + 0.2);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 0.22);
    }

    // 火盐投掷爆炸
    playFireSalt() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        f.type = 'lowpass'; f.frequency.value = 400;
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 0.6);
        this._noise(0.2, 0.4, 200);
    }

    // 雷声（Level 28 风暴石堡）
    playThunder() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(60, t);
        o.frequency.exponentialRampToValueAtTime(24, t + 1.6);
        f.type = 'lowpass'; f.frequency.value = 120;
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        o.connect(f); f.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 1.9);
        this._noise(0.15, 0.9, 80);
    }

    // 派对客诡异"音乐"（f 版设定：派对客邀请你参加派对）
    playParty() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const notes = [660, 784, 880, 1046, 880, 784];
        for (let i = 0; i < notes.length; i++) {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = notes[i];
            const tt = t + i * 0.13;
            g.gain.setValueAtTime(0.05, tt);
            g.gain.exponentialRampToValueAtTime(0.001, tt + 0.12);
            o.connect(g); g.connect(this.master);
            o.start(tt); o.stop(tt + 0.13);
        }
    }

    // 卡出（noclip）音效：低频轰鸣 + 噪声
    playNoclip() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(60, t);
        o.frequency.exponentialRampToValueAtTime(24, t + 1.2);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(g); g.connect(this.master);
        o.start(); o.stop(t + 1.5);
        this._noise(0.12, 1.0, 90);
    }
}
