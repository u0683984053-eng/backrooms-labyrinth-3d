// 后室层级配置 - 基于 wikidot Backrooms 文档
// TerrainType 决定迷宫生成机制

export const TerrainType = {
    CORRIDORS: 'corridors',
    ROOMS: 'rooms',
    CAVES: 'caves',
    OPEN: 'open',
    URBAN: 'urban',
    INDUSTRIAL: 'industrial',
    AQUATIC: 'aquatic',
    FOREST: 'forest',
    VOID: 'void',
    LABYRINTH: 'labyrinth',
    TUNNELS: 'tunnels',
    COMPLEX: 'complex',
    PIPES: 'pipes',
    HALLS: 'halls',
    MAZE: 'maze',
    WAREHOUSE: 'warehouse',
    HOTEL: 'hotel',
    HOSPITAL: 'hospital',
    OFFICE: 'office',
    UNDERGROUND: 'underground',
    INFINITE: 'infinite',
    DREAM: 'dream',
    SNOW: 'snow',
    DESERT: 'desert',
    JUNGLE: 'jungle',
    OCEAN: 'ocean',
    SKY: 'sky'
};

export const SurvivalClass = {
    ZERO: 0, ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
    UNKNOWN: -1, UNDETERMINED: -2, PENDING: -3, VARIABLE: -4, DEADZONE: 6
};

export const Environment = {
    INDOOR_ARTIFICIAL: 'indoor',
    INDOOR_NATURAL: 'indoor_natural',
    OUTDOOR_TERRESTRIAL: 'outdoor',
    OUTDOOR_AQUATIC: 'aquatic',
    OUTDOOR_AERIAL: 'aerial',
    EXTRADIMENSIONAL_CAVE: 'cave',
    EXTRADIMENSIONAL_VOID: 'void',
    HYBRID: 'hybrid'
};

export const MazeRenderFlags = {
    DOUBLE_SIDED: 'doubleSided',
    OPEN_BORDER: 'openBorder',
    NO_CEILING: 'noCeiling',
    TRANSPARENT_WALLS: 'transparentWalls',
    FOG_HEAVY: 'fogHeavy',
    NO_FOG: 'noFog',
    WIREFRAME: 'wireframe',
    LOW_GRAVITY: 'lowGravity',
    DARKNESS: 'darkness',
    FLICKERING_LIGHTS: 'flickeringLights',
    BIOHAZARD: 'biohazard',
    NO_CLIP: 'noClip'
};

function def(id, name, desc, terrain, survClass, env, flags = [], entities = []) {
    return { id, name, description: desc, terrainType: terrain, survivalClass: survClass,
        environment: env, renderFlags: flags, entities };
}

