const fs = require('fs');
const path = require('path');

const bundlePath = path.join('d:/1Wallpaper-7-3/sonic-clone/dist/assets', 'index-fixed.js');
const projectPath = path.join('d:/1Wallpaper-7-3/sonic-clone/dist', 'project.json');
const indexPath = path.join('d:/1Wallpaper-7-3/sonic-clone/dist', 'index.html');

let c = fs.readFileSync(bundlePath, 'utf8');

function replaceOnce(label, from, to) {
  if (to.includes(from) && c.includes(to)) {
    console.log('= ' + label + ' already applied');
    return true;
  }
  if (c.includes(to) && !c.includes(from)) {
    console.log('= ' + label + ' already applied');
    return true;
  }
  if (!c.includes(from)) {
    console.log('! Missing pattern: ' + label);
    return false;
  }
  c = c.replace(from, to);
  console.log('+ ' + label);
  return true;
}

// Keep the previous color-cycling fix, but make it idempotent.
replaceOnce(
  'themeCyclingEnabled default',
  'theme:"nocturnal",themeCycleInterval:60,',
  'theme:"nocturnal",themeCycleInterval:60,themeCyclingEnabled:!1,'
);
replaceOnce(
  'theme cycling interval guard',
  'setInterval(()=>{t()},',
  'setInterval(()=>{is.getState().themeCyclingEnabled&&t()},'
);
replaceOnce(
  'themeCyclingEnabled updateSetting branch',
  'updateSetting:(t,n)=>{if(i({[t]:n}),t==="theme"){const r=md(n);i({currentTheme:r})}}',
  'updateSetting:(t,n)=>{if(i({[t]:n}),t==="theme"){const r=md(n);i({currentTheme:r})}else if(t==="themeCyclingEnabled"){i({themeCyclingEnabled:n})}}'
);

// Default to the original documented working density, while allocating a max pool for runtime changes.
replaceOnce('gridSize default 160', 'gridSize:80,', 'gridSize:160,');
replaceOnce(
  'max grid pool 240 and original world area',
  'TA=84,kf=80,vg=TA/kf,XM=vg*.857,jM=kf*kf,YM=TA/2',
  'TA=168,kf=240,vg=TA/kf,XM=vg*.857,jM=kf*kf,YM=TA/2'
);
replaceOnce(
  'restore original world area',
  'TA=84,kf=240,vg=TA/kf,XM=vg*.857,jM=kf*kf,YM=TA/2',
  'TA=168,kf=240,vg=TA/kf,XM=vg*.857,jM=kf*kf,YM=TA/2'
);

// Avoid the almost-invisible idle render: keep material opaque and enforce a small color floor.
replaceOnce('opaque pillar material', 'transparent:!0,uniforms:{uTime', 'transparent:!1,uniforms:{uTime');
if (c.includes('finalColor = max(finalColor, cBase2 + vec3(0.035, 0.045, 0.08));')) {
  console.log('= fragment brightness floor already applied');
} else {
  replaceOnce(
    'fragment brightness floor',
    'float alphaFade = 1.0 - smoothstep(55.0, 78.0, vDistance);\\r\\n\\r\\n  gl_FragColor = vec4(finalColor, alphaFade);',
    'finalColor = max(finalColor, cBase2 + vec3(0.035, 0.045, 0.08));\\r\\n  float alphaFade = 1.0;\\r\\n\\r\\n  gl_FragColor = vec4(finalColor, alphaFade);'
  )
  || replaceOnce(
    'fragment brightness floor',
    'float alphaFade = 1.0 - smoothstep(55.0, 78.0, vDistance);\\r\r\n\\r\r\n  gl_FragColor = vec4(finalColor, alphaFade);',
    'finalColor = max(finalColor, cBase2 + vec3(0.035, 0.045, 0.08));\\r\r\n  float alphaFade = 1.0;\\r\r\n\\r\r\n  gl_FragColor = vec4(finalColor, alphaFade);'
  );
}

// gridSize should update the store. Reloading returns to the baked default before WE reapplies settings.
replaceOnce(
  'gridSize no reload',
  'a==="gridSize"?setTimeout(()=>window.location.reload(),200):a==="theme"?e(u.value):u.value!==void 0&&i(a,u.value)',
  'a==="theme"?e(u.value):u.value!==void 0&&i(a,u.value)'
);

