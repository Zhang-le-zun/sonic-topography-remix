# Wallpaper Engine 网页壁纸开发指南

> 基于「音域回响魔改版」的实战经验，涵盖从零搭建到发布的全流程

---

## 目录

1. [项目初始化](#1-项目初始化)
2. [project.json — Wallpaper Engine 配置规范](#2-projectjson--wallpaper-engine-配置规范)
3. [音频系统](#3-音频系统)
4. [媒体集成 (Media Integration)](#4-媒体集成-media-integration)
5. [用户可调参数系统](#5-用户可调参数系统)
6. [Three.js 性能架构](#6-threejs-性能架构)
7. [GLSL 着色器注意事项](#7-glsl-着色器注意事项)
8. [构建与部署](#8-构建与部署)
9. [调试方法](#9-调试方法)
10. [常见陷阱清单](#10-常见陷阱清单)

---

## 1. 项目初始化

### 推荐技术栈

```
Vite + TypeScript + React 18 + @react-three/fiber + zustand + Three.js
```

⚠️ **不要用 React 19**（至今与 R3F 8.x 存在兼容性问题）

```bash
npm create vite@latest my-wallpaper -- --template react-ts
cd my-wallpaper
npm install react@18 react-dom@18 @types/react@18 @types/react-dom@18
npm install three @react-three/fiber @react-three/drei zustand
```

### 入口文件

`index.html` 必须在 `<head>` 的 `<script>` 中**立即注册**（不能延迟到 React mount 后）Wallpaper Engine 回调：

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
  </style>

  <!-- ⚠️ 这个 script 必须在 <script type="module" src="/src/main.tsx"> 之前 -->
  <script>
    // 音频数据存储
    window.__audioData = null;
    if (window.wallpaperRegisterAudioListener) {
      window.wallpaperRegisterAudioListener(function(audioArray) {
        window.__audioData = audioArray;
      });
    }

    // 媒体属性
    window.__mediaState = {
      title: '', artist: '', thumbnail: '',
      primaryColor: '', textColor: '',
      isPlaying: false, position: 0, duration: 0,
      _callbacks: []
    };
    window.__notifyMediaChange = function() {
      window.__mediaState._callbacks.forEach(function(cb) {
        cb({ ...window.__mediaState });
      });
    };

    if (window.wallpaperRegisterMediaPropertiesListener) {
      window.wallpaperRegisterMediaPropertiesListener(function(props) {
        window.__mediaState.title = props.title || '';
        window.__mediaState.artist = props.artist || '';
        window.__notifyMediaChange();
      });
    }

    if (window.wallpaperRegisterMediaThumbnailListener) {
      window.wallpaperRegisterMediaThumbnailListener(function(thumb) {
        window.__mediaState.thumbnail = thumb.thumbnail || '';
        window.__mediaState.primaryColor = thumb.primaryColor || '';
        window.__mediaState.textColor = thumb.textColor || '';
        window.__notifyMediaChange();
      });
    }

    if (window.wallpaperRegisterMediaPlaybackListener) {
      window.wallpaperRegisterMediaPlaybackListener(function(pb) {
        var PLAYING = (window.wallpaperMediaIntegration && window.wallpaperMediaIntegration.PLAYBACK_PLAYING) || 0;
        window.__mediaState.isPlaying = pb.state === PLAYING;
        window.__notifyMediaChange();
      });
    }

    if (window.wallpaperRegisterMediaTimelineListener) {
      window.wallpaperRegisterMediaTimelineListener(function(tl) {
        window.__mediaState.position = tl.position || 0;
        window.__mediaState.duration = tl.duration || 0;
        window.__notifyMediaChange();
      });
    }
  </script>

  <script type="module" crossorigin src="/src/main.tsx"></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

---

## 2. project.json — Wallpaper Engine 配置规范

### 最小可用结构

```json
{
  "approved": true,
  "audio": { "enabled": true },
  "contentrating": "Everyone",
  "description": "壁纸简介",
  "file": "index.html",
  "general": {
    "properties": {
      "schemecolor": {
        "order": 0,
        "text": "ui_browse_properties_scheme_color",
        "type": "color",
        "value": "0.3333333333333333 0.0196078431372549 0.3333333333333333"
      }
    },
    "supportsaudioprocessing": true
  },
  "name": "My Wallpaper",
  "preview": "preview.gif",
  "tags": ["Sci-Fi"],
  "title": "我的壁纸",
  "type": "web",
  "version": 1
}
```

### 关键字段说明

| 字段 | 说明 | 必须 |
|------|------|:---:|
| `type: "web"` | 必须为 `"web"` | ✅ |
| `file: "index.html"` | 入口 HTML 文件名 | ✅ |
| `audio.enabled: true` | 启用音频处理 | ✅ |
| `general.supportsaudioprocessing: true` | 同上（旧版兼容） | ✅ |
| `general.properties` | 用户可调参数定义 | 可选 |
| `preview` | 预览图 GIF/PNG，放在 dist/ 根目录 | 推荐 |

### 参数类型

```json
{
  "mySlider": {
    "type": "slider",
    "text": "参数名称",
    "value": 1.0,
    "min": 0.0,
    "max": 2.0,
    "step": 0.1,
    "order": 100
  },
  "myBool": {
    "type": "bool",
    "text": "开关名称",
    "value": true,
    "order": 101
  },
  "myCombo": {
    "type": "combo",
    "text": "下拉选项",
    "value": "option1",
    "options": [
      { "label": "选项1", "value": "option1" },
      { "label": "选项2", "value": "option2" }
    ],
    "order": 102
  }
}
```

- `order` 决定 UI 中排列顺序，建议从 100 开始
- `schemecolor` 的 `order: 0` 是保留值
- 数值参数的 `value` 必须带小数（如 `1.0` 而非 `1`）

### ⚠️ 不要包含的字段

以下字段仅用于 Steam Workshop，**本地导入必须删除**：

```json
"workshopid": "...",       // ❌ 删除
"workshopurl": "...",      // ❌ 删除
"visibility": "public",    // ❌ 删除
"ratingsex": "none",       // ❌ 删除
"ratingviolence": "none"   // ❌ 删除
```

---

## 3. 音频系统

### 数据流架构

```
Wallpaper Engine (系统音频)
  ↓ wallpaperRegisterAudioListener (128-bin Float32Array)
  ↓ 存储在 window.__audioData
  ↓ rAF 轮询桥接 (在 React 组件中)
  ↓ AudioEngine.setWallpaperAudioData()
  ↓ 升采样到 512-bin FFT
  ↓ getAudioData() 频段分析 + 谱通量节拍检测
  ↓ useFrame 每帧写入 ShaderMaterial uniforms
  ↓ GLSL 顶点着色器驱动顶点位移
```

### 桥接代码（关键！）

`index.html` 注册回调只负责**存储原始数据**到 `window.__audioData`，**不负责传输给引擎**。
传输桥接必须在 React 组件中通过 rAF 轮询完成：

```ts
// PillarGrid.tsx 或相应的 3D 组件
useEffect(() => {
  let active = true;
  const poll = () => {
    if (!active) return;
    if ((window as any).__audioData) {
      audioEngine.setWallpaperAudioData((window as any).__audioData);
    }
    requestAnimationFrame(poll);
  };
  const raf = requestAnimationFrame(poll);
  return () => { active = false; cancelAnimationFrame(raf); };
}, []);
```

### 频段定义（512-bin FFT）

| 频段 | Bin 范围 | Bin 数量 | 用于 |
|------|---------|---------|------|
| Sub Bass | 0–4 | 5 | 中心大面积位移 |
| Bass | 5–12 | 9 | 分块位移 |
| Low Mid | 13–24 | 13 | 流动波浪 |
| Mid | 25–45 | 21 | 斜向河流 |
| High Mid | 46–81 | 37 | 散点尖峰 |
| Presence | 82–120 | 39 | 色彩闪烁 |
| Treble | 121–180 | 60 | 边缘发光 |
| Brilliance | 181–255 | 75 | 微光 |

### 节拍检测：谱通量法 (Spectral Flux)

原理：计算相邻帧的频段能量差，通过历史均值和标准差动态计算阈值：

```ts
const mean = sum(fluxHistory) / fluxHistory.length;
const stdDev = Math.sqrt(variance(fluxHistory, mean));
const threshold = Math.max(0.05, mean + stdDev * sensitivity);
const isPeak = prevSmoothedFlux > threshold && prevSmoothedFlux >= smoothedFlux;
```

Pulse 触发器（低频 0-12 bin）：cooldown 45 帧，sensitivity 0.22
Meteor 触发器（高频 92-340 bin）：cooldown 180 帧，sensitivity 0.4

---

## 4. 媒体集成 (Media Integration)

### 五个回调

| 回调 | 触发时机 | 提供数据 |
|------|---------|---------|
| `wallpaperRegisterMediaPropertiesListener` | 歌曲切换 | title, artist |
| `wallpaperRegisterMediaThumbnailListener` | 封面变化 | thumbnail (base64), primaryColor, textColor |
| `wallpaperRegisterMediaPlaybackListener` | 播放/暂停 | state (PLAYING/PAUSED/STOPPED) |
| `wallpaperRegisterMediaTimelineListener` | 进度更新 | position, duration |

### React 组件获取方式

```ts
// 在 useEffect 中订阅 __mediaState
useEffect(() => {
  if (!window.__mediaState) return;
  const handler = (state: MediaState) => {
    setTitle(state.title);
    setArtist(state.artist);
    setThumbnail(state.thumbnail);
    // ...
  };
  window.__mediaState._callbacks.push(handler);
  return () => {
    const idx = window.__mediaState._callbacks.indexOf(handler);
    if (idx > -1) window.__mediaState._callbacks.splice(idx, 1);
  };
}, []);
```

---

## 5. 用户可调参数系统

### Wallpaper Engine → React 通信

WE 通过 `window.wallpaperPropertyListener` 传递用户设置：

```ts
useEffect(() => {
  window.wallpaperPropertyListener = {
    applyUserProperties: (properties) => {
      for (const key of Object.keys(properties)) {
        const prop = properties[key];
        if (!prop) continue;
        // 传递给 Zustand store
        if (key === 'theme') {
          store.setTheme(prop.value);
        } else if (prop.value !== undefined) {
          store.updateSetting(key, prop.value);
        }
      }
    },
    applyGeneralProperties: (properties) => {
      if (properties.fps) store.updateSetting('fps', properties.fps);
    },
  };

  // 通知 WE 壁纸已就绪
  if (window.wallpaperReady) window.wallpaperReady();
}, []);
```

### 性能关键原则

**绝不在 React render 路径中订阅 Zustand 设置值！** 任何参数变更都会 → 组件重渲染 → R3F 重建 3D 对象 → 卡死。

```ts
// ❌ 错误写法
const audioIntensity = useSettings(s => s.audioIntensity);

// ✅ 正确写法 — useFrame 中实时读取
useFrame(() => {
  const { audioIntensity } = useSettings.getState();
  shaderUniforms.uAudioIntensity.value = audioIntensity;
});
```

所有 3D 对象用 `useLayoutEffect([], ...)` 一次性创建，命令式添加到 scene，组件 `return null`：

```ts
useLayoutEffect(() => {
  if (initDone) return;
  initDone = true;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  scene.add(mesh);
  return () => scene.remove(mesh);
}, []);
```

---

## 6. Three.js 性能架构

### InstancedMesh 是必须的

160×160 = 25600 个独立 mesh 会直接让 GPU 崩溃。必须使用 `InstancedMesh`：

```ts
// 1 次 draw call 绘制所有柱子
const mesh = new THREE.InstancedMesh(geometry, material, 160 * 160);
```

### InstanceMatrix 策略

- **平移**：在 `useLayoutEffect` 中一次性设置 `makeTranslation`，永不更新
- **缩放**：绝不用 `instanceMatrix` 做缩放！会导致柱子变胖
- **高度**：在顶点着色器中通过 `modelPosition.y += lift` 实现

### 避免 JSX reconciler 开销

对于性能敏感的 InstancedMesh，直接用命令式 API：

```ts
// ❌ R3F JSX 方式 — 每次 prop 变化都触发 reconciler
<instancedMesh ref={ref} args={[geo, mat, count]}>
  <shaderMaterial uniforms={...} />
</instancedMesh>

// ✅ 命令式 — 完全绕过 R3F
const mesh = new THREE.InstancedMesh(geo, mat, count);
scene.add(mesh);
// 组件 return null;
```

### useFrame 中的内存管理

避免每帧 `new` 对象：

```ts
// ❌ 每帧创建 Vector3/Matrix4
pos.set(x, y, z);

// ✅ 复用
const pos = new THREE.Vector3(); // 在模块顶层声明
// 在 useFrame 中:
pos.set(x, y, z);
```

或者缓存为 `useMemo` / 模块级变量（推荐）。

---

## 7. GLSL 着色器注意事项

### THREE.js ShaderMaterial 的 uniform 限制

THREE.js 的 `WebGLProgram` 在解析 uniform 时**不支持**：

- ❌ 自定义 `struct`
- ❌ 自定义 `struct` 数组
- ❌ interface blocks

**解决方案**：将结构体拆分为多个基本类型数组：

```glsl
// ❌ 不支持
struct Ripple { vec3 pos; float time; };
uniform Ripple uRipples[10];

// ✅ 拆分为
uniform vec3 uRipplePositions[10];
uniform float uRippleTimes[10];
```

### uniforms 三处同步

增/删/改名 uniform 时，**三处必须同时修改**：

1. GLSL shader 中的 `uniform` 声明
2. `ShaderMaterial({ uniforms: { ... } })` 中的 JS 对象
3. `useFrame` 中的 `.value` 赋值代码

**任何一处遗漏 = 黑屏/报错**

### 常用内置变量（Three.js 自动注入）

| GLSL 变量 | THREE.js 注入值 |
|-----------|----------------|
| `projectionMatrix` | 相机投影矩阵 |
| `modelViewMatrix` | modelView 矩阵 |
| `viewMatrix` | view 矩阵 |
| `normalMatrix` | 法线矩阵 |
| `cameraPosition` | 相机世界坐标 |

### 自定义 uniform 命名约定

Three.js 自动处理 `uTime`、`uResolution` 等保留名 — 避免冲突。建议所有自定义 uniform 用 `u` 前缀。

---

## 8. 构建与部署

### 构建输出

```bash
npm run build
# 输出 → dist/
#   index.html
#   assets/
#     index-XXXXXX.js
#     index-XXXXXX.css
```

### project.json 管理

`project.json` **不在 `src/` 中**，不参与 Vite 构建。

**工作流程**：

1. `npm run build` → 生成 `dist/`
2. 将预先准备好的 `project.json` 复制到 `dist/`
3. 验证 `dist/` 包含：index.html + project.json + assets/

⚠️ Vite build 每次都会**清空** dist/，所以 project.json 在构建后需要重新复制。建议写脚本：

```json
// package.json
{
  "scripts": {
    "build:we": "vite build && copy project.json dist\\"
  }
}
```

### 导入 Wallpaper Engine

1. 打开 WE → "从文件安装" → 选择 `dist/` 文件夹
2. 或直接拖拽 `dist/` 到 WE 窗口

### 本地预览

```bash
npx vite preview --port 4173
# 打开 http://localhost:4173
# 注意：音频不会工作（wallpaperRegisterAudioListener 需要 WE 环境）
```

---

## 9. 调试方法

### 调试用 HUD overlay

在没有 Wallpaper Engine 环境（浏览器开发）时，添加假的音频数据源：

```ts
// 开发时模拟音频
if (!window.wallpaperRegisterAudioListener) {
  setInterval(() => {
    const arr = new Float32Array(128);
    for (let i = 0; i < 128; i++) {
      arr[i] = Math.random() * 0.5 * (1 - i / 128);
    }
    window.__audioData = arr;
  }, 50);
}
```

### 控制台诊断

```ts
// 确认音频数据流入
console.log('audio data length:', window.__audioData?.length);

// 确认 FFT 输出
const m = audioEngine.getAudioData();
console.log('energy:', m.energy, 'bass:', m.bass);

// 确认 uniform 可用
console.log('uniforms:', Object.keys(mesh.material.uniforms));
```

### W2E (Wallpaper-to-Edge) 诊断

Wallpaper Engine 的错误信息不会显示在浏览器 Console。在 `index.html` 的注册脚本中添加 try-catch 包裹所有 WE API 调用，捕获启动异常。

---

## 10. 常见陷阱清单

| # | 陷阱 | 症状 | 预防 |
|---|------|------|------|
| 1 | React 19 | Canvas 不渲染 | 锁定 react@18 |
| 2 | GLSL struct 数组 | WebGL 编译失败 | 拆分为基本类型数组 |
| 3 | JSX / GLSL / JS uniforms 不同步 | 黑屏 + undefined error | 三处同时修改 |
| 4 | project.json 含 Workshop 字段 | 导入失败 | 删除 workshopid/workshopurl/visibility 等 |
| 5 | 音频桥接缺失 | 柱子无响应 | rAF 轮询 window.__audioData → setWallpaperAudioData |
| 6 | Zustand 订阅触发重渲染 | 修改参数后卡死 | getState() in useFrame |
| 7 | InstanceMatrix 做 scale | 柱子变胖/偏移 | 只用 makeTranslation，高度在 shader 中计算 |
| 8 | 构建缓存残留 | 改了源码但 dist 不变 | rm -rf dist && rebuild |
| 9 | `useEffect` 代替 `useLayoutEffect` | 首帧黑屏/闪烁 | 初始化用 useLayoutEffect |
| 10 | Vite build 清空 project.json | 导入后无配置面板 | 构建后复制 project.json |

---

## 附录：完整文件清单（dist/ 成品）

```
dist/
  index.html           # 入口（含 WE 回调注册）
  project.json          # 配置（音频/参数/元信息）
  preview.gif           # 壁纸预览图
  assets/
    index-*.js          # 打包源码
    index-*.css         # 样式
```

只有这两个/三个文件会被 Wallpaper Engine 加载，其他所有源码/依赖/配置只在开发阶段有用。
