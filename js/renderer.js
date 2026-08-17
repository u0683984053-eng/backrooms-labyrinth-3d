import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MazeRenderFlags } from './config.js';

const WALL_H = 3.5;
const CELL_S = 5;
const SKIRT_H = 0.22;   // 踢脚线高度
const RAIL_H = 0.14;    // 墙顶装饰线高度
const WALL_T = 0.3;     // 墙厚

// ---------------------------------------------------------------
// 程序化纹理 —— 依据后室 Level 0 经典图实测配色：
// 素面淡黄墙纸、黄褐潮湿地毯、冷白污渍天花板
// ---------------------------------------------------------------
function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

// 纹理统一收尾：sRGB 颜色空间（否则整幅画面会被压暗约 2.2 伽马）
function finishTexture(t, repeat = false) {
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); }
    t.anisotropy = 4;
    return t;
}

// 程序化渐变天空（顶级 3D 的户外观感）
function makeSkyTexture(top, mid, bottom) {
    const c = makeCanvas(64, 256);
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top);
    grd.addColorStop(0.55, mid);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 256);
    // 云朵噪点（顶部区域）
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * 64, y = Math.random() * 90;
        const r = 4 + Math.random() * 10;
        const cl = g.createRadialGradient(x, y, 0, x, y, r);
        cl.addColorStop(0, 'rgba(255,255,255,' + (0.05 + Math.random() * 0.08).toFixed(2) + ')');
        cl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = cl;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return finishTexture(new THREE.CanvasTexture(c));
}

function makeWallpaperTexture() {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    // 素面淡黄墙纸（经典图主色 ≈ #c8b870，偏橄榄黄）
    g.fillStyle = '#c8b870';
    g.fillRect(0, 0, 256, 256);
    // 极其轻微的竖向明暗变化（模拟墙面受光不均）
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
    return finishTexture(new THREE.CanvasTexture(c), true);
}

function makeCarpetTexture() {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    // 黄褐色潮湿旧地毯（经典图 ≈ #8f7f48）
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
    // 潮湿深色水渍
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 44;
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(35,28,12,' + (0.09 + Math.random() * 0.14).toFixed(2) + ')');
        grd.addColorStop(1, 'rgba(35,28,12,0)');
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return finishTexture(new THREE.CanvasTexture(c), true);
}

function makeCeilingTexture() {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    // 冷白灰天花板（经典图 ≈ #b8b8ac）
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
    return finishTexture(new THREE.CanvasTexture(c), true);
}