// Rebuild instance matrices when gridSize changes. The InstancedMesh count is capped at the 240x240 pool.
replaceOnce(
  'runtime grid matrix rebuild',
  'const N=new Dt,O=kf*vg/2;for(let B=0;B<jM;B++){const U=B%kf,D=Math.floor(B/kf);N.makeTranslation(U*vg-O,.5,D*vg-O),P.setMatrixAt(B,N)}P.instanceMatrix.needsUpdate=!0;',
  'const N=new Dt,O=B=>{const U=Math.max(1,Math.min(kf,Number(B)||kf)),D=U<=160?168/160:TA/U,H=D*(U-1)/2;P.count=U*U;P.userData.gridSize=U;for(let ne=0;ne<jM;ne++)if(ne<P.count){const ee=ne%U,de=Math.floor(ne/U);N.makeTranslation(ee*D-H,.5,de*D-H),P.setMatrixAt(ne,N)}else N.makeScale(0,0,0),N.setPosition(0,-1e3,0),P.setMatrixAt(ne,N);P.instanceMatrix.needsUpdate=!0};P.userData.updateGrid=O,O(is.getState().gridSize||kf);'
);
replaceOnce(
  'runtime grid matrix rebuild aggregation',
  'const N=new Dt,O=B=>{const U=Math.max(1,Math.min(kf,Number(B)||kf)),D=TA/U,H=D*(U-1)/2;P.count=U*U;P.userData.gridSize=U;for(let ne=0;ne<jM;ne++)if(ne<P.count){const ee=ne%U,de=Math.floor(ne/U);N.makeTranslation(ee*D-H,.5,de*D-H),P.setMatrixAt(ne,N)}else N.makeScale(0,0,0),N.setPosition(0,-1e3,0),P.setMatrixAt(ne,N);P.instanceMatrix.needsUpdate=!0};P.userData.updateGrid=O,O(is.getState().gridSize||kf);',
  'const N=new Dt,O=B=>{const U=Math.max(1,Math.min(kf,Number(B)||kf)),D=U<=160?168/160:TA/U,H=D*(U-1)/2;P.count=U*U;P.userData.gridSize=U;for(let ne=0;ne<jM;ne++)if(ne<P.count){const ee=ne%U,de=Math.floor(ne/U);N.makeTranslation(ee*D-H,.5,de*D-H),P.setMatrixAt(ne,N)}else N.makeScale(0,0,0),N.setPosition(0,-1e3,0),P.setMatrixAt(ne,N);P.instanceMatrix.needsUpdate=!0};P.userData.updateGrid=O,O(is.getState().gridSize||kf);'
);
replaceOnce(
  'gridSize frame hook',
  'const N=is.getState(),O=N.theme,',
  'const N=is.getState();P.userData.gridSize!==N.gridSize&&P.userData.updateGrid&&(P.userData.updateGrid(N.gridSize),P.userData.gridSize=N.gridSize);const O=N.theme,'
);
replaceOnce(
  'theme cycle only through toggle',
  'const O=N.theme,B=md(O==="cycle"?bd[Math.floor(S.clock.elapsedTime/60)%bd.length]:O),U=Math.min(R*3,1);',
  'const O=N.theme,B=md(O==="cycle"?"nocturnal":O),U=Math.min(R*3,1);'
);
replaceOnce(
  'camera settings live update',
  'if(N.autoRotateEnabled){E.current=(E.current+N.autoRotateSpeed*R)%360;const ue=fd.degToRad(E.current),G=fd.degToRad(N.cameraAngleY),J=N.cameraDistance;o.position.set(J*Math.cos(G)*Math.sin(ue),J*Math.sin(G),J*Math.cos(G)*Math.cos(ue)),o.lookAt(0,0,0)}})',
  'N.autoRotateEnabled?E.current=(E.current+N.autoRotateSpeed*R)%360:E.current=N.cameraAngleX;const ue=fd.degToRad(E.current),G=fd.degToRad(N.cameraAngleY),J=N.cameraDistance;o.position.set(J*Math.cos(G)*Math.sin(ue),J*Math.sin(G),J*Math.cos(G)*Math.cos(ue)),o.lookAt(0,0,0)})'
);
replaceOnce('fallback background color', 'args:["#000000"]', 'args:["#10162e"]');
replaceOnce(
  'fallback fog color',
  'function ZU(i){const e=new cp("#000000",30,95);return i.fog=e,e}',
  'function ZU(i){const e=new cp("#10162e",30,95);return i.fog=e,e}'
);
replaceOnce('disable main mesh frustum culling', 'P.frustumCulled=!0,t.current=P,u.add(P);', 'P.frustumCulled=!1,t.current=P,u.add(P);');

c = c.replace(
  'themeCycleInterval:60,themeCyclingEnabled:!1,themeCyclingEnabled:!1,',
  'themeCycleInterval:60,themeCyclingEnabled:!1,'
);

fs.writeFileSync(bundlePath, c);
console.log('Bundle JS saved.');

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('./assets/index-CzRHdd5W.js', './assets/index-fixed.js');
html = html.replace('assets/index-CzRHdd5W.js', 'assets/index-fixed.js');
fs.writeFileSync(indexPath, html);
console.log('index.html saved.');

const pObj = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
const props = pObj.general.properties;

props.themeCyclingEnabled = {
  index: 22,
  order: 125,
  text: '颜色轮询',
  type: 'bool',
  value: false
};

props.gridSize = {
  index: 4,
  options: [
    { label: '小 (80x80)', value: 80 },
    { label: '中 (120x120)', value: 120 },
    { label: '标准 (160x160)', value: 160 },
    { label: '高 (200x200)', value: 200 },
    { label: '极高 (240x240)', value: 240 }
  ],
  order: 104,
  text: '渲染精度',
  type: 'combo',
  value: 160
};

const sourceProjectPath = path.join('d:/1Wallpaper-7-3', '音域回响', 'project.json');
if (fs.existsSync(sourceProjectPath)) {
  const sourceProps = JSON.parse(fs.readFileSync(sourceProjectPath, 'utf8')).general.properties;
  for (const key of ['showPlayerController', 'showAlbumCover', 'controllerSize', 'controllerX', 'controllerY']) {
    if (sourceProps[key]) props[key] = sourceProps[key];
  }
}

fs.writeFileSync(projectPath, JSON.stringify(pObj, null, '\t'));
console.log('project.json saved.');
