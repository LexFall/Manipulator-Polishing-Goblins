(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const T = window.THREE;
  const stage = el('stage'), view = el('world'), action = el('action');
  const dialog = el('dialog'), audio = window.garageSound;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({alpha:true, antialias:true, powerPreference:'high-performance'});
  } catch (error) {
    const notice = el('notice');
    notice.textContent = 'Для 3D-гаража нужен WebGL. Откройте игру в браузере с аппаратным ускорением.';
    notice.classList.add('show');
    return;
  }
  view.append(renderer.domElement);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-8,8,6,-6,.1,85);
  scene.add(new T.HemisphereLight(0xe5f0f9,0xa5b3a4,1.7));
  const sun = new T.DirectionalLight(0xffead1,2.25);
  sun.position.set(-3,13,8);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.3,far:34});
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.bias = -.00035;
  sun.shadow.normalBias = .014;
  scene.add(sun,sun.target);
  const room = window.buildRoom(scene);
  const pit = {x1:-3.45,x2:-1.1,z1:-3.95,z2:-.65};
  const inside = (x,z,r,p=0) => x>r.x1-p && x<r.x2+p && z>r.z1-p && z<r.z2+p;
  const clamp = T.MathUtils.clamp;
  const barriers=[pit,...window.roomObstacles];
  const walkable = (x,z) => Math.abs(x)<4.76 && Math.abs(z)<5.35 &&
    !inside(x,z,pit,.19) && !window.roomObstacles.some(r=>inside(x,z,r,.19));
  const floorHeight = (x,z) => x>pit.x1 && x<pit.x2 && z>=pit.z2 && z<4.85 ? .067 : 0;

  // Waypoints share the exact furniture and stair footprints of the rendered room.
  const step=.42, nodes=[], grid=new Map();
  const key=(i,j)=>i+','+j;
  for (let i=0;i<23;i++) for (let j=0;j<26;j++) {
    const x=-4.62+i*step, z=-5.15+j*step;
    if (!walkable(x,z)) continue;
    const node={i,j,x,z,near:[]};
    nodes.push(node); grid.set(key(i,j),node);
  }
  for (const n of nodes) {
    for (let di=-1;di<=1;di++) for (let dj=-1;dj<=1;dj++) {
      if (!di&&!dj) continue;
      if (di&&dj && (!grid.has(key(n.i+di,n.j))||!grid.has(key(n.i,n.j+dj)))) continue;
      const dest=grid.get(key(n.i+di,n.j+dj));
      if (dest && clearLine(n,dest)) n.near.push(dest);
    }
  }
  function nearest(x,z) {
    let best=nodes[0], bestDist=Infinity;
    for (const n of nodes) {
      const d=(x-n.x)**2+(z-n.z)**2;
      if (d<bestDist) {best=n;bestDist=d;}
    }
    return best;
  }
  function clearLine(a,b) {
    function interval(start,delta,lo,hi){
      if(Math.abs(delta)<1e-9) return start>lo&&start<hi?[-Infinity,Infinity]:[Infinity,-Infinity];
      const t0=(lo-start)/delta,t1=(hi-start)/delta;
      return [Math.min(t0,t1),Math.max(t0,t1)];
    }
    return !barriers.some(r=>{
      const x=interval(a.x,b.x-a.x,r.x1-.19,r.x2+.19);
      const z=interval(a.z,b.z-a.z,r.z1-.19,r.z2+.19);
      return Math.max(0,x[0],z[0])<Math.min(1,x[1],z[1]);
    });
  }
  function route(position) {
    const first=nearest(position.x,position.z);
    const last=nodes[Math.floor(Math.random()*nodes.length)];
    if(clearLine(position,last)) return [last];
    const queue=[first], previous=new Map([[first,null]]);
    for(let k=0;k<queue.length && !previous.has(last);k++) {
      for(const next of queue[k].near) if(!previous.has(next)){
        queue.push(next);previous.set(next,queue[k]);
      }
    }
    const path=[];
    if(previous.has(last)) for(let n=last;n;n=previous.get(n)) path.push(n);
    path.reverse();
    const smooth=[];
    let start=position;
    for(let i=0;i<path.length;i++){
      let end=i;
      while(end+1<path.length && clearLine(start,path[end+1])) end++;
      smooth.push(path[end]); start=path[end]; i=end;
    }
    return smooth;
  }
  const blobCanvas=document.createElement('canvas');
  blobCanvas.width=blobCanvas.height=64;
  const ctx=blobCanvas.getContext('2d'), grad=ctx.createRadialGradient(32,32,2,32,32,31);
  grad.addColorStop(0,'rgba(27,28,17,.55)');grad.addColorStop(.55,'rgba(30,30,20,.26)');grad.addColorStop(1,'rgba(30,30,20,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const blobMat=new T.MeshBasicMaterial({map:new T.CanvasTexture(blobCanvas),transparent:true,depthWrite:false});
  const blobGeometry=new T.PlaneGeometry(1.13,.74).rotateX(-Math.PI/2);
  const aim=new T.Vector2(.8,.7);
  const claw=window.createClaw();
  scene.add(claw.root);
  // A wall-mounted travelling crane keeps the overhead support out of the aisles.
  const hardware = new T.BoxGeometry(1,1,1);
  const iron = new T.MeshStandardMaterial({color:0x465351,roughness:.7});
  const enamel = new T.MeshStandardMaterial({color:0xcc963b,roughness:.68});
  function bar(material,x,y,z,w,h,d){
    const m=new T.Mesh(hardware,material);
    m.position.set(x,y,z);m.scale.set(w,h,d);scene.add(m);return m;
  }
  bar(iron,-4.96,3.28,0,.15,.15,11.2);
  const carriage=window.createOperatorCab(document.querySelector('.operator img'));
  carriage.position.set(-4.74,3.43,0);scene.add(carriage);
  const jib=bar(iron,0,3.49,0,1,.115,.13);
  const jibBase=bar(enamel,0,3.49,0,1,.17,.19);
  const pulley=bar(enamel,0,3.47,0,.24,.21,.24);
  const cable=bar(iron,0,3,0,.024,1,.024);
  const marker=new T.Group();
  const markMat=new T.MeshBasicMaterial({color:0xffc85a,transparent:true,opacity:.94,depthWrite:false,side:T.DoubleSide});
  for(let i=0;i<4;i++){
    const ring=new T.Mesh(new T.RingGeometry(.38,.423,14,1,i*Math.PI/2+.12,Math.PI/2-.24),markMat);
    ring.rotation.x=-Math.PI/2;marker.add(ring);
  }
  scene.add(marker);
  const actors=[];
  const maxGoblins=5;
  let serial=0, held=null, target=null, score=0, time=0, nextSpawn=3.8, nextTalk=2.5, messageUntil=0;
  const operatorQuote=el('operatorQuote');
  let nextOperator=Infinity, quoteUntil=0, lastLine=-1;
  const pendingLines=[];
  function updateOperator(){
    if(!operatorQuote.hidden && time>=quoteUntil)operatorQuote.hidden=true;
    if(time<nextOperator||!awakened)return;
    const lines=window.operatorLines;
    if(!pendingLines.length){
      for(let i=0;i<lines.length;i++)pendingLines.push(i);
      for(let i=pendingLines.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [pendingLines[i],pendingLines[j]]=[pendingLines[j],pendingLines[i]];
      }
      const end=pendingLines.length-1;
      if(end>0 && pendingLines[end]===lastLine)
        [pendingLines[0],pendingLines[end]]=[pendingLines[end],pendingLines[0]];
    }
    const index=pendingLines[pendingLines.length-1];
    const duration=enabled?audio.playOperator(index):0;
    if(enabled && !duration && (window.AudioContext||window.webkitAudioContext)){
      nextOperator=time+.55;return;
    }
    lastLine=pendingLines.pop();
    operatorQuote.textContent=lines[index].text;operatorQuote.hidden=false;
    quoteUntil=time+Math.max(duration+.3,2.7,lines[index].text.length*.073);
    nextOperator=quoteUntil+10+Math.random()*8;
  }
  let swingX=0,swingZ=0,speedX=0,speedZ=0,velX=0,velZ=0;
  const pivot=new T.Group();pivot.rotation.order='ZXY';scene.add(pivot);
  let enabled=true, suspended=false, awakened=false, pointerId=null, padId=null, padX=0,padY=0;
  const ray=new T.Raycaster(), pointer=new T.Vector2(), scratch=new T.Vector3();
  const floorPlane=new T.Plane(new T.Vector3(0,1,0),0);
  let bounds, cameraX, cameraZ, width=1,height=1, zoomed=false;
  let halfWidth=1,halfHeight=1,frameX=0,frameY=0,centerX=0,centerY=0;
  function setFrame(){
    const scale=zoomed?1.6:1;
    camera.left=centerX-halfWidth/scale;camera.right=centerX+halfWidth/scale;
    camera.top=centerY+halfHeight/scale;camera.bottom=centerY-halfHeight/scale;
    camera.updateProjectionMatrix();
  }
  el('zoom').onclick=()=>{
    zoomed=!zoomed;el('zoom').setAttribute('aria-pressed',String(zoomed));
    el('zoom').title=zoomed?'Показать весь гараж':'Увеличить гараж';
    el('zoom').setAttribute('aria-label',el('zoom').title);
    if(!zoomed){centerX=frameX;centerY=frameY;}
    setFrame();
  };
  function followAim(dt){
    if(!zoomed)return;
    scratch.set(aim.x,.65,aim.y).applyMatrix4(camera.matrixWorldInverse);
    const ease=1-Math.exp(-dt*5);
    centerX+=(clamp(scratch.x,frameX-halfWidth*.38,frameX+halfWidth*.38)-centerX)*ease;
    centerY+=(clamp(scratch.y,frameY-halfHeight*.38,frameY+halfHeight*.38)-centerY)*ease;
    setFrame();
  }
  function resize(){
    bounds=view.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
    renderer.setSize(width,height,false);
    const portrait=width<height*.94;
    camera.position.set(portrait?5.9:11,portrait?19:15,portrait?21:17);
    camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    cameraX=camera.matrix.elements[0];cameraZ=camera.matrix.elements[2];
    const points=[];
    for(const x of [-5.18,5.18])for(const z of [-5.77,5.77]){
      points.push(new T.Vector3(x,-.5,z));
      if(x<0||z<0)points.push(new T.Vector3(x,3.25,z));
    }
    const box=new T.Box3().setFromPoints(points.map(p=>p.applyMatrix4(camera.matrixWorldInverse)));
    const aspect=width/height;
    const marginX=width<500?1.032:1.095;
    const half=Math.max((box.max.x-box.min.x)*marginX/aspect,(box.max.y-box.min.y)*(height<400?1.03:1.085))/2;
    const cx=(box.max.x+box.min.x)/2,cy=(box.max.y+box.min.y)/2;
    frameX=centerX=cx;frameY=centerY=cy;halfHeight=half;halfWidth=half*aspect;setFrame();
  }
  new ResizeObserver(resize).observe(view);resize();
  function screenPoint(x,y,z) {
    scratch.set(x,y,z).project(camera);
    return {x:(scratch.x+1)*width/2,y:(1-scratch.y)*height/2};
  }
  function groundPoint(clientX,clientY) {
    pointer.set((clientX-bounds.left)/width*2-1,1-(clientY-bounds.top)/height*2);
    ray.setFromCamera(pointer,camera);ray.ray.intersectPlane(floorPlane,scratch);
    return {x:scratch.x,z:scratch.z};
  }
  function placeAim(x,z){aim.set(clamp(x,-4.88,4.88),clamp(z,-5.48,5.48));}
  function pointerAim(e) {
    const p=groundPoint(e.clientX,e.clientY);
    if(!held){
      const x=e.clientX-bounds.left,y=e.clientY-bounds.top;
      let closest=Infinity, hit=null;
      for(const g of actors) if(g.state==='run'){
        const pos=g.root.position, center=screenPoint(pos.x,pos.y+.52,pos.z);
        const top=screenPoint(pos.x,pos.y+1.07,pos.z);
        const radius=clamp(Math.abs(top.y-center.y)*1.45,10,37);
        const dist=Math.hypot(x-center.x,(y-center.y)*.78);
        if(dist<radius && dist<closest){hit=g;closest=dist;}
      }
      if(hit){placeAim(hit.root.position.x,hit.root.position.z);return;}
    }
    placeAim(p.x,p.z);
  }
  function spawn(state,x,z) {
    if(actors.length>=maxGoblins)return;
    const model=window.createGoblin(serial++);
    const g={...model,state,age:0,phase:Math.random()*6.28,speed:.79+Math.random()*.39,path:[],
      shadow:new T.Mesh(blobGeometry,blobMat),bubble:null};
    g.root.position.set(x,floorHeight(x,z),z);
    g.root.rotation.y=.25+Math.random()*1.2;
    if(state==='emerge'){
      g.root.rotation.y=Math.PI;g.root.position.y=-1.76;
    }
    scene.add(g.root,g.shadow);actors.push(g);
    return g;
  }
  spawn('run',-.15,1.58);spawn('run',1.1,-1.16);spawn('run',-2.35,2.65);
  function runnerCount(){return actors.reduce((n,g)=>n+(g.state==='run'),0);}
  function replenish(){
    if(runnerCount()<2) {
      const x=-2.88+Math.random()*1.25;
      spawn('run',x,-4.23);
    }
  }
  function announce(s,duration=1.4){
    el('notice').textContent=s;el('notice').classList.add('show');messageUntil=time+duration;
  }
  function bubble(g,s,seconds=1.45){
    for(const person of actors) {person.bubble?.remove();person.bubble=null;}
    g.bubble=document.createElement('span');g.bubble.className='tag';g.bubble.textContent=s;
    el('tags').append(g.bubble);g.bubbleEnd=time+seconds;
  }
  function chooseTarget(){
    target=null;
    if(held)return;
    let distance=.79;
    for(const g of actors) if(g.state==='run'){
      const p=g.root.position,d=Math.hypot(p.x-aim.x,p.z-aim.y);
      if(d<distance){distance=d;target=g;}
    }
  }
  function syncHud(){
    const status=held?(inside(aim.x,aim.y,pit)?'Над ямой':'Гоблин пойман'):(target?'Цель в захвате':'Свободный ход');
    if(el('targetStatus').lastElementChild.textContent!==status){
      el('targetStatus').lastElementChild.textContent=status;
      el('targetStatus').className='grip-light '+(held?'held':target?'ready':'');
    }
    const count=String(runnerCount()).padStart(2,'0');
    if(el('free').textContent!==count)el('free').textContent=count;
  }
  function perform(){
    if(suspended||document.hidden)return;
    wake();chooseTarget();
    if(held){
      const g=held, drop=inside(aim.x,aim.y,pit);
      scene.attach(g.root);
      held=null;g.age=0;
      g.origin=g.root.position.clone();g.startEuler=g.root.rotation.clone();
      g.end=drop?{x:aim.x,z:aim.y}:walkable(aim.x,aim.y)?{x:aim.x,z:aim.y}:nearest(aim.x,aim.y);
      g.state=drop?'fall':'land';
      g.bubble?.remove();g.bubble=null;
      audio?.play(drop?'fall':'release');
      if(drop)bubble(g,'А-а-а!',.45);
      action.lastElementChild.textContent='Захват';
    }else if(target){
      if(actors.length===maxGoblins && runnerCount()<=2){
        announce('Подождите, пока гоблин приземлится',.7);
        return;
      }
      held=target;target=null;held.state='held';held.age=0;
      const pos=held.root.position;
      placeAim(pos.x,pos.z);
      pivot.position.set(pos.x,pos.y+held.collarHeight,pos.z);
      pivot.rotation.set(0,0,0,'ZXY');
      const heading=held.root.rotation.y;
      pivot.rotation.y=heading;
      pivot.add(held.root);held.root.position.set(0,-held.collarHeight,-held.collarZ);
      held.root.rotation.set(0,0,0);
      swingX=swingZ=speedX=speedZ=velX=velZ=0;
      audio?.play('grab');bubble(held,'Эй, пусти!');
      action.lastElementChild.textContent='Сброс';
      replenish();
    }else{
      audio?.play('miss');announce('Подведите клешню ближе к гоблину');
    }
    syncHud();
  }
  function wake(){
    if(!awakened){awakened=true;audio?.unlock();audio?.setEnabled(enabled);nextOperator=time+3.5;}
  }
  document.addEventListener('pointerdown',wake,{capture:true});
  // Some touch browsers grant audio playback on release of the first finger.
  document.addEventListener('pointerup',()=>{
    if(enabled && !suspended && awakened)audio?.unlock();
  },{capture:true,once:true});
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{
    if(suspended||pointerId!==null||e.button!==0)return;
    e.preventDefault();pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);
    pointerAim(e);if(e.pointerType==='mouse')perform();
  });
  canvas.addEventListener('pointermove',e=>{
    if(!suspended && (e.pointerId===pointerId || (pointerId===null && e.pointerType==='mouse')))pointerAim(e);
  });
  const endPointer=e=>{if(pointerId===e.pointerId)pointerId=null;};
  canvas.addEventListener('lostpointercapture',endPointer);
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
  const pad=el('pad');
  function padMove(e){
    if(e.pointerId!==padId)return;
    const r=pad.getBoundingClientRect();
    let x=(e.clientX-r.left-r.width*.5)/(r.width*.4),y=(e.clientY-r.top-r.height*.5)/(r.height*.4);
    const length=Math.max(1,Math.hypot(x,y));padX=x/length;padY=y/length;
    el('stick').style.transform='translate('+padX*8+'px,'+padY*8+'px)';
  }
  pad.onpointerdown=e=>{if(padId!==null)return;e.preventDefault();padId=e.pointerId;pad.setPointerCapture(padId);padMove(e);};
  pad.onpointermove=padMove;
  function resetPad(){padId=null;padX=padY=0;el('stick').style.transform='';}
  pad.onlostpointercapture=resetPad;pad.onpointerup=resetPad;pad.onpointercancel=resetPad;
  action.addEventListener('pointerdown',e=>{if(e.button===0){e.preventDefault();perform();}});
  action.addEventListener('click',e=>{if(e.detail===0)perform();});
  const keys=new Set();
  function pauseGame(help){
    if(dialog.open)return;
    suspended=true;keys.clear();resetPad();pointerId=null;audio?.setEnabled(false);
    operatorQuote.hidden=true;
    el('dialogTitle').textContent=help?'Как играть':'Пауза';
    el('instructions').hidden=!help;dialog.showModal();
  }
  function resume(){
    if(dialog.open)dialog.close();
    suspended=false;last=performance.now();audio?.setEnabled(enabled&&!document.hidden);
  }
  el('help').onclick=()=>pauseGame(true);el('pause').onclick=()=>pauseGame(false);
  el('resume').onclick=resume;el('close').onclick=resume;dialog.addEventListener('cancel',e=>{e.preventDefault();resume();});
  el('sound').onclick=()=>{
    enabled=!enabled;audio?.setEnabled(enabled);
    el('sound').firstElementChild.firstElementChild.setAttribute('href',enabled?'#vol':'#mute');
    el('sound').setAttribute('aria-label',enabled?'Выключить звук':'Включить звук');
  };
  const touch=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
  el('moveHint').textContent=touch?'Пальцем по полю или джойстику':'Мышью или стрелками';
  el('inputGuide').textContent=touch?'Одним пальцем веди клешню по полю или двигай джойстик. Другим нажимай кнопку захвата и сброса.':'Наводи мышью и щёлкай по гоблину, затем по яме. Также работают стрелки и пробел.';
  window.addEventListener('keydown',e=>{
    if(e.code==='Escape'){if(!dialog.open){e.preventDefault();pauseGame(false);}return;}
    if(suspended)return;
    if(e.code.startsWith('Arrow')){e.preventDefault();keys.add(e.code);}
    if(e.code==='Space' && !e.repeat && !(e.target instanceof HTMLButtonElement)){e.preventDefault();perform();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();resetPad();pointerId=null;});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){keys.clear();resetPad();pointerId=null;audio?.setEnabled(false);}
    else {last=performance.now();if(!suspended)audio?.setEnabled(enabled);}
  });
  function drive(dt){
    let x=padX+Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
    let y=padY+Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
    const len=Math.max(1,Math.hypot(x,y));x/=len;y/=len;
    placeAim(aim.x+(x*cameraX-y*cameraZ)*dt*5.1,aim.y+(x*cameraZ+y*cameraX)*dt*5.1);
  }
  function updateGoblin(g,dt){
    g.age+=dt;
    const p=g.root.position;
    if(g.state==='run'){
      if(!g.path.length)g.path=route(p);
      const n=g.path[0];
      if(n){
        const dx=n.x-p.x,dz=n.z-p.z,d=Math.hypot(dx,dz);
        const s=Math.min(g.speed*dt,d);
        if(d>.0001){
          p.x+=dx/d*s;p.z+=dz/d*s;
          const heading=Math.atan2(dx,dz),diff=heading-g.root.rotation.y;
          g.root.rotation.y+=Math.atan2(Math.sin(diff),Math.cos(diff))*Math.min(1,dt*11);
        }
        if(d-s<.00001){p.x=n.x;p.z=n.z;g.path.shift();}
      }
      p.y=floorHeight(p.x,p.z);
    }else if(g.state==='emerge'){
      const progress=Math.min(1,g.age/2.15);
      p.z=-1.36-progress*2.86;
      p.y=Math.min(0,-1.76+progress*1.91);
      if(progress===1){g.state='run';g.age=0;}
    }else if(g.state==='fall'||g.state==='land'){
      const falling=g.state==='fall';
      const t=clamp(g.age/(falling?.62:.37),0,1);
      p.x=T.MathUtils.lerp(g.origin.x,g.end.x,t);p.z=T.MathUtils.lerp(g.origin.z,g.end.z,t);
      p.y=T.MathUtils.lerp(g.origin.y,falling?-2.55:floorHeight(p.x,p.z),t*t);
      g.root.rotation.x=falling?g.startEuler.x+t*1.65:g.startEuler.x*(1-t);
      g.root.rotation.z=falling?g.startEuler.z+t*.35:g.startEuler.z*(1-t);
      if(t>=1 && falling){
        score++;el('score').textContent=String(score).padStart(2,'0');audio?.play('impact');
        announce('+1 в подвал',1.05);scene.remove(g.root,g.shadow);g.bubble?.remove();
        actors.splice(actors.indexOf(g),1);return;
      }
      if(t>=1){g.state='run';g.path=[];g.age=0;}
    }
    g.animate(time+g.phase,g.speed,g.state==='land'?'fall':g.state);
    g.shadow.visible=g.state==='run'||g.state==='held'||g.state==='land';
    const sx=g===held?pivot.position.x:p.x, sz=g===held?pivot.position.z:p.z;
    if(inside(sx,sz,pit))g.shadow.visible=false;
    g.shadow.position.set(sx,floorHeight(sx,sz)+.023,sz);
    if(g.bubble){
      if(time>g.bubbleEnd){g.bubble.remove();g.bubble=null;}
      else {
        g.root.getWorldPosition(scratch);
        const at=screenPoint(scratch.x,scratch.y+1.12,scratch.z);
        g.bubble.style.left=at.x+'px';g.bubble.style.top=at.y+'px';
      }
    }
  }
  function updateClaw(dt){
    chooseTarget();
    const p=target?.root.position;
    const x=p?p.x:aim.x, z=p?p.z:aim.y;
    const base=floorHeight(x,z);
    const y=held?1.69:target?base+1.10:base+1.03;
    const pos=claw.root.position;
    const smooth=1-Math.exp(-dt*(held?20:26));
    const oldX=pos.x, oldZ=pos.z;
    pos.x+=(x-pos.x)*smooth;pos.z+=(z-pos.z)*smooth;pos.y+=(y-pos.y)*Math.min(1,dt*10);
    const length=pos.x+4.96;
    carriage.position.z=jib.position.z=jibBase.position.z=pulley.position.z=cable.position.z=pos.z;
    jib.position.x=-4.96+length*.5;jib.scale.x=length;
    jibBase.position.x=-4.96+length*.22;jibBase.scale.x=length*.44;
    pulley.position.x=cable.position.x=pos.x;
    if(awakened)audio?.setMotion(Math.min(1,Math.hypot(pos.x-oldX,pos.z-oldZ)/(dt*5)));
    const end=pos.y+1.64;
    cable.position.y=(3.47+end)*.5;cable.scale.y=Math.max(.02,3.47-end);
    if(held){
      const vx=(pos.x-oldX)/dt,vz=(pos.z-oldZ)/dt;
      speedZ+=clamp((vx-velX)*.13,-.8,.8);speedX-=clamp((vz-velZ)*.13,-.8,.8);
      velX=vx;velZ=vz;
      speedX+=(-25*swingX-2.8*speedX)*dt;speedZ+=(-25*swingZ-2.8*speedZ)*dt;
      swingX=clamp(swingX+speedX*dt,-.72,.72);swingZ=clamp(swingZ+speedZ*dt,-.72,.72);
      pivot.position.copy(pos);pivot.rotation.x=swingX+.032*Math.sin(time*3.5);pivot.rotation.z=swingZ;
    }
    claw.animate(time,!!held);
    marker.position.set(x,base+.097,z);
    const over=held&&inside(x,z,pit);
    markMat.color.setHex(over||target?0xb5fb73:0xffc04e);
    marker.scale.setScalar((target?1.2:1)+.035*Math.sin(time*4));syncHud();
  }
  claw.root.position.set(aim.x,1.04,aim.y);
  let last=performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    if(suspended||document.hidden){last=now;return;}
    const dt=clamp((now-last)/1000,.001,.06);last=now;time+=dt;
    if(time>=nextSpawn){
      spawn('emerge',-2.85+Math.random()*1.15,-1.36);
      nextSpawn=time+3+Math.random()*2;
    }
    updateOperator();
    if(time>=nextTalk && operatorQuote.hidden){
      const free=actors.filter(g=>g.state==='run');
      if(!held && free.length){
        const g=free[Math.floor(Math.random()*free.length)];
        bubble(g,['Свободны!','Не поймаешь!','Ура!'][Math.floor(Math.random()*3)]);
        if(awakened)audio?.play('free');
      }else if(held&&held.age>2.5 && awakened){audio?.play('grumble');bubble(held,'Ну пусти уже!');}
      nextTalk=time+5+Math.random()*3.5;
    }
    if(messageUntil&&time>=messageUntil){el('notice').classList.remove('show');messageUntil=0;}
    drive(dt);followAim(dt);updateClaw(dt);
    for(let i=actors.length-1;i>=0;i--)updateGoblin(actors[i],dt);
    renderer.render(scene,camera);
  }
  frame(last);
})();
