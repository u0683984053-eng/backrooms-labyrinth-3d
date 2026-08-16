import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MazeRenderFlags } from './config.js';

const WALL_H = 3.5;
const CELL_S = 5;
const SKIRT_H = 0.22;   // 踢脚线高度
const RAIL_H = 0.14;    // 墙顶装饰线高度
const WALL_T = 0.3;     // 墙厚

// ---------------------------------------------------------------
// 程序化纹理 —— 依据后室维基 Level 0 经典图的真实配色：
// 素面淡黄墙纸（无条纹）、黄褐潮湿地毯、冷白污渍天花板
// ---------------------------------------------------------------
function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

function makeWallpaperTexture() {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    // 素面淡黄墙纸（经典图主色 ≈ #c8b870，偏橄榄黄）
    g.fillStyle = '#c8b870';
    g.fillRect(0, 0, 256, 256);
    // 极其轻微的竖向明暗变化（模拟墙面受光不均，几乎看不出条纹）
    for (let x = 0; x < 256; x += 16) {
        const a = (Math.sin(x * 0.35) * 0.5 + 0.5) * 0.045;
        g.fillStyle = 'rgba(90,75,35,' + a.toFixed(3) + ')';
        g.fillRect(x, 0, 8, 256);
    }
    // 淡淡的水渍/霉斑（经典图有潮湿污渍）
    for (let i = 0; i < 22; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 34;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(105,88,42,' + (0.04 + Math.random() * 0.09).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(105,88,42,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 极淡噪点
    const img = g.getImageData(0, 0, 256, 256);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 14;
        d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.7;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
}

function makeCarpetTexture() {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    // 黄褐色潮湿旧地毯（经典图 ≈ #8f7f48，比墙纸深、更棕）
    g.fillStyle = '#8f7f48';
    g.fillRect(0, 0, 256, 256);
    // 纤维噪点
    const img = g.getImageData(0, 0, 256, 256);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 38;
        d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.55;
    }
    g.putImageData(img, 0, 0);
    // 潮湿深色水渍（经典图地毯明显潮湿发黑）
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 44;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(35,28,12,' + (0.09 + Math.random() * 0.14).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(35,28,12,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
}

function makeCeilingTexture() {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    // 冷白灰天花板（经典图 ≈ #b8b8ac，荧光灯照得偏冷）
    g.fillStyle = '#b8b8ac';
    g.fillRect(0, 0, 256, 256);
    // 天花板砖缝
    g.strokeStyle = 'rgba(80,80,70,0.30)';
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
    for (let y = 0; y <= 256; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    // 霉点/水痕
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 3 + Math.random() * 20;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(70,65,45,' + (0.05 + Math.random() * 0.1).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(70,65,45,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
}

function makeSmileTexture() {
    // 微笑者：苍白发光面孔 + 黑色眼睛 + 咧嘴笑（后室设定）
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#e8e8e4';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#0c0c0c';
    g.beginPath(); g.ellipse(92, 92, 18, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(164, 92, 18, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(128, 166, 54, 42, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#e8e8e4';
    for (let i = 0; i < 6; i++) g.fillRect(104 + i * 9, 162, 6, 11);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
}

function makeCrateTexture() {
    const c = makeCanvas(128, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#7a5c30';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(45,30,12,0.9)';
    g.lineWidth = 6;
    g.strokeRect(4, 4, 120, 120);
    g.beginPath(); g.moveTo(4, 4); g.lineTo(124, 124); g.stroke();
    g.beginPath(); g.moveTo(124, 4); g.lineTo(4, 124); g.stroke();
    g.strokeRect(54, 4, 20, 120);
    for (let i = 0; i < 30; i++) {
        g.fillStyle = 'rgba(35,22,10,' + (Math.random() * 0.2).toFixed(2) + ')';
        g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 2;
    return t;
}

// ---------------------------------------------------------------
// 渲染器
// ---------------------------------------------------------------
export class GameRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.32;
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
        this.wallMat = new THREE.MeshStandardMaterial({ map: this.texWall, roughness: 0.92, metalness: 0.0 });
        this.floorMat = new THREE.MeshStandardMaterial({ map: this.texFloor, roughness: 0.95, metalness: 0.0 });
        this.ceilMat = new THREE.MeshStandardMaterial({ map: this.texCeil, roughness: 0.85, metalness: 0.02 });
        this.skirtMat = new THREE.MeshStandardMaterial({ color: 0x4a3c22, roughness: 0.9 });
        this.railMat = new THREE.MeshStandardMaterial({ color: 0x5a4c2e, roughness: 0.85 });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92 });
        this.crateMat = new THREE.MeshStandardMaterial({ map: this.texCrate, roughness: 0.85 });
        this.lampFrameMat = new THREE.MeshStandardMaterial({ color: 0x2e2e30, roughness: 0.45, metalness: 0.6 });
        this.lampTubeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xfffdf4, emissiveIntensity: 2.8, roughness: 0.35
        });
        this.lampGlowMat = new THREE.MeshBasicMaterial({
            color: 0xfff8e8, transparent: true, opacity: 0.15,
            blending: THREE.AdditiveBlending, depthWrite: false
        });

        this.ceilingLights = [];
        this.lampMeshes = [];
        this._setupLighting();

        // 手电筒
        this.flashlight = new THREE.SpotLight(0xfff6d0, 5, 34, Math.PI / 6.5, 0.42, 1.1);
        this.flashlight.castShadow = true;
        this.flashlight.shadow.mapSize.set(512, 512);
        this.flashlight.visible = false;
        this.flashGroup.add(this.flashlight);
        this.flashGroup.add(this.flashlight.target);

        // 手电筒光锥
        const coneGeo = new THREE.ConeGeometry(2.6, 9, 20, 1, true);
        this.flashCone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
            color: 0xfff2c0, transparent: true, opacity: 0.08,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        }));
        this.flashCone.visible = false;
        this.flashGroup.add(this.flashCone);

        // 第一人称手电筒模型
        this.viewModelGroup = new THREE.Group();
        this.viewModelGroup.position.set(0.28, -0.26, -0.55);
        const torchBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.028, 0.036, 0.26, 8),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.7 })
        );
        torchBody.rotation.x = Math.PI / 2.4;
        const torchHead = new THREE.Mesh(
            new THREE.CylinderGeometry(0.042, 0.03, 0.07, 8),
            new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.3, metalness: 0.8 })
        );
        torchHead.rotation.x = Math.PI / 2.4;
        torchHead.position.z = -0.15;
        this.viewModelGroup.add(torchBody, torchHead);
        this.viewModelGroup.visible = false;
        this.camera.add(this.viewModelGroup);
        this.scene.add(this.camera);

        this.bobTime = 0;

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _setupLighting() {
        this.ambient = new THREE.AmbientLight(0x4a4630, 1.15);
        this.scene.add(this.ambient);
        this.hemi = new THREE.HemisphereLight(0x8a8470, 0x3a3520, 0.4);
        this.scene.add(this.hemi);

        // 少量大范围点光源（经典后室的"荧光灯均匀照明"感）
        // 每 40 单位一个 → 全图仅 16 个
        this.ceilingLights = [];
        for (let x = -60; x <= 60; x += 40) {
            for (let z = -60; z <= 60; z += 40) {
                const pl = new THREE.PointLight(0xfff8e0, 2.6, 34, 1.7);
                pl.position.set(x, WALL_H - 0.6, z);
                this.scene.add(pl);
                this.ceilingLights.push(pl);
            }
        }
    }

    setLevelConfig(config) {
        this.config = config;
        const flags = config.renderFlags || [];

        const fogDensity = flags.includes(MazeRenderFlags.FOG_HEAVY) ? 0.0013
            : flags.includes(MazeRenderFlags.NO_FOG) ? 0.00015 : 0.0007;
        this.scene.fog = new THREE.FogExp2(0x0a0a05, fogDensity);

        const dark = flags.includes(MazeRenderFlags.DARKNESS);
        this.ambient.intensity = dark ? 0.08 : 1.15;
        this.hemi.intensity = dark ? 0.03 : 0.4;
        for (const l of this.ceilingLights) l.intensity = dark ? 0 : 2.4;
        this.renderer.toneMappingExposure = dark ? 0.9 : 1.2;

        const ds = flags.includes(MazeRenderFlags.DOUBLE_SIDED);
        const wf = flags.includes(MazeRenderFlags.WIREFRAME);
        this.wallMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.wallMat.wireframe = wf;
        this.floorMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.floorMat.wireframe = wf;
        this.ceilMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.ceilMat.wireframe = wf;

        this._hasCeiling = !flags.includes(MazeRenderFlags.NO_CEILING);
        this._openBorder = flags.includes(MazeRenderFlags.OPEN_BORDER);
    }

    // 合并同材质几何体 → 一次 draw call
    _merge(geos) {
        const m = mergeGeometries(geos, false);
        geos.forEach(g => g.dispose());
        return m;
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
        const W = grid.length, H = grid[0].length;

        // ---- 收集几何体（后续合并） ----
        const floorGeos = [], ceilGeos = [], wallGeos = [], skirtGeos = [], railGeos = [];
        const lampFrameGeos = [], lampTubeGeos = [], lampGlowGeos = [];

        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                const cell = grid[x][y];
                const wx = x * CELL_S;
                const wz = y * CELL_S;

                // 地板
                const fg = new THREE.PlaneGeometry(CELL_S, CELL_S);
                fg.rotateX(-Math.PI / 2);
                fg.translate(wx, 0, wz);
                floorGeos.push(fg);

                // 天花板
                if (this._hasCeiling) {
                    const cg = new THREE.PlaneGeometry(CELL_S, CELL_S);
                    cg.rotateX(-Math.PI / 2);
                    cg.translate(wx, WALL_H, wz);
                    ceilGeos.push(cg);
                }

                // 四面墙（含踢脚线/顶线）
                const walls = [
                    { hit: cell.walls[0] && (!openBorder || y > 0), dir: 'N', p: [wx, wz - CELL_S / 2] },
                    { hit: cell.walls[1] && (!openBorder || x < W - 1), dir: 'E', p: [wx + CELL_S / 2, wz] },
                    { hit: cell.walls[2] && (!openBorder || y < H - 1), dir: 'S', p: [wx, wz + CELL_S / 2] },
                    { hit: cell.walls[3] && (!openBorder || x > 0), dir: 'W', p: [wx - CELL_S / 2, wz] },
                ];
                for (const wd of walls) {
                    if (!wd.hit) continue;
                    // 墙主体
                    const wg = new THREE.BoxGeometry(CELL_S, WALL_H, WALL_T);
                    if (wd.dir === 'E' || wd.dir === 'W') wg.rotateY(Math.PI / 2);
                    wg.translate(wd.p[0], WALL_H / 2, wd.p[1]);
                    wallGeos.push(wg);
                    // 踢脚线
                    const sg = new THREE.BoxGeometry(CELL_S, SKIRT_H, WALL_T + 0.1);
                    if (wd.dir === 'E' || wd.dir === 'W') sg.rotateY(Math.PI / 2);
                    sg.translate(wd.p[0], SKIRT_H / 2 + 0.01, wd.p[1]);
                    skirtGeos.push(sg);
                    // 顶线
                    const rg = new THREE.BoxGeometry(CELL_S, RAIL_H, WALL_T + 0.08);
                    if (wd.dir === 'E' || wd.dir === 'W') rg.rotateY(Math.PI / 2);
                    rg.translate(wd.p[0], WALL_H - RAIL_H / 2 - 0.01, wd.p[1]);
                    railGeos.push(rg);
                }
            }
        }

        // 荧光灯箱：每 15 单位一个（经典三管灯箱），合并为 3 个 mesh
        for (let x = -60; x <= 60; x += 15) {
            for (let z = -60; z <= 60; z += 15) {
                const fx = new THREE.BoxGeometry(3.6, 0.14, 0.55);
                fx.translate(x, WALL_H - 0.07, z);
                lampFrameGeos.push(fx);
                for (const dz of [-0.17, 0, 0.17]) {
                    const tg = new THREE.BoxGeometry(3.4, 0.05, 0.09);
                    tg.translate(x, WALL_H - 0.17, z + dz);
                    lampTubeGeos.push(tg);
                }
                const gg = new THREE.PlaneGeometry(3.8, 0.7);
                gg.rotateX(-Math.PI / 2);
                gg.translate(x, WALL_H - 0.22, z);
                lampGlowGeos.push(gg);
            }
        }

        // ---- 合并并加入场景（每个材质 1 次 draw call） ----
        const add = (geos, mat, group, cast, recv) => {
            if (geos.length === 0) return;
            const mesh = new THREE.Mesh(this._merge(geos), mat);
            mesh.castShadow = cast; mesh.receiveShadow = recv;
            group.add(mesh);
        };
        add(floorGeos, this._getFloorMat(), this.mazeGroup, false, true);
        add(ceilGeos, this.ceilMat, this.mazeGroup, false, true);
        add(wallGeos, this.wallMat, this.mazeGroup, true, true);
        add(skirtGeos, this.skirtMat, this.mazeGroup, false, true);
        add(railGeos, this.railMat, this.mazeGroup, false, true);
        add(lampFrameGeos, this.lampFrameMat, this.mazeGroup, false, false);
        add(lampTubeGeos, this.lampTubeMat, this.mazeGroup, false, false);
        add(lampGlowGeos, this.lampGlowMat, this.mazeGroup, false, false);

        // ---- 平台（数量少，独立 mesh） ----
        if (platforms && platforms.length) {
            for (const p of platforms) {
                const top = p.top;
                if (p.type === 'step') {
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
                    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, top, p.d), this.concreteMat);
                    box.position.set(p.x, top / 2, p.z);
                    box.castShadow = true; box.receiveShadow = true;
                    this.platformGroup.add(box);
                    const stripe = new THREE.Mesh(
                        new THREE.BoxGeometry(p.w + 0.02, 0.06, p.d + 0.02),
                        new THREE.MeshStandardMaterial({ color: 0xc8a830, roughness: 0.7, emissive: 0x201800, emissiveIntensity: 0.6 })
                    );
                    stripe.position.set(p.x, top - 0.12, p.z);
                    this.platformGroup.add(stripe);
                }
            }
        }

        // ---- 建筑（合并主体与窗户） ----
        if (buildings && buildings.length) {
            const bm = new THREE.MeshStandardMaterial({ color: 0x6e6e74, roughness: 0.85, metalness: 0.15 });
            const winMat = new THREE.MeshStandardMaterial({
                color: 0x22242a, roughness: 0.2, metalness: 0.5,
                emissive: 0x22242a, emissiveIntensity: 0.3
            });
            const bGeos = [], wGeos = [];
            for (const b of buildings) {
                const bg = new THREE.BoxGeometry(b.width - 1, b.height, b.depth - 1);
                bg.translate(b.x, b.height / 2, b.z);
                bGeos.push(bg);
                const cols = Math.max(2, Math.floor(b.width / 4));
                const rows = Math.max(2, Math.floor(b.height / 4));
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        const win = new THREE.PlaneGeometry(1.2, 1.6);
                        win.translate(
                            b.x - b.width / 2 + 2 + i * (b.width - 4) / Math.max(1, cols - 1),
                            b.height / 2 - 3 - j * (b.height - 5) / Math.max(1, rows - 1),
                            b.z + b.depth / 2 + 0.02
                        );
                        wGeos.push(win);
                    }
                }
            }
            add(bGeos, bm, this.buildingGroup, true, true);
            add(wGeos, winMat, this.buildingGroup, false, false);
        }

        // ---- 树木（合并树干与树冠） ----
        if (trees && trees.length) {
            const tkm = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95 });
            const crm = new THREE.MeshStandardMaterial({ color: 0x1f4a10, roughness: 0.9 });
            const tkGeos = [], crGeos = [];
            for (const t of trees) {
                const tk = new THREE.CylinderGeometry(0.18, 0.32, t.height * 0.5, 6);
                tk.translate(t.x, t.height * 0.25, t.z);
                tkGeos.push(tk);
                const cr = new THREE.SphereGeometry(t.height * 0.28, 6, 4);
                cr.translate(t.x, t.height * 0.72, t.z);
                crGeos.push(cr);
            }
            add(tkGeos, tkm, this.treeGroup, true, false);
            add(crGeos, crm, this.treeGroup, true, false);
        }

        // ---- 装饰物（柱子/货架/管道，合并） ----
        if (decorations && decorations.length) {
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a5548, roughness: 0.9 });
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.6 });
            const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.85 });
            const pGeos = [], pipeGeos = [], shelfGeos = [], itemGeos = [];
            for (const d of decorations) {
                if (d.type === 'pillar') {
                    const pg = new THREE.CylinderGeometry(0.45, 0.55, WALL_H, 7);
                    pg.translate(d.x, WALL_H / 2, d.z);
                    pGeos.push(pg);
                } else if (d.type === 'shelf') {
                    const fr = new THREE.BoxGeometry(2.6, 2.4, 0.12);
                    fr.translate(d.x, 1.2, d.z);
                    shelfGeos.push(fr);
                    for (let i = 0; i < 3; i++) {
                        const bd = new THREE.BoxGeometry(2.6, 0.08, 1.0);
                        bd.translate(d.x, 0.5 + i * 0.8, d.z);
                        shelfGeos.push(bd);
                    }
                    for (let i = 0; i < 3; i++) {
                        const it = new THREE.BoxGeometry(0.35 + Math.random() * 0.4, 0.3 + Math.random() * 0.35, 0.35 + Math.random() * 0.4);
                        it.translate(d.x - 0.9 + Math.random() * 1.8, 0.55 + Math.floor(Math.random() * 3) * 0.8 + 0.25, d.z);
                        itemGeos.push(it);
                    }
                } else if (d.type === 'pipe') {
                    const pg = new THREE.CylinderGeometry(0.22, 0.22, 4, 7);
                    pg.rotateX(Math.PI / 2);
                    pg.translate(d.x, 2.6 + (d.z % 2) * 0.5, d.z);
                    pipeGeos.push(pg);
                }
            }
            add(pGeos, pillarMat, this.decoGroup, true, false);
            add(pipeGeos, pipeMat, this.decoGroup, true, false);
            add(shelfGeos, shelfMat, this.decoGroup, true, false);
            add(itemGeos, new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.9 }), this.decoGroup, false, false);
        }

        // ---- 出口 ----
        if (exitPos) {
            const em = new THREE.MeshStandardMaterial({ color: 0x40ff40, emissive: 0x22aa22, roughness: 0.3 });
            const exit = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), em);
            exit.position.set(exitPos.x, 0.15, exitPos.z);
            exit.name = 'exitMarker';
            this.mazeGroup.add(exit);
            const beam = new THREE.Mesh(
                new THREE.CylinderGeometry(0.35, 0.35, 4, 8, 1, true),
                new THREE.MeshBasicMaterial({ color: 0x40ff40, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
            );
            beam.position.set(exitPos.x, 2.1, exitPos.z);
            this.mazeGroup.add(beam);
        }
    }

    _getFloorMat() {
        if (!this.config) return this.floorMat;
        switch (this.config.terrainType) {
            case 'caves': return this._caveMat || (this._caveMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95, map: this.texFloor }));
            case 'aquatic': return this._aquaMat || (this._aquaMat = new THREE.MeshStandardMaterial({ color: 0x1a3355, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.75 }));
            case 'forest': return this._forestMat || (this._forestMat = new THREE.MeshStandardMaterial({ color: 0x2a4a10, roughness: 0.9 }));
            case 'snow': return this._snowMat || (this._snowMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.6 }));
            case 'desert': return this._desertMat || (this._desertMat = new THREE.MeshStandardMaterial({ color: 0xc8b060, roughness: 0.95 }));
            case 'void': return this._voidMat || (this._voidMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.3 }));
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
        this.viewModelGroup.visible = player.flashlightOn;
        this.viewModelGroup.quaternion.copy(player.camera.quaternion);

        if (player.flashlightOn) {
            this.flashCone.position.copy(player.position.clone().addScaledVector(dir, 4.5));
            this.flashCone.quaternion.copy(player.camera.quaternion);
            const flicker = this.config && this.config.renderFlags && this.config.renderFlags.includes(MazeRenderFlags.FLICKERING_LIGHTS);
            if (flicker) {
                this.flashlight.intensity = Math.sin(flickerTime * 15) * 0.5 + 2.5;
                this.flashCone.material.opacity = 0.05 + Math.sin(flickerTime * 19) * 0.03;
            } else {
                this.flashlight.intensity = 5;
                this.flashCone.material.opacity = 0.08;
            }
        }

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
            smiler: 0xffffff, hound: 0x1e1a1a, duller: 0x8a8a8a,
            clump: 0x6a4a4a, deathmoth: 0xc8c8c8, skin_stealer: 0xd4a080,
            scratcher: 0x6a3030, burster: 0xff6020, thing_on_level_7: 0x1a1a40,
        };
        const c = colors[type] || 0xff0000;
        const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: c, emissiveIntensity: 0.15 });
        const group = new THREE.Group();

        switch (type) {
            case 'smiler': {
                // 微笑者：黑暗中苍白的发光面孔
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshStandardMaterial({
                    map: this.texSmile, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.5,
                    emissiveMap: this.texSmile
                }));
                head.castShadow = true;
                group.add(head);
                break;
            }
            case 'hound': {
                // 猎犬：黑色四足怪物（设定）
                const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.55), mat);
                body.position.y = 0.55; body.castShadow = true;
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.4), mat);
                head.position.set(0.65, 0.75, 0); head.castShadow = true;
                const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.2), mat);
                snout.position.set(0.78, 0.66, 0);
                group.add(body, head, snout);
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
                const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), mat);
                core.castShadow = true;
                const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({
                    color: 0xff6020, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false
                }));
                group.add(core, glow);
                break;
            }
            case 'duller': {
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.7, 7), mat);
                body.position.y = 0.85; body.castShadow = true;
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat);
                head.position.y = 1.85; head.castShadow = true;
                group.add(body, head);
                break;
            }
            case 'thing_on_level_7': {
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), mat);
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
