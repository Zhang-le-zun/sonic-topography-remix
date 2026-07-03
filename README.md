# 音域回响 · 魔改版

> Sonic Topography Remix — Wallpaper Engine 网页类型壁纸

[![tag](https://img.shields.io/badge/version-v1.1-blue)](https://github.com/Zhang-le-zun/sonic-topography-remix/releases/tag/v1.1)
[![type](https://img.shields.io/badge/type-Web%20Wallpaper-green)](https://www.wallpaperengine.io/)

基于 Steam 创意工坊「音域回响 · Sonic Topography」魔改重制，完全使用 TypeScript + React Three Fiber + GLSL 重写。

---

## 🎵 功能特性

| 功能 | 说明 |
|------|------|
| **音频响应** | 512-bin FFT 多频段实时分析，5 个频率区域独立驱动柱子高度 |
| **10 套色彩主题** | 靛蓝紫 / 深海蓝 / 冰蓝 / 翡翠绿 / 暖金黄 / 琥珀橙 / 血红 / 珊瑚粉 / 霓虹紫粉 / 极简黑白 |
| **自动轮询** | 主题自动定时切换 |
| **流星特效** | 高频节拍触发流星坠落，撞击地面产生粒子爆炸 |
| **波纹特效** | 低频节拍触发地面扩散涟漪 |
| **空闲波浪** | 无音乐时柱子呼吸状微动，保持画面活力 |
| **专辑封面** | 兼容 Wallpaper Engine Media Integration |
| **播放器控制器** | 悬浮毛玻璃卡片，三种尺寸 |
| **多参数可调** | 音频响应强度、响应范围、视角旋转、灵敏度等 |

---

## 📥 安装方法

1. 下载 [最新 Release](https://github.com/Zhang-le-zun/sonic-topography-remix/releases)
2. 解压到任意目录
3. 将文件夹拖入 Wallpaper Engine 或手动添加

---

## 🛠 技术栈

- **Three.js** — 3D 渲染引擎
- **React Three Fiber** — React 声明式 3D
- **GLSL Shaders** — 自定义顶点/片元着色器
- **Simplex Noise** — 程序化地形生成
- **Web Audio FFT** — 512 频段频谱分析
- **Zustand** — 状态管理

---

## 📂 项目结构

```
dist/
  index.html          # 壁纸入口
  project.json         # Wallpaper Engine 配置
  assets/
    index-*.js         # 打包后的完整源码
    index-*.css        # 样式
```

---

## 🔄 更新计划

- [ ] 更多色彩主题
- [ ] 渲染精度动态调整
- [ ] 波纹效果增强
- [ ] 性能优化

---

## 📄 许可

MIT License
