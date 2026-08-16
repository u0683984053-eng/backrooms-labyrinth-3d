import * as THREE from 'three';

const WALK = 8, RUN = 14, Q_SPRINT = 28, DBL_SPRINT = 42;
const STAMINA_MAX = 100, STAMINA_REGEN = 20;
const DRAIN_Q = 28, DRAIN_DBL = 42;
const CROUCH_SPEED = 4;
const PLAYER_H = 1.7, CROUCH_H = 1.0;
const RADIUS = 0.35;
const GRAVITY = 26;        // 重力
const JUMP_V = 9.6;        // 起跳初速（跳高 ≈ v²/2g ≈ 1.77）

export class Player {
    constructor(camera) {
        this.camera = camera;
        this.position = new THREE.Vector3(0, PLAYER_H, 0);
        this.yaw = 0; this.pitch = 0;
        this.health = 100; this.maxHealth = 100;
        this.stamina = STAMINA_MAX; this.maxStamina = STAMINA_MAX;
        this.sanity = 100;
        this.isCrouching = false;
        this.flashlightOn = false;
        this.noise = 0;
        this.alive = true;
        this.statusEffects = [];
        this.height = PLAYER_H;
        // 3D 物理状态
        this.vy = 0;
        this.onGround = true;
        this.isMoving = false;
        this.platforms = [];
        // 理智流失速率（黑暗层级更高，f 版设定：心理危害）
        this.sanityDrain = 0.3;
    }

    update(dt, input, grid, cellSize, platforms) {
        if (!this.alive) return;
        if (platforms) this.platforms = platforms;

        const { forward, right } = input.getInputVector();
        const len = Math.sqrt(forward * forward + right * right);
        let speed = WALK;
        let drain = 0;

        if (len > 0.01 && input.isSprinting() && this.stamina > 0) {
            speed = Q_SPRINT;
            drain = DRAIN_Q;
        } else if (this.isCrouching) {
            speed = CROUCH_SPEED;
        } else {
            speed = len > 0.01 ? RUN : WALK;
        }

        this.stamina = drain > 0 && len > 0.01
            ? Math.max(0, this.stamina - drain * dt)
            : Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * dt);
        if (this.stamina <= 0) speed = WALK;

        if (speed >= DBL_SPRINT) this.noise = 0.9;
        else if (speed >= Q_SPRINT) this.noise = 0.7;
        else if (speed >= RUN) this.noise = 0.4;
        else this.noise = 0.05;
        if (this.isCrouching) this.noise *= 0.5;

        // 鼠标视角
        const { dx, dy } = input.getMovement();
        this.yaw -= dx;
        this.pitch = Math.max(-1.0, Math.min(1.0, this.pitch - dy));
        this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

        // 移动方向
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        fwd.y = 0; fwd.normalize();
        const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        rgt.y = 0; rgt.normalize();

        const mv = new THREE.Vector3();
        mv.addScaledVector(fwd, forward);
        mv.addScaledVector(rgt, right);
        if (mv.length() > 0) mv.normalize();

        // 蹲伏高度过渡
        this.height += ((this.isCrouching ? CROUCH_H : PLAYER_H) - this.height) * 10 * dt;
        this.isMoving = len > 0.01 && this.onGround;

        // ---- 3D 垂直物理 ----
        // 跳跃（空格）
        if (input.isPressed('KeySpace') && this.onGround) {
            this.vy = JUMP_V;
            this.onGround = false;
        }
        this.vy -= GRAVITY * dt;
        if (this.vy < -40) this.vy = -40;

        // 水平移动 + XZ 碰撞（子步进：每步 ≤0.55m，防止高速冲刺穿透薄墙）
        const np = this.position.clone().addScaledVector(mv, speed * dt);
        const dir = mv.length() > 0 ? mv.clone().normalize() : new THREE.Vector3();
        let rp = this.position.clone();
        let remaining = this.position.distanceTo(np);
        if (dir.length() > 0) {
            while (remaining > 0.0001) {
                const step = Math.min(0.55, remaining);
                const next = rp.clone().addScaledVector(dir, step);
                const after = this._collide(next, grid, cellSize);
                if (after.distanceTo(next) > 0.01) break; // 被墙挡住，停止本帧移动
                rp = after;
                remaining -= step;
            }
        }
        rp.y = this.position.y + this.vy * dt; // 垂直只受重力/跳跃影响

