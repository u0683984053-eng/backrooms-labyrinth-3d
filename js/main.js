import * as THREE from 'three';
import { GameRenderer } from './renderer.js';
import { MazeGenerator } from './maze.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { EntityManager } from './entities.js';
import { Inventory } from './inventory.js';
import { AudioManager } from './audio.js';
import { getLevelConfig, getDetailedLevels, MazeRenderFlags, getSurvivalClassInfo } from './config.js';

class BackroomsGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new GameRenderer(this.canvas);
        this.input = new InputManager(this.canvas);
        this.player = new Player(this.renderer.camera);
        this.inventory = new Inventory(15);
        this.audio = new AudioManager();
        this.entityManager = new EntityManager(this.renderer, this.audio);

        this.currentLevel = 0;
        this.mazeData = null;
        this.isRunning = false;
        this.prevTime = 0;
        this.flickerTime = 0;
        this.backpackOpen = false;
        this.cheatOpen = false;
        this.transitioning = false;
        this._dead = false;
        this.stepTimer = 0;
        this.noclipHeld = 0;
        this.playTime = 0;

        this._setupUI();
        this._initAudio();
        this._showLoading();
        // 调试钩子（无害）：暴露实例便于外部检查渲染状态
        window.__game = this;
    }

    async _initAudio() { await this.audio.init(); }

    _showLoading() {
        const bar = document.querySelector('.loading-bar-fill');
        const txt = document.getElementById('loading-text');
        let p = 0;
        const iv = setInterval(() => {
            p += Math.random() * 12;
            if (p >= 100) {
                p = 100;
                clearInterval(iv);
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('start-screen').classList.remove('hidden');
                const btn = document.getElementById('btn-start');
                if (btn && this.hasSave()) btn.textContent = '继 续 探 索';
                this._updateDocCount();
            }
            bar.style.width = p + '%';
            txt.textContent = '加载中... ' + Math.floor(p) + '%';
        }, 180);
    }

    _setupUI() {
        document.getElementById('btn-start').addEventListener('click', () => this.startGame(this.hasSave()));
        document.getElementById('btn-respawn').addEventListener('click', () => this.respawn());
        document.getElementById('btn-ending-restart').addEventListener('click', () => this._restartGame());
        document.getElementById('btn-close-backpack').addEventListener('click', () => this.toggleBackpack(false));
        document.getElementById('btn-close-cheat').addEventListener('click', () => this.toggleCheat(false));
        document.getElementById('btn-cheat-go').addEventListener('click', () => this._cheatGo());
        this.input.on('keydown', e => this._onKeyDown(e));

        // 鼠标灵敏度设置（localStorage 记忆）
        const sens = document.getElementById('sens-input');
        const sensVal = document.getElementById('sens-value');
        if (sens && sensVal) {
            try {
                const saved = parseInt(localStorage.getItem('backrooms3d_sens') || '7', 10);
                sens.value = saved;
                sensVal.textContent = saved;
                this.input.sensitivity = saved / 7 * 0.002;
            } catch (e) {}
            sens.addEventListener('input', () => {
                const v = parseInt(sens.value, 10);
                sensVal.textContent = v;
                this.input.sensitivity = v / 7 * 0.002;
                try { localStorage.setItem('backrooms3d_sens', String(v)); } catch (e) {}
            });
        }

        // 音量设置（localStorage 记忆）
        const vol = document.getElementById('vol-input');
        const volVal = document.getElementById('vol-value');
        if (vol && volVal) {
            try {
                const saved = parseInt(localStorage.getItem('backrooms3d_vol') || '70', 10);
                vol.value = saved;
                volVal.textContent = saved;
                if (this.audio.master) this.audio.master.gain.value = saved / 100 * 0.4;
            } catch (e) {}
            vol.addEventListener('input', () => {
                const v = parseInt(vol.value, 10);
                volVal.textContent = v;
                if (this.audio.master) this.audio.master.gain.value = v / 100 * 0.4;
                try { localStorage.setItem('backrooms3d_vol', String(v)); } catch (e) {}
            });
        }
    }

    _onKeyDown(e) {
        if (!this.isRunning) return;

        if (e.code === 'KeyB' || e.code === 'KeyI') {
            if (!this.cheatOpen) this.toggleBackpack(!this.backpackOpen);
            return;
        }
        if (e.code === 'Backquote') { this.toggleCheat(!this.cheatOpen); return; }
        if (e.code === 'KeyF' && !this.backpackOpen && !this.cheatOpen) {
            if (this.currentDark) {
                // f 版设定：Level 6「熄灭」绝对黑暗，任何光源无法工作
                this.failLightTimer = 2.5;
                document.getElementById('flashlight-indicator').classList.remove('hidden');
                document.getElementById('flashlight-indicator').textContent = '🔦 光源无法工作';
                return;
            }
            this.player.toggleFlashlight();
            document.getElementById('flashlight-indicator').classList.toggle('hidden', !this.player.flashlightOn);
        }
        if (e.code === 'KeyC' && !e.ctrlKey && !this.backpackOpen && !this.cheatOpen) {
            this.player.crouch(!this.player.isCrouching);
            // f 版设定：潜行状态提示
            this.player.statusEffects = this.player.statusEffects.filter(s => s.name !== '潜行');
            if (this.player.isCrouching) {
                this.player.addStatusEffect({ name: '潜行', color: '#88aaff', duration: Infinity });
            }
        }
        if (e.code === 'Escape') {
            if (this.backpackOpen) this.toggleBackpack(false);
            if (this.cheatOpen) this.toggleCheat(false);
        }

        const slotKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
        const si = slotKeys.indexOf(e.code);
        if (si >= 0 && !this.backpackOpen && !this.cheatOpen) {
            const r = this.inventory.useItem(si, this.player);
            if (r && r.action === 'throwFireSalt') this._throwFireSalt();
            this._refreshInventory();
        }

        if (this.backpackOpen && e.code === 'Enter' && this.inventory.selectedIndex >= 0) {
            const r = this.inventory.useItem(this.inventory.selectedIndex, this.player);
            if (r && r.action === 'throwFireSalt') this._throwFireSalt();
            this._refreshInventory();
            this.toggleBackpack(false);
        }
        if (this.backpackOpen) {
            if (e.code === 'ArrowLeft') this._navInv(-1);
            if (e.code === 'ArrowRight') this._navInv(1);
        }
    }

    startGame(continueGame) {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.isRunning = true;
        if (continueGame && this._loadProgress()) {
            // 已从存档恢复
        } else {
            this._loadLevel(0);
        }
        this.input.requestLock();
        this.prevTime = performance.now();
        this._loop(performance.now());
        // 生存指南（M.E.G. 风格，8 秒后消失）
        const guide = document.getElementById('guide-overlay');
        if (guide) {
            guide.classList.remove('hidden');
            clearTimeout(this._guideTimer);
            this._guideTimer = setTimeout(() => guide.classList.add('hidden'), 9000);
        }
    }

    _loadLevel(id) {
        const config = getLevelConfig(id);
        this.currentLevel = id;
        const gen = new MazeGenerator(config);
        this.mazeData = gen.generate();

        this.renderer.setLevelConfig(config);
        this.renderer.buildMaze(this.mazeData);

        this.player.position.copy(this.mazeData.startPos);
        this.player.position.y = this.player.height;
        this.renderer.camera.position.copy(this.player.position);
        this._faceOpenDirection();

        // f 版设定：黑暗层级心理危害更大 → 理智流失加速
        const flags = config.renderFlags || [];
        this.player.sanityDrain = flags.includes(MazeRenderFlags.DARKNESS) ? 1.0 : 0.3;
        this.player.sanity = Math.max(30, this.player.sanity);
        this.currentDark = flags.includes(MazeRenderFlags.DARKNESS);
        this.failLightTimer = 0;
        this.currentTerrain = config.terrainType;
        // f 版设定：Level 11 城市昼夜循环（白天无实体）
        this.dayNightTimer = 0;
        this._isNight = false;
        this.renderer.setDayNight(false);
        this.entityManager.setNight(false);

        // f 版设定：Level 2「管道之梦」极其炎热（43°C+）→ 持续消耗理智
        this.player.statusEffects = [];
        if (id === 2) {
            this.player.sanityDrain = 0.6;
            this.player.addStatusEffect({ name: '酷热 43°C', color: '#ff6020', duration: Infinity });
        } else if (flags.includes(MazeRenderFlags.BIOHAZARD)) {
            this.player.addStatusEffect({ name: '毒气', color: '#40c040', duration: Infinity });
        }

        // Level 404：故障效果（f 版设定：损坏的现实）
        const gl = document.getElementById('glitch-overlay');
        if (gl) gl.classList.toggle('hidden', id !== 404);

        this.entityManager.spawnEntities(this.mazeData.entitySpawns);
        this.audio.stopAmbient();
        // f 版设定：Level 6「熄灭」绝对寂静（除脚步声外一切无声）
        this.audio.setSilent(id === 6);
        if (id !== 6) this.audio.startAmbient(id);

        document.getElementById('level-indicator').textContent = 'Level ' + id + ' - ' + config.name + '  [' + getSurvivalClassInfo(config.survivalClass).label + ']';
        document.getElementById('flashlight-indicator').classList.add('hidden');
        this.player.flashlightOn = false;
        this._showTransition(config.name, config.description);
        this._refreshInventory();
        this._saveProgress();
    }

    // ---- 进度存档（localStorage） ----
    _saveProgress() {
        try {
            localStorage.setItem('backrooms3d_save', JSON.stringify({
                level: this.currentLevel,
                health: Math.round(this.player.health),
                stamina: Math.round(this.player.stamina),
                sanity: Math.round(this.player.sanity),
                inventory: this.inventory.getItems()
            }));
        } catch (e) { /* 隐私模式等场景下忽略 */ }
    }

    hasSave() {
        try { return !!localStorage.getItem('backrooms3d_save'); } catch (e) { return false; }
    }

    _loadProgress() {
        try {
            const raw = localStorage.getItem('backrooms3d_save');
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (typeof s.level !== 'number') return false;
            this._loadLevel(Math.max(0, Math.min(1000, s.level)));
            if (typeof s.health === 'number') this.player.health = s.health;
            if (typeof s.stamina === 'number') this.player.stamina = s.stamina;
            if (typeof s.sanity === 'number') this.player.sanity = s.sanity;
            if (Array.isArray(s.inventory)) {
                this.inventory.items = s.inventory;
                this.inventory.selectedIndex = -1;
                this._refreshInventory();
            }
            return true;
        } catch (e) { return false; }
    }

    _clearSave() {
        try { localStorage.removeItem('backrooms3d_save'); } catch (e) {}
    }

    // 出生时面朝最开阔的方向（避免开局贴墙）
    _faceOpenDirection() {
        if (!this.mazeData || !this.mazeData.grid) return;
        const grid = this.mazeData.grid;
        const cx = Math.floor(this.player.position.x / 5);
        const cz = Math.floor(this.player.position.z / 5);
        const dirs = [
            { dx: 0, dy: -1, wi: 0, yaw: 0 },
            { dx: 1, dy: 0, wi: 1, yaw: -Math.PI / 2 },
            { dx: 0, dy: 1, wi: 2, yaw: Math.PI },
            { dx: -1, dy: 0, wi: 3, yaw: Math.PI / 2 },
        ];
        let best = dirs[0], bestLen = -1;
        for (const d of dirs) {
            let x = cx, z = cz, len = 0;
            for (let i = 0; i < 8; i++) {
                if (grid[x][z].walls[d.wi]) break;
                x += d.dx; z += d.dy; len++;
                if (x < 0 || x >= grid.length || z < 0 || z >= grid[0].length) break;
            }
            if (len > bestLen) { bestLen = len; best = d; }
        }
        this.player.yaw = best.yaw;
        this.renderer.camera.quaternion.setFromEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    }

    _showTransition(name, desc) {
        const ov = document.getElementById('level-transition');
        document.getElementById('transition-level-name').textContent = name;
        document.getElementById('transition-level-desc').textContent = desc;
        // f 版设定：M.E.G. 档案式生存难度评级
        const info = getSurvivalClassInfo(this.mazeData ? getLevelConfig(this.currentLevel).survivalClass : null);
        const cls = document.getElementById('transition-level-class');
        if (cls) {
            cls.textContent = info
                ? 'M.E.G. 档案 · ' + info.label + ' ｜ ' + info.safe + ' / ' + info.stable + ' / ' + info.entity
                : '';
        }
        ov.classList.remove('hidden');
        this.transitioning = true;
        setTimeout(() => { ov.classList.add('hidden'); this.transitioning = false; }, 2200);
    }

    _loop(time) {
        if (!this.isRunning) return;
        requestAnimationFrame(t => this._loop(t));
        const dt = Math.min((time - this.prevTime) / 1000, 0.1);
        this.prevTime = time;
        this.flickerTime += dt;

        if (this.transitioning) { this.renderer.render(); return; }

        const uiOpen = this.backpackOpen || this.cheatOpen;
        if (!uiOpen && !this._dead) {
            this.playTime += dt;
            this.player.update(dt, this.input, this.mazeData ? this.mazeData.grid : null, 5, this.mazeData ? this.mazeData.platforms : null);
            this.renderer.updateLights(this.flickerTime);
            this.renderer.updateFlashlight(this.player, this.flickerTime);
            this.entityManager.update(dt, this.player, this.mazeData ? this.mazeData.grid : null);
            this._checkExit();

            // f 版设定：补给拾取
            const pickup = this._nearestPickup(2.2);
            const hintEl = document.getElementById('interaction-hint');
            if (pickup && !this.currentDark) {
                const names = { almond_water: '杏仁水 💧', memory_juice: '记忆汁 🧃', royal_ration: '皇家口粮 🍱', cashew_water: '腰果水 ⚗️' };
                hintEl.classList.remove('hidden');
                hintEl.textContent = '按 E 拾取 ' + (names[pickup.type] || '补给');
                if (this.input.isPressed('KeyE')) this._collectPickup(pickup);
            }

            // f 版设定：卡出（noclip）——按住 E 从现实中卡出
            if (this.input.isPressed('KeyE') && !pickup) {
                this.noclipHeld += dt;
                hintEl.classList.remove('hidden');
                hintEl.textContent = '卡出中... ' + Math.min(100, Math.floor(this.noclipHeld / 1.2 * 100)) + '%';
                if (this.noclipHeld >= 1.2) {
                    this.noclipHeld = 0;
                    this._noclip();
                }
            } else {
                if (this.noclipHeld > 0) this.noclipHeld = 0;
                if (!pickup && !this.currentDark) hintEl.classList.add('hidden');
            }

            const iv = this.input.getInputVector();
            if ((Math.abs(iv.forward) > 0.01 || Math.abs(iv.right) > 0.01)) {
                this.stepTimer += dt;
                const interval = this.player.isCrouching ? 0.6 : this.player.stamina > 0 && this.input.isSprinting() ? 0.25 : 0.45;
                if (this.stepTimer >= interval) {
                    this.stepTimer = 0;
                    // 材质脚步声（f 版设定：潮湿地毯/水/雪）
                    if (this.currentTerrain === 'aquatic') this.audio.playStepWater();
                    else if (this.currentTerrain === 'snow') this.audio.playStepSnow();
                    else this.audio.playStep();
                }
            }
            // f 版设定：Level 404「层级未找到」——损坏的现实会随机把你传送走
            if (this.currentLevel === 404 && Math.random() < dt * 0.04) {
                this._glitchTeleport();
            }
            // f 版设定：Level 11「无尽城市」昼夜循环（白天看不到实体）
            if (this.currentLevel === 11) {
                this.dayNightTimer += dt;
                const night = this.dayNightTimer > 75;
                if (night !== this._isNight) {
                    this._isNight = night;
                    this.renderer.setDayNight(night);
                    this.entityManager.setNight(night);
                }
            }
            const nearby = this.entityManager.getEntitiesInRange(this.player.position, 12);
            if (nearby.length > 0 && Math.random() < 0.03) this.audio.playEntityNearby();

            if (!this.player.alive) { this._dead = true; this._onDeath(); }
        }

        // f 版设定：Level 404 光源失效提示计时
        if (this.failLightTimer > 0) {
            this.failLightTimer -= dt;
            if (this.failLightTimer <= 0) {
                document.getElementById('flashlight-indicator').classList.add('hidden');
                document.getElementById('flashlight-indicator').textContent = '🔦 开';
            }
        }

        this._updateExitIndicator();
        this._updateHUD();
        this.renderer.render();
    }

    // 出口方向指示（HUD 箭头指向最近出口）
    _updateExitIndicator() {
        const el = document.getElementById('exit-indicator');
        if (!el || !this.mazeData) return;
        const exits = (this.mazeData.exits && this.mazeData.exits.length)
            ? this.mazeData.exits
            : (this.mazeData.exitPos ? [{ x: this.mazeData.exitPos.x, z: this.mazeData.exitPos.z }] : []);
        if (exits.length === 0) { el.classList.add('hidden'); return; }
        let best = null, bd = Infinity;
        for (const ex of exits) {
            const d = this.player.position.distanceTo(new THREE.Vector3(ex.x, this.player.position.y, ex.z));
            if (d < bd) { bd = d; best = ex; }
        }
        if (!best || bd < 8) { el.classList.add('hidden'); return; }
        el.classList.remove('hidden');
        const dir = new THREE.Vector3(best.x - this.player.position.x, 0, best.z - this.player.position.z);
        dir.applyQuaternion(this.renderer.camera.quaternion.clone().invert());
        const ang = Math.atan2(dir.x, -dir.z);
        el.style.transform = 'translate(-50%,-50%) rotate(' + ang + 'rad)';
        el.style.opacity = Math.min(1, (bd - 8) / 40).toFixed(2);
    }

    // 火盐投掷（f 版设定：少数能对抗实体的手段）
    _throwFireSalt() {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.renderer.camera.quaternion);
        let best = null, bd = 24;
        for (const e of this.entityManager.entities) {
            if (!e.alive) continue;
            const d = e.pos.distanceTo(this.player.position);
            if (d > bd) continue;
            const dirTo = e.pos.clone().sub(this.player.position);
            dirTo.y = 0; dirTo.normalize();
            if (fwd.dot(dirTo) < 0.4) continue; // 视线 60° 内
            best = e; bd = d;
        }
        if (best) {
            this.entityManager.damageEntity(best, 60);
            this.audio.playFireSalt();
            this.renderer.createExplosion(best.pos);
        } else {
            this.audio.playStep();
            const hintEl = document.getElementById('interaction-hint');
            hintEl.classList.remove('hidden');
            hintEl.textContent = '火盐掷向虚空...';
            setTimeout(() => { if (!this._nearestPickup(2.2)) hintEl.classList.add('hidden'); }, 1200);
        }
    }

    // Level 404 故障传送：随机移动到本层开放位置
    _glitchTeleport() {
        const grid = this.mazeData.grid;
        if (!grid) return;
        for (let t = 0; t < 80; t++) {
            const gx = Math.floor(Math.random() * grid.length);
            const gz = Math.floor(Math.random() * grid[0].length);
            if (gx < 1 || gx > grid.length - 2 || gz < 1 || gz > grid[0].length - 2) continue;
            if (grid[gx][gz].walls.some(w => w)) continue;
            this.player.position.set(gx * 5, this.player.height, gz * 5);
            this.player.vy = 0;
            this.player.onGround = true;
            this.renderer.camera.position.copy(this.player.position);
            this.audio.playNoclip();
            break;
        }
    }

    // 最近的可拾取补给
    _nearestPickup(range) {
        if (!this.mazeData || !this.mazeData.pickups || this.mazeData.pickups.length === 0) return null;
        let best = null, bd = range;
        for (const pk of this.mazeData.pickups) {
            const d = this.player.position.distanceTo(new THREE.Vector3(pk.x, this.player.position.y, pk.z));
            if (d < bd) { bd = d; best = pk; }
        }
        return best;
    }

    _collectPickup(pk) {
        // f 版设定：M.E.G. 遗落文档 → 阅读档案（不入背包，按层级专属）
        if (pk.type === 'meg_doc') {
            const lv = this.currentLevel;
            const DOCS = {
                common: [
                    'M.E.G. 档案 #002：「杏仁水是从后室中提取的流体，能恢复理智。注意：腰果水与它截然相反——千万别喝错。」',
                    'M.E.G. 档案 #007：「猎犬是四足的捕食者，会发出类似犬吠的叫声。听到吠叫，跑。」',
                    'M.E.G. 档案 #011：「微笑者只在黑暗中显形。如果黑暗中有一张苍白的笑脸在凝视你——不要与它对视。」',
                    'M.E.G. 档案 #018：「派对客会邀请你参加派对。拒绝。永远拒绝。」',
                    'M.E.G. 档案 #023：「火盐是少数能伤害实体的物质。流浪者总是随身携带。」',
                ],
                0: ['M.E.G. 档案 #001：「如果你不小心，在错误的地方切出现实，你就会进入后室。那里只有潮湿地毯的臭味，疯狂吞噬着你的理智……」',
                    'M.E.G. 档案 #031：「Level 0 的出口被称为卡出。有人说，只要贴着墙壁行走并相信，就能穿过现实。」'],
                1: ['M.E.G. 档案 #005：「Level 1 是宜居区。这里有物资、有灯光，还有——希望。珍惜它。」'],
                5: ['M.E.G. 档案 #009：「Level 5 的酒店在 1930 年代就已废弃。如果你听到留声机的音乐——那声音不是来自任何房间。」'],
                33: ['M.E.G. 档案 #017：「Level 33 的电梯会去往任何楼层。据说有一部电梯会带你到后室之外。我们还没找到那部。」'],
                56: ['M.E.G. 档案 #029：「Level 56 的太空站重力只有 0.8G。注意那些舷窗——窗外的星星，有些在移动。」'],
                283: ['M.E.G. 档案 #041：「Level 283 是游乐场。旋转木马永远在转。如果你听到孩子的笑声——那不是孩子。」'],
            };
            const pool = DOCS[lv] || DOCS.common;
            const text = pool[Math.floor(Math.random() * pool.length)];
            this._showMegDoc(text);
            this._removePickupMesh(pk);
            this.mazeData.pickups = this.mazeData.pickups.filter(p => p !== pk);
            return;
        }
        const defs = {
            almond_water: {
                id: 'almond_water', name: '杏仁水', icon: '💧', type: 'consumable',
                description: '恢复30点生命值并平复理智。流浪者的生命之源。', stackable: true, count: 1,
                effect: { heal: 30, sanity: 20 }
            },
            memory_juice: {
                id: 'memory_juice', name: '记忆汁', icon: '🧃', type: 'consumable',
                description: '恢复50点理智。M.E.G. 记载：紫色的汁液能抚平记忆的裂痕。', stackable: true, count: 1,
                effect: { sanity: 50 }
            },
            royal_ration: {
                id: 'royal_ration', name: '皇家口粮', icon: '🍱', type: 'consumable',
                description: '恢复20生命值和40体力值。M.E.G. 后勤标准军用口粮。', stackable: true, count: 1,
                effect: { heal: 20, stamina: 40 }
            },
            cashew_water: {
                id: 'cashew_water', name: '腰果水', icon: '⚗️', type: 'consumable',
                description: '与杏仁水相反的存在。喝了它会损失25点理智。', stackable: true, count: 1,
                effect: { sanityDrain: 25 }
            },
        };
        const itemDef = defs[pk.type] || defs.almond_water;
        const added = this.inventory.addItem({ ...itemDef });
        if (!added) return;
        this.mazeData.pickups = this.mazeData.pickups.filter(p => p !== pk);
        this._removePickupMesh(pk);
        this.audio.playCollect();
        this._refreshInventory();
    }

    _removePickupMesh(pk) {
        for (const c of this.renderer.mazeGroup.children) {
            if (c.userData && c.userData.pickup && Math.abs(c.position.x - pk.x) < 0.5 && Math.abs(c.position.z - pk.z) < 0.5) {
                this.renderer.mazeGroup.remove(c);
            }
        }
    }

    // M.E.G. 文档展示（收集计数）
    _showMegDoc(text) {
        const ov = document.getElementById('meg-doc-overlay');
        if (!ov) return;
        document.getElementById('meg-doc-text').textContent = text;
        ov.classList.remove('hidden');
        this.audio.playCollect();
        clearTimeout(this._docTimer);
        this._docTimer = setTimeout(() => ov.classList.add('hidden'), 4200);
        try {
            const n = parseInt(localStorage.getItem('backrooms3d_docs') || '0', 10);
            localStorage.setItem('backrooms3d_docs', String(n + 1));
            this._updateDocCount();
        } catch (e) {}
    }

    _updateDocCount() {
        const el = document.getElementById('doc-count');
        if (!el) return;
        try {
            const n = parseInt(localStorage.getItem('backrooms3d_docs') || '0', 10);
            el.textContent = '已收集 M.E.G. 文档：' + n + ' 份';
        } catch (e) {}
    }

    // 卡出（noclip）：随机传送到邻近层级（f 版设定：Level 0 主要出口方式）
    // 通关（Level 1000 终点）
    _onWin() {
        this._clearSave();
        this.isRunning = false;
        this.input.releaseLock();
        this.audio.stopAmbient();
        this.audio.playTransition();
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('ending-screen').classList.remove('hidden');
        // 显示通关用时
        const mins = Math.floor(this.playTime / 60);
        const secs = Math.floor(this.playTime % 60);
        const sub = document.querySelector('.ending-sub');
        if (sub) sub.textContent = '你在后室中挣扎了 ' + mins + ' 分 ' + secs + ' 秒。寂静。仅此而已。你自由了。';
    }

    _restartGame() {
        this._clearSave();
        document.getElementById('ending-screen').classList.add('hidden');
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.isRunning = true;
        this._dead = false;
        this._loadLevel(0);
        this.input.requestLock();
        this.prevTime = performance.now();
        this._loop(performance.now());
    }

    _noclip() {
        this.audio.playNoclip();
        const delta = 5 + Math.floor(Math.random() * 26);
        let target = this.currentLevel + (Math.random() < 0.5 ? delta : -delta);
        target = Math.max(0, Math.min(1000, target));
        if (target === this.currentLevel) target = Math.min(1000, target + 1);
        this._loadLevel(target);
        // 覆盖过渡文字
        document.getElementById('transition-level-name').textContent = '现 实 裂 隙';
        document.getElementById('transition-level-desc').textContent = '你从现实中卡了出去... 来到了 Level ' + target;
    }

    _checkExit() {
        if (!this.mazeData) return;
        const exits = (this.mazeData.exits && this.mazeData.exits.length)
            ? this.mazeData.exits
            : (this.mazeData.exitPos ? [{ x: this.mazeData.exitPos.x, z: this.mazeData.exitPos.z }] : []);
        if (exits.length === 0) return;
        for (const ex of exits) {
            const d = this.player.position.distanceTo(
                new THREE.Vector3(ex.x, this.player.position.y, ex.z)
            );
            if (d < 2) {
                if (this.currentLevel >= 1000) { this._onWin(); return; }
                this.audio.playTransition();
                this._loadLevel(this.currentLevel + 1);
                return;
            }
        }
    }

    _onDeath() {
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('death-screen').classList.remove('hidden');
        const d = document.getElementById('death-cause');
        if (d) d.textContent = this.player.lastAttacker ? '你被 ' + this.player.lastAttacker + ' 吞噬...' : '后室又夺走了一个灵魂...';
        this.input.releaseLock();
        this.audio.stopAmbient();
    }

    respawn() {
        this._dead = false;
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.player.respawn(new THREE.Vector3(
            this.mazeData.startPos.x, 0, this.mazeData.startPos.z
        ));
        this._loadLevel(this.currentLevel);
        this.input.requestLock();
    }

    toggleBackpack(open) {
        this.backpackOpen = open;
        document.getElementById('backpack-modal').classList.toggle('hidden', !open);
        this.input.setUIOpen(open);
        if (open) { this.input.releaseLock(); this._refreshInventory(); }
    }

    toggleCheat(open) {
        this.cheatOpen = open;
        document.getElementById('cheat-modal').classList.toggle('hidden', !open);
        this.input.setUIOpen(open);
        if (open) { this.input.releaseLock(); this._popCheatList(); document.getElementById('cheat-level-input').focus(); }
    }

    _popCheatList() {
        const list = document.getElementById('cheat-level-list');
        list.innerHTML = '';
        const det = getDetailedLevels();
        for (let i = 0; i <= 1000; i++) {
            const btn = document.createElement('button');
            btn.className = 'cheat-level-btn' + (det.includes(i) ? ' detailed' : '');
            btn.textContent = i;
            btn.addEventListener('click', () => this._cheatGoTo(i));
            list.appendChild(btn);
        }
    }

    _cheatGo() {
        const v = parseInt(document.getElementById('cheat-level-input').value);
        if (!isNaN(v) && v >= 0 && v <= 1000) this._cheatGoTo(v);
    }

    _cheatGoTo(level) {
        this.toggleCheat(false);
        this.audio.playTransition();
        this._loadLevel(level);
        setTimeout(() => this.input.requestLock(), 300);
    }

    _updateHUD() {
        document.getElementById('health-bar-fill').style.width = this.player.health + '%';
        document.getElementById('health-text').textContent = Math.ceil(this.player.health);
        document.getElementById('stamina-bar-fill').style.width = this.player.stamina + '%';
        document.getElementById('stamina-text').textContent = Math.ceil(this.player.stamina);
        document.getElementById('sanity-indicator').textContent = '理智: ' + Math.ceil(this.player.sanity) + '%';
        document.getElementById('position-indicator').textContent =
            'X: ' + Math.round(this.player.position.x) + ' Z: ' + Math.round(this.player.position.z);

        // f 版设定：理智过低时出现血色暗角（心理危害的视觉反馈）
        const so = document.getElementById('sanity-overlay');
        if (so) {
            const s = this.player.sanity;
            let op = 0;
            if (s < 40) op = ((40 - s) / 40) * 0.6;
            so.style.opacity = op.toFixed(3);
        }
        // Level 11 昼夜显示
        if (this.currentLevel === 11) {
            document.getElementById('level-indicator').textContent =
                'Level 11 - 无尽城市  [Class 1]  ' + (this._isNight ? '🌙 夜晚' : '🌞 白天');
        }

        const se = document.getElementById('status-effects');
        se.innerHTML = '';
        for (const e of this.player.statusEffects) {
            const d = document.createElement('div');
            d.className = 'status-effect';
            d.style.borderColor = e.color || '#888';
            d.textContent = e.name;
            se.appendChild(d);
        }
    }

    _refreshInventory() {
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';
        const items = this.inventory.getItems();
        for (let i = 0; i < this.inventory.maxSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot' + (i >= items.length ? ' empty' : '') + (i === this.inventory.selectedIndex ? ' selected' : '');
            if (i < items.length) {
                const item = items[i];
                slot.textContent = item.icon;
                if (item.stackable && item.count > 1) {
                    const c = document.createElement('span');
                    c.className = 'count'; c.textContent = item.count;
                    slot.appendChild(c);
                }
                slot.addEventListener('click', () => { this.inventory.selectItem(i); this._refreshInventory(); this._showItemDetails(item); });
                slot.addEventListener('dblclick', () => { this.inventory.useItem(i, this.player); this._refreshInventory(); });
            }
            grid.appendChild(slot);
        }
    }

    _showItemDetails(item) {
        const d = document.getElementById('inventory-details');
        d.innerHTML = item
            ? '<p><strong>' + item.name + '</strong> ' + item.icon + '</p><p>' + item.description + '</p>' + (item.stackable ? '<p>数量: ' + item.count + '</p>' : '')
            : '<p>选择一个物品查看详情</p>';
    }

    _navInv(dir) {
        const items = this.inventory.getItems();
        if (items.length === 0) return;
        let idx = this.inventory.selectedIndex + dir;
        if (idx < 0) idx = items.length - 1;
        if (idx >= items.length) idx = 0;
        this.inventory.selectItem(idx);
        this._refreshInventory();
        this._showItemDetails(items[idx]);
    }
}

document.addEventListener('DOMContentLoaded', () => { new BackroomsGame(); });