export const LEVEL_CONFIGS = {
    0: def(0, '大厅', '大多数人首次进入的层级。无尽单调的黄色房间，荧光灯嗡嗡作响，空气中弥漫着潮湿地毯的气味。',
        TerrainType.ROOMS, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS, MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'duller', 'deathmoth']),

    1: def(1, '宜居区', '一个巨大的仓库式空间，堆满板条箱和物资，灯光闪烁。比 Level 0 更适合居住。',
        TerrainType.WAREHOUSE, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'hound', 'duller', 'clump', 'deathmoth', 'scratcher']),

    2: def(2, '管道之梦', '无尽管道和机械组成的走廊。极其炎热，温度可达43°C以上。',
        TerrainType.PIPES, SurvivalClass.TWO, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'clump', 'skin_stealer', 'burster']),

    3: def(3, '电气站', '狭窄走廊和电气室的复杂结构，裸露的电线极其危险。',
        TerrainType.CORRIDORS, SurvivalClass.THREE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'hound', 'clump', 'skin_stealer', 'burster']),

    4: def(4, '废弃办公室', '一座无限的办公楼，空荡的隔间、饮水机和远处电脑的嗡嗡声。',
        TerrainType.OFFICE, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'hound', 'deathmoth']),

    5: def(5, '恐怖酒店', '一座腐朽的1930年代华丽酒店，充满扭曲走廊和攻击性实体。',
        TerrainType.HOTEL, SurvivalClass.TWO, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'deathmoth', 'skin_stealer', 'clump', 'partygoer']),

    6: def(6, '熄灭', '完全的、彻底的黑暗。任何光源在这里都无法正常工作。最危险的早期层级。',
        TerrainType.CORRIDORS, SurvivalClass.FIVE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.DARKNESS, MazeRenderFlags.NO_FOG],
        ['smiler', 'hound', 'skin_stealer', 'clump']),

    7: def(7, '深海恐惧', '无尽海洋中只有一座孤立的房子。水中栖息着"Level 7之物"。',
        TerrainType.AQUATIC, SurvivalClass.FOUR, Environment.OUTDOOR_AQUATIC,
        [MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.FOG_HEAVY],
        ['thing_on_level_7']),

    8: def(8, '洞穴系统', '巨大的洞穴网络，地下河流、钟乳石和危险实体遍布其中。',
        TerrainType.CAVES, SurvivalClass.THREE, Environment.EXTRADIMENSIONAL_CAVE,
        [MazeRenderFlags.NO_CEILING, MazeRenderFlags.DOUBLE_SIDED],
        ['smiler', 'hound', 'deathmoth', 'skin_stealer']),

    9: def(9, '黯夜郊区', '午夜天空下无尽的郊区社区。房屋是陷阱。',
        TerrainType.URBAN, SurvivalClass.TWO, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.DARKNESS],
        ['smiler', 'hound', 'skin_stealer', 'deathmoth']),

    10: def(10, '丰收', '无尽的麦田，有一间农舍、谷仓和攻击性稻草人实体。',
        TerrainType.OPEN, SurvivalClass.ONE, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED],
        ['smiler', 'hound']),

    11: def(11, '无尽城市', '一座看似无限的现代城市，摩天大楼、街道和基础设施一应俱全。白天看不到实体。',
        TerrainType.URBAN, SurvivalClass.ONE, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING],
        ['smiler', 'hound', 'skin_stealer', 'clump', 'burster']),

    12: def(12, '矩阵', '纯白色的空间，只有一个明亮的光源。令人迷失方向，导致理智快速下降。',
        TerrainType.VOID, SurvivalClass.UNKNOWN, Environment.EXTRADIMENSIONAL_VOID,
        [MazeRenderFlags.NO_CEILING, MazeRenderFlags.WIREFRAME],
        []),

    13: def(13, '建筑', '文艺复兴风格的无限公寓大楼。美丽却致命。',
        TerrainType.COMPLEX, SurvivalClass.TWO, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'clump']),

    27: def(27, '木屋', '无限相连的木制房间，让人想起桑拿房。高温和迷失感。',
        TerrainType.ROOMS, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.NO_CEILING],
        ['smiler', 'hound']),

    33: def(33, '电梯', '无尽狭窄的电梯井，金属门通往任意楼层。有些楼层最好别按。',
        TerrainType.CORRIDORS, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'duller', 'clump']),

    28: def(28, '风暴石堡', '悬浮空岛上的一座中世纪城堡，永远笼罩在雷暴之中。',
        TerrainType.OPEN, SurvivalClass.TWO, Environment.OUTDOOR_AERIAL,
        [MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.NO_CEILING],
        ['smiler', 'hound', 'skin_stealer']),

    37: def(37, '泳池房', '无尽的瓷砖泳池房间，水声舒缓。看似平和实则致命。',
        TerrainType.COMPLEX, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.TRANSPARENT_WALLS],
        ['smiler', 'hound', 'deathmoth']),

    48: def(48, '猩红森林', '无尽的血红色森林，高耸的深红巨树和掠食性植物。',
        TerrainType.FOREST, SurvivalClass.THREE, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING],
        ['smiler', 'hound', 'deathmoth', 'clump']),

    52: def(52, '学校', '废弃的小学，有教室、走廊和"校长"实体。',
        TerrainType.HALLS, SurvivalClass.TWO, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'hound', 'skin_stealer', 'partygoer']),

    94: def(94, '金斯威尔小镇', '一个被困于永恒暮色中的1950年代小镇。平静却极度诡异。',
        TerrainType.URBAN, SurvivalClass.TWO, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.DARKNESS],
        ['smiler', 'hound', 'skin_stealer']),

    100: def(100, '工厂', '废弃的工业建筑群，锈蚀机器和有毒烟雾弥漫。',
        TerrainType.INDUSTRIAL, SurvivalClass.THREE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FOG_HEAVY, MazeRenderFlags.BIOHAZARD],
        ['smiler', 'hound', 'clump', 'skin_stealer']),

    188: def(188, '窗户', '无尽的走廊，两侧是展示不可能景观的窗户。',
        TerrainType.HALLS, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.TRANSPARENT_WALLS, MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'deathmoth', 'partygoer']),

    189: def(189, '康养中心', '废弃的水疗中心，游泳池、蒸汽房和诡异的宁静。',
        TerrainType.COMPLEX, SurvivalClass.TWO, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'clump']),

    210: def(210, '雪球', '无尽冰封的景观，持续降雪和冰结构。',
        TerrainType.SNOW, SurvivalClass.TWO, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING],
        ['smiler', 'hound']),

    290: def(290, '购物中心', '废弃的1990年代购物中心。美食广场仍有电力。',
        TerrainType.COMPLEX, SurvivalClass.ONE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.FLICKERING_LIGHTS],
        ['smiler', 'hound', 'skin_stealer', 'clump', 'partygoer']),

    399: def(399, '霓虹深渊', '赛博朋克风格的空间，霓虹灯、湿漉漉的街道和无尽的雨。',
        TerrainType.URBAN, SurvivalClass.TWO, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'skin_stealer', 'clump']),

    404: def(404, '层级未找到', '一个被故障和损坏的现实版本。物理定律不可靠。',
        TerrainType.VOID, SurvivalClass.UNKNOWN, Environment.EXTRADIMENSIONAL_VOID,
        [MazeRenderFlags.WIREFRAME, MazeRenderFlags.NO_CLIP],
        []),

    480: def(480, '海滩', '无尽的沙滩和平静的海洋。有昼夜循环，平静但与世隔绝。',
        TerrainType.OPEN, SurvivalClass.ZERO, Environment.OUTDOOR_TERRESTRIAL,
        [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING],
        []),

    599: def(599, '红色房间', 'Level 0 的血腥版本。红色墙壁、地板、天花板。实体群聚之地。',
        TerrainType.ROOMS, SurvivalClass.FIVE, Environment.INDOOR_ARTIFICIAL,
        [MazeRenderFlags.DARKNESS, MazeRenderFlags.FOG_HEAVY],
        ['smiler', 'hound', 'duller', 'clump', 'skin_stealer', 'scratcher', 'burster']),

    666: def(666, '地狱之门', '烈火、硫磺和恶魔实体的地狱景象。',
        TerrainType.CAVES, SurvivalClass.FIVE, Environment.EXTRADIMENSIONAL_CAVE,
        [MazeRenderFlags.NO_CEILING, MazeRenderFlags.FOG_HEAVY, MazeRenderFlags.DOUBLE_SIDED],
        ['smiler', 'hound', 'skin_stealer', 'clump', 'burster', 'scratcher']),

    998: def(998, '天顶', '后室巅峰附近的超现实空间。现实崩塌。',
        TerrainType.VOID, SurvivalClass.UNKNOWN, Environment.EXTRADIMENSIONAL_VOID,
        [MazeRenderFlags.WIREFRAME, MazeRenderFlags.NO_CLIP, MazeRenderFlags.NO_CEILING],
        []),

    999: def(999, '最后的延伸', '悬浮于虚空中的巨大石质大教堂。终结前的最后一站。',
        TerrainType.COMPLEX, SurvivalClass.THREE, Environment.EXTRADIMENSIONAL_VOID,
        [MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING, MazeRenderFlags.NO_FOG],
        ['smiler', 'hound', 'skin_stealer', 'clump', 'scratcher']),

    1000: def(1000, '终点', '最终层级。不可能几何和宇宙恐怖之地。',
        TerrainType.VOID, SurvivalClass.FIVE, Environment.EXTRADIMENSIONAL_VOID,
        [MazeRenderFlags.WIREFRAME, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING, MazeRenderFlags.NO_CLIP],
        ['smiler', 'hound', 'skin_stealer', 'clump', 'burster', 'scratcher', 'thing_on_level_7']),
};

