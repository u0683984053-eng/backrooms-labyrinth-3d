# 外部资产导入指南（提升建模与画面质量）

本游戏支持**外部 3D 模型与真实纹理**替换程序化生成的简陋模型。放入资产文件后**无需改代码**，自动加载；缺失时自动回退程序化模型。

## 一、实体模型（腾讯混元 3D 等工具生成）

### 操作步骤

1. 打开 [腾讯混元 3D](https://3d.tencent.com)（或 Tripo / Meshy / Rodin）
2. 输入提示词生成模型（见下表），选择 **GLB 格式**下载
3. 文件放到 `assets/models/` 目录，**文件名 = 实体 ID**（见下表）
4. 刷新游戏即生效（建议生成后用 gltf.report 在线检查）

### 提示词与文件名对照

| 实体 ID | 文件名 | 提示词建议（英文效果更佳） |
|---|---|---|
| smiler | `smiler.glb` | "horror entity, white pale floating head with black eyes and wide grin, backrooms style, no body" |
| hound | `hound.glb` | "four-legged black beast, horror creature, sharp teeth, lean body, dark fur" |
| duller | `duller.glb` | "gray humanoid figure, featureless face, horror, old clothes, standing" |
| clump | `clump.glb` | "tangled mass of human limbs, fleshy horror creature, writhing" |
| deathmoth | `deathmoth.glb` | "giant gray moth, horror, wings spread, flying" |
| skin_stealer | `skin_stealer.glb` | "pale humanoid wearing human skin as cloak, horror, unsettling" |
| scratcher | `scratcher.glb` | "emaciated horror creature with long claw fingers, hunched" |
| burster | `burster.glb` | "bulging red creature with glowing core, about to explode, horror" |
| partygoer | `partygoer.glb` | "cartoonish figure wearing yellow smile mask and colorful cone hat, creepy carnival" |

### 模型规格建议

- 格式：**GLB**（二进制，单文件）
- 面数：5k-50k 三角（越高越精细，注意性能）
- 纹理：1K-2K 即可
- 单位：任意（游戏自动缩放居中、底部对齐）
- 无动画也没关系（游戏自带呼吸浮动/倾斜/脉动效果）

## 二、真实纹理（CC0 免费资源）

### 操作步骤

1. 从 [ambientCG](https://ambientcg.com) / [Poly Haven](https://polyhaven.com) 下载 CC0 贴图（选 JPG，带 Color 通道即可；有 Normal/Roughness 更好）
2. 文件放到 `assets/textures/`，文件名固定：
   - `wallpaper.jpg` — 黄色墙纸（替换手绘墙纸）
   - `carpet.jpg` — 潮湿地毯
   - `ceiling.jpg` — 天花板
   - `crate.jpg` — 木箱
3. 刷新即生效（自动平铺，失败回退）

## 三、性能提示

- 模型总量建议 < 50MB；单个模型纹理 < 2K
- 需要压缩可用 [gltf-transform](https://gltf-transform.dev/)：`npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp`

## 四、文件结构

```
assets/
  models/   ← 实体 GLB 放这里（smiler.glb 等）
  textures/ ← 真实贴图放这里（wallpaper.jpg 等）
```
