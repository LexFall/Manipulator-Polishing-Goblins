/* Soviet workshop cutaway. Coordinates are in metres. Y=0 is the garage floor. */
(function () {
  'use strict';
  window.buildRoom = function buildRoom(scene) {
    const T = THREE;
    const group = new T.Group();
    group.name = 'Гараж • пол, стены, оборудование';
    scene.add(group);
    const obstacles = window.roomObstacles = [];
    let seed = 17596;
    const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
    const v = (x,y,z) => new T.Vector3(x,y,z);
    const loader = new T.TextureLoader();
    function grain(url) {
      const tex=loader.load(url);
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 2;
      return tex;
    }
    const plaster = grain('assets/wall-grain.jpg');
    const grainWood = grain('assets/wood-grain.jpg');
    const concrete = grain('assets/concrete-grain.jpg');
    const types = {};
    function standard(key, name, props={}) {
      types[key] = new T.MeshStandardMaterial({name,roughness:.84,vertexColors:true,...props});
    }
    standard('wall','Крашеная штукатурка',{map:plaster});
    standard('stone','Бетон с заполнителем',{map:concrete});
    standard('wood','Столярное дерево',{map:grainWood});
    standard('metal','Сталь и старая эмаль',{roughness:.68,metalness:.16});
    standard('matte','Резина, бумага и краска');
    types.glow = new T.MeshBasicMaterial({vertexColors:true});
    let batches = {};
    const baseBox = new T.BoxGeometry(1,1,1);
    const axisY = v(0,1,0);
    const qu = new T.Quaternion();
    function add(geo,center,scale,rotation,type,color,uvFn) {
      const data = batches[type] ||= {p:[],n:[],c:[],u:[],i:[]};
      const ix = data.p.length/3;
      const matrix = new T.Matrix4().compose(center,rotation || qu,scale);
      const nm = new T.Matrix3().getNormalMatrix(matrix);
      const rgb = new T.Color(color);
      const {position,normal,uv}=geo.attributes;
      const pt=v(0,0,0), n=v(0,0,0);
      for (let i=0; i<position.count; i++) {
        pt.fromBufferAttribute(position,i).applyMatrix4(matrix);
        n.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();
        data.p.push(...pt.toArray()); data.n.push(...n.toArray()); data.c.push(rgb.r,rgb.g,rgb.b);
        data.u.push(...(uvFn ? uvFn(pt,n,i) : [uv.getX(i),uv.getY(i)]));
      }
      const idx=geo.index;
      for(let i=0;i<(idx?idx.count:position.count);i++) data.i.push(ix+(idx?idx.getX(i):i));
    }
    const recess='#273333', angle='#354443', iron='#51605a', rust='#8f5032', timber='#c59e6b';
    function box(x,y,z,w,h,d,clr,type='matte',rx=0,ry=0,rz=0) {
      const q=new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz));
      const uvFn=(p,n,i)=>{
        const u=baseBox.attributes.uv.getX(i), t=baseBox.attributes.uv.getY(i);
        const face=Math.floor(i/4);
        if (type==='wood') {
          const along=w>=d && w>=h;
          if (face===2 || face===3) return along ? [u*w/1.28,t*d/.92] : [t*d/1.28,u*w/.92];
          if(face>=4) return w>h ? [u*w/1.28,t*h/.92] : [t*h/1.28,u*w/.92];
          return d>h ? [u*d/1.28,t*h/.92] : [t*h/1.28,u*d/.92];
        }
        if (type==='wall'||type==='stone') {
          let a,b;
          if(Math.abs(n.y)>.6){a=p.x;b=p.z;}else if(Math.abs(n.z)>.6){a=p.x;b=p.y;}else{a=p.z;b=p.y;}
          return [a*.57,b*.57];
        }
        return [u,t];
      };
      add(baseBox,v(x,y,z),v(w,h,d),q,type,clr,uvFn);
    }
    function beam(a,b,w,d,clr,type='metal') {
      const start=v(...a),end=v(...b),delta=end.clone().sub(start);
      const q=new T.Quaternion().setFromUnitVectors(axisY,delta.clone().normalize());
      add(baseBox,start.addScaledVector(delta,.5),v(w,delta.length(),d),q,type,clr);
    }
    const tubes=new Map();
    function rod(a,b,r,clr,type='metal',segments=8,r2=r) {
      const key=segments+':'+(r2/r).toFixed(3);
      if(!tubes.has(key))tubes.set(key,new T.CylinderGeometry(r2/r,1,1,segments));
      const start=v(...a),delta=v(...b).sub(start);
      add(tubes.get(key),start.addScaledVector(delta,.5),v(r,delta.length(),r),
          new T.Quaternion().setFromUnitVectors(axisY,delta.clone().normalize()),type,clr);
    }
    function block(x1,x2,z1,z2){obstacles.push({x1,x2,z1,z2});}
    function decalCanvas(key,w,h,draw) {
      const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'));
      const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;
      types[key]=new T.MeshStandardMaterial({map:tex,roughness:.95,vertexColors:true});
    }
    const quad=new T.PlaneGeometry();
    function panel(x,y,z,w,h,ry,type) {
      add(quad,v(x,y,z),v(w,h,1),new T.Quaternion().setFromAxisAngle(axisY,ry),type,0xffffff);
    }
    const floorY=-.16;
    function slab(x1,x2,z1,z2,color) {
      box((x1+x2)/2,floorY,(z1+z2)/2,x2-x1,.32,z2-z1,color,'stone');
      box((x1+x2)/2,-.40,(z1+z2)/2,x2-x1,.16,z2-z1,'#655f51','stone');
    }
    const left=-3.45,right=-1.1,rear=-3.95,front=4.85,boards=-.65;
    slab(-5,left,-5.6,5.6,'#aba69a');slab(right,5,-5.6,5.6,'#b0ada0');
    slab(left,right,-5.6,rear,'#aaa798');slab(left,right,front,5.6,'#a6a292');
    // Expansion joints divide the poured floor. The perimeter lip exposes the thickness of the slab.
    [-.15,2.55].forEach(x=>box(x,.002,0,.012,.004,11.2,'#827e73'));
    [-3.24,.54,3.78].forEach(z=>{
      box(1.95,.002,z,6.1,.004,.015,'#797e71');
      box(-4.225,.002,z,1.55,.004,.014,'#7e7d70');
    });
    function crack(x,z,dir,steps){
      for(let j=0;j<steps;j++){
        const dx=(.09+random()*.23)*Math.cos(dir),dz=(.09+random()*.23)*Math.sin(dir);
        beam([x,.005,z],[x+dx,.005,z+dz],.011,.006,'#807e72','matte');
        x+=dx;z+=dz;dir+=(random()-.5)*1.4;
      }
    }
    crack(.5,-3.24,1.2,8);crack(3,3.78,2.6,8);crack(-4.1,3.78,4.4,5);
    const pitCenter=(left+right)/2;
    const pitEnd = boards + .40; // The hidden area beneath the planks ends inside the cutaway slab.
    box(left-.036,-1.0,(rear+pitEnd)/2,.075,2.03,pitEnd-rear,'#59645c','stone');
    box(right+.036,-1.0,(rear+pitEnd)/2,.075,2.03,pitEnd-rear,'#4c554e','stone');
    box(pitCenter,-1.01,pitEnd+.035,right-left,2.02,.075,'#555849','stone');
    box(pitCenter,-2.03,(pitEnd+rear)/2,right-left,.12,pitEnd-rear,'#333d37','stone');
    box(pitCenter,-1.22,rear-.042,right-left,1.49,.084,'#536058','stone');
    // The runner's existing climb passes directly over this inclined welded ladder.
    const ladderLeft=pitCenter-1.045, ladderRight=pitCenter+1.045;
    const climbY=z=>-1.76+(-1.36-z)*1.91/2.86;
    for(const x of [ladderLeft,ladderRight]){
      beam([x,-.074,rear-.045],[x,-1.99,-1.16],.085,.135,'#646e69');
      box(x,-.007,rear-.084,.155,.035,.205,'#777e75','metal');
      rod([x,.012,rear-.133],[x,.027,rear-.133],.031,'#a3a392','metal',6);
      box(x,-1.955,-1.17,.19,.031,.23,'#636b62','metal');
    }
    for(let i=0;i<9;i++){
      const z=rear+.20+i*.316, y=climbY(z)-.023;
      // Two level steel saddles are welded to the sloping stringers at each tread.
      for(const x of [ladderLeft,ladderRight]){
        box(x,y-.044,z,.096,.047,.268,'#758175','metal');
        box(x,y-.085,z+.037,.055,.095,.117,'#616d65','metal');
      }
      // Each tread is three individual bars. Its holes stay open all the way to the pit floor.
      for(const offset of [-.103,0,.103]){
        const barZ=z+offset;
        rod([ladderLeft-.026,y,barZ],[ladderRight+.026,y,barZ],.023,'#a1aa9d','metal',8);
        for(let j=1;j<14;j++){
          const x=ladderLeft+j*(ladderRight-ladderLeft)/14;
          rod([x-.008,y-.001,barZ-.003],[x+.008,y+.001,barZ+.003],.028,'#7c897e','metal',6);
        }
      }
    }
    // Angle iron and worn safety paint border the uncovered section.
    for(const x of [left-.05,right+.05]){
      box(x,.014,(rear+front)/2,.095,.031,front-rear+.12,'#595a4f','metal');
      for(let z=rear+.18;z<boards;z+=.41)box(x,.033,z,.081,.007,.21,'#d9a544','metal',0,0,0);
    }
    for(const z of [rear-.045,front+.045])box(pitCenter,.015,z,right-left+.16,.034,.084,iron,'metal');
    // Warm caged light mounted below the pit rim.
    box(left+.060,-.57,-1.34,.10,.24,.58,'#535b4e','metal');
    box(left+.118,-.56,-1.34,.03,.11,.42,'#ffbd69','glow');
    for(let i=0;i<5;i++) box(left+.14,-.56,-1.52+i*.095,.026,.15,.014,angle,'metal');
    const plankColors=['#ad946f','#bc9d71','#ae8b60','#c0a77e','#a99374','#bda179'];
    const count=13, span=(front-boards)/count;
    for(let i=0;i<count;i++){
      const z=boards+(i+.5)*span;
      const height=.058+(i%4)*.003;
      box(pitCenter,height-.076,z,right-left-.025,.152,span-.023,plankColors[(i*7)%6],'wood',0,(random()-.5)*.003);
      for(const x of [left+.16,right-.15]){
        rod([x,height+.001,z+.12],[x,height+.009,z+.12],.016,'#555b50','metal',6);
      }
      if(i%3===0)box(left+.41,height+.006,z-.10,.53,.003,.013,'#756851','wood',0,.037);
    }
    // Full-height cut walls with a teal oil-paint wainscot, cap stones and a dark skirting board.
    const wh=3.11;
    box(0,wh/2-.13,-5.71,10.25,wh+.26,.22,'#adbbb8','wall');
    box(-5.11,wh/2-.13,0,.22,wh+.26,11.4,'#a8b4b0','wall');
    box(0,.47,-5.583,10,.94,.039,'#678783','wall');
    box(-4.985,.47,0,.039,.94,11.2,'#65827c','wall');
    box(0,.965,-5.581,10,.040,.041,'#647c74','matte');
    box(-4.982,.965,0,.042,.040,11.2,'#637970','matte');
    box(0,.076,-5.568,10,.15,.072,'#50655d','stone');
    box(-4.966,.076,0,.070,.15,11.2,'#53695f','stone');
    box(-.03,wh+.01,-5.71,10.34,.095,.27,'#bfc3b6','stone');
    box(-5.11,wh+.012,.05,.27,.095,11.36,'#c2c3b7','stone');
    // Small areas of chipped paint reveal plaster. Kept clustered at corners and bench height.
    for(const [wx,wz,wy,side] of [[-.5,-5.555,.98,0],[-4.96,1.3,.98,1],[-4.96,-3.4,.19,1],[2.7,-5.555,.41,0]]){
      for(let i=0;i<25;i++){
        const offset=(random()-.5)*.86, y=wy+(random()-.5)*.13;
        box(wx+(side?0:offset),y,wz+(side?offset:0),side?.003:.03+random()*.12,.009+random()*.041,side?.03+random()*.12:.003,'#a5aaa0','matte');
      }
    }
    // Old surface-mounted metal conduit. Parallel lines follow both walls around the corner.
    for(const y of [2.70,2.77]){
      rod([-4.93,y,-5.51],[4.85,y,-5.51],.018,iron);
      rod([-4.92,y,5.45],[-4.92,y,-5.51],.018,iron);
    }
    for(let x=-4.55;x<5;x+=1.14)box(x,2.736,-5.492,.043,.132,.038,'#7b8176','metal');
    for(let z=-4.82;z<5.62;z+=1.21)box(-4.897,2.736,z,.037,.132,.043,'#7b8176','metal');
    function lamp(cx,cz,leftWall) {
      if(leftWall){
        box(cx,2.39,cz,.11,.18,1.6,'#65736f','metal');
        for(const y of [2.35,2.43])rod([cx+.086,y,cz-.73],[cx+.086,y,cz+.73],.031,'#fff1cb','glow');
        for(const k of [-.76,.76])box(cx+.055,2.39,cz+k,.14,.19,.058,'#72796f','metal');
      }else{
        box(cx,2.39,cz,1.64,.18,.11,'#65736f','metal');
        for(const y of [2.35,2.43])rod([cx-.75,y,cz+.085],[cx+.75,y,cz+.085],.031,'#fff5d8','glow');
        for(const k of [-.78,.78])box(cx+k,2.39,cz+.055,.06,.19,.15,'#72796f','metal');
      }
    }
    lamp(.18,-5.493,false);lamp(-4.88,1.43,true);
    rod([1.45,2.66,-5.49],[1.45,.6,-5.49],.025,iron);
    box(1.45,2.69,-5.48,.16,.14,.12,'#737a6e','metal');
    box(1.45,1.34,-5.43,.64,.78,.22,'#506863','metal');
    box(1.45,1.35,-5.295,.55,.67,.045,'#849288','metal');
    box(1.45,1.49,-5.265,.29,.18,.025,recess,'metal');
    box(1.45,1.50,-5.244,.22,.105,.015,'#c1bba0');
    box(1.39,1.18,-5.252,.066,.12,.036,angle,'metal');
    for(let i=0;i<4;i++)box(1.55,1.13+i*.039,-5.265,.16,.012,.015,'#53655b','metal');
    // Safety print, a familiar graphic accent in Soviet workshops.
    decalCanvas('safety',384,512,(c)=>{
      c.fillStyle='#c3af83';c.fillRect(0,0,384,512);
      c.fillStyle='#efe0b2';c.fillRect(10,10,364,492);
      c.fillStyle='#a63d2c';c.fillRect(25,26,334,104);c.fillRect(25,393,334,84);
      c.textAlign='center';c.font='900 55px Arial';c.fillStyle='#fff0c3';c.fillText('БЕРЕГИ',192,98);
      c.font='900 56px Arial';c.fillText('РУКИ!',192,457);
      c.fillStyle='#53685e';c.beginPath();c.moveTo(55,362);c.lineTo(325,150);c.lineTo(339,177);c.lineTo(82,380);c.fill();
      c.save();c.translate(186,261);c.rotate(-.27);c.fillStyle='#ad442f';
      c.beginPath();c.roundRect(-45,-1,99,75,27);c.fill();
      [[-44,-48,18,77],[-20,-65,18,92],[4,-74,18,100],[28,-57,16,82],[45,-8,23,55]].forEach(([x,y,w,h])=>{c.beginPath();c.roundRect(x,y,w,h,10);c.fill();});
      c.fillRect(-30,57,62,39);c.restore();
      for(let i=0;i<180;i++){c.fillStyle='rgba(109,85,58,.1)';c.fillRect(random()*384,random()*512,random()*4+1,random()*3+1);}
    });
    box(-4.05,1.78,-5.55,.94,1.29,.06,'#756e58','wood');
    panel(-4.05,1.78,-5.51,.91,1.26,0,'safety');
    decalCanvas('grindingSign',768,240,(c)=>{
      c.fillStyle='#ede4ca';c.fillRect(0,0,768,240);
      c.strokeStyle='#573b31';c.lineWidth=8;c.strokeRect(8,8,752,224);
      c.fillStyle='#382f2b';c.textAlign='center';c.textBaseline='middle';
      c.font='900 88px Arial, sans-serif';
      c.fillText('ШЛИФОВОЧНАЯ',384,78,708);
      c.fillStyle='#a23425';c.beginPath();
      c.moveTo(367,135);c.lineTo(401,135);c.lineTo(401,163);
      c.lineTo(435,163);c.lineTo(384,215);c.lineTo(333,163);
      c.lineTo(367,163);c.closePath();c.fill();
      c.fillStyle='#685a4d';
      for(const x of [24,744])for(const y of [24,216]){
        c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();
      }
    });
    box(-2.27,1.86,-5.55,2.47,.82,.056,'#665d50','metal');
    panel(-2.27,1.86,-5.516,2.43,.78,0,'grindingSign');
    // Wall-mounted pegboard of spanners, saw and a hammer.
    box(.08,1.56,-5.55,2.03,.89,.08,'#485954','metal');
    box(.08,1.56,-5.495,1.93,.80,.037,'#837858','wood');
    for(let col=0;col<20;col++)for(let row=0;row<8;row++){
      box(-.824+col*.095,1.225+row*.092,-5.471,.021,.017,.005,'#514f43');
    }
    for(let j=0;j<4;j++){
      const x=-.64+j*.166, len=.24+j*.066;
      rod([x,1.82,-5.43],[x,1.82-len,-5.43],.023,'#b2b6a7');
      rod([x-.047,1.854,-5.43],[x-.027,1.797,-5.43],.024,'#b2b6a7');
      rod([x+.047,1.854,-5.43],[x+.027,1.797,-5.43],.024,'#b2b6a7');
      box(x,1.80,-5.429,.076,.043,.04,'#b2b6a7','metal');
    }
    beam([.21,1.31,-5.42],[.31,1.76,-5.42],.045,.044,timber,'wood');
    beam([.19,1.82,-5.42],[.43,1.75,-5.42],.081,.070,'#525b56');
    for(let i=0;i<2;i++){
      let x=.57+i*.145;
      rod([x,1.37,-5.42],[x,1.79,-5.42],.013,'#afb2a1');
      rod([x,1.34,-5.42],[x,1.49,-5.42],.032,i?'#b78344':'#a35a41');
    }
    function bench(cx,cz,w,d) {
      block(cx-w/2,cx+w/2,cz-d/2,cz+d/2);
      const top=.91;
      box(cx,top-.029,cz,w,.10,d,angle,'metal');
      for(let i=0;i<4;i++){
        const alongX=w>d,wBand=(alongX?d:w)-.092;
        const shift=-wBand/2+(i+.5)*wBand/4;
        box(cx+(alongX?0:shift),top+.021,cz+(alongX?shift:0),
          alongX?w-.09:wBand/4-.006,.042,alongX?wBand/4-.006:d-.09,
          ['#b69059','#bd965f','#b08b58','#c39d69'][i],'wood');
      }
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const x=cx+sx*(w/2-.064),z=cz+sz*(d/2-.064);
        box(x,.427,z,.058,.853,.057,angle,'metal');
        box(x,.026,z,.10,.05,.10,'#4b544c','metal');
        rod([x,top+.023,z],[x,top+.046,z],.014,'#81877a','metal',6);
      }
      for(const s of [-1,1]){
        box(cx,.29,cz+s*(d/2-.064),w-.09,.052,.041,angle,'metal');
        box(cx+s*(w/2-.064),.29,cz,.042,.052,d-.09,angle,'metal');
      }
      box(cx,.322,cz,w-.14,.035,d-.14,'#746849','wood');
    }
    bench(-4.49,2.44,.88,4.65);
    bench(-.03,-5.07,2.25,.83);
    bench(.84,5.01,2.68,.90);
    function can(x,y,z,r,h,color){
      rod([x,y,z],[x,y+h,z],r,color,'metal',12);
      rod([x,y+h-.012,z],[x,y+h+.013,z],r*1.055,'#a4a596','metal',12);
      rod([x,y+.011,z],[x,y+.029,z],r*1.035,'#a0a194','metal',12);
      if(h>.18)rod([x,y+h*.27,z],[x,y+h*.67,z],r*1.014,'#d2c6a1','matte',12);
    }
    can(-4.51,.952,.60,.118,.25,'#9b563c');can(-4.54,.952,.88,.096,.204,'#526e68');
    can(-.72,.952,-5.12,.093,.19,'#786d54');can(-.47,.952,-5.18,.10,.20,'#8b5640');
    // Red cast iron bench vise with jaws, a sliding spindle and spherical tips.
    function vise(x,y,z) {
      box(x,y+.035,z,.49,.07,.33,'#593f36','metal');
      rod([x,y+.04,z],[x,y+.122,z],.165,'#8e4537','metal',14);
      box(x,y+.176,z,.50,.16,.19,'#9b4938','metal');
      for(const off of [-.12,.11]){
        box(x+off,y+.256,z,.095,.20,.26,'#a6533e','metal');
        box(x+off,y+.363,z,.102,.045,.293,'#959b8c','metal');
      }
      rod([x+.20,y+.194,z],[x+.36,y+.194,z],.042,angle);
      rod([x+.355,y+.065,z-.058],[x+.355,y+.332,z+.062],.017,'#afb3a5');
      for(const [dy,dz] of [[.065,-.058],[.332,.062]])rod([x+.354,y+dy-.011,z+dz],[x+.354,y+dy+.011,z+dz],.031,iron);
    }
    vise(1.60,.95,5.04);vise(.54,.95,-4.99);
    box(.32,.958,5.06,.60,.025,.38,'#e0d5b1','matte',0,.22);
    box(.32,.972,5.06,.40,.003,.18,'#76928b','matte',0,.22);
    can(-.23,.946,4.98,.094,.14,'#7b8b76');
    // A small toolbox and pieces of cut timber occupy the long side bench.
    box(-4.47,1.055,2.98,.52,.20,.78,'#9c4e3d','metal');
    box(-4.47,1.172,2.98,.55,.054,.81,'#ae614a','metal');
    for(const z of [2.83,3.13])box(-4.47,1.226,z,.041,.09,.034,angle,'metal');
    box(-4.47,1.267,2.98,.047,.038,.33,angle,'metal');
    box(-4.41,.986,1.80,.28,.082,.94,'#c7a777','wood',0,.09);
    box(-4.49,1.11,1.73,.12,.178,.72,'#ceaf7e','wood',0,-.07);
    box(-4.51,.50,3.81,.50,.32,.63,'#947d59','wood');
    box(-4.51,.53,3.81,.512,.04,.635,'#ae936a','wood');
    // Tall veneered Soviet cupboard, facing the stair. The near face is the nailed fibreboard backing.
    const cabx=3.78,cabz=5.09,cw=1.45,cd=.77,cabH=2.28;
    const faceZ=cabz-cd/2,backZ=cabz+cd/2,caseColor='#9d613c';
    block(cabx-cw/2-.018,cabx+cw/2+.018,faceZ-.066,backZ+.028);
    box(cabx,.066,cabz,cw-.12,.132,cd-.085,'#674835','wood');
    box(cabx,cabH/2+.064,cabz,cw,cabH-.128,cd,caseColor,'wood');
    box(cabx,cabH-.014,cabz,cw+.036,.061,cd+.055,'#875634','wood');
    box(cabx,.151,cabz,cw+.023,.059,cd+.042,'#895938','wood');
    const doorW=(cw-.082)/2;
    for(const side of [-1,1]){
      const cx=cabx+side*(doorW/2+.006);
      box(cx,1.208,faceZ-.022,doorW,2.045,.043,side<0?'#af7249':'#a66c45','wood');
      // Shallow applied moulding edges the front panels.
      for(const edge of [-1,1]){
        box(cx+edge*(doorW/2-.046),1.208,faceZ-.045,.035,1.95,.014,'#97603e','wood');
        box(cx,1.208+edge*.963,faceZ-.045,doorW-.065,.029,.014,'#97603e','wood');
      }
      const handleX=cx-side*(doorW/2-.095);
      for(const y of [1.074,1.209]){
        rod([handleX,y,faceZ-.043],[handleX,y,faceZ-.099],.019,'#a28c65');
      }
      rod([handleX,1.067,faceZ-.100],[handleX,1.216,faceZ-.100],.021,'#51443a');
      for(const y of [.44,1.96])rod([cx+side*(doorW/2+.003),y,faceZ-.023],
        [cx+side*(doorW/2+.003),y+.086,faceZ-.023],.014,'#817963');
      box(cabx+side*(cw/4-.004),1.206,backZ+.008,cw/2-.029,2.033,.018,'#947552','wood');
    }
    box(cabx,1.204,backZ+.025,.048,2.052,.025,'#896a4b','wood');
    for(const side of [-1,1]){
      box(cabx+side*(cw/2-.021),1.205,backZ+.024,.036,2.079,.027,'#8c623f','wood');
      for(const y of [.25,.60,.96,1.32,1.68,2.12]){
        const nailX=cabx+side*(cw/2-.045);
        rod([nailX,y,backZ+.016],[nailX,y,backZ+.022],.010,'#5e5c4d','metal',6);
      }
    }
    // The far-right landing is one low step. The flight climbs towards the front cut edge.
    block(2.65,5,-5.6,-.05);
    const x0=2.79,x1=4.78,sx=(x0+x1)/2;
    const lowY=.18,rearEdge=-5.56,start=-3.58,landingDepth=start-rearEdge;
    box(sx,.074,(rearEdge+start)/2,2.22,.148,landingDepth,'#8c7456','wood');
    for(let i=0;i<6;i++){
      const z=rearEdge+landingDepth*(i+.5)/6;
      box(sx,lowY-.021,z,2.23,.042,landingDepth/6-.012,'#bfa175','wood');
    }
    const tread=.286,rise=.204,n=12,topY=lowY+n*rise,topZ=start+n*tread;
    for(let i=0;i<n;i++){
      const z=start+(i+.5)*tread,y=lowY+(i+1)*rise;
      box(sx,y-.049,z,x1-x0,.098,tread+.03,plankColors[(i+2)%6],'wood');
      box(sx,y-.10,z+tread*.5-.024,x1-x0-.045,.102,.048,'#917854','wood');
      for(const x of [x0+.11,x1-.11])rod([x,y+.001,z-.04],[x,y+.006,z-.04],.014,iron,'metal',6);
    }
    for(const x of [x0-.035,x1+.035]){
      beam([x,lowY+.004,start-.027],[x,topY-.065,topZ-.015],.125,.227,'#a18762','wood');
      for(const i of [0,5,11]){
        const z=start+(i+.5)*tread,y=lowY+(i+1)*rise;
        box(x,y+.32,z,.076,.90,.076,'#b99f77','wood');
      }
      beam([x,lowY+rise+.77,start+tread*.5],[x,topY+.77,topZ-tread*.5],.105,.095,'#c6a679','wood');
    }
    // Exposed timber portal and knee braces support the upper threshold in the cutaway.
    const supportZ=topZ-.065,postTop=topY-.242;
    box(sx,topY-.166,supportZ,x1-x0+.175,.158,.22,'#8f7451','wood');
    for(const side of [-1,1]){
      const x=sx+side*(x1-x0-.12)/2;
      box(x,postTop/2,supportZ,.124,postTop,.135,'#957b57','wood');
      box(x,.045,supportZ,.193,.09,.185,iron,'metal');
      beam([x,postTop-.58,supportZ],[x-side*.47,postTop+.028,supportZ],.085,.091,'#9d805b','wood');
      beam([x,postTop-1.15,supportZ],[x,topY-.64,supportZ-.66],.078,.089,'#9d805b','wood');
    }
    // Shadow at the foot of heavy machinery and benches remains visible on low-power renderers.
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');
    const gradient=ctx.createRadialGradient(32,32,3,32,32,31);
    gradient.addColorStop(0,'rgba(33,39,31,.65)');gradient.addColorStop(.6,'rgba(33,39,31,.38)');
    gradient.addColorStop(1,'rgba(33,39,31,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const shadowTex=new T.CanvasTexture(c);
    types.shadow=new T.MeshBasicMaterial({map:shadowTex,depthWrite:false,transparent:true,vertexColors:true});
    function stain(x,z,w,d) {
      add(quad,v(x,.009,z),v(w,d,1),new T.Quaternion().setFromAxisAngle(v(1,0,0),-Math.PI/2),'shadow','#ffffff');
    }
    stain(-4.48,2.40,1.16,5.03);stain(.84,4.97,3.11,1.20);stain(.02,-4.98,2.69,1.19);
    stain(3.78,-2.90,2.77,4.91);stain(cabx,cabz,cw+.32,cd+.3);
    stain(1.48,-2.20,.53,.83);stain(1.61,-2.38,.31,.23);
    for(const [type,data] of Object.entries(batches)){
      const geo=new T.BufferGeometry();
      for(const [attribute,values,sz] of [['position',data.p,3],['normal',data.n,3],['color',data.c,3],['uv',data.u,2]]){
        geo.setAttribute(attribute,new T.Float32BufferAttribute(values,sz));
      }
      geo.setIndex(data.i);geo.computeBoundingSphere();
      const mesh=new T.Mesh(geo,types[type]);mesh.name=types[type].name || type;
      mesh.castShadow=type!=='shadow' && type!=='glow';mesh.receiveShadow=type!=='shadow';
      group.add(mesh);
    }
    return group;
  };
})();