function getDefaultConfig(id) {
    let terrain, survClass, env, flags = [], entities = ['smiler', 'hound'];

    if (id <= 5) {
        terrain = TerrainType.ROOMS;
        survClass = SurvivalClass.ONE;
        env = Environment.INDOOR_ARTIFICIAL;
        flags = [MazeRenderFlags.FLICKERING_LIGHTS];
    } else if (id <= 20) {
        terrain = TerrainType.CORRIDORS;
        survClass = id <= 10 ? SurvivalClass.TWO : SurvivalClass.THREE;
        env = Environment.INDOOR_ARTIFICIAL;
        flags = [MazeRenderFlags.FOG_HEAVY];
    } else if (id <= 100) {
        const r = Math.random();
        terrain = (r < 0.25) ? TerrainType.CORRIDORS : (r < 0.5) ? TerrainType.ROOMS : (r < 0.75) ? TerrainType.CAVES : TerrainType.COMPLEX;
        survClass = id <= 50 ? SurvivalClass.TWO : SurvivalClass.THREE;
        env = Environment.INDOOR_ARTIFICIAL;
        flags = [MazeRenderFlags.FLICKERING_LIGHTS];
    } else if (id <= 300) {
        const r = Math.random();
        terrain = (r < 0.2) ? TerrainType.OFFICE : (r < 0.4) ? TerrainType.HOTEL : (r < 0.6) ? TerrainType.INDUSTRIAL : (r < 0.8) ? TerrainType.PIPES : TerrainType.HALLS;
        survClass = id <= 200 ? SurvivalClass.THREE : SurvivalClass.FOUR;
        env = Environment.INDOOR_ARTIFICIAL;
        flags = [MazeRenderFlags.FOG_HEAVY, MazeRenderFlags.FLICKERING_LIGHTS];
    } else if (id <= 600) {
        const r = Math.random();
        terrain = (r < 0.3) ? TerrainType.URBAN : (r < 0.6) ? TerrainType.FOREST : TerrainType.SNOW;
        survClass = id <= 500 ? SurvivalClass.FOUR : SurvivalClass.FIVE;
        env = Environment.OUTDOOR_TERRESTRIAL;
        flags = [MazeRenderFlags.OPEN_BORDER, MazeRenderFlags.DOUBLE_SIDED];
    } else if (id <= 997) {
        terrain = TerrainType.VOID;
        survClass = SurvivalClass.UNKNOWN;
        env = Environment.EXTRADIMENSIONAL_VOID;
        flags = [MazeRenderFlags.WIREFRAME, MazeRenderFlags.NO_CEILING];
        entities = [];
    } else {
        terrain = TerrainType.VOID;
        survClass = SurvivalClass.FIVE;
        env = Environment.EXTRADIMENSIONAL_VOID;
        flags = [MazeRenderFlags.WIREFRAME, MazeRenderFlags.DOUBLE_SIDED, MazeRenderFlags.NO_CEILING];
        entities = [];
    }

    return def(id, `Level ${id}`, '后室中一个未被探索的层级。', terrain, survClass, env, flags, entities);
}

