const DOUBLE_TAP_INTERVAL = 300;
const DOUBLE_TAP_SPRINT_WINDOW = 1200;

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.keyTimestamps = {};
        this.doubleTapActive = {};
        this.lastDoubleTapTime = {};
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.isPointerLocked = false;
        this.sensitivity = 0.002;
        this._uiOpen = false;
        this._cb = {};

        document.addEventListener('keydown', e => {
            const dir = this._toDir(e.code);
            if (dir && !this.keys[e.code]) {
                const now = Date.now();
                const last = this.keyTimestamps[dir] || 0;
                if (now - last < DOUBLE_TAP_INTERVAL) {
                    this.doubleTapActive[dir] = true;
                    this.lastDoubleTapTime[dir] = now;
                }
                this.keyTimestamps[dir] = now;
            }
            this.keys[e.code] = true;
            if (this._cb.keydown) this._cb.keydown(e);
        });

        document.addEventListener('keyup', e => { this.keys[e.code] = false; });

        document.addEventListener('mousemove', e => {
            if (this.isPointerLocked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
        });

        this.canvas.addEventListener('click', () => {
            if (!this.isPointerLocked && !this._uiOpen) this.requestLock();
        });
    }

    _toDir(code) {
        switch (code) { case 'KeyW': return 'W'; case 'KeyA': return 'A'; case 'KeyS': return 'S'; case 'KeyD': return 'D'; default: return null; }
    }

    setUIOpen(v) { this._uiOpen = v; }
    requestLock() { if (!this._uiOpen) this.canvas.requestPointerLock(); }
    releaseLock() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
    isPressed(c) { return !!this.keys[c]; }

    getMovement() {
        const r = { dx: this.mouseDX * this.sensitivity, dy: this.mouseDY * this.sensitivity };
        this.mouseDX = 0; this.mouseDY = 0;
        return r;
    }

    getInputVector() {
        let f = 0, r = 0;
        if (this.keys['KeyW']) f += 1;
        if (this.keys['KeyS']) f -= 1;
        if (this.keys['KeyD']) r += 1;
        if (this.keys['KeyA']) r -= 1;
        return { forward: f, right: r };
    }

    isSprinting() {
        if (this.keys['KeyQ']) return true;
        const now = Date.now();
        for (const d of ['W', 'A', 'S', 'D']) {
            if (this.doubleTapActive[d] && now - this.lastDoubleTapTime[d] < DOUBLE_TAP_SPRINT_WINDOW) {
                const km = { W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD' };
                if (this.keys[km[d]]) return true;
            }
        }
        return false;
    }

    on(ev, fn) { this._cb[ev] = fn; }
}
