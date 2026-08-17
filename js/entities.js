import * as THREE from 'three';
import { getEntityDef } from './config.js';

export class EntityManager {
    constructor(renderer, audio) {
        this.renderer = renderer;
        this.audio = audio || null;
        this.entities = [];
        this.timer = 0;
        this.night = false;
    }

    // f 版设定：Level 11 夜晚实体更活跃、游荡更远
    setNight(n) {
        this.night = !!n;
        for (const e of this.entities) {
            e.patrolR = (e.basePatrolR || e.patrolR) * (this.night ? 2.2 : 1);
        }
    }

    spawnEntities(spawnData) {
        this.clear();
        if (!spawnData || spawnData.length === 0) return;
        for (const sd of spawnData) {
            const def = getEntityDef(sd.type);
            if (!def) continue;
            const mesh = this.renderer.createEntityMesh(sd.type);
            mesh.position.set(sd.x, 1, sd.z);
            mesh.castShadow = true;
            this.renderer.addEntityMesh(mesh);
            this.entities.push({
                type: sd.type, def, mesh,
                pos: new THREE.Vector3(sd.x, 1, sd.z),
                spawn: new THREE.Vector3(sd.x, 1, sd.z),
                patrolR: sd.patrolRadius || 10,
                basePatrolR: sd.patrolRadius || 10,
                seed: Math.random() * Math.PI * 2,
                state: 'idle',
                target: new THREE.Vector3(),
                speed: def.speed, health: def.health,
                detectionR: def.detectionRadius,
                chaseTimer: 0, maxChaseDur: def.chaseDuration,
                attackCd: 0, attackInterval: 1.5,
                patrolTimer: 0, patrolDest: new THREE.Vector3(),
                alive: true,
            });
        }
    }

    update(dt, player, grid) {
        if (!player.alive) return;
        this.grid = grid || this.grid;
        this.timer += dt;
        if (this.timer < 0.1) { this.entities.forEach(e => { if (e.alive) e.mesh.position.copy(e.pos); }); return; }
        this.timer = 0;

        for (const e of this.entities) {
            if (!e.alive) continue;
            const dist = e.pos.distanceTo(player.position);
            // f 版设定：蹲下潜行大幅降低被发现的概率；手电筒/噪音吸引实体
            const stealth = player.isCrouching ? 0.55 : 1;
            const effDet = e.detectionR * (1 + (player.noise || 0)) * (player.flashlightOn ? 1.8 : 1) * (this.night ? 1.5 : 1) * stealth;

            // ---- f 版设定：死亡蛾是趋光的无害飞蛾，绕光源/玩家盘旋 ----
            if (e.type === 'deathmoth') {
                e.flyAngle = (e.flyAngle || Math.random() * Math.PI * 2) + dt * 2.2;
                const r = 4 + Math.sin(e.flyAngle * 0.7) * 2.5;
                e.pos.set(
                    player.position.x + Math.cos(e.flyAngle) * r,
                    2.0 + Math.sin(e.flyAngle * 1.3) * 0.9,
                    player.position.z + Math.sin(e.flyAngle) * r
                );
                e.mesh.position.copy(e.pos);
                e.mesh.rotation.y = -e.flyAngle + Math.PI / 2;
                continue;
            }

            // ---- f 版设定：恐惧音效与理智侵蚀 ----
            if (e.state === 'chase' || e.state === 'attack') {
                e.soundTimer = (e.soundTimer || 0) - dt;
                if (e.soundTimer <= 0) {
                    if (e.type === 'hound' && this.audio) this.audio.playBark();
                    if (e.type === 'scratcher' && this.audio) this.audio.playScratch();
                    if (e.type === 'partygoer' && this.audio) this.audio.playParty();
                    e.soundTimer = 4 + Math.random() * 3;
                }
                // 微笑者：被其注视会加速理智流失（f 版设定）
                if (e.type === 'smiler' && dist < 12) {
                    player.sanity = Math.max(0, player.sanity - 4 * dt);
                }
            }

            switch (e.state) {
                case 'idle':
                    if (dist < effDet) { e.state = 'alert'; e.target.copy(player.position); }
                    else if (Math.random() < 0.02) { e.state = 'patrol'; this._patrolTarget(e); }
                    break;
                case 'patrol':
                    if (dist < effDet) { e.state = 'alert'; break; }
                    this._moveTo(e, e.patrolDest, e.speed * 0.4 * dt * 10);
                    e.patrolTimer -= dt;
                    if (e.patrolTimer <= 0 || e.pos.distanceTo(e.patrolDest) < 1.5) e.state = 'idle';
                    break;
                case 'alert':
                    e.state = 'chase'; e.chaseTimer = 0;
                    break;
                case 'chase':
                    if (dist > effDet * 1.5 && e.chaseTimer > 3) { e.state = 'returning'; break; }
                    e.chaseTimer += dt;
                    if (e.chaseTimer > e.maxChaseDur) { e.state = 'returning'; break; }
                    e.target.copy(player.position);
                    // f 版设定：派对客的追逐诡异而有节奏（追一会儿、停一会儿）
                    if (e.type === 'partygoer') {
                        e.weirdT = (e.weirdT || 0) + dt;
                        if (e.weirdT % 6.5 < 1.5) break; // 站在原地"邀请"你
                    }
                    this._moveTo(e, player.position, e.speed * 1.2 * dt * 10);
                    if (dist < 1.5) { e.state = 'attack'; e.attackCd = 0; }
                    break;
                case 'returning':
                    // f 版设定：实体有领地意识，追丢后返回出生地
                    this._moveTo(e, e.spawn, e.speed * 0.45 * dt * 10);
                    if (e.pos.distanceTo(e.spawn) < 2) e.state = 'idle';
                    break;
                case 'attack':
                    e.attackCd += dt;
                    if (e.attackCd >= e.attackInterval) {
                        player.takeDamage(e.def.damage);
                        player.lastAttacker = e.def.name;
                        if (this.audio) this.audio.playDamage();
                        e.attackCd = 0;
                        if (e.type === 'burster') { e.alive = false; e.mesh.visible = false; this.renderer.removeEntityMesh(e.mesh); }
                    }
                    if (dist > 3) e.state = 'chase';
                    break;
            }
        }
        this.entities = this.entities.filter(e => e.alive);
        // 实体呼吸浮动（生物感，顶级 3D 的活物表现）
        for (const e of this.entities) {
            if (e.type === 'deathmoth') continue;
            e.mesh.position.y = e.pos.y + Math.sin(this.timer * 2.2 + e.seed) * 0.05;
        }
        // 猎犬奔跑摆腿 / 飞蛾扑翅动画
        for (const e of this.entities) {
            if (!e.alive) continue;
            if (e.type === 'hound' && e.mesh.userData && e.mesh.userData.legs) {
                const running = e.state === 'chase' ? 1 : 0.25;
                const t = this.timer * 12;
                e.mesh.userData.legs.forEach((leg, i) => {
                    leg.rotation.x = Math.sin(t + (i % 2) * Math.PI) * 0.55 * running;
                });
            } else if (e.type === 'deathmoth' && e.mesh.userData && e.mesh.userData.wings) {
                const flap = Math.sin(this.timer * 22 + e.seed) * 0.5;
                e.mesh.userData.wings[0].rotation.z = flap;
                e.mesh.userData.wings[1].rotation.z = -flap;
            }
        }
    }