export function getLevelConfig(levelId) {
    const id = Math.max(0, Math.min(1000, Math.floor(levelId)));
    return LEVEL_CONFIGS[id] || getDefaultConfig(id);
}

export function getDetailedLevels() {
    return Object.keys(LEVEL_CONFIGS).map(Number);
}

export const ENTITY_DEFS = {
    smiler: { name: '微笑者', danger: 3, speed: 4, detectionRadius: 20, chaseDuration: 15, health: 80, damage: 15, type: 'aggressive', desc: '黑暗中咧嘴而笑的面孔。' },
    hound: { name: '猎犬', danger: 4, speed: 8, detectionRadius: 30, chaseDuration: 20, health: 60, damage: 20, type: 'aggressive', desc: '四足尖牙利爪的野兽。' },
    duller: { name: '迟钝者', danger: 2, speed: 2, detectionRadius: 15, chaseDuration: 10, health: 100, damage: 8, type: 'ambient', desc: '一种让你感官迟钝的人形实体。' },
    clump: { name: '团块', danger: 3, speed: 3, detectionRadius: 12, chaseDuration: 12, health: 120, damage: 12, type: 'ambient', desc: '一团缠绕的肢体。' },
    deathmoth: { name: '死蛾', danger: 2, speed: 6, detectionRadius: 25, chaseDuration: 8, health: 40, damage: 10, type: 'flying', desc: '以恐惧为食的巨大飞蛾。' },
    skin_stealer: { name: '剥皮者', danger: 5, speed: 6, detectionRadius: 35, chaseDuration: 30, health: 150, damage: 25, type: 'aggressive', desc: '披着受害者皮肤行走的怪物。' },
    scratcher: { name: '抓挠者', danger: 3, speed: 5, detectionRadius: 20, chaseDuration: 15, health: 70, damage: 18, type: 'aggressive', desc: '长爪手指刮擦墙壁。' },
    burster: { name: '自爆者', danger: 4, speed: 7, detectionRadius: 20, chaseDuration: 10, health: 50, damage: 30, type: 'burst', desc: '靠近目标时自爆。' },
    partygoer: { name: '派对客', danger: 4, speed: 5.5, detectionRadius: 26, chaseDuration: 25, health: 90, damage: 18, type: 'aggressive', desc: '戴着微笑面具的狂欢者，会诱骗你参加"派对"。' },
    thing_on_level_7: { name: 'Level 7之物', danger: 5, speed: 3, detectionRadius: 50, chaseDuration: 60, health: 300, damage: 40, type: 'boss', desc: '水下某种巨大的存在。' },
};

