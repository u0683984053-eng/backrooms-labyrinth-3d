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

    // f 版设定：Level 11 夜晚实体更活跃
    setNight(n) { this.night = !!n; }

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

    update(dt, player) {
        if (!player.alive) return;
        this.timer += dt;
        if (this.timer < 0.1) { this.entities.forEach(e => { if (e.alive) e.mesh.position.copy(e.pos); }); return; }
        this.timer = 0;

        for (const e of this.entities) {
            if (!e.alive) continue;
            const dist = e.pos.distanceTo(player.position);
            const effDet = e.detectionR * (1 + (player.noise || 0)) * (player.flashlightOn ? 1.8 : 1) * (this.night ? 1.5 : 1);

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
                    if (dist > effDet * 1.5 && e.chaseTimer > 3) { e.state = 'idle'; break; }
                    e.chaseTimer += dt;
                    if (e.chaseTimer > e.maxChaseDur) { e.state = 'idle'; break; }
                    e.target.copy(player.position);
                    this._moveTo(e, player.position, e.speed * 1.2 * dt * 10);
                    if (dist < 1.5) { e.state = 'attack'; e.attackCd = 0; }
                    break;
                case 'attack':
                    e.attackCd += dt;
                    if (e.attackCd >= e.attackInterval) {
                        player.takeDamage(e.def.damage);
                        if (this.audio) this.audio.playDamage();
                        e.attackCd = 0;
                        if (e.type === 'burster') { e.alive = false; e.mesh.visible = false; this.renderer.removeEntityMesh(e.mesh); }
                    }
                    if (dist > 3) e.state = 'chase';
                    break;
            }
        }
        this.entities = this.entities.filter(e => e.alive);
    }

    _moveTo(e, target, amount) {
        const d = new THREE.Vector3().subVectors(target, e.pos); d.y = 0;
        const len = d.length(); if (len < 0.1) return;
        d.normalize();
        e.pos.addScaledVector(d, Math.min(amount, len));
        e.mesh.position.copy(e.pos);
        e.mesh.lookAt(e.pos.x + d.x, e.pos.y, e.pos.z + d.z);
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