    _moveTo(e, target, amount) {
        const d = new THREE.Vector3().subVectors(target, e.pos); d.y = 0;
        const len = d.length(); if (len < 0.1) return;
        d.normalize();
        const step = Math.min(amount, len);
        if (this.grid) {
            // 避障：实体 AABB 与格边界墙相交才阻挡（滑动绕行，实体不再穿墙也不卡格）
            const blocked = (px, pz) => {
                const gx = Math.floor(px / 5), gz = Math.floor(pz / 5);
                if (gx < 0 || gx >= this.grid.length || gz < 0 || gz >= this.grid[0].length) return true;
                const c = this.grid[gx][gz];
                const R = 0.3;
                const lx = px - gx * 5, lz = pz - gz * 5;
                if (c.walls[0] && lz < -2.5 + 0.15 + R) return true;
                if (c.walls[1] && lx > 2.5 - 0.15 - R) return true;
                if (c.walls[2] && lz > 2.5 - 0.15 - R) return true;
                if (c.walls[3] && lx < -2.5 + 0.15 + R) return true;
                return false;
            };
            const nx = e.pos.x + d.x * step, nz = e.pos.z + d.z * step;
            if (!blocked(nx, nz)) {
                e.pos.x = nx; e.pos.z = nz;
            } else if (!blocked(e.pos.x + d.x * step, e.pos.z)) {
                e.pos.x += d.x * step;
            } else if (!blocked(e.pos.x, e.pos.z + d.z * step)) {
                e.pos.z += d.z * step;
            }
        } else {
            e.pos.addScaledVector(d, step);
        }
        e.mesh.position.copy(e.pos);
        e.mesh.lookAt(e.pos.x + d.x, e.pos.y, e.pos.z + d.z);
        // 移动姿态：人形/四足实体前倾（奔跑感，顶级 3D 的活物表现）
        if (e.type === 'hound' || e.type === 'duller' || e.type === 'skin_stealer' || e.type === 'clump' || e.type === 'partygoer') {
            const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.14);
            e.mesh.quaternion.multiply(tilt);
        }
    }

    _patrolTarget(e) {
        const a = Math.random() * Math.PI * 2;
        const r = e.patrolR * (0.3 + Math.random() * 0.7);
        e.patrolDest.set(e.spawn.x + Math.cos(a) * r, e.spawn.y, e.spawn.z + Math.sin(a) * r);
        e.patrolTimer = 3 + Math.random() * 8;
    }

    clear() {
        for (const e of this.entities) this.renderer.removeEntityMesh(e.mesh);
        this.entities = [];
    }

    // 实体受到伤害（f 版设定：火盐等少数手段能对抗实体）
    damageEntity(e, dmg) {
        if (!e || !e.alive) return;
        e.health -= dmg;
        if (e.health <= 0) {
            e.alive = false;
            e.mesh.visible = false;
            this.renderer.removeEntityMesh(e.mesh);
        }
    }

    getEntitiesInRange(pos, range) {
        return this.entities.filter(e => e.alive && e.pos.distanceTo(pos) <= range);
    }
}
