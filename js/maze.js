import * as THREE from 'three';
import { TerrainType, MazeRenderFlags } from './config.js';

const WALL_HEIGHT = 3.5;
const WALL_THICKNESS = 0.3;
const CELL_SIZE = 5;
const GRID_SIZE = 30;

export class MazeGenerator {
    constructor(levelConfig) {
        this.config = levelConfig;
        this.grid = [];
        this.width = GRID_SIZE;
        this.height = GRID_SIZE;
        this.cellSize = CELL_SIZE;
        this.wallHeight = WALL_HEIGHT;
        this.startPos = new THREE.Vector3();
        this.exitPos = new THREE.Vector3();
        this.buildings = [];
        this.trees = [];
        this.decorations = [];
        this.entitySpawns = [];
        this.platforms = [];
    }

    generate() {
        this.grid = this._createEmptyGrid();
        this._applyTerrainMaze();
        this._applyRenderFlags();
        return {
            grid: this.grid,
            startPos: this.startPos,
            exitPos: this.exitPos,
            buildings: this.buildings,
            trees: this.trees,
            decorations: this.decorations,
            entitySpawns: this.entitySpawns,
            platforms: this.platforms
        };
    }

    _createEmptyGrid() {
        const grid = [];
        for (let x = 0; x < this.width; x++) {
            grid[x] = [];
            for (let y = 0; y < this.height; y++) {
                grid[x][y] = { walls: [true, true, true, true], visited: false, isOpen: false };
            }
        }
        return grid;
    }

    _applyTerrainMaze() {
        switch (this.config.terrainType) {
            case TerrainType.ROOMS: this._genRooms(); break;
            case TerrainType.CORRIDORS: this._genCorridors(); break;
            case TerrainType.CAVES: this._genCaves(); break;
            case TerrainType.OPEN: this._genOpen(); break;
            case TerrainType.URBAN: this._genUrban(); break;
            case TerrainType.INDUSTRIAL: this._genIndustrial(); break;
            case TerrainType.PIPES: this._genPipes(); break;
            case TerrainType.AQUATIC: this._genOpen(); break;
            case TerrainType.FOREST: this._genForest(); break;
            case TerrainType.VOID: this._genVoid(); break;
            case TerrainType.LABYRINTH: this._genLabyrinth(); break;
            case TerrainType.TUNNELS: this._genTunnels(); break;
            case TerrainType.WAREHOUSE: this._genWarehouse(); break;
            case TerrainType.HOTEL: this._genRooms(); break;
            case TerrainType.HOSPITAL: this._genCorridors(); break;
            case TerrainType.OFFICE: this._genRooms(); break;
            case TerrainType.UNDERGROUND: this._genCaves(); break;
            case TerrainType.SNOW: this._genOpen(); break;
            case TerrainType.DESERT: this._genOpen(); break;
            case TerrainType.JUNGLE: this._genForest(); break;
            default: this._genRooms(); break;
        }
        this._placeEntities();
        this._addVerticality();
    }

