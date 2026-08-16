export class AudioManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.enabled = false;
        this.ambient = null;
    }

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
        if (!this.enabled) return;
        this._noise(0.04, 0.06, 80 + Math.random() * 200);
    }

    // 水中脚步（Level 7 深海、Level 37 泳池）
    playStepWater() {
        if (!this.enabled) return;
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
        if (!this.enabled) return;
        this._noise(0.05, 0.08, 2600 + Math.random() * 900);
    }

    playEntityNearby() {
        if (!this.enabled) return;
        this._noise(0.08, 0.2, 40 + Math.random() * 80);
    }

    playDamage() {
        if (!this.enabled) return;
        this._noise(0.25, 0.4, 30 + Math.random() * 60);
    }

    playTransition() {
        if (!this.enabled) return;
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
        if (!this.enabled) return;
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
    }

    _noise(vol, dur, freq) {
        if (!this.enabled) return;
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
        if (!this.enabled) return;
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
        if (!this.enabled) return;
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
        if (!this.enabled) return;
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

    // 卡出（noclip）音效：低频轰鸣 + 噪声
    playNoclip() {
        if (!this.enabled) return;
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