        // 平台站立检测
        const prevFoot = this.position.y - this.height;
        const foot = rp.y - this.height;
        let standTop = -1;
        for (const p of this.platforms) {
            const halfW = p.w / 2, halfD = p.d / 2;
            const inside = Math.abs(rp.x - p.x) < halfW - RADIUS * 0.5 && Math.abs(rp.z - p.z) < halfD - RADIUS * 0.5;
            if (!inside) continue;
            if (prevFoot >= p.top - 0.12 && foot <= p.top && this.vy <= 0) {
                if (p.top > standTop) standTop = p.top;
            }
        }
        if (standTop >= 0) {
            rp.y = standTop + this.height;
            this.vy = 0;
            this.onGround = true;
        } else if (rp.y <= this.height) {
            // 地面
            rp.y = this.height;
            this.vy = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // 头顶碰撞：从平台下方起跳会被平台底面挡住（防止跳进实心平台内部卡住）
        if (this.vy > 0) {
            for (const p of this.platforms) {
                if (Math.abs(rp.x - p.x) < p.w / 2 && Math.abs(rp.z - p.z) < p.d / 2) {
                    if (prevFoot < p.top && rp.y > p.top) {
                        rp.y = p.top - 1.6; // 头顶顶在平台底面
                        this.vy = 0;
                        break;
                    }
                }
            }
        }

        this.position.copy(rp);
        this.camera.position.copy(this.position);

        this.sanity = Math.max(0, this.sanity - (this.sanityDrain || 0.3) * dt);
        this._tickEffects(dt);
    }

    _collide(pos, grid, cellSize) {
        if (!grid) return pos;
        const r = pos.clone();
        const cx = Math.floor(pos.x / cellSize);
        const cz = Math.floor(pos.z / cellSize);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const gx = cx + dx, gz = cz + dy;
                if (gx < 0 || gx >= grid.length || gz < 0 || gz >= grid[0].length) continue;
                const c = grid[gx][gz];
                const wx = gx * cellSize, wz = gz * cellSize;
                const h = cellSize / 2;

                // 墙碰撞：玩家 AABB 与墙段相交时，按玩家所在侧推出（双向，防穿墙）
                // 北墙（z = wz - h）
                if (c.walls[0] && Math.abs(pos.z - (wz - h)) < 0.15 + RADIUS && Math.abs(pos.x - wx) < h + RADIUS) {
                    r.z = (pos.z > wz - h) ? wz - h - 0.15 - RADIUS : wz - h + 0.15 + RADIUS;
                }
                // 东墙（x = wx + h）
                if (c.walls[1] && Math.abs(pos.x - (wx + h)) < 0.15 + RADIUS && Math.abs(pos.z - wz) < h + RADIUS) {
                    r.x = (pos.x < wx + h) ? wx + h - 0.15 - RADIUS : wx + h + 0.15 + RADIUS;
                }
                // 南墙（z = wz + h）
                if (c.walls[2] && Math.abs(pos.z - (wz + h)) < 0.15 + RADIUS && Math.abs(pos.x - wx) < h + RADIUS) {
                    r.z = (pos.z < wz + h) ? wz + h - 0.15 - RADIUS : wz + h + 0.15 + RADIUS;
                }
                // 西墙（x = wx - h）
                if (c.walls[3] && Math.abs(pos.x - (wx - h)) < 0.15 + RADIUS && Math.abs(pos.z - wz) < h + RADIUS) {
                    r.x = (pos.x > wx - h) ? wx - h - 0.15 - RADIUS : wx - h + 0.15 + RADIUS;
                }
            }
        }

        // 平台 XZ 推挤（站在平台上时放行）
        const foot = pos.y - this.height;
        for (const p of this.platforms) {
            const halfW = p.w / 2, halfD = p.d / 2;
            if (foot >= p.top - 0.12) continue; // 已经在平台上（可自由走动）
            if (r.x + RADIUS > p.x - halfW && r.x - RADIUS < p.x + halfW &&
                r.z + RADIUS > p.z - halfD && r.z - RADIUS < p.z + halfD) {
                const dx1 = (r.x - RADIUS) - (p.x - halfW);
                const dx2 = (p.x + halfW) - (r.x + RADIUS);
                const dz1 = (r.z - RADIUS) - (p.z - halfD);
                const dz2 = (p.z + halfD) - (r.z + RADIUS);
                const m = Math.min(dx1, dx2, dz1, dz2);
                if (m === dx1) r.x = p.x - halfW + RADIUS;
                else if (m === dx2) r.x = p.x + halfW + RADIUS;
                else if (m === dz1) r.z = p.z - halfD + RADIUS;
                else r.z = p.z + halfD + RADIUS;
            }
        }
        return r;
    }

    crouch(v) { this.isCrouching = v; }
    toggleFlashlight() { this.flashlightOn = !this.flashlightOn; return this.flashlightOn; }
    takeDamage(n) { this.health = Math.max(0, this.health - n); if (this.health <= 0) this.alive = false; }
    heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }
    addStatusEffect(e) { this.statusEffects.push(e); }
    _tickEffects(dt) {
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            this.statusEffects[i].duration -= dt;
            if (this.statusEffects[i].duration <= 0) this.statusEffects.splice(i, 1);
        }
    }
    respawn(pos) {
        this.position.copy(pos); this.position.y = PLAYER_H;
        this.camera.position.copy(this.position);
        this.health = this.maxHealth; this.stamina = this.maxStamina;
        this.sanity = 100; this.alive = true; this.statusEffects = [];
        this.height = PLAYER_H;
        this.vy = 0; this.onGround = true;
    }
}