    // ---- 3D 垂直维度 ----
    // Level 0 生成"二层夹层 + 阶梯"；室内层级撒一些可跳上的木箱
    _addVerticality() {
        this.platforms = [];

        if (this.config.id === 0) {
            let area = this._findOpenArea(4, 4, 40);
            if (!area) {
                // 找不到天然空区：自凿一块 4x4 区域并打通出口，保证夹层必现
                const x0 = 4, y0 = this.height - 8;
                for (let dx = 0; dx < 4; dx++)
                    for (let dy = 0; dy < 4; dy++)
                        this.grid[x0 + dx][y0 + dy].walls = [false, false, false, false];
                for (let dy = 0; dy < 4; dy++) this.grid[x0 + 4][y0 + dy].walls[3] = false;
                for (let dx = 0; dx < 4; dx++) this.grid[x0 + dx][y0 + 4].walls[0] = false;
                area = { x0, y0 };
            }
            if (area) {
                const { x0, y0 } = area;
                const cx = (x0 + 2) * this.cellSize;
                const cz = (y0 + 2) * this.cellSize;
                const deckW = 16, deckD = 16;
                // 夹层高台（顶高 2.85）
                this.platforms.push({ type: 'deck', x: cx, z: cz, w: deckW, d: deckD, top: 2.85 });
                // 三级阶梯上夹层（展开为 3 个可站立的台阶）
                for (let i = 0; i < 3; i++) {
                    const sw = deckW - (deckW / 3) * i;
                    this.platforms.push({
                        type: 'step', x: cx - deckW / 2 + (deckW / 3) * i + sw / 2,
                        z: cz - deckD / 2 - 3.2, w: sw, d: 3.2, top: 0.95 * (i + 1)
                    });
                }
                // 夹层上的箱子
                for (let i = 0; i < 3; i++) {
                    this.platforms.push({
                        type: 'crate', x: cx - 4 + i * 4.2, z: cz + (i % 2 === 0 ? 2.5 : -2.5),
                        w: 1.1, d: 1.1, top: 3.8
                    });
                }
            }
        }

        // 室内层级撒木箱（可跳上躲避实体）
        const indoor = [TerrainType.ROOMS, TerrainType.HALLS, TerrainType.OFFICE, TerrainType.WAREHOUSE,
            TerrainType.HOTEL, TerrainType.INDUSTRIAL, TerrainType.CORRIDORS, TerrainType.COMPLEX];
        if (indoor.includes(this.config.terrainType)) {
            const n = 4 + Math.floor(Math.random() * 5);
            for (let i = 0; i < n; i++) {
                const ex = 2 + Math.floor(Math.random() * (this.width - 4));
                const ey = 2 + Math.floor(Math.random() * (this.height - 4));
                if (!this._cellBlocked(ex, ey, 1)) {
                    this.platforms.push({
                        type: 'crate',
                        x: ex * this.cellSize + (Math.random() - 0.5) * 1.5,
                        z: ey * this.cellSize + (Math.random() - 0.5) * 1.5,
                        w: 1.1, d: 1.1, top: 0.95
                    });
                }
            }
        }
    }

    // 找一块 size×size 无墙区域（返回 {x0, y0}），失败返回 null
    _findOpenArea(size, margin, attempts) {
        for (let t = 0; t < attempts; t++) {
            const x0 = margin + Math.floor(Math.random() * (this.width - size - margin * 2));
            const y0 = margin + Math.floor(Math.random() * (this.height - size - margin * 2));
            let ok = true;
            for (let dx = 0; dx < size && ok; dx++)
                for (let dy = 0; dy < size && ok; dy++) {
                    if (this.grid[x0 + dx][y0 + dy].walls.some(w => w)) ok = false;
                }
            if (ok) {
                const sc = Math.floor(this.startPos.x / this.cellSize);
                const sz = Math.floor(this.startPos.z / this.cellSize);
                if (Math.abs(sc - (x0 + size / 2)) < 4 && Math.abs(sz - (y0 + size / 2)) < 4) ok = false;
            }
            if (ok) return { x0, y0 };
        }
        return null;
    }

    // 该格子周围 radius 格内是否有墙
    _cellBlocked(x, y, radius) {
        for (let dx = -radius; dx <= radius; dx++)
            for (let dy = -radius; dy <= radius; dy++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
                if (this.grid[nx][ny].walls.some(w => w)) return true;
            }
        return false;
    }

    // 管道之梦：走廊 + 头顶管道
    _genPipes() {
        this._genCorridors();
        this.wallHeight = 2.2;
        for (let x = 2; x < this.width - 2; x += 4)
            for (let y = 2; y < this.height - 2; y += 4)
                this.decorations.push({ type: 'pipe', x: x * this.cellSize, z: y * this.cellSize });
    }