export function getEntityDef(entityId) {
    return ENTITY_DEFS[entityId] || null;
}

// f 版生存难度评级（M.E.G. 档案格式）
export function getSurvivalClassInfo(survClass) {
    switch (survClass) {
        case SurvivalClass.ZERO: return { label: 'Class 0', safe: '安全', stable: '稳定', entity: '实体绝迹' };
        case SurvivalClass.ONE: return { label: 'Class 1', safe: '安全', stable: '稳定', entity: '实体极少' };
        case SurvivalClass.TWO: return { label: 'Class 2', safe: '不安全', stable: '稳定', entity: '实体稀少' };
        case SurvivalClass.THREE: return { label: 'Class 3', safe: '不安全', stable: '不稳定', entity: '实体数量中等' };
        case SurvivalClass.FOUR: return { label: 'Class 4', safe: '不安全', stable: '极不稳定', entity: '大量实体' };
        case SurvivalClass.FIVE: return { label: 'Class 5', safe: '不安全', stable: '极不稳定', entity: '实体侵染' };
        case SurvivalClass.DEADZONE: return { label: 'Class 死区', safe: '不安全', stable: '极不稳定', entity: '实体横行' };
        case SurvivalClass.UNKNOWN: return { label: 'Class 未知', safe: '未知', stable: '未知', entity: '未知' };
        case SurvivalClass.UNDETERMINED: return { label: 'Class 未定', safe: '未定', stable: '未定', entity: '未定' };
        case SurvivalClass.PENDING: return { label: 'Class 待定', safe: '待定', stable: '待定', entity: '待定' };
        case SurvivalClass.VARIABLE: return { label: 'Class 变量', safe: '随层级变化', stable: '随层级变化', entity: '随层级变化' };
        default: return { label: 'Class ?', safe: '未知', stable: '未知', entity: '未知' };
    }
}
