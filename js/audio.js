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
}