    // 后室设定式生成：连排大房间 + 随意隔断墙 + 门洞连接
    // （Level 0 是"无限延伸、随意分隔的房间"，不是完美迷宫通道）
    _genRooms() {
        const W = this.width, H = this.height;
        // 全部打通
        for (let x = 0; x < W; x++)
            for (let y = 0; y < H; y++) {
                this.grid[x][y].walls = [false, false, false, false];
                this.grid[x][y].visited = true;
            }
        // 外围墙
        for (let x = 0; x < W; x++) { this.grid[x][0].walls[0] = true; this.grid[x][H - 1].walls[2] = true; }
        for (let y = 0; y < H; y++) { this.grid[0][y].walls[3] = true; this.grid[W - 1][y].walls[1] = true; }

        // 4 格大块分区：块间默认有墙，随机开 1~2 个门洞
        const B = 4;
        for (let bx = B; bx < W; bx += B) {
            for (let y = 0; y < H; y++) this.grid[bx][y].walls[3] = true;
            const gates = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < gates; i++) {
                const gy = 1 + Math.floor(Math.random() * (H - 2));
                this.grid[bx][gy].walls[3] = false;
                if (Math.random() < 0.5 && gy + 1 < H - 1) this.grid[bx][gy + 1].walls[3] = false;
            }
        }
        for (let by = B; by < H; by += B) {
            for (let x = 0; x < W; x++) this.grid[x][by].walls[0] = true;
            const gates = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < gates; i++) {
                const gx = 1 + Math.floor(Math.random() * (W - 2));
                this.grid[gx][by].walls[0] = false;
                if (Math.random() < 0.5 && gx + 1 < W - 1) this.grid[gx + 1][by].walls[0] = false;
            }
        }

        // 块内随意隔断（1~2 面，留口不封死）
        for (let bx = 0; bx * B < W; bx++) {
            for (let by = 0; by * B < H; by++) {
                const x0 = bx * B, y0 = by * B;
                const x1 = Math.min(x0 + B, W - 1), y1 = Math.min(y0 + B, H - 1);
                const segs = 1 + Math.floor(Math.random() * 2);
                for (let s = 0; s < segs; s++) {
                    if (Math.random() < 0.5) {
                        // 垂直隔断（沿 y 方向）
                        const sx = x0 + 1 + Math.floor(Math.random() * Math.max(1, x1 - x0 - 2));
                        if (sx < x1) {
                            const gap = y0 + Math.floor(Math.random() * (y1 - y0));
                            for (let y = y0; y <= y1; y++) if (y !== gap) this.grid[sx][y].walls[3] = true;
                        }
                    } else {
                        // 水平隔断（沿 x 方向）
                        const sy = y0 + 1 + Math.floor(Math.random() * Math.max(1, y1 - y0 - 2));
                        if (sy < y1) {
                            const gap = x0 + Math.floor(Math.random() * (x1 - x0));
                            for (let x = x0; x <= x1; x++) if (x !== gap) this.grid[x][sy].walls[0] = true;
                        }
                    }
                }
            }
        }

        const cx = Math.floor(W / 2);
        const cy = Math.floor(H / 2);
        this.startPos.set(cx * this.cellSize, 0, cy * this.cellSize);
        this.exitPos.set((W - 3) * this.cellSize, 0, (H - 3) * this.cellSize);
    }

    _genCorridors() {
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                this.grid[x][y].visited = true;
                if (x > 0) this.grid[x][y].walls[3] = Math.random() < 0.65;
                if (y > 0) this.grid[x][y].walls[0] = Math.random() < 0.65;
            }
        }
        this._ensureConnectivity();
        this.startPos.set(Math.floor(this.width / 2) * this.cellSize, 0, Math.floor(this.height / 2) * this.cellSize);
        this.exitPos.set((this.width - 2) * this.cellSize, 0, (this.height - 2) * this.cellSize);
    }

    _genCaves() {
        for (let x = 0; x < this.width; x++)
            for (let y = 0; y < this.height; y++)
                this.grid[x][y].isOpen = Math.random() < 0.55;

        for (let iter = 0; iter < 4; iter++) {
            const next = [];
            for (let x = 0; x < this.width; x++) {
                next[x] = [];
                for (let y = 0; y < this.height; y++) {
                    let count = 0;
                    for (let dx = -1; dx <= 1; dx++)
                        for (let dy = -1; dy <= 1; dy++) {
                            const nx = x + dx, ny = y + dy;
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.grid[nx][ny].isOpen)
                                count++;
                        }
                    next[x][y] = count >= 5;
                }
            }
            for (let x = 0; x < this.width; x++)
                for (let y = 0; y < this.height; y++)
                    this.grid[x][y].isOpen = next[x][y];
        }

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                const o = this.grid[x][y].isOpen;
                this.grid[x][y].walls = [
                    !o || (y > 0 && !this._isCaveOpen(x, y - 1)),
                    !o || (x < this.width - 1 && !this._isCaveOpen(x + 1, y)),
                    !o || (y < this.height - 1 && !this._isCaveOpen(x, y + 1)),
                    !o || (x > 0 && !this._isCaveOpen(x - 1, y)),
                ];
            }
        }
        this.startPos.set(Math.floor(this.width / 2) * this.cellSize, 0, Math.floor(this.height / 2) * this.cellSize);
        this.exitPos.set((this.width - 2) * this.cellSize, 0, (this.height - 2) * this.cellSize);
    }

    _isCaveOpen(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height && this.grid[x][y].isOpen;
    }

    _genOpen() {
        for (let x = 0; x < this.width; x++)
            for (let y = 0; y < this.height; y++)
                this.grid[x][y].walls = Math.random() < 0.12 ? [true, true, true, true] : [false, false, false, false];
        this.startPos.set(Math.floor(this.width / 2) * this.cellSize, 0, Math.floor(this.height / 2) * this.cellSize);
        this.exitPos.set((this.width - 2) * this.cellSize, 0, (this.height - 2) * this.cellSize);
    }

    _genUrban() {
        for (let x = 0; x < this.width; x++)
            for (let y = 0; y < this.height; y++)
                this.grid[x][y].walls = [false, false, false, false];

        for (let x = 1; x < this.width - 1; x += 3 + Math.floor(Math.random() * 3)) {
            for (let y = 1; y < this.height - 1; y += 3 + Math.floor(Math.random() * 3)) {
                const bw = 1 + Math.floor(Math.random() * 3);
                const bh = 1 + Math.floor(Math.random() * 3);
                this.buildings.push({
                    x: x * this.cellSize, z: y * this.cellSize,
                    width: bw * this.cellSize, depth: bh * this.cellSize,
                    height: 5 + Math.floor(Math.random() * 30)
                });
            }
        }
        this.startPos.set(Math.floor(this.width / 2) * this.cellSize, 0, Math.floor(this.height / 2) * this.cellSize);
        this.exitPos.set((this.width - 3) * this.cellSize, 0, (this.height - 3) * this.cellSize);
    }

    _genIndustrial() {
        this._genCorridors();
        for (let x = 2; x < this.width - 2; x += 5)
            for (let y = 2; y < this.height - 2; y += 5)
                this.decorations.push({ type: 'pillar', x: x * this.cellSize, z: y * this.cellSize });
    }

    _genForest() {
        this._genOpen();
        for (let x = 0; x < this.width; x++)
            for (let y = 0; y < this.height; y++)
                if (Math.random() < 0.45)
                    this.trees.push({
                        x: x * this.cellSize + (Math.random() - 0.5) * 3,
                        z: y * this.cellSize + (Math.random() - 0.5) * 3,
                        height: 3 + Math.random() * 10
                    });
    }

    _genVoid() {
        for (let x = 0; x < this.width; x++)
            for (let y = 0; y < this.height; y++)
                this.grid[x][y].walls = Math.random() < 0.1 ? [true, true, true, true] : [false, false, false, false];
        this.startPos.set(Math.floor(this.width / 2) * this.cellSize, 0, Math.floor(this.height / 2) * this.cellSize);
        this.exitPos.set((this.width - 2) * this.cellSize, 0, (this.height - 2) * this.cellSize);
    }

    _genLabyrinth() {
        for (let x = 0; x < this.width; x++)
            for (let y = 0; y < this.height; y++)
                this.grid[x][y].walls = Math.random() < 0.55 ? [true, true, true, true] : [false, false, false, false];
        this._ensureConnectivity();
        this.startPos.set(Math.floor(this.width / 2) * this.cellSize, 0, Math.floor(this.height / 2) * this.cellSize);
        this.exitPos.set((this.width - 2) * this.cellSize, 0, (this.height - 2) * this.cellSize);
    }

    _genTunnels() {
        this._genCorridors();
        this.wallHeight = 2.2;
    }

    _genWarehouse() {
        this._genOpen();
        for (let x = 2; x < this.width - 2; x += 4)
            for (let y = 1; y < this.height - 1; y += 3)
                this.decorations.push({ type: 'shelf', x: x * this.cellSize, z: y * this.cellSize });
    }

    _getUnvisitedNeighbors(x, y) {
        const neighbors = [];
        if (y > 0 && !this.grid[x][y - 1].visited) neighbors.push([x, y - 1, 0]);
        if (x < this.width - 1 && !this.grid[x + 1][y].visited) neighbors.push([x + 1, y, 1]);
        if (y < this.height - 1 && !this.grid[x][y + 1].visited) neighbors.push([x, y + 1, 2]);
        if (x > 0 && !this.grid[x - 1][y].visited) neighbors.push([x - 1, y, 3]);
        return neighbors;
    }

    _ensureConnectivity() {
        const visited = new Set();
        const queue = [[0, 0]];
        visited.add('0,0');
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            for (let d = 0; d < 4; d++) {
                if (!this.grid[x][y].walls[d]) {
                    const nx = x + dirs[d][0], ny = y + dirs[d][1];
                    const key = `${nx},${ny}`;
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && !visited.has(key)) {
                        visited.add(key);
                        queue.push([nx, ny]);
                    }
                }
            }
        }
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (!visited.has(`${x},${y}`)) {
                    for (let d = 0; d < 4; d++) {
                        const nx = x + dirs[d][0], ny = y + dirs[d][1];
                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && visited.has(`${nx},${ny}`)) {
                            this.grid[x][y].walls[d] = false;
                            visited.add(`${x},${y}`);
                            break;
                        }
                    }
                }
            }
        }
    }

    _applyRenderFlags() {
        const flags = this.config.renderFlags || [];
        this.hasCeiling = !flags.includes(MazeRenderFlags.NO_CEILING);
        this.openBorder = flags.includes(MazeRenderFlags.OPEN_BORDER);
        this.isDark = flags.includes(MazeRenderFlags.DARKNESS);
        this.isWireframe = flags.includes(MazeRenderFlags.WIREFRAME);
        this.flickering = flags.includes(MazeRenderFlags.FLICKERING_LIGHTS);
    }

    _placeEntities() {
        const entityIds = this.config.entities || [];
        if (entityIds.length === 0) return;
        const count = 3 + Math.floor(Math.random() * 5) + (this.config.survivalClass || 1);
        for (let i = 0; i < count; i++) {
            const ex = 2 + Math.floor(Math.random() * (this.width - 4));
            const ey = 2 + Math.floor(Math.random() * (this.height - 4));
            this.entitySpawns.push({
                type: entityIds[Math.floor(Math.random() * entityIds.length)],
                x: ex * this.cellSize,
                z: ey * this.cellSize,
                patrolRadius: 5 + Math.random() * 15
            });
        }
    }
}
