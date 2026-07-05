# 开发日志 — 音域回响魔改版

> 记录从零仿制 Steam Workshop「音域回响 · Sonic Topography」过程中遇到的所有技术问题及修复方案

---

## 目录

1. [React 19 / R3F 8.x 不兼容](#1-react-19--r3f-8x-不兼容)
2. [柱子高度径向对称畸形凸起](#2-柱子高度径向对称畸形凸起)
3. [GLSL struct 数组不兼容 THREE.js WebGLProgram](#3-glsl-struct-数组不兼容-threejs-webglprogram)
4. [黑屏 — undefined uniforms 报错](#4-黑屏--undefined-uniforms-报错)
5. [Wallpaper Engine 导入失败 — project.json 格式](#5-wallpaper-engine-导入失败--projectjson-格式)
6. [音频完全无响应 — 数据链路断裂](#6-音频完全无响应--数据链路断裂)
7. [修改设置后壁纸卡死](#7-修改设置后壁纸卡死)
8. [谱通量节拍检测与频谱指标计算偏差](#8-谱通量节拍检测与频谱指标计算偏差)
9. [构建缓存与旧 bundle 残留](#9-构建缓存与旧-bundle-残留)
10. [非 WE 环境黑屏 — 缺少 Wallpaper Engine API Polyfill](#10-非-we-环境黑屏--缺少-wallpaper-engine-api-polyfill)

---

## 1. React 19 / R3F 8.x 不兼容

### 现象
项目启动即报错 `Cannot read properties of null`，Canvas 组件渲染失败。

### 根因
项目初始化时使用了 React 19，而 `@react-three/fiber` 8.x 对 React 19 的实验性支持不完整，内部 reconciler 使用了 React 18 的 API。

### 修复
```bash
npm install react@18 react-dom@18 @types/react@18 @types/react-dom@18
```

### 教训
R3F 生态对 React 大版本升级滞后，仿制项目前先检查依赖兼容性矩阵。

---

## 2. 柱子高度径向对称畸形凸起

### 现象
160×160 网格中心区域的柱子异常凸起，形成不自然的"锥形山"，与原始壁纸效果差异巨大。

### 根因
原始壁纸的高度计算完全在 **GPU 顶点着色器** 中完成，使用 Simplex 2D 噪声 + 5 个频率区域驱动的位移。而我最初在 CPU 端用 `instanceMatrix` 的缩放变换来模拟高度变化，由于 `Matrix4.scale` 会同时缩放 X、Y、Z 三个轴，导致柱子变胖且位置偏移。

### 修复
**对标原版写法**：InstanceMatrix 仅设置 `makeTranslation`，所有高度运算移入顶点着色器 `pillar.vert`：

```glsl
// 5 个频率区域独立位移
float subBassLift = easeLift(uSubBass, noise, position) * 6.0 * uResponseRange;
float bassLift = flowLift(uBass, chunkNoise, position) * 5.0 * uResponseRange;
float lowMidLift = waveLift(uLowMid, position) * 3.0 * uResponseRange;
float midLift = riverLift(uMid, position) * 4.0 * uResponseRange;
float highMidLift = spikeLift(uHighMid, position) * 3.0 * uResponseRange;
float totalLift = subBassLift + bassLift + lowMidLift + midLift + highMidLift;
```

---

## 3. GLSL struct 数组不兼容 THREE.js WebGLProgram

### 现象
加载页面报 WebGL 编译错误，shader 无法链接着色器程序。

### 根因
原始代码中顶点着色器使用了：
```glsl
struct Ripple { vec3 pos; float time; float strength; int isActive; int rippleType; };
uniform Ripple uRipples[10];
```

THREE.js 的 `WebGLProgram` 在解析 uniform 时 **不支持自定义 struct 数组**，只有基本类型数组（`float[]`、`vec3[]` 等）和 sampler 数组被认可。

### 修复
从着色器中**完全移除** Ripple struct 及循环逻辑，Ripple 效果待后续版本用其他方式实现。

### 教训
THREE.js ShaderMaterial 的 uniform 支持范围远小于原生 WebGL。遇到结构体数组应拆分为多个基本类型数组（如 `float uRippleTimes[10]`, `vec3 uRipplePositions[10]`），但更推荐直接用 CSS/Canvas overlay 实现波纹。

---

## 4. 黑屏 — undefined uniforms 报错

### 现象
构建后在 Wallpaper Engine 中黑屏，控制台报 `Cannot set properties of undefined (setting 'value')`。

### 根因
PillarGrid 组件的 `useFrame` 中写了：
```ts
// ❌ 错误：uSpectralCentroid 和 uTreble 在 JSX uniforms 中未声明
u.uSpectralCentroid.value = m.spectralCentroid;
u.uTreble.value = m.treble;
```

但在 `<shaderMaterial>` 的 `uniforms` 对象中没有对应的键，GLSL 中也未声明 `uniform float uSpectralCentroid`。

### 修复
```ts
// 从 source 中彻底删除这两行
// uniforms 对象中也不添加
// GLSL 中也不声明
```

### 教训
JS、JSX uniforms 声明、GLSL uniform 声明三处必须一一对应。增删 uniform 时务必三处同步。

---

## 5. Wallpaper Engine 导入失败 — project.json 格式

### 现象
将 `dist/` 文件夹导入 WE 时报 "模型文件不匹配" 或 "无法加载壁纸"。

### 根因
直接从原始壁纸复制 `project.json` 时，包含了 Steam Workshop 专属字段：
```json
"workshopid": "3747222633",
"workshopurl": "steam://url/CommunityFilePage/3747222633",
"visibility": "public",
"ratingsex": "none",
"ratingviolence": "none"
```
这些字段在本地导入时不合法。

### 修复
清理 `project.json`，仅保留必要字段：
```json
{
  "approved": true,
  "audio": { "enabled": true },
  "contentrating": "Everyone",
  "description": "...",
  "file": "index.html",
  "general": { "properties": {...}, "supportsaudioprocessing": true },
  "name": "Sonic Topography Clone",
  "preview": "preview.gif",
  "tags": ["Sci-Fi"],
  "title": "音域回响 · Clone",
  "type": "web",
  "version": 1
}
```

### 教训
Vite `build` 每次会清空 `dist/`，project.json 需要在构建后单独写入。

---

## 6. 音频完全无响应 — 数据链路断裂

### 现象
壁纸能运行但柱子完全不随音乐起伏，所有音频指标为 0。

### 根因分析
音频数据流有三段链路，中间断了：

```
✅ Wallpaper Engine → index.html (wallpaperRegisterAudioListener 注册成功)
   → window.__audioData (存储原始 128-bin FFT 数据)
❌ 【断裂】没有任何代码将 window.__audioData 传输给 AudioEngine
❌ AudioEngine.wallpaperAudioData 始终为零数组
❌ getAudioData() 返回全 0 → Shader 无数据 → 柱子无响应
```

### 修复
在 `PillarGrid` 中新增 rAF 轮询桥接：
```ts
useEffect(() => {
  const poll = () => {
    if ((window as any).__audioData) {
      Zr.setWallpaperAudioData((window as any).__audioData);
    }
    requestAnimationFrame(poll);
  };
  const raf = requestAnimationFrame(poll);
  return () => cancelAnimationFrame(raf);
}, []);
```

---

## 7. 修改设置后壁纸卡死

### 现象
在 Wallpaper Engine 中调整任意参数（颜色主题、渲染精度、音频响应强度等），壁纸画面冻结。

### 根因链路
```
用户修改 gridSize (160→320)
  ↓
Zustand store 更新 → PillarGrid 组件重渲染
  ↓
totalPillars 从 25600 变为 102400
  ↓
<instancedMesh args={[...totalPillars]}> prop 变化
  ↓
R3F reconciler 销毁旧 InstancedMesh + 重建新 InstancedMesh（25600→102400 实例）
  ↓
useFrame 在重建期间访问已销毁的 mesh.material.uniforms → 崩溃/GPU 挂死
```

### 修复 — 彻底重组架构

| 改动 | 效果 |
|------|------|
| 几何参数提升为**模块级常量** `GRID_WORLD=168, MAX_GRID=160` | InstancedMesh 永不重建 |
| `React.memo` 包裹 PillarGrid | 阻断父组件重渲染传播 |
| **零 Zustand 订阅** | 组件不因 store 变化而重渲染 |
| `useSettings.getState()` 在 useFrame 中实时读取 | 闭包永不过期 |
| **命令式** `new THREE.InstancedMesh()` + `scene.add()` | 绕开 R3F JSX reconciler |
| 组件 `return null` | R3F 无节点可协调 |

### 教训
R3F + Zustand 组合中，**设置类型的 store 绝不应被 render 路径订阅**。所有动态值通过 `getState()` 在 `useFrame` 中读取。

---

## 8. 谱通量节拍检测与频谱指标计算偏差

### 问题 1：谱通量计算错误
**旧版**：`getAudioData()` 主循环结束后，用 `prevData` 和 `data` 的差值近似计算频段谱通量。

**原版**：在主循环中直接累加 `diff > 0` 的频段正向差分，且 Pulse 和 Meteor 分别统计各自频段。

**修复**：将谱通量累加移入主循环：
```ts
for (let i = 0; i < len; i++) {
  const val = data[i];
  const diff = val - this.prevData[i];
  spectralFluxTotal += Math.abs(diff);
  if (i >= this.pulseTrigger.bandStart && i <= this.pulseTrigger.bandEnd && diff > 0) {
    pulseFlux += diff;
  }
  if (i >= this.meteorTrigger.bandStart && i <= this.meteorTrigger.bandEnd && diff > 0) {
    meteorFlux += diff;
  }
}
```

### 问题 2：复合指标公式错误
**旧版**：`(subBassAvg + bassAvg + lowMidAvg) / 3` — 先取各段平均再取平均

**原版**：`(subBass + bass + lowMid) / 27` — 原始值求和除以总 bin 数

### 问题 3：spectralCentroid 多除了 len
**旧版**：`weightedSum / total / len`
**原版**：`weightedSum / total`

### 问题 4：density 分母错误
**旧版**：`activeBands / 9`（含 air 段）
**原版**：`activeBands / 8`（不含 air）

---

## 9. 构建缓存与旧 bundle 残留

### 现象
源码已修改多次，但 `dist/` 中的 JS bundle 仍然是旧代码，或 TS 编译通过但实际行为不符预期。

### 根因
1. Vite 增量构建可能复用旧的 transform 缓存（`tsconfig.tsbuildinfo`）
2. 之前手动编辑 `dist/` 文件（如 `useSettings.ts` 修复）不会被下次 build 保留
3. 用 `replace_in_file` 修改有 cache 文件时可能失败

### 修复
```bash
# 每次出问题时，强制全新构建
rm -rf sonic-clone/dist
npm run build
```

### 教训
永远不在 `dist/` 里编辑文件。所有修改在 `src/` 完成后 `build`。出问题时 `rm -rf dist && rebuild` 是最可靠的诊断手段。

---

## 10. 非 WE 环境黑屏 — 缺少 Wallpaper Engine API Polyfill

### 现象
克隆仓库后在浏览器中本地预览或导入 Wallpaper Engine 后画面全黑，但控制台无 JavaScript 运行时错误。

### 根因
`index.html` 中所有 WE 专用 API（`wallpaperRegisterAudioListener`、`wallpaperRegisterMediaPropertiesListener` 等）的注册都是带条件判断的：

```js
if (window.wallpaperRegisterAudioListener) {
  window.wallpaperRegisterAudioListener(function(audioArray) { ... });
}
```

在非 Wallpaper Engine 环境（普通浏览器、本地测试）中，这些 API 均不存在，导致：
1. 所有条件分支静默跳过，没有任何回调被注册
2. `window.__audioData` 始终为 `null`
3. rAF 轮询桥接代码得不到有效音频数据
4. AudioEngine 的 512-bin 频谱全为 0 → Shader uniforms 全 0 → InstancedMesh 顶点位移全 0
5. 画面呈现为纯黑色背景（背景色 `#000`），实际**场景在渲染但柱子高度为零**

WebGL 诊断确认 shader 已正确编译链接，uniforms 完整，场景节点齐全——只是没有视觉变化。

### 修复
在 `dist/index.html` 中的 `if (window.wallpaperRegisterAudioListener)` 之前注入 polyfill：

```js
// ===== WE API Polyfill (for dev/testing outside Wallpaper Engine) =====
if (!window.wallpaperRegisterAudioListener) {
  window.wallpaperRegisterAudioListener = function(cb) {
    window.__we_audioCb = cb;
  };
  window.wallpaperRegisterMediaPropertiesListener = function(){};
  window.wallpaperRegisterMediaThumbnailListener = function(){};
  window.wallpaperRegisterMediaPlaybackListener = function(){};
  window.wallpaperRegisterMediaTimelineListener = function(){};
  window.wallpaperPropertyListener = {
    applyUserProperties: function(){},
    applyGeneralProperties: function(){}
  };
  window.wallpaperRequestMediaIntegration = function(){};
  window.wallpaperReady = function(){};

  // Start simulated audio (128-bin FFT)
  var _simAudio = new Float32Array(128);
  for (var i = 0; i < 128; i++) _simAudio[i] = Math.random() * 0.5 * (1 - i / 128);
  window.__audioData = _simAudio;

  setInterval(function() {
    var arr = new Float32Array(128);
    for (var i = 0; i < 128; i++) arr[i] = Math.random() * 0.5 * (1 - i / 128);
    window.__audioData = arr;
    if (window.__we_audioCb) window.__we_audioCb(arr);
  }, 50);
}
```

### 教训
1. Wallpaper Engine 网页壁纸的 **全部数据源依赖 WE 宿主注入 API**，本地开发测试必须提供完整的 polyfill
2. 框架级 `.gitignore` 排除 `src/` 后，问题诊断只能通过 **反编译 bundle.js + 浏览器控制台** 进行，效率极低——应保留源码纳入版本控制
3. 黑屏不一定是报错导致的，**"场景正常渲染但不产生视觉变化"** 是隐式 bug 的典型特征（全零数据驱动），需要通过 WebGL readPixels 等底层诊断手段才能确认

---

## 总结

| 类别 | 数量 |
|------|------|
| React/框架兼容性 | 1 |
| 图形学/GPU | 3 |
| 音视频处理 | 2 |
| 状态管理/架构 | 1 |
| 构建/部署 | 3 |

核心经验：
1. **仿制项目优先反编译原版代码**，公式、参数、架构全部对标
2. **R3F 性能敏感场景避免 JSX reconciler**，命令式 Three.js 更可控
3. **Zustand 和 R3F 的组合中，设置值永远不要触发组件重渲染**
4. **GLSL 跨平台差异远比 JS 大**，THREE.js 对高级特性的支持是 WebGL 的子集
