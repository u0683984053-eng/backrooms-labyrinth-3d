import * as THREE from 'three';
import { MazeRenderFlags } from './config.js';

const WALL_H = 3.5;
const CELL_S = 5;
const SKIRT_H = 0.22;   // 墙脚线高度
const RAIL_H = 0.16;    // 墙顶装饰线高度
const WALL_T = 0.3;     // 墙厚

// ---------------------------------------------------------------
// 程序化纹理（CanvasTexture）—— 后室标志性观感
// ---------------------------------------------------------------
function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

function makeWallpaperTexture() {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    // 底色：泛黄的墙纸
    g.fillStyle = '#d9c893';
    g.fillRect(0, 0, 512, 512);
    // 竖向条纹暗纹
    for (let x = 0; x < 512; x += 32) {
        g.fillStyle = x % 64 === 0 ? 'rgba(120,100,50,0.10)' : 'rgba(90,75,40,0.07)';
        g.fillRect(x, 0, 16, 512);
    }
    // 污渍 / 水渍
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 8 + Math.random() * 42;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(110,95,55,' + (0.05 + Math.random() * 0.1).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(110,95,55,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 细裂纹
    g.strokeStyle = 'rgba(80,70,40,0.25)';
    for (let i = 0; i < 12; i++) {
        g.beginPath();
        let x = Math.random() * 512, y = Math.random() * 512;
        g.moveTo(x, y);
        for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); }
        g.stroke();
    }
    // 颗粒噪点
    const img = g.getImageData(0, 0, 512, 512);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 22;
        d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.7;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    t.anisotropy = 8;
    return t;
}