function makeSmileTexture() {
    // 微笑者：苍白发光面孔 + 黑色眼睛 + 咧嘴笑（f 版设定）
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    g.fillStyle = '#e8e8e4';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#0c0c0c';
    g.beginPath(); g.ellipse(92, 92, 18, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(164, 92, 18, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(128, 166, 54, 42, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#e8e8e4';
    for (let i = 0; i < 6; i++) g.fillRect(104 + i * 9, 162, 6, 11);
    return finishTexture(new THREE.CanvasTexture(c));
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
    return finishTexture(new THREE.CanvasTexture(c));
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
        // legacy 光照：PointLight 强度为直接系数（物理模式会把小强度在远距离衰减到近乎零）
        this.renderer.useLegacyLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x171410);

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

        // 材质（程序化凹凸贴图：利用纹理亮度作为高度场，增加表面细节）
        this.wallMat = new THREE.MeshStandardMaterial({ map: this.texWall, bumpMap: this.texWall, bumpScale: 0.06, roughness: 0.92, metalness: 0.0 });
        this.floorMat = new THREE.MeshStandardMaterial({ map: this.texFloor, bumpMap: this.texFloor, bumpScale: 0.09, roughness: 0.95, metalness: 0.0 });
        this.ceilMat = new THREE.MeshStandardMaterial({ map: this.texCeil, bumpMap: this.texCeil, bumpScale: 0.05, roughness: 0.85, metalness: 0.02 });
        this.skirtMat = new THREE.MeshStandardMaterial({ color: 0x4a3c22, roughness: 0.9 });
        this.railMat = new THREE.MeshStandardMaterial({ color: 0x5a4c2e, roughness: 0.85 });
        this.concreteMat = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92 });
        this.crateMat = new THREE.MeshStandardMaterial({ map: this.texCrate, roughness: 0.85 });
        this.lampFrameMat = new THREE.MeshStandardMaterial({ color: 0x2e2e30, roughness: 0.45, metalness: 0.6 });
        this.lampTubeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xfffdf4, emissiveIntensity: 3.0, roughness: 0.35
        });
        this.lampGlowMat = new THREE.MeshBasicMaterial({
            color: 0xfff8e8, transparent: true, opacity: 0.18,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        // 家具材质
        this.woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5f3a, roughness: 0.85 });
        this.woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a4428, roughness: 0.9 });
        this.metalMat = new THREE.MeshStandardMaterial({ color: 0x5a5a60, roughness: 0.5, metalness: 0.55 });
        this.fabricMat = new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: 0.95 });
        this.fabricLightMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95 });

        this.ceilingLights = [];
        this._setupLighting();

        // 手电筒（f 版设定：黑暗层级的主要光源）
        this.flashlight = new THREE.SpotLight(0xfff6d0, 6.5, 38, Math.PI / 6.5, 0.42, 1.1);
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

        // 第一人称模型：手臂（常显）+ 手电筒（按 F 显隐）
        this.viewModelGroup = new THREE.Group();
        this.viewModelGroup.position.set(0.28, -0.26, -0.55);
        // 手臂（顶级 FPS 的沉浸感：始终可见的持物手臂）
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xc8a080, roughness: 0.85 });
        const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x4a4a3e, roughness: 0.95 });
        this.armGroup = new THREE.Group();
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), skinMat);
        arm.position.set(-0.02, -0.02, 0.02);
        arm.rotation.z = -0.35;
        arm.rotation.x = -0.5;
        const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), sleeveMat);
        sleeve.position.set(-0.07, 0.1, -0.05);
        sleeve.rotation.z = -0.35;
        sleeve.rotation.x = -0.5;
        this.armGroup.add(arm, sleeve);
        this.viewModelGroup.add(this.armGroup);

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
        this.torchGroup = new THREE.Group();
        this.torchGroup.add(torchBody, torchHead);
        this.torchGroup.visible = false;
        this.viewModelGroup.add(this.torchGroup);
        this.viewModelGroup.visible = true;
        this.camera.add(this.viewModelGroup);
        this.scene.add(this.camera);

        this.bobTime = 0;

        // 泛光后处理（顶级 3D 的辉光感：荧光灯/霓虹/光幕）
        this.useBloom = true;
        this.composer = null;
        this.bloomPass = null;
        try {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            // 半分辨率泛光（性能与画质的平衡，顶级 3D 常用做法）
            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
                0.55, 0.5, 0.85
            );
            this.composer.addPass(this.bloomPass);
            this.composer.addPass(new OutputPass());
        } catch (e) {
            this.composer = null;
        }

        // 漂浮尘埃粒子（f 版设定：Level 0 潮湿闷热的空气感）
        this.dustPoints = null;
        this._setupDust();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            if (this.composer) this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    _setupDust() {
        const N = 350;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 140;
            pos[i * 3 + 1] = 0.3 + Math.random() * 2.8;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 140;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xd8d0b8, size: 0.035, transparent: true, opacity: 0.35,
            depthWrite: false, sizeAttenuation: true
        });
        this.dustPoints = new THREE.Points(geo, mat);
        this.dustPoints.frustumCulled = false;
        this.scene.add(this.dustPoints);
    }

    _setupLighting() {
        // f 版设定：荧光灯是室内主要光源，明亮均匀
        this.ambient = new THREE.AmbientLight(0x5a5440, 1.5);
        this.scene.add(this.ambient);
        this.hemi = new THREE.HemisphereLight(0x9a9480, 0x4a4530, 0.7);
        this.scene.add(this.hemi);

        // 少量大范围点光源（每 40 单位一个 → 全图仅 16 个；legacy 模式直接乘）
        this.ceilingLights = [];
        for (let x = -60; x <= 60; x += 40) {
            for (let z = -60; z <= 60; z += 40) {
                const pl = new THREE.PointLight(0xfff8e0, 4.5, 42, 1.6);
                pl.position.set(x, WALL_H - 0.6, z);
                this.scene.add(pl);
                this.ceilingLights.push(pl);
            }
        }
    }

    setLevelConfig(config) {
        this.config = config;
        const flags = config.renderFlags || [];

        // 层级氛围雾色（f 版设定）
        let fogColor = 0x171410;
        if (config.id === 2) fogColor = 0x2a1808;        // 管道之梦：闷热
        else if (config.id === 7) fogColor = 0x08182a;   // 深海：冰冷蓝
        else if (config.id === 8) fogColor = 0x141210;   // 洞穴
        else if (config.id === 10) fogColor = 0x1c1408;  // 麦田黄昏
        else if (config.id === 48) fogColor = 0x0e1a0c;  // 猩红森林
        else if (config.id === 210) fogColor = 0x1c2228; // 雪境
        else if (config.id === 399) fogColor = 0x0a0c18; // 霓虹夜
        else if (config.id >= 900) fogColor = 0x0c0a12;  // 终局虚空
        this._fogColor = fogColor;

        const fogDensity = flags.includes(MazeRenderFlags.FOG_HEAVY) ? 0.0011
            : flags.includes(MazeRenderFlags.NO_FOG) ? 0.00012 : 0.0006;
        this.scene.fog = new THREE.FogExp2(fogColor, fogDensity);
        this.scene.background = new THREE.Color(fogColor);

        const dark = flags.includes(MazeRenderFlags.DARKNESS);
        // 室内/封闭层级强制天花板（洞穴、木屋、地狱等按设定应有顶）
        const noCeil = flags.includes(MazeRenderFlags.NO_CEILING);
        const forcedCeil = config.id === 8 || config.id === 27 || config.id === 666;
        this._hasCeiling = !noCeil || forcedCeil;
        this._outdoor = noCeil && !forcedCeil;
        this._openBorder = flags.includes(MazeRenderFlags.OPEN_BORDER);

        // 光照按层级类型
        if (this._outdoor) {
            // 户外层级：白天感（环境光强、无荧光灯）
            this.ambient.intensity = 2.0;
            this.hemi.intensity = 1.0;
            for (const l of this.ceilingLights) l.intensity = 0;
            this.renderer.toneMappingExposure = 1.45;
        } else if (dark) {
            this.ambient.intensity = 0.1;
            this.hemi.intensity = 0.04;
            for (const l of this.ceilingLights) l.intensity = 0;
            this.renderer.toneMappingExposure = 1.0;
        } else {
            this.ambient.intensity = 1.5;
            this.hemi.intensity = 0.7;
            for (const l of this.ceilingLights) l.intensity = 4.5;
            this.renderer.toneMappingExposure = 1.5;
        }
        // 层级微调：399 霓虹深渊是夜晚城市，但保持可见
        if (this.config && this.config.id === 399) {
            this.ambient.intensity = 1.85;
            this.hemi.intensity = 0.85;
            this.renderer.toneMappingExposure = 1.65;
        }

        // 泛光强度按层级氛围（霓虹/室内/黑暗/户外）
        if (this.bloomPass) {
            if (config.id === 399) this.bloomPass.strength = 1.25;      // 霓虹辉光
            else if (config.id === 12) this.bloomPass.strength = 1.0;   // 矩阵白光
            else if (this._outdoor) this.bloomPass.strength = 0.35;     // 户外自然光
            else if (dark) this.bloomPass.strength = 0.25;              // 黑暗层级微弱
            else this.bloomPass.strength = 0.55;                        // 室内荧光灯
        }

        const ds = flags.includes(MazeRenderFlags.DOUBLE_SIDED);
        const wf = flags.includes(MazeRenderFlags.WIREFRAME);
        // 层级墙面材质覆盖（f 版设定）
        if (config.id === 37) {
            // 泳池房：瓷砖墙
            if (!this.tileWallMat) {
                const c = makeCanvas(128, 128);
                const g = c.getContext('2d');
                g.fillStyle = '#d8dcd8';
                g.fillRect(0, 0, 128, 128);
                g.strokeStyle = 'rgba(60,120,150,0.55)';
                g.lineWidth = 4;
                for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
                for (let y = 0; y <= 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
                this.tileWallMat = new THREE.MeshStandardMaterial({ map: finishTexture(new THREE.CanvasTexture(c), true), roughness: 0.25, metalness: 0.1 });
            }
            this.wallMat = this.tileWallMat;
        } else if (config.id === 27) {
            // 木屋：木板墙
            if (!this.woodWallMat) {
                const c = makeCanvas(128, 128);
                const g = c.getContext('2d');
                g.fillStyle = '#a07840';
                g.fillRect(0, 0, 128, 128);
                g.strokeStyle = 'rgba(60,35,10,0.7)';
                g.lineWidth = 3;
                for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
                for (let i = 0; i < 26; i++) {
                    g.fillStyle = 'rgba(50,30,8,' + (Math.random() * 0.2).toFixed(2) + ')';
                    g.fillRect(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 10, 2 + Math.random() * 4);
                }
                this.woodWallMat = new THREE.MeshStandardMaterial({ map: finishTexture(new THREE.CanvasTexture(c), true), roughness: 0.9 });
            }
            this.wallMat = this.woodWallMat;
        } else if (config.id === 599) {
            // 红色房间：血红墙面
            if (!this.redWallMat) {
                this.redWallMat = new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.85 });
            }
            this.wallMat = this.redWallMat;
        } else {
            this.wallMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
            this.wallMat.wireframe = wf;
        }

        // Level 7 深海气泡粒子（f 版设定：深海恐惧）
        if (!this.bubblePoints) {
            const N = 140;
            const pos = new Float32Array(N * 3);
            for (let i = 0; i < N; i++) {
                pos[i * 3] = (Math.random() - 0.5) * 150;
                pos[i * 3 + 1] = Math.random() * 3.5;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 150;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            this.bubblePoints = new THREE.Points(geo, new THREE.PointsMaterial({
                color: 0x88ccee, size: 0.06, transparent: true, opacity: 0.4,
                depthWrite: false, sizeAttenuation: true
            }));
            this.bubblePoints.frustumCulled = false;
            this.scene.add(this.bubblePoints);
        }
        this.bubblePoints.visible = config.id === 7;
        this.floorMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.floorMat.wireframe = wf;
        this.ceilMat.side = ds ? THREE.DoubleSide : THREE.FrontSide;
        this.ceilMat.wireframe = wf;

        this._hasCeiling = this._hasCeiling;
        this._openBorder = this._openBorder;

        // 天空穹顶（户外层级，跟随相机）
        if (!this.skyDome) {
            this.skyDome = new THREE.Mesh(
                new THREE.SphereGeometry(140, 16, 12),
                new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false })
            );
            this.skyDome.frustumCulled = false;
            this.skyDome.renderOrder = -1;
            this.scene.add(this.skyDome);
        }
        if (this._outdoor) {
            let skyTex = this._skyTexDay;
            if (config.id === 399) skyTex = this._skyTexNight;
            else if (config.id === 666) skyTex = this._skyTexHell;
            else if (config.id >= 900) skyTex = this._skyTexVoid;
            if (!skyTex) {
                if (config.id === 399) this._skyTexNight = skyTex = makeSkyTexture('#0a0c1c', '#121828', '#1c2434');
                else if (config.id === 666) this._skyTexHell = skyTex = makeSkyTexture('#1c0404', '#380a08', '#541808');
                else if (config.id >= 900) this._skyTexVoid = skyTex = makeSkyTexture('#0c0a14', '#12101c', '#181424');
                else this._skyTexDay = skyTex = makeSkyTexture('#4a6a8a', '#8a9ab0', '#d8c8a0');
            }
            this.skyDome.material.map = skyTex;
            this.skyDome.material.needsUpdate = true;
            this.skyDome.visible = true;
        } else {
            this.skyDome.visible = false;
        }

        // 尘埃粒子：室内层级可见
        if (this.dustPoints) this.dustPoints.visible = !this._outdoor && !dark;

        // Level 12 矩阵（f 版设定）：纯白空间 + 唯一光源
        if (config.id === 12) {
            this.wallMat.map = null; this.wallMat.color.set(0xffffff);
            this.floorMat.map = null; this.floorMat.color.set(0xf0f0f0);
            this.ceilMat.map = null; this.ceilMat.color.set(0xffffff);
            this.wallMat.needsUpdate = true; this.floorMat.needsUpdate = true; this.ceilMat.needsUpdate = true;
            this.ambient.intensity = 1.9;
            this.hemi.intensity = 0.8;
            for (const l of this.ceilingLights) l.intensity = 0;
            this.renderer.toneMappingExposure = 1.4;
            // 中央白色光源
            if (!this.matrixLight) {
                this.matrixLight = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
                }));
                this.matrixLight.frustumCulled = false;
                this.scene.add(this.matrixLight);
            }
            this.matrixLight.position.set(this.camera.position.x, 6, this.camera.position.z);
            this.matrixLight.visible = true;
        } else {
            if (this.matrixLight) this.matrixLight.visible = false;
            // 恢复纹理材质（非矩阵层级）
            if (this.wallMat.map !== this.texWall) {
                this.wallMat.map = this.texWall;
                this.wallMat.color.set(0xffffff);
                this.wallMat.needsUpdate = true;
            }
            if (this.floorMat.map !== this.texFloor) {
                this.floorMat.map = this.texFloor;
                this.floorMat.color.set(0xffffff);
                this.floorMat.needsUpdate = true;
            }
            if (this.ceilMat.map !== this.texCeil) {
                this.ceilMat.map = this.texCeil;
                this.ceilMat.color.set(0xffffff);
                this.ceilMat.needsUpdate = true;
            }
        }

        // f 版设定：Level 28「风暴石堡」雷暴闪电
        if (config.id === 28) {
            if (!this.thunderFlash) {
                this.thunderFlash = new THREE.Mesh(new THREE.SphereGeometry(30, 10, 8), new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0,
                    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                }));
                this.thunderFlash.frustumCulled = false;
                this.scene.add(this.thunderFlash);
            }
            this._thunderT = 2 + Math.floor(Math.random() * 6);
        } else if (this.thunderFlash) {
            this.thunderFlash.material.opacity = 0;
            this._thunderT = -1;
        }

        // f 版设定：Level 6「熄灭」偶发微弱蓝光（黑暗中的幻觉）
        if (!this.blueGlow) {
            this.blueGlow = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({
                color: 0x4488ff, transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending, depthWrite: false
            }));
            this.blueGlow.frustumCulled = false;
            this.scene.add(this.blueGlow);
        }
        this.blueGlowTimer = config.id === 6 ? 60 : -1;
        this.blueGlow.material.opacity = 0;
    }

    // ---- InstancedMesh 辅助：同材质几何体 1 次 draw call ----
    _instanced(geo, mat, matrices, group, cast, recv) {
        if (matrices.length === 0) return null;
        const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
        for (let i = 0; i < matrices.length; i++) inst.setMatrixAt(i, matrices[i]);
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = cast; inst.receiveShadow = recv;
        inst.frustumCulled = false;
        group.add(inst);
        return inst;
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

        // 单位几何体（矩阵里放缩放）
        const unitBox = new THREE.BoxGeometry(1, 1, 1);
        const unitPlane = new THREE.PlaneGeometry(1, 1);
        const unitTrunk = new THREE.CylinderGeometry(0.18, 0.32, 1, 6);
        const unitCrown = new THREE.SphereGeometry(0.28, 6, 4);
        const unitPillar = new THREE.CylinderGeometry(0.45, 0.55, 1, 7);
        const unitPipe = new THREE.CylinderGeometry(0.22, 0.22, 1, 5);

        // 复用矩阵/向量对象
        const _m = new THREE.Matrix4();
        const _q = new THREE.Quaternion();
        const _p = new THREE.Vector3();
        const _s = new THREE.Vector3();
        const _qX90 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        const _qY90 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
        const _qId = new THREE.Quaternion();
        const mat = (px, py, pz, q, sx, sy, sz) => {
            _p.set(px, py, pz); _s.set(sx, sy, sz);
            _m.compose(_p, q, _s);
            return _m.clone();
        };

        const floorMs = [], ceilMs = [], wallMs = [], skirtMs = [], railMs = [];
        const lampFrameMs = [], lampTubeMs = [], lampGlowMs = [];

        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                const cell = grid[x][y];
                const wx = x * CELL_S;
                const wz = y * CELL_S;

                floorMs.push(mat(wx, 0, wz, _qX90, CELL_S, 1, CELL_S));
                if (this._hasCeiling) ceilMs.push(mat(wx, WALL_H, wz, _qX90, CELL_S, 1, CELL_S));

                const walls = [
                    { hit: cell.walls[0] && (!openBorder || y > 0), rot: false, p: [wx, wz - CELL_S / 2] },
                    { hit: cell.walls[1] && (!openBorder || x < W - 1), rot: true, p: [wx + CELL_S / 2, wz] },
                    { hit: cell.walls[2] && (!openBorder || y < H - 1), rot: false, p: [wx, wz + CELL_S / 2] },
                    { hit: cell.walls[3] && (!openBorder || x > 0), rot: true, p: [wx - CELL_S / 2, wz] },
                ];
                for (const wd of walls) {
                    if (!wd.hit) continue;
                    const q = wd.rot ? _qY90 : _qId;
                    wallMs.push(mat(wd.p[0], WALL_H / 2, wd.p[1], q, CELL_S, WALL_H, WALL_T));
                    skirtMs.push(mat(wd.p[0], SKIRT_H / 2 + 0.01, wd.p[1], q, CELL_S, SKIRT_H, WALL_T + 0.1));
                    railMs.push(mat(wd.p[0], WALL_H - RAIL_H / 2 - 0.01, wd.p[1], q, CELL_S, RAIL_H, WALL_T + 0.08));
                }
            }
        }

        // 荧光灯箱：每 15 单位一个（经典三管灯箱；仅室内有天花板的层级）
        if (this._hasCeiling) {
            for (let x = -60; x <= 60; x += 15) {
                for (let z = -60; z <= 60; z += 15) {
                    lampFrameMs.push(mat(x, WALL_H - 0.07, z, _qId, 3.6, 0.14, 0.55));
                    for (const dz of [-0.17, 0, 0.17]) {
                        lampTubeMs.push(mat(x, WALL_H - 0.17, z + dz, _qId, 3.4, 0.05, 0.09));
                    }
                    lampGlowMs.push(mat(x, WALL_H - 0.22, z, _qX90, 3.8, 1, 0.7));
                }
            }
        }

        // 合并并加入场景（每种材质 1 次 draw call）
        this._instanced(unitPlane, this._getFloorMat(), floorMs, this.mazeGroup, false, true);
        if (ceilMs.length) this._instanced(unitPlane, this.ceilMat, ceilMs, this.mazeGroup, false, true);
        this._instanced(unitBox, this.wallMat, wallMs, this.mazeGroup, true, true);
        this._instanced(unitBox, this.skirtMat, skirtMs, this.mazeGroup, false, true);
        this._instanced(unitBox, this.railMat, railMs, this.mazeGroup, false, true);
        this._instanced(unitBox, this.lampFrameMat, lampFrameMs, this.mazeGroup, false, false);
        this._instanced(unitBox, this.lampTubeMat, lampTubeMs, this.mazeGroup, false, false);
        this._instanced(unitPlane, this.lampGlowMat, lampGlowMs, this.mazeGroup, false, false);

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

        // ---- 建筑（主体 + 窗户，各 1 个 InstancedMesh） ----
        if (buildings && buildings.length) {
            const bm = new THREE.MeshStandardMaterial({ color: 0x6e6e74, roughness: 0.85, metalness: 0.15 });
            const winMat = new THREE.MeshStandardMaterial({
                color: 0x22242a, roughness: 0.2, metalness: 0.5,
                emissive: 0x22242a, emissiveIntensity: 0.3
            });
            const bMs = [], wMs = [];
            for (const b of buildings) {
                bMs.push(mat(b.x, b.height / 2, b.z, _qId, b.width - 1, b.height, b.depth - 1));
                const cols = Math.max(2, Math.floor(b.width / 4));
                const rows = Math.max(2, Math.floor(b.height / 4));
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        wMs.push(mat(
                            b.x - b.width / 2 + 2 + i * (b.width - 4) / Math.max(1, cols - 1),
                            b.height / 2 - 3 - j * (b.height - 5) / Math.max(1, rows - 1),
                            b.z + b.depth / 2 + 0.02, _qId, 1.2, 1.6, 1
                        ));
                    }
                }
            }
            this._instanced(unitBox, bm, bMs, this.buildingGroup, true, true);
            this._instanced(unitPlane, winMat, wMs, this.buildingGroup, false, false);
        }

        // ---- 树木（树干/树冠各 1 个 InstancedMesh） ----
        if (trees && trees.length) {
            const tkm = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95 });
            // f 版设定：Level 48 猩红森林的树木是血红色的
            const crm = this.config && this.config.id === 48
                ? new THREE.MeshStandardMaterial({ color: 0x8a1a10, roughness: 0.9, emissive: 0x200500, emissiveIntensity: 0.25 })
                : new THREE.MeshStandardMaterial({ color: 0x1f4a10, roughness: 0.9 });
            const tkMs = [], crMs = [];
            for (const t of trees) {
                tkMs.push(mat(t.x, t.height * 0.25, t.z, _qId, 1, t.height * 0.5, 1));
                crMs.push(mat(t.x, t.height * 0.72, t.z, _qId, t.height, t.height, t.height));
            }
            this._instanced(unitTrunk, tkm, tkMs, this.treeGroup, true, false);
            this._instanced(unitCrown, crm, crMs, this.treeGroup, true, false);
        }

        // ---- 装饰物（柱子/货架/管道/家具） ----
        if (decorations && decorations.length) {
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a5548, roughness: 0.9 });
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.5, metalness: 0.6 });
            const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.85 });
            const itemMat = new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.9 });
            const pMs = [], pipeMs = [], shelfMs = [], itemMs = [];
            const elevDoorMs = [], elevSeamMs = [], elevSignMs = [];
            const single = []; // 独立网格的家具（数量少，直接 add）
            for (const d of decorations) {
                if (d.type === 'pillar') {
                    pMs.push(mat(d.x, WALL_H / 2, d.z, _qId, 1, WALL_H, 1));
                } else if (d.type === 'shelf') {
                    shelfMs.push(mat(d.x, 1.2, d.z, _qId, 2.6, 2.4, 0.12));
                    for (let i = 0; i < 3; i++) {
                        shelfMs.push(mat(d.x, 0.5 + i * 0.8, d.z, _qId, 2.6, 0.08, 1.0));
                    }
                    for (let i = 0; i < 3; i++) {
                        const w = 0.35 + Math.random() * 0.4, h = 0.3 + Math.random() * 0.35, dep = 0.35 + Math.random() * 0.4;
                        itemMs.push(mat(d.x - 0.9 + Math.random() * 1.8, 0.55 + Math.floor(Math.random() * 3) * 0.8 + 0.25, d.z, _qId, w, h, dep));
                    }
                } else if (d.type === 'pipe') {
                    pipeMs.push(mat(d.x, 2.6 + (d.z % 2) * 0.5, d.z, _qX90, 1, 4, 1));
                } else if (d.type === 'valve') {
                    // 管道阀门：法兰环 + 手柄（挂在墙侧）
                    const grp = new THREE.Group();
                    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 14), this.metalMat);
                    ring.position.y = 1.7;
                    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), this.metalMat);
                    handle.position.y = 1.7; handle.rotation.z = d.rot;
                    grp.add(ring, handle);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'desk') {
                    // 办公桌（f 版 Level 4 废弃办公室）
                    const grp = new THREE.Group();
                    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.85), this.woodMat);
                    top.position.y = 0.78;
                    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.74, 0.7), this.woodDarkMat);
                    l.position.set(-0.78, 0.4, 0);
                    const r = l.clone(); r.position.x = 0.78;
                    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.05), this.woodDarkMat);
                    back.position.set(0, 0.5, -0.4);
                    grp.add(top, l, r, back);
                    // 显示器（f 版设定：远处电脑的嗡嗡声）
                    if (Math.random() < 0.65) {
                        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4 }));
                        mon.position.set(0.2, 1.02, -0.28);
                        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.3), new THREE.MeshBasicMaterial({
                            color: 0x88bbff, transparent: true, opacity: 0.75
                        }));
                        scr.position.set(0.2, 1.02, -0.305);
                        const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), this.woodDarkMat);
                        stand.position.set(0.2, 0.86, -0.28);
                        grp.add(mon, scr, stand);
                    }
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'chandelier') {
                    // Level 5 恐怖酒店：1930 年代吊灯
                    const grp = new THREE.Group();
                    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), this.metalMat);
                    rod.position.y = WALL_H - 0.45;
                    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.55, 8, 1, true), new THREE.MeshStandardMaterial({
                        color: 0x8a7a4a, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide
                    }));
                    shade.position.y = WALL_H - 1.0;
                    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({
                        color: 0xffe8a0, transparent: true, opacity: 0.95
                    }));
                    bulb.position.y = WALL_H - 0.75;
                    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({
                        color: 0xffd880, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    halo.position.y = WALL_H - 0.75;
                    grp.add(rod, shade, bulb, halo);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'chair') {
                    const grp = new THREE.Group();
                    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), this.woodMat);
                    seat.position.y = 0.45;
                    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), this.woodMat);
                    back.position.set(0, 0.75, -0.22);
                    grp.add(seat, back);
                    for (let i = 0; i < 4; i++) {
                        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), this.woodDarkMat);
                        leg.position.set(i % 2 === 0 ? -0.2 : 0.2, 0.21, i < 2 ? 0.2 : -0.2);
                        grp.add(leg);
                    }
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'bed') {
                    // 床（f 版 Level 5 恐怖酒店）
                    const grp = new THREE.Group();
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 1.2), this.woodDarkMat);
                    frame.position.y = 0.15;
                    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.1), this.fabricLightMat);
                    mattress.position.y = 0.4;
                    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 0.12), this.woodDarkMat);
                    headboard.position.set(0, 0.5, -0.58);
                    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.7), this.fabricMat);
                    blanket.position.set(0, 0.55, 0.2);
                    grp.add(frame, mattress, headboard, blanket);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'locker') {
                    // 储物柜
                    const grp = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.6), this.metalMat);
                    body.position.y = 1.0;
                    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 0.62), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.6 }));
                    seam.position.set(0, 1.0, 0);
                    grp.add(body, seam);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'cratepile') {
                    // 板条箱堆（f 版 Level 1 宜居区：堆满板条箱）
                    const grp = new THREE.Group();
                    const n = 2 + Math.floor(Math.random() * 2);
                    for (let i = 0; i < n; i++) {
                        const cr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.0), this.crateMat);
                        cr.position.set((i % 2 === 0 ? -0.5 : 0.5), 0.45 + (i % n === 0 ? 0 : 0.9), (i % 3 === 0 ? 0.3 : -0.2));
                        grp.add(cr);
                    }
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'windowframe') {
                    // Level 188「窗户」：展示不可能景观的发光窗
                    const grp = new THREE.Group();
                    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5, metalness: 0.5 });
                    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.14), frameMat);
                    top.position.y = 2.5;
                    const bot = top.clone(); bot.position.y = 0.9;
                    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.14), frameMat);
                    l.position.set(-1.04, 1.7, 0);
                    const r = l.clone(); r.position.x = 1.04;
                    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.35), new THREE.MeshBasicMaterial({
                        color: 0x88ccff, transparent: true, opacity: 0.35,
                        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                    }));
                    glow.position.set(0, 1.7, 0);
                    grp.add(top, bot, l, r, glow);
                    // 窗内景观：微光（不可能的天空）
                    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.25), new THREE.MeshBasicMaterial({
                        color: 0x224466, transparent: true, opacity: 0.8, side: THREE.DoubleSide
                    }));
                    sky.position.set(0, 1.7, -0.01);
                    grp.add(sky);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot * (Math.PI / 2);
                    single.push(grp);
                } else if (d.type === 'haystack') {
                    // Level 10「丰收」：干草堆
                    const grp = new THREE.Group();
                    const h = d.h || 1.6;
                    const strawMat = new THREE.MeshStandardMaterial({ color: 0xc8a840, roughness: 0.95 });
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, h * 0.7, 9), strawMat);
                    base.position.y = h * 0.35;
                    const top2 = new THREE.Mesh(new THREE.ConeGeometry(0.55, h * 0.6, 9), strawMat);
                    top2.position.y = h * 0.75;
                    grp.add(base, top2);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'electricbox') {
                    // Level 3「电气站」：裸露电箱 + 警示灯
                    const grp = new THREE.Group();
                    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.5), this.metalMat);
                    box.position.y = 1.15;
                    const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({
                        color: 0xff3020, transparent: true, opacity: 0.9
                    }));
                    light.position.set(0, 1.85, 0.28);
                    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.8 }));
                    wire.position.set(0.4, 1.6, 0);
                    grp.add(box, light, wire);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'stalactite') {
                    // Level 8「洞穴」：钟乳石（倒挂锥）
                    const h = d.h || 1.2;
                    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.95 });
                    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.3, h, 7), rockMat);
                    sp.position.y = WALL_H - h / 2;
                    const sp2 = new THREE.Mesh(new THREE.ConeGeometry(0.16, h * 0.6, 6), rockMat);
                    sp2.position.set(0.35, WALL_H - h * 0.3, 0.2);
                    const grp = new THREE.Group();
                    grp.add(sp, sp2);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'streetlamp') {
                    // Level 9 / 94：郊区路灯
                    const grp = new THREE.Group();
                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 7), this.metalMat);
                    pole.position.y = 2.3;
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), this.metalMat);
                    arm.position.set(0.45, 4.4, 0);
                    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({
                        color: 0xffe8a0, transparent: true, opacity: 0.95
                    }));
                    bulb.position.set(0.88, 4.3, 0);
                    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({
                        color: 0xffd880, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    halo.position.set(0.88, 4.25, 0);
                    grp.add(pole, arm, bulb, halo);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'elevator') {
                    // Level 33「电梯」：金属电梯门（收集矩阵 → InstancedMesh）
                    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, d.rot, 0));
                    for (const off of [new THREE.Vector3(-0.45, 1.2, 0).applyQuaternion(q), new THREE.Vector3(0.45, 1.2, 0).applyQuaternion(q)]) {
                        elevDoorMs.push(mat(d.x + off.x, off.y, d.z + off.z, _qId, 0.9, 2.4, 0.08));
                    }
                    const offS = new THREE.Vector3(0, 1.2, 0).applyQuaternion(q);
                    elevSeamMs.push(mat(d.x + offS.x, offS.y, d.z + offS.z, _qId, 0.03, 2.3, 0.1));
                    const offL = new THREE.Vector3(0, 2.62, 0).applyQuaternion(q);
                    elevSignMs.push(mat(d.x + offL.x, offL.y, d.z + offL.z, _qId, 0.5, 0.22, 1));
                } else if (d.type === 'freezer') {
                    // Level 18 便利店：冰柜（透明门 + 冷光）
                    const grp = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.0, 0.7), this.metalMat);
                    body.position.y = 1.0;
                    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 0.04), new THREE.MeshStandardMaterial({
                        color: 0xbfe8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55
                    }));
                    door.position.set(0, 1.15, 0.36);
                    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), new THREE.MeshBasicMaterial({
                        color: 0x99ddff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    glow.position.set(0, 1.15, 0.37);
                    grp.add(body, door, glow);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'register') {
                    // Level 18 便利店：收银台
                    const grp = new THREE.Group();
                    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.8), this.woodMat);
                    counter.position.y = 0.5;
                    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.8), this.woodDarkMat);
                    top.position.y = 1.03;
                    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4 }));
                    screen.position.set(0.4, 1.3, 0.2);
                    const scrGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), new THREE.MeshBasicMaterial({
                        color: 0x88ff88, transparent: true, opacity: 0.6
                    }));
                    scrGlow.position.set(0.4, 1.3, 0.226);
                    grp.add(counter, top, screen, scrGlow);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'vending') {
                    // Level 1 自动售货机：金属柜 + 玻璃门 + 发光商品
                    const grp = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.8), new THREE.MeshStandardMaterial({
                        color: 0x9a3030, roughness: 0.6, metalness: 0.3
                    }));
                    body.position.y = 1.05;
                    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.5, 0.04), new THREE.MeshStandardMaterial({
                        color: 0xcfe8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.6
                    }));
                    glass.position.set(0, 1.3, 0.41);
                    // 内部发光（商品光）
                    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.4), new THREE.MeshBasicMaterial({
                        color: 0x88ddff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    glow.position.set(0, 1.3, 0.42);
                    // 商品色块
                    for (let i = 0; i < 6; i++) {
                        const item = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.05), new THREE.MeshStandardMaterial({
                            color: [0xff6060, 0x60ff60, 0x6060ff, 0xffff60, 0xff60ff, 0x60ffff][i], roughness: 0.7
                        }));
                        item.position.set(-0.35 + (i % 3) * 0.35, 1.75 - Math.floor(i / 3) * 0.5, 0.42);
                        grp.add(item);
                    }
                    grp.add(body, glass, glow);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'porthole') {
                    // Level 56 太空站：舷窗（映出星空）
                    const grp = new THREE.Group();
                    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 16), this.metalMat);
                    frame.position.y = 1.7;
                    // 星空（程序化）
                    if (!this._starTex) {
                        const c = makeCanvas(128, 128);
                        const g = c.getContext('2d');
                        g.fillStyle = '#050810';
                        g.fillRect(0, 0, 128, 128);
                        for (let i = 0; i < 140; i++) {
                            g.fillStyle = 'rgba(220,230,255,' + (0.3 + Math.random() * 0.7).toFixed(2) + ')';
                            g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
                        }
                        g.fillStyle = 'rgba(180,220,255,0.95)';
                        g.beginPath(); g.arc(30, 40, 2.2, 0, Math.PI * 2); g.fill();
                        this._starTex = finishTexture(new THREE.CanvasTexture(c));
                    }
                    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), new THREE.MeshBasicMaterial({
                        map: this._starTex, transparent: true, opacity: 0.95
                    }));
                    glass.position.set(0, 1.7, 0.06);
                    grp.add(frame, glass);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'airlock') {
                    // Level 56 太空站：气闸舱门（环形 + 警示灯）
                    const grp = new THREE.Group();
                    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.15, 18), this.metalMat);
                    door.rotation.x = Math.PI / 2;
                    door.position.y = 1.5;
                    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.4, metalness: 0.6 }));
                    hub.rotation.x = Math.PI / 2;
                    hub.position.y = 1.5;
                    const warn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshBasicMaterial({
                        color: 0xff5020, transparent: true, opacity: 0.9
                    }));
                    warn.position.set(0.55, 2.2, 0);
                    grp.add(door, hub, warn);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'carousel') {
                    // Level 283 玩耍之地：旋转木马（彩条圆柱 + 锥顶）
                    const grp = new THREE.Group();
                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), this.metalMat);
                    pole.position.y = 1.7;
                    const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 10), new THREE.MeshStandardMaterial({
                        color: 0xc02060, roughness: 0.6, emissive: 0x300018, emissiveIntensity: 0.4
                    }));
                    top.position.y = 3.6;
                    for (let i = 0; i < 6; i++) {
                        const a = (i / 6) * Math.PI * 2;
                        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), new THREE.MeshStandardMaterial({
                            color: [0xff6060, 0x60ff60, 0x6060ff, 0xffff60, 0xff60ff, 0x60ffff][i], roughness: 0.6
                        }));
                        stripe.position.set(Math.cos(a) * 1.15, 1.1, Math.sin(a) * 1.15);
                        grp.add(stripe);
                    }
                    grp.add(pole, top);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'slide') {
                    // 滑梯
                    const grp = new THREE.Group();
                    const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 3.2), new THREE.MeshStandardMaterial({
                        color: 0xff8040, roughness: 0.7
                    }));
                    ramp.position.set(0, 1.1, 0.6);
                    ramp.rotation.x = 0.5;
                    const stairs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.8), this.woodMat);
                    stairs.position.set(0, 0.8, -1.3);
                    grp.add(ramp, stairs);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'ballpit') {
                    // 彩球池
                    const grp = new THREE.Group();
                    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 14, 1, true), new THREE.MeshStandardMaterial({
                        color: 0x4070c0, roughness: 0.8, side: THREE.DoubleSide
                    }));
                    wall.position.y = 0.25;
                    const balls = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.35, 12), new THREE.MeshBasicMaterial({
                        color: 0x80b0ff, transparent: true, opacity: 0.35
                    }));
                    balls.position.y = 0.2;
                    grp.add(wall, balls);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'billboard') {
                    // Level 11 城市：发光广告牌
                    const grp = new THREE.Group();
                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.0, 7), this.metalMat);
                    pole.position.y = 2.0;
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 0.12), new THREE.MeshStandardMaterial({
                        color: 0x2a2a30, roughness: 0.6, metalness: 0.3
                    }));
                    panel.position.y = 4.3;
                    const adColors = [0xff4040, 0x40ff40, 0x4040ff, 0xffaa00];
                    const ad = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.1), new THREE.MeshBasicMaterial({
                        color: adColors[Math.floor(Math.random() * adColors.length)],
                        transparent: true, opacity: 0.85
                    }));
                    ad.position.set(0, 4.3, 0.07);
                    grp.add(pole, panel, ad);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'cubicle') {
                    // Level 4 办公室：半高隔间（f 版：空荡的隔间）
                    const grp = new THREE.Group();
                    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.7 });
                    const p1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.05), wallMat);
                    p1.position.set(0, 0.6, 0);
                    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 2.4), wallMat);
                    p2.position.set(1.18, 0.6, 0);
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0x5a5a62, roughness: 0.6 }));
                    frame.position.set(0, 1.22, 0);
                    grp.add(p1, p2, frame);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'errsign') {
                    // Level 404：故障"404"发光标识
                    const grp = new THREE.Group();
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08), new THREE.MeshStandardMaterial({
                        color: 0x1a1a1e, roughness: 0.5
                    }));
                    panel.position.y = 1.9;
                    // "404" 发光纹理
                    if (!this._errTex) {
                        const c = makeCanvas(128, 64);
                        const g = c.getContext('2d');
                        g.fillStyle = '#101014';
                        g.fillRect(0, 0, 128, 64);
                        g.fillStyle = '#ff3030';
                        g.font = 'bold 44px monospace';
                        g.textAlign = 'center';
                        g.textBaseline = 'middle';
                        g.fillText('404', 64, 34);
                        this._errTex = finishTexture(new THREE.CanvasTexture(c));
                    }
                    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({
                        map: this._errTex, transparent: true, opacity: 0.9
                    }));
                    sign.position.set(0, 1.9, 0.05);
                    grp.add(panel, sign);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'aptdoor') {
                    // Level 13 建筑：公寓门
                    const grp = new THREE.Group();
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.08), this.woodDarkMat);
                    frame.position.y = 1.2;
                    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, 0.05), this.woodMat);
                    door.position.set(0, 1.1, 0.06);
                    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0xc8a830, roughness: 0.3, metalness: 0.7 }));
                    knob.position.set(0.38, 1.0, 0.1);
                    const num = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01), new THREE.MeshBasicMaterial({
                        color: 0xffe8a0, transparent: true, opacity: 0.8
                    }));
                    num.position.set(0, 1.85, 0.09);
                    grp.add(frame, door, knob, num);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'mailbox') {
                    // Level 94 小镇：红色邮箱
                    const grp = new THREE.Group();
                    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 6), this.metalMat);
                    post.position.y = 0.55;
                    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.25), new THREE.MeshStandardMaterial({
                        color: 0xb03030, roughness: 0.6, metalness: 0.3
                    }));
                    box.position.y = 1.15;
                    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 }));
                    flag.position.set(0.27, 1.3, 0);
                    grp.add(post, box, flag);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'finalgate') {
                    // Level 1000「终点」：终点之门（巨门 + 光幕 + 光柱）
                    const grp = new THREE.Group();
                    const gateMat = new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.7 });
                    const pl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.2), gateMat);
                    pl.position.set(-3.5, 4, 0);
                    const pr = pl.clone(); pr.position.x = 3.5;
                    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.4, 1.2), gateMat);
                    lintel.position.set(0, 8.4, 0);
                    const veil = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 7.6), new THREE.MeshBasicMaterial({
                        color: 0xfff2c0, transparent: true, opacity: 0.28,
                        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                    }));
                    veil.position.set(0, 4, 0);
                    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 16, 10, 1, true), new THREE.MeshBasicMaterial({
                        color: 0xfff6d0, transparent: true, opacity: 0.1,
                        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
                    }));
                    beam.position.y = 10;
                    grp.add(pl, pr, lintel, veil, beam);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'scarecrow') {
                    // Level 10 丰收：稻草人（f 版设定）
                    const grp = new THREE.Group();
                    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), this.woodDarkMat);
                    pole.position.y = 1.2;
                    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), this.woodDarkMat);
                    arm.position.y = 2.0;
                    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb8a878, roughness: 0.9 }));
                    head.position.y = 2.45;
                    // 破衣
                    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95 }));
                    cloth.position.y = 1.5;
                    // 草帽
                    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xc8a840, roughness: 0.9 }));
                    hat.position.y = 2.62;
                    grp.add(pole, arm, head, cloth, hat);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'blackboard') {
                    // Level 52「学校」：教室黑板
                    const grp = new THREE.Group();
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.1), this.woodDarkMat);
                    frame.position.y = 1.9;
                    const board = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.06), new THREE.MeshStandardMaterial({
                        color: 0x1e3a2a, roughness: 0.6
                    }));
                    board.position.y = 1.5;
                    // 粉笔字迹
                    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshBasicMaterial({
                        color: 0xd8d8d0, transparent: true, opacity: 0.5, side: THREE.DoubleSide
                    }));
                    chalk.position.set(0, 1.5, 0.04);
                    grp.add(frame, board, chalk);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'machine') {
                    // Level 100「工厂」：锈蚀机器
                    const grp = new THREE.Group();
                    const rustMat = new THREE.MeshStandardMaterial({ color: 0x6a4a38, roughness: 0.85, metalness: 0.3 });
                    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 1.4), rustMat);
                    body.position.y = 0.9;
                    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), rustMat);
                    pipe.position.set(0.9, 1.6, 0);
                    pipe.rotation.z = Math.PI / 3;
                    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), new THREE.MeshStandardMaterial({
                        color: 0x303030, roughness: 0.4, metalness: 0.5
                    }));
                    gauge.position.set(-0.5, 1.55, 0.72);
                    gauge.rotation.x = Math.PI / 2;
                    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({
                        color: 0xff4020, transparent: true, opacity: 0.9
                    }));
                    lamp.position.set(-0.5, 1.75, 0.72);
                    grp.add(body, pipe, gauge, lamp);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                } else if (d.type === 'monolith') {
                    const grp = new THREE.Group();
                    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.85 });
                    const pillar = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 4), stoneMat);
                    pillar.position.y = 4.5;
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 6), stoneMat);
                    cap.position.y = 9.6;
                    const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 8), stoneMat);
                    base.position.y = 0.4;
                    // 天光柱
                    const beam = new THREE.Mesh(
                        new THREE.CylinderGeometry(2.2, 2.2, 14, 10, 1, true),
                        new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
                    );
                    beam.position.y = 10;
                    const glow = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), new THREE.MeshBasicMaterial({
                        color: 0xfff0c0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    glow.position.y = 17;
                    grp.add(pillar, cap, base, beam, glow);
                    grp.position.set(d.x, 0, d.z);
                    single.push(grp);
                } else if (d.type === 'sea_house') {
                    // Level 7「深海恐惧」：海中央的孤房
                    const grp = new THREE.Group();
                    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a5a44, roughness: 0.9 });
                    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.85 });
                    for (let i = 0; i < 4; i++) {
                        const wall = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 0.3), wallMat);
                        wall.position.set(
                            i % 2 === 0 ? 0 : (i === 1 ? 4.5 : -4.5),
                            1.5,
                            i % 2 === 0 ? (i === 0 ? -4.5 : 4.5) : 0
                        );
                        grp.add(wall);
                    }
                    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 2.2, 4), roofMat);
                    roof.position.y = 4.1;
                    roof.rotation.y = Math.PI / 4;
                    const floor = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 9.6), wallMat);
                    floor.position.y = 0.2;
                    // 屋里的光（孤房是 Level 7 唯一的亮点）
                    const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({
                        color: 0xffcc66, transparent: true, opacity: 0.8, side: THREE.DoubleSide
                    }));
                    winGlow.position.set(0, 1.6, -4.46);
                    grp.add(roof, floor, winGlow);
                    grp.position.set(d.x, 0, d.z);
                    grp.rotation.y = d.rot;
                    single.push(grp);
                }
            }
            this._instanced(unitPillar, pillarMat, pMs, this.decoGroup, true, false);
            this._instanced(unitPipe, pipeMat, pipeMs, this.decoGroup, true, false);
            this._instanced(unitBox, shelfMat, shelfMs, this.decoGroup, true, false);
            this._instanced(unitBox, itemMat, itemMs, this.decoGroup, false, false);
            // 电梯门（InstancedMesh）
            this._instanced(unitBox, new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.45, metalness: 0.7 }), elevDoorMs, this.decoGroup, true, false);
            this._instanced(unitBox, new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.6 }), elevSeamMs, this.decoGroup, true, false);
            this._instanced(unitPlane, new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.9 }), elevSignMs, this.decoGroup, false, false);
            for (const o of single) {
                o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                this.decoGroup.add(o);
            }
        }

        // ---- 层级特色装饰（f 版设定） ----
        // Level 399 霓虹深渊：街道上方霓虹灯条
        if (this.config && this.config.id === 399) {
            const neonColors = [0xff2d78, 0x00e5ff, 0xaa66ff, 0xffaa00];
            const neonMat = [];
            for (const nc of neonColors) {
                neonMat.push(new THREE.MeshBasicMaterial({ color: nc, transparent: true, opacity: 0.9 }));
            }
            const neonMs = [];
            for (let i = 0; i < 60; i++) {
                const nx = (Math.random() - 0.5) * 130;
                const nz = (Math.random() - 0.5) * 130;
                const horiz = Math.random() < 0.5;
                const len = 4 + Math.random() * 10;
                const q = horiz ? new THREE.Quaternion() : new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
                neonMs.push(mat(nx, 2.2 + Math.random() * 1.6, nz, q, len, 0.07, 0.07));
            }
            // 每条霓虹灯独立材质颜色 → 分色 InstancedMesh
            for (let c = 0; c < neonColors.length; c++) {
                const ms = neonMs.filter((_, i) => i % neonColors.length === c);
                this._instanced(unitBox, neonMat[c], ms, this.decoGroup, false, false);
            }
            // 下雨：斜落雨线粒子（399 设定：无尽湿漉街道）
            if (!this.rainPoints) {
                const N = 500;
                const pos = new Float32Array(N * 3);
                for (let i = 0; i < N; i++) {
                    pos[i * 3] = (Math.random() - 0.5) * 160;
                    pos[i * 3 + 1] = Math.random() * 8;
                    pos[i * 3 + 2] = (Math.random() - 0.5) * 160;
                }
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                this.rainPoints = new THREE.Points(geo, new THREE.PointsMaterial({
                    color: 0x8899cc, size: 0.05, transparent: true, opacity: 0.5,
                    depthWrite: false, sizeAttenuation: true
                }));
                this.rainPoints.frustumCulled = false;
                this.scene.add(this.rainPoints);
            }
            this.rainPoints.visible = true;
            this._rainT = 0;
        } else if (this.rainPoints) {
            this.rainPoints.visible = false;
        }
        // Level 37 泳池房 / Level 7 深海：真实水面反射（顶级 3D 的水面）
        if (this.config && (this.config.id === 37 || this.config.id === 7)) {
            if (!this.waterReflector) {
                this.waterReflector = new Reflector(new THREE.PlaneGeometry(150, 150), {
                    clipBias: 0.003,
                    textureWidth: 512, textureHeight: 512,
                    color: this.config.id === 7 ? 0x2a5a7a : 0x3a8a9a
                });
                this.waterReflector.position.y = 0.05;
                this.waterReflector.rotation.x = -Math.PI / 2;
                this.waterReflector.visible = false;
                this.scene.add(this.waterReflector);
            }
            this.waterReflector.visible = true;
        } else if (this.waterReflector) {
            this.waterReflector.visible = false;
        }

        // ---- 补给（f 版核心设定） ----
        if (mazeData.pickups && mazeData.pickups.length) {
            const pickupStyles = {
                almond_water: { bottle: 0xd8e8f0, cap: 0x2060a0, glow: 0x66ccff, label: '💧' },
                memory_juice: { bottle: 0xc8a8e8, cap: 0x6020a0, glow: 0xb066ff, label: '🧃' },
                royal_ration: { bottle: 0xd8b878, cap: 0x8a6020, glow: 0xffcc66, label: '🍱' },
                cashew_water: { bottle: 0xa8e8d8, cap: 0x206080, glow: 0x66ffcc, label: '⚗️' },
            };
            for (const pk of mazeData.pickups) {
                const st = pickupStyles[pk.type] || pickupStyles.almond_water;
                const grp = new THREE.Group();
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.32, 10), new THREE.MeshStandardMaterial({
                    color: st.bottle, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85
                }));
                body.position.y = 0.18;
                const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), new THREE.MeshStandardMaterial({ color: st.cap, roughness: 0.4 }));
                cap.position.y = 0.38;
                const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({
                    color: st.glow, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false
                }));
                glow.position.y = 0.25;
                grp.add(body, cap, glow);
                grp.position.set(pk.x, 0, pk.z);
                grp.userData.pickup = true;
                grp.userData.pickupType = pk.type;
                this.mazeGroup.add(grp);
                if (pk.type === 'meg_doc') {
                    // M.E.G. 遗落文档：泛黄纸片 + 微光
                    grp.clear();
                    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), new THREE.MeshStandardMaterial({
                        color: 0xe8dcb0, roughness: 0.9, side: THREE.DoubleSide
                    }));
                    paper.position.y = 0.25;
                    const paperGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({
                        color: 0x88bbff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
                    }));
                    paperGlow.position.y = 0.25;
                    grp.add(paper, paperGlow);
                }
            }
        }

        // ---- 出口：门框 + 光幕（多出口） ----
        const exits = mazeData.exits && mazeData.exits.length ? mazeData.exits : (exitPos ? [{ x: exitPos.x, z: exitPos.z, hidden: false }] : []);
        for (const ex of exits) {
            const grp = new THREE.Group();
            const doorMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.6, metalness: 0.4 });
            const postL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.22), doorMat);
            postL.position.set(-1.1, 1.35, 0);
            const postR = postL.clone(); postR.position.x = 1.1;
            const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.22, 0.22), doorMat);
            lintel.position.set(0, 2.7, 0);
            grp.add(postL, postR, lintel);
            // 光幕
            const glowMat = new THREE.MeshBasicMaterial({
                color: ex.hidden ? 0x60ff60 : 0x40ff40,
                transparent: true, opacity: ex.hidden ? 0.12 : 0.3,
                blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            });
            const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.3), glowMat);
            veil.position.y = 1.35;
            grp.add(veil);
            // 光柱（主出口明显）
            if (!ex.hidden) {
                const beam = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.3, 0.3, 4, 8, 1, true),
                    new THREE.MeshBasicMaterial({ color: 0x40ff40, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })
                );
                beam.position.y = 2.1;
                grp.add(beam);
            }
            grp.position.set(ex.x, 0, ex.z);
            grp.name = 'exitDoor' + (ex.hidden ? '-hidden' : '');
            this.mazeGroup.add(grp);
        }
        // 兼容旧字段：单独的 exitPos 标记块（不再需要，但保留旧场景引用安全）
        if (exitPos && (!mazeData.exits || mazeData.exits.length === 0)) {
            const em = new THREE.MeshStandardMaterial({ color: 0x40ff40, emissive: 0x22aa22, roughness: 0.3 });
            const exit = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), em);
            exit.position.set(exitPos.x, 0.15, exitPos.z);
            exit.name = 'exitMarker';
            this.mazeGroup.add(exit);
        }
    }

    _getFloorMat() {
        if (!this.config) return this.floorMat;
        // f 版设定：Level 480 海滩 → 沙地
        if (this.config.id === 480) return this._sandMat || (this._sandMat = new THREE.MeshStandardMaterial({ color: 0xd8c088, roughness: 0.95 }));
        // f 版设定：Level 666 地狱 → 焦土
        if (this.config.id === 666) return this._hellMat || (this._hellMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9, emissive: 0x300800, emissiveIntensity: 0.35 }));
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

    // f 版设定：Level 11 城市昼夜切换
    setDayNight(night) {
        if (!this._outdoor || (this.config && this.config.id !== 11)) {
            this._nightOverride = false;
            return;
        }
        this._nightOverride = night;
        if (night) {
            this.ambient.intensity = 0.55;
            this.hemi.intensity = 0.3;
            this.renderer.toneMappingExposure = 1.15;
            this.scene.fog = new THREE.FogExp2(0x0a0e1c, this.scene.fog ? this.scene.fog.density : 0.0006);
            this.scene.background = new THREE.Color(0x0a0e1c);
        } else {
            this.ambient.intensity = 2.0;
            this.hemi.intensity = 1.0;
            this.renderer.toneMappingExposure = 1.45;
            this.scene.fog = new THREE.FogExp2(0x171410, 0.0006);
            this.scene.background = new THREE.Color(0x171410);
        }
    }

    // 荧光灯闪烁（f 版设定：荧光灯嗡嗡作响、偶尔闪烁——闪的是灯，不是手电筒）
    updateLights(flickerTime) {
        const flicker = this.config && this.config.renderFlags && this.config.renderFlags.includes(MazeRenderFlags.FLICKERING_LIGHTS);
        if (!flicker || this._outdoor || !this.lampTubeMat) {
            if (this.lampTubeMat) this.lampTubeMat.emissiveIntensity = 3.0;
            return;
        }
        // 缓慢明暗呼吸 + 偶发熄灭（每秒 2 次左右的随机灭灯瞬间）
        const phase = Math.sin(flickerTime * 2.3) * 0.5 + 0.5;
        let base = 2.4 + phase * 1.2;
        if (Math.sin(flickerTime * 1.7) > 0.985) base = 0.15;      // 偶发瞬间熄灭
        if (Math.sin(flickerTime * 3.1 + 1.3) > 0.992) base = 0.1; // 另一组灯闪
        this.lampTubeMat.emissiveIntensity = base;
        for (let i = 0; i < this.ceilingLights.length; i++) {
            const l = this.ceilingLights[i];
            if (l.intensity <= 0) continue;
            const ph = Math.sin(flickerTime * 2.3 + i * 1.7);
            l.intensity = 4.5 * (0.6 + 0.4 * (ph * 0.5 + 0.5));
            if (Math.sin(flickerTime * 3.1 + i * 2.3) > 0.99) l.intensity = 0.3;
        }
    }

    updateFlashlight(player, flickerTime) {
        if (!this.flashlight) return;
        this.flashlight.position.copy(player.position);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.camera.quaternion);
        this.flashlight.target.position.copy(player.position.clone().add(dir));
        this.flashlight.visible = player.flashlightOn;
        this.flashCone.visible = player.flashlightOn;
        // 手臂常显；手电筒模型按 F 显隐
        this.torchGroup.visible = player.flashlightOn;

        if (player.flashlightOn) {
            this.flashCone.position.copy(player.position.clone().addScaledVector(dir, 4.5));
            this.flashCone.quaternion.copy(player.camera.quaternion);
            // 手电筒恒定亮度（闪烁的是荧光灯，不是手电筒）
            this.flashlight.intensity = 6.5;
            this.flashCone.material.opacity = 0.1;
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
                // 微笑者：黑暗中苍白的发光面孔（f 版设定）
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshStandardMaterial({
                    map: this.texSmile, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.5,
                    emissiveMap: this.texSmile
                }));
                head.castShadow = true;
                group.add(head);
                break;
            }
            case 'hound': {
                // 猎犬：黑色四足怪物（f 版设定）
                const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.55), mat);
                body.position.y = 0.55; body.castShadow = true;
                const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.4), mat);
                head.position.set(0.65, 0.75, 0); head.castShadow = true;
                const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.2), mat);
                snout.position.set(0.78, 0.66, 0);
                group.add(body, head, snout);
                const legs = [];
                for (let i = 0; i < 4; i++) {
                    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat);
                    leg.position.set((i % 2 === 0 ? -0.38 : 0.38), 0.25, i < 2 ? 0.2 : -0.2);
                    leg.position.y = 0.5;
                    leg.geometry.translate(0, -0.25, 0); // 旋转轴在腿根部
                    group.add(leg);
                    legs.push(leg);
                }
                group.userData.legs = legs; // 奔跑摆腿动画
                break;
            }
            case 'deathmoth': {
                const wingMat = new THREE.MeshBasicMaterial({ color: 0x9a9aa0, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
                const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), wingMat);
                w1.position.set(-0.5, 0.5, 0); w1.rotation.y = 0.6;
                w1.geometry.translate(0.5, 0, 0); // 旋转轴在翅膀根部
                const w2 = w1.clone(); w2.position.x = 0.5; w2.rotation.y = -0.6;
                w2.geometry.translate(0.5, 0, 0);
                const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8), mat);
                body.position.y = 0.5; body.castShadow = true;
                group.add(w1, w2, body);
                group.userData.wings = [w1, w2]; // 扑翅动画
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
            case 'partygoer': {
                // 派对客（f 版设定）：黄色微笑面具 + 彩色锥帽的狂欢者
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), new THREE.MeshStandardMaterial({
                    map: this._partyTex || (this._partyTex = (() => {
                        const c = document.createElement('canvas');
                        c.width = 256; c.height = 256;
                        const g = c.getContext('2d');
                        g.fillStyle = '#f0d040';
                        g.fillRect(0, 0, 256, 256);
                        g.fillStyle = '#101010';
                        g.beginPath(); g.ellipse(92, 96, 20, 26, 0, 0, Math.PI * 2); g.fill();
                        g.beginPath(); g.ellipse(164, 96, 20, 26, 0, 0, Math.PI * 2); g.fill();
                        g.beginPath(); g.ellipse(128, 168, 46, 36, 0, 0, Math.PI); g.fill();
                        return finishTexture(new THREE.CanvasTexture(c));
                    })()),
                    roughness: 0.6
                }));
                head.castShadow = true;
                const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), new THREE.MeshStandardMaterial({
                    color: 0xc02060, roughness: 0.5, emissive: 0x400020, emissiveIntensity: 0.3
                }));
                hat.position.y = 0.72;
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.4, 8), new THREE.MeshStandardMaterial({
                    color: 0x8a3050, roughness: 0.7
                }));
                body.position.y = -0.55;
                group.add(head, hat, body);
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
            case 'clump': {
                // 团块（f 版设定）：一团缠绕的肢体
                const limbMat = new THREE.MeshStandardMaterial({ color: 0x6a4a4a, roughness: 0.9 });
                const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), limbMat);
                core.position.y = 0.7; core.castShadow = true;
                group.add(core);
                for (let i = 0; i < 5; i++) {
                    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.0, 5), limbMat);
                    const a = (i / 5) * Math.PI * 2;
                    limb.position.set(Math.cos(a) * 0.45, 0.7 + Math.sin(i * 2.4) * 0.35, Math.sin(a) * 0.45);
                    limb.rotation.set(Math.sin(i * 1.7) * 1.2, a, Math.cos(i * 2.1) * 1.2);
                    group.add(limb);
                }
                break;
            }
            case 'skin_stealer': {
                // 皮行者（f 版设定）：披着受害者皮肤的怪物
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.7, 7), mat);
                body.position.y = 0.85; body.castShadow = true;
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat);
                head.position.y = 1.82; head.castShadow = true;
                // 下垂的"皮"
                const skin = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshStandardMaterial({
                    color: 0xc8a080, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.85
                }));
                skin.position.set(0, 0.75, -0.2);
                skin.rotation.x = 0.2;
                group.add(body, head, skin);
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

    // 爆炸/灼烧特效（火盐命中实体）
    createExplosion(pos) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({
            color: 0xffaa33, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        glow.position.copy(pos);
        glow.position.y += 1;
        this.scene.add(glow);
        const t0 = performance.now();
        const tick = () => {
            const t = (performance.now() - t0) / 550;
            if (t >= 1) { this.scene.remove(glow); return; }
            glow.scale.setScalar(1 + t * 3.5);
            glow.material.opacity = 0.9 * (1 - t);
            requestAnimationFrame(tick);
        };
        tick();
    }

    render() {
        // 天空穹顶跟随相机
        if (this.skyDome && this.skyDome.visible) {
            this.skyDome.position.copy(this.camera.position);
        }
        // 399 下雨动画
        if (this.rainPoints && this.rainPoints.visible) {
            this._rainT = (this._rainT || 0) + 1;
            const pos = this.rainPoints.geometry.attributes.position;
            const dy = 0.3;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i) - dy;
                if (y < 0) y = 8 + Math.random() * 2;
                pos.setY(i, y);
            }
            pos.needsUpdate = true;
        }
        // Level 7 气泡上升
        if (this.bubblePoints && this.bubblePoints.visible) {
            const pos = this.bubblePoints.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i) + 0.025;
                if (y > 3.6) y = 0.1;
                pos.setY(i, y);
            }
            pos.needsUpdate = true;
        }
        // Level 6「熄灭」偶发蓝光（f 版设定：黑暗中的诡异闪光）
        if (this.blueGlow && this.blueGlowTimer >= 0) {
            this.blueGlowTimer -= 1;
            if (this.blueGlowTimer <= 0) {
                if (this._bluePhase) {
                    this.blueGlow.material.opacity = 0;
                    this.blueGlowTimer = 240 + Math.floor(Math.random() * 300); // 4~9 秒后再次
                    this._bluePhase = false;
                } else {
                    const a = Math.random() * Math.PI * 2;
                    const d = 8 + Math.random() * 14;
                    this.blueGlow.position.set(
                        this.camera.position.x + Math.cos(a) * d,
                        1.2 + Math.random() * 2.2,
                        this.camera.position.z + Math.sin(a) * d
                    );
                    this.blueGlowTimer = 24;
                    this._bluePhase = true;
                }
            } else if (this._bluePhase) {
                this.blueGlow.material.opacity = 0.32 * (this.blueGlowTimer / 24);
            }
        }
        // Level 28 雷暴闪电（f 版设定：风暴石堡永远笼罩在雷暴中）
        if (this.thunderFlash && this._thunderT >= 0) {
            this._thunderT -= 1;
            if (this._thunderT === 2 || this._thunderT === 1) {
                this.thunderFlash.material.opacity = 0.9;
                this._thunderCb && this._thunderCb();
            } else {
                this.thunderFlash.material.opacity = 0;
            }
            if (this._thunderT <= 0) {
                this._thunderT = 300 + Math.floor(Math.random() * 500);
                this._thunderCb = null;
            }
        }
        // 泛光后处理（顶级 3D 辉光）或直接渲染
        if (this.composer && this.useBloom) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    // 泛光开关（低端设备可关闭）
    setBloomEnabled(on) {
        this.useBloom = !!on;
    }

    // 注册闪电回调（雷声）
    setThunderCallback(cb) { this._thunderCb = cb; }
}