function makeCarpetTexture() {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = '#8a7a4a';
    g.fillRect(0, 0, 512, 512);
    // 地毯纤维噪点
    const img = g.getImageData(0, 0, 512, 512);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 46;
        d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.6;
    }
    g.putImageData(img, 0, 0);
    // 潮湿地毯的深色污渍
    for (let i = 0; i < 26; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 12 + Math.random() * 55;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(40,32,16,' + (0.08 + Math.random() * 0.14).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(40,32,16,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 拼接缝
    g.strokeStyle = 'rgba(50,40,20,0.5)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
}

function makeCeilingTexture() {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = '#c9c9b4';
    g.fillRect(0, 0, 512, 512);
    // 天花板砖格
    g.strokeStyle = 'rgba(90,90,75,0.35)';
    g.lineWidth = 3;
    for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
    for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    // 污渍 / 发霉点
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * 512, y = Math.random() * 512, r = 4 + Math.random() * 26;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(80,70,50,' + (0.05 + Math.random() * 0.12).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(80,70,50,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
}

function makeSmileTexture() {
    // 微笑者：白底笑脸（黑色眼睛 + 咧嘴笑）
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f0';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#101010';
    // 眼睛
    g.beginPath(); g.ellipse(92, 96, 20, 26, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(164, 96, 20, 26, 0, 0, Math.PI * 2); g.fill();
    // 大嘴
    g.beginPath(); g.ellipse(128, 172, 52, 40, 0, 0, Math.PI); g.fill();
    // 牙齿
    g.fillStyle = '#f2f2f0';
    for (let i = 0; i < 6; i++) {
        g.fillRect(104 + i * 9, 168, 6, 12);
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
}

function makeCrateTexture() {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#8a6a3a';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(50,35,15,0.9)';
    g.lineWidth = 10;
    g.strokeRect(6, 6, 244, 244);
    g.beginPath(); g.moveTo(6, 6); g.lineTo(250, 250); g.stroke();
    g.beginPath(); g.moveTo(250, 6); g.lineTo(6, 250); g.stroke();
    g.strokeRect(110, 6, 36, 244);
    for (let i = 0; i < 60; i++) {
        g.fillStyle = 'rgba(40,28,12,' + (Math.random() * 0.18).toFixed(2) + ')';
        g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 2 + Math.random() * 5);
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
}

// ---------------------------------------------------------------
// 渲染器
// ---------------------------------------------------------------
export class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a05);

        this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.1, 260);

        this.mazeGroup = new THREE.Group();
        this.buildingGroup = new THREE.Group();
        this.treeGroup = new THREE.Group();
        this.decoGroup = new THREE.Group();
        this.entityGroup = new THREE.Group();
        this.flashGroup = new THREE.Group();
        this.platformGroup = new THREE.Group();
        this.scene.add(this.mazeGroup, this.buildingGroup, this.treeGroup, this.decoGroup, this.entityGroup, this.flashGroup, this.platformGroup);

        // 程序化纹理
        this.texWall = makeWallpaperTexture();
        this.texFloor = makeCarpetTexture();
        this.texCeil = makeCeilingTexture();
        this.texSmile = makeSmileTexture();
        this.texCrate = makeCrateTexture();

        // 材质
        this.wallMat = new THREE.MeshStandardMaterial({ map: this.texWall, roughness: 0.88, metalness: 0.0 });
        this.floorMat = new THREE.MeshStandardMaterial({ map: this.texFloor, roughness: 0.95, metalness: 0.0 });
        this.ceilMat = new THREE.MeshStandardMaterial({ map: this.texCeil, roughness: 0.8, metalness: 0.05 });
        this.skirtMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.9 });
        this.railMat = new THREE.MeshStandardMaterial({ color: 0x6a5a38, roughness: 0.85 });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92 });
        this.crateMat = new THREE.MeshStandardMaterial({ map: this.texCrate, roughness: 0.85 });
        this.lampMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 1.6, roughness: 0.4
        });

        this.ceilingLights = [];
        this.lampMeshes = [];
        this._setupLighting();

        // 手电筒
        this.flashlight = new THREE.SpotLight(0xfff6d0, 5, 34, Math.PI / 6.5, 0.42, 1.1);
        this.flashlight.castShadow = true;
        this.flashlight.shadow.mapSize.set(1024, 1024);
        this.flashlight.visible = false;
        this.flashGroup.add(this.flashlight);
        this.flashGroup.add(this.flashlight.target);

        // 手电筒光锥（半透明辅助体，制造体积感）
        const coneGeo = new THREE.ConeGeometry(2.6, 9, 24, 1, true);
        this.flashCone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
            color: 0xfff2c0, transparent: true, opacity: 0.09,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        }));
        this.flashCone.visible = false;
        this.flashGroup.add(this.flashCone);

        // 第一人称手电筒模型（挂在相机下）
        this.viewModelGroup = new THREE.Group();
        this.viewModelGroup.position.set(0.28, -0.26, -0.55);
        const torchBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.028, 0.036, 0.26, 10),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.7 })
        );
        torchBody.rotation.x = Math.PI / 2.4;
        const torchHead = new THREE.Mesh(
            new THREE.CylinderGeometry(0.042, 0.03, 0.07, 10),
            new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.3, metalness: 0.8 })
        );
        torchHead.rotation.x = Math.PI / 2.4;
        torchHead.position.z = -0.15;
        this.viewModelGroup.add(torchBody, torchHead);
        this.viewModelGroup.visible = false;
        this.camera.add(this.viewModelGroup);
        this.scene.add(this.camera);

        // 行走晃动
        this.bobTime = 0;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _setupLighting() {
        this.ambient = new THREE.AmbientLight(0x4a4630, 1.35);
        this.scene.add(this.ambient);

        this.hemi = new THREE.HemisphereLight(0x8a8470, 0x3a3520, 0.5);
        this.scene.add(this.hemi);

        // 荧光灯组：灯板（发光）+ 少量点光源（控制光源数量保证性能）
        this.ceilingLights = [];
        this.lampMeshes = [];
        const lg = new THREE.Group();
        let li = 0;
        for (let x = -70; x <= 70; x += 10) {
            for (let z = -70; z <= 70; z += 10) {
                // 发光灯板（贴天花板）
                const lamp = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5), this.lampMat);
                lamp.rotation.x = Math.PI / 2;
                lamp.position.set(x, WALL_H - 0.04, z);
                lg.add(lamp);
                this.lampMeshes.push(lamp);
                // 每 2 格一个真实点光源
                if (li % 4 === 0) {
                    const pl = new THREE.PointLight(0xfff0c0, 1.6, 26, 1.6);
                    pl.position.set(x, WALL_H - 0.5, z);
                    lg.add(pl);
                    this.ceilingLights.push(pl);
                }
                li++;
            }
        }
        this.scene.add(lg);
    }

    setLevelConfig(config) {
        this.config = config;
        const flags = config.renderFlags || [];

        // 更淡的雾：远处墙仍可见 → 空间感 / 立体感
        const fogDensity = flags.includes(MazeRenderFlags.FOG_HEAVY) ? 0.0013
            : flags.includes(MazeRenderFlags.NO_FOG) ? 0.00015 : 0.0007;
        this.scene.fog = new THREE.FogExp2(0x0a0a05, fogDensity);

        const dark = flags.includes(MazeRenderFlags.DARKNESS);
        this.ambient.intensity = dark ? 0.09 : 1.35;
        this.hemi.intensity = dark ? 0.03 : 0.5;
        for (const l of this.ceilingLights) l.intensity = dark ? 0 : 1.6;
        this.lampMeshes.forEach(m => m.material.emissiveIntensity = dark ? 0.04 : 1.6);
        this.renderer.toneMappingExposure = dark ? 0.9 : 1.15;

        const ds = flags.includes(MazeRenderFlags.DOUBLE_SIDED);
        const wf = flags.includes(MazeRenderFlags.WIREFRAME);
        this.wallMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.wallMat.wireframe = wf;
        this.floorMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.floorMat.wireframe = wf;
        this.ceilMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.ceilMat.wireframe = wf;

        const noCeil = flags.includes(MazeRenderFlags.NO_CEILING);
        this._hasCeiling = !noCeil;
        this._openBorder = flags.includes(MazeRenderFlags.OPEN_BORDER);
    }

    buildMaze(mazeData) {
        this.mazeGroup.clear();
        this.buildingGroup.clear();
        this.treeGroup.clear();
        this.decoGroup.clear();
        this.entityGroup.clear();
        this.platformGroup.clear();

        const { grid, buildings, trees, decorations, exitPos, platforms } = mazeData;
        if (!grid) return;

        const openBorder = this._openBorder;

        const wallBodyN = new THREE.BoxGeometry(CELL_S, WALL_H, WALL_T);
        const wallBodyZ = new THREE.BoxGeometry(WALL_T, WALL_H, CELL_S);
        const skirtN = new THREE.BoxGeometry(CELL_S, SKIRT_H, WALL_T + 0.08);
        const skirtZ = new THREE.BoxGeometry(WALL_T + 0.08, SKIRT_H, CELL_S);
        const railN = new THREE.BoxGeometry(CELL_S, RAIL_H, WALL_T + 0.06);
        const railZ = new THREE.BoxGeometry(WALL_T + 0.06, RAIL_H, CELL_S);
        const fg = new THREE.PlaneGeometry(CELL_S, CELL_S);

        for (let x = 0; x < grid.length; x++) {
            for (let y = 0; y < grid[0].length; y++) {
                const cell = grid[x][y];
                const wx = x * CELL_S;
                const wz = y * CELL_S;

                // 地板
                const floor = new THREE.Mesh(fg, this._getFloorMat());
                floor.rotation.x = -Math.PI / 2;
                floor.position.set(wx, 0, wz);
                floor.receiveShadow = true;
                this.mazeGroup.add(floor);

                // 天花板
                if (this._hasCeiling) {
                    const ceil = new THREE.Mesh(fg, this.ceilMat);
                    ceil.rotation.x = -Math.PI / 2;
                    ceil.position.set(wx, WALL_H, wz);
                    this.mazeGroup.add(ceil);
                }

                // 四面墙：主体 + 墙脚线 + 顶线
                const walls = [
                    { hit: cell.walls[0] && (!openBorder || y > 0), g: wallBodyN, p: [wx, WALL_H / 2, wz - CELL_S / 2] },
                    { hit: cell.walls[1] && (!openBorder || x < grid.length - 1), g: wallBodyZ, p: [wx + CELL_S / 2, WALL_H / 2, wz] },
                    { hit: cell.walls[2] && (!openBorder || y < grid[0].length - 1), g: wallBodyN, p: [wx, WALL_H / 2, wz + CELL_S / 2] },
                    { hit: cell.walls[3] && (!openBorder || x > 0), g: wallBodyZ, p: [wx - CELL_S / 2, WALL_H / 2, wz] },
                ];
                for (const wd of walls) {
                    if (!wd.hit) continue;
                    const w = new THREE.Mesh(wd.g, this.wallMat);
                    w.position.set(wd.p[0], wd.p[1], wd.p[2]);
                    w.castShadow = true; w.receiveShadow = true;
                    this.mazeGroup.add(w);

                    // 墙脚线
                    const sk = new THREE.Mesh(wd.g === wallBodyN ? skirtN : skirtZ, this.skirtMat);
                    sk.position.set(wd.p[0], SKIRT_H / 2 + 0.01, wd.p[2]);
                    this.mazeGroup.add(sk);
                    // 墙顶线
                    const rl = new THREE.Mesh(wd.g === wallBodyN ? railN : railZ, this.railMat);
                    rl.position.set(wd.p[0], WALL_H - RAIL_H / 2 - 0.01, wd.p[2]);
                    this.mazeGroup.add(rl);
                }
            }
        }

        // 夹层平台 / 可跳上的箱子（真正的垂直维度）
        if (platforms && platforms.length) {
            for (const p of platforms) {
                const top = p.top;
                if (p.type === 'step') {
                    // 台阶
                    const s = new THREE.Mesh(new THREE.BoxGeometry(p.w, top, p.d), this.concreteMat);
                    s.position.set(p.x, top / 2, p.z);
                    s.castShadow = true; s.receiveShadow = true;
                    this.platformGroup.add(s);
                } else if (p.type === 'crate') {
                    const cr = new THREE.Mesh(new THREE.BoxGeometry(p.w, top, p.d), this.crateMat);
                    cr.position.set(p.x, top / 2, p.z);
                    cr.castShadow = true; cr.receiveShadow = true;
                    this.platformGroup.add(cr);
                } else {
                    // 高台 / 平台
                    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, top, p.d), this.concreteMat);
                    box.position.set(p.x, top / 2, p.z);
                    box.castShadow = true; box.receiveShadow = true;
                    this.platformGroup.add(box);
                    // 侧面条纹（提示可攀爬）
                    const stripe = new THREE.Mesh(
                        new THREE.BoxGeometry(p.w + 0.02, 0.06, p.d + 0.02),
                        new THREE.MeshStandardMaterial({ color: 0xc8a830, roughness: 0.7, emissive: 0x201800, emissiveIntensity: 0.6 })
                    );
                    stripe.position.set(p.x, top - 0.12, p.z);
                    this.platformGroup.add(stripe);
                }
            }
        }

        // 建筑（城市等层级）
        if (buildings) {
            const bm = new THREE.MeshStandardMaterial({ color: 0x6e6e74, roughness: 0.85, metalness: 0.15 });
            const windowMat = new THREE.MeshStandardMaterial({
                color: 0x22242a, roughness: 0.2, metalness: 0.5,
                emissive: 0x22242a, emissiveIntensity: 0.3
            });
            for (const b of buildings) {
                const bg = new THREE.BoxGeometry(b.width - 1, b.height, b.depth - 1);
                const mesh = new THREE.Mesh(bg, bm);
                mesh.position.set(b.x, b.height / 2, b.z);
                mesh.castShadow = true; mesh.receiveShadow = true;
                this.buildingGroup.add(mesh);
                // 窗户带
                const cols = Math.max(2, Math.floor(b.width / 4));
                const rows = Math.max(2, Math.floor(b.height / 4));
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), windowMat);
                        win.position.set(
                            b.x - b.width / 2 + 2 + i * (b.width - 4) / Math.max(1, cols - 1),
                            b.height / 2 - 3 - j * (b.height - 5) / Math.max(1, rows - 1),
                            b.z + b.depth / 2 + 0.02
                        );
                        this.buildingGroup.add(win);
                    }
                }
            }
        }

        // 树木
        if (trees) {
            const tkm = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95 });
            const crm = new THREE.MeshStandardMaterial({ color: 0x1f4a10, roughness: 0.9 });
            for (const t of trees) {
                const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, t.height * 0.5, 7), tkm);
                tk.position.set(t.x, t.height * 0.25, t.z);
                tk.castShadow = true;
                this.treeGroup.add(tk);
                const cr = new THREE.Mesh(new THREE.SphereGeometry(t.height * 0.28, 7, 5), crm);
                cr.position.set(t.x, t.height * 0.72, t.z);
                cr.castShadow = true;
                this.treeGroup.add(cr);
            }
        }

        // 装饰物（原版生成了数据但从未渲染！）
        if (decorations) {
            for (const d of decorations) {
                if (d.type === 'pillar') {
                    const p = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.45, 0.55, WALL_H, 8),
                        new THREE.MeshStandardMaterial({ color: 0x5a5548, roughness: 0.9 })
                    );
                    p.position.set(d.x, WALL_H / 2, d.z);
                    p.castShadow = true;
                    this.decoGroup.add(p);
                } else if (d.type === 'shelf') {
                    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.85 });
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.12), shelfMat);
                    frame.position.set(d.x, 1.2, d.z);
                    frame.castShadow = true;
                    this.decoGroup.add(frame);
                    for (let i = 0; i < 3; i++) {
                        const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.0), shelfMat);
                        board.position.set(d.x, 0.5 + i * 0.8, d.z);
                        this.decoGroup.add(board);
                    }
                    // 货架上的杂物
                    for (let i = 0; i < 4; i++) {
                        const it = new THREE.Mesh(
                            new THREE.BoxGeometry(0.35 + Math.random() * 0.4, 0.3 + Math.random() * 0.35, 0.35 + Math.random() * 0.4),
                            new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.12, 0.35), roughness: 0.9 })
                        );
                        it.position.set(d.x - 0.9 + Math.random() * 1.8, 0.55 + Math.floor(Math.random() * 3) * 0.8 + 0.25, d.z);
                        this.decoGroup.add(it);
                    }
                } else if (d.type === 'pipe') {
                    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.6 });
                    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4, 8), pipeMat);
                    pipe.rotation.x = Math.PI / 2;
                    pipe.position.set(d.x, 2.6 + (d.z % 2) * 0.5, d.z);
                    pipe.castShadow = true;
                    this.decoGroup.add(pipe);
                }
            }
        }

        // 出口标记
        if (exitPos) {
            const em = new THREE.MeshStandardMaterial({ color: 0x40ff40, emissive: 0x22aa22, roughness: 0.3 });
            const eg = new THREE.BoxGeometry(1, 0.2, 1);
            const exit = new THREE.Mesh(eg, em);
            exit.position.set(exitPos.x, 0.15, exitPos.z);
            exit.name = 'exitMarker';
            this.mazeGroup.add(exit);
            // 出口光柱
            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.35, 0.35, 4, 10, 1, true),
                new THREE.MeshBasicMaterial({ color: 0x40ff40, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
            );
            beam.position.set(exitPos.x, 2.1, exitPos.z);
            this.mazeGroup.add(beam);
        }
    }

    _getFloorMat() {
        if (!this.config) return this.floorMat;
        switch (this.config.terrainType) {
            case 'caves': return new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95, map: this.texFloor });
            case 'aquatic': return new THREE.MeshStandardMaterial({ color: 0x1a3355, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.75 });
            case 'forest': return new THREE.MeshStandardMaterial({ color: 0x2a4a10, roughness: 0.9 });
            case 'snow': return new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.6 });
            case 'desert': return new THREE.MeshStandardMaterial({ color: 0xc8b060, roughness: 0.95 });
            case 'void': return new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.3 });
            default: return this.floorMat;
        }
    }

    updateFlashlight(player, flickerTime) {
        if (!this.flashlight) return;
        this.flashlight.position.copy(player.position);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.camera.quaternion);
        this.flashlight.target.position.copy(player.position.clone().add(dir));
        this.flashlight.visible = player.flashlightOn;
        this.flashCone.visible = player.flashlightOn;

        // 手电筒模型跟随相机
        this.viewModelGroup.visible = player.flashlightOn;
        this.viewModelGroup.quaternion.copy(player.camera.quaternion);

        // 光锥跟随
        if (player.flashlightOn) {
            this.flashCone.position.copy(player.position.clone().addScaledVector(dir, 4.5));
            this.flashCone.quaternion.copy(player.camera.quaternion);
            const flicker = this.config && this.config.renderFlags && this.config.renderFlags.includes(MazeRenderFlags.FLICKERING_LIGHTS);
            if (flicker) {
                const f = Math.sin(flickerTime * 15) * 0.5 + 2.5;
                this.flashlight.intensity = f;
                this.flashCone.material.opacity = 0.05 + Math.sin(flickerTime * 19) * 0.03;
            } else {
                this.flashlight.intensity = 5;
                this.flashCone.material.opacity = 0.09;
            }
        }

        // 行走晃动
        if (player.isMoving) {
            this.bobTime += 0.09;
            this.viewModelGroup.position.y = -0.26 + Math.sin(this.bobTime) * 0.012;
        } else {
            this.bobTime = 0;
            this.viewModelGroup.position.y = -0.26;
        }
    }

    createEntityMesh(type) {
        const colors = {
            smiler: 0xffffff, hound: 0x4a2020, duller: 0x888888,
            clump: 0x6a4a4a, deathmoth: 0xc8c8c8, skin_stealer: 0xd4a080,
            scratcher: 0x6a3030, burster: 0xff6020, thing_on_level_7: 0x1a1a40,
        };
        const c = colors[type] || 0xff0000;
        const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, emissive: c, emissiveIntensity: 0.12 });
        const group = new THREE.Group();

        switch (type) {
            case 'smiler': {
                // 白色微笑面孔（贴笑脸纹理）
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), new THREE.MeshStandardMaterial({
                    map: this.texSmile, roughness: 0.6, emissive: 0x333333, emissiveIntensity: 0.25
                }));
                head.castShadow = true;
                group.add(head);
                break;
            }
            case 'hound': {
                // 四足猎犬：身体 + 头 + 腿
                const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.55), mat);
                body.position.y = 0.55; body.castShadow = true;
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.4), mat);
                head.position.set(0.65, 0.75, 0); head.castShadow = true;
                group.add(body, head);
                for (let i = 0; i < 4; i++) {
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat);
                    leg.position.set((i % 2 === 0 ? -0.38 : 0.38), 0.25, i < 2 ? 0.2 : -0.2);
                    group.add(leg);
                }
                break;
            }
            case 'deathmoth': {
                const wingMat = new THREE.MeshBasicMaterial({ color: 0x9a9aa0, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
                const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), wingMat);
                w1.position.set(-0.5, 0.5, 0); w1.rotation.y = 0.6;
                const w2 = w1.clone(); w2.position.x = 0.5; w2.rotation.y = -0.6;
                const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), mat);
                body.position.y = 0.5; body.castShadow = true;
                group.add(w1, w2, body);
                break;
            }
            case 'burster': {
                const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat);
                core.castShadow = true;
                const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({
                    color: 0xff6020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false
                }));
                group.add(core, glow);
                break;
            }
            case 'duller': {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.7, 8), mat);
                body.position.y = 0.85; body.castShadow = true;
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), mat);
                head.position.y = 1.85; head.castShadow = true;
                group.add(body, head);
                break;
            }
            case 'thing_on_level_7': {
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), mat);
                body.castShadow = true;
                group.add(body);
                break;
            }
            default: {
                const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.4, 4, 8), mat);
                m.castShadow = true;
                group.add(m);
                break;
            }
        }
        return group;
    }

    addEntityMesh(m) { this.entityGroup.add(m); }
    removeEntityMesh(m) { this.entityGroup.remove(m); }

    render() { this.renderer.render(this.scene, this.camera); }
}
