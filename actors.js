/* Rigid coloured parts are baked once so each animated joint is one draw call. */
(() => {
  "use strict";
  const T = window.THREE;
  const material = new T.MeshStandardMaterial({
    vertexColors: true, roughness: 0.82, metalness: 0.06, flatShading: true
  });
  const block = new T.BoxGeometry(1, 1, 1);
  const bulb = new T.SphereGeometry(1, 10, 7);
  const lowBulb = new T.SphereGeometry(1, 7, 5);
  const tube = new T.CylinderGeometry(1, 1, 1, 10);
  const cone = new T.ConeGeometry(1, 1, 7);
  const palette = [
    {skin:0x92ad4f, cheeks:0x829441, ears:0xba8c65, vest:0x3c626c, sleeve:0xb17a44, cap:0xa85433},
    {skin:0x91b868, cheeks:0x748e4a, ears:0xc2996e, vest:0x775547, sleeve:0x648e87, cap:0x3b5b64},
    {skin:0xa3ac59, cheeks:0x848e44, ears:0xbf9063, vest:0x4a586d, sleeve:0x9e695f, cap:0xc28c45},
    {skin:0x87a858, cheeks:0x708b43, ears:0xae8b66, vest:0x72553f, sleeve:0xa79062, cap:0x5b6662}
  ];
  const geometryCache = new Map();
  const vec = (p) => new T.Vector3(...p);
  const axisY = new T.Vector3(0,1,0);
  const zero = [0,0,0];
  const one = [1,1,1];

  function part(key, build) {
    if (!geometryCache.has(key)) {
      const positions = [], normals = [], colors = [];
      const tmp = new T.Vector3(), tint = new T.Color();
      function add(source, color, position=zero, scale=one, rotation=zero) {
        const q = rotation.isQuaternion ? rotation : new T.Quaternion().setFromEuler(new T.Euler(...rotation));
        const m = new T.Matrix4().compose(vec(position),q,vec(scale));
        const n = new T.Matrix3().getNormalMatrix(m);
        const p = source.attributes.position, normal = source.attributes.normal;
        tint.setHex(color);
        const count = source.index ? source.index.count : p.count;
        for (let j=0;j<count;j++) {
          const i = source.index ? source.index.getX(j) : j;
          tmp.fromBufferAttribute(p,i).applyMatrix4(m);
          positions.push(tmp.x,tmp.y,tmp.z);
          tmp.fromBufferAttribute(normal,i).applyNormalMatrix(n);
          normals.push(tmp.x,tmp.y,tmp.z);
          colors.push(tint.r,tint.g,tint.b);
        }
      }
      function beam(a,b,r,color,style=tube) {
        const delta = vec(b).sub(vec(a));
        const length = delta.length();
        const mid = vec(a).lerp(vec(b),0.5);
        add(style,color,mid.toArray(),[r,length,r],
          new T.Quaternion().setFromUnitVectors(axisY,delta.normalize()));
      }
      // Orient each convex face outward, including mirrored ear profiles.
      function poly(vertices, faces) {
        const center = new T.Vector3();
        vertices.forEach(v=>center.add(vec(v)));
        center.divideScalar(vertices.length);
        const points = [];
        for (const [a,b,c,color] of faces) {
          const u=vec(vertices[a]), v=vec(vertices[b]), w=vec(vertices[c]);
          const outward = v.clone().sub(u).cross(w.clone().sub(u)).dot(u.clone().sub(center)) > 0;
          const tri = outward ? [a,b,c] : [a,c,b];
          const normal = vec(vertices[tri[1]]).sub(u).cross(vec(vertices[tri[2]]).sub(u)).normalize();
          tint.setHex(color);
          for (const idx of tri) {
            points.push(...vertices[idx]);
            normals.push(normal.x,normal.y,normal.z);
            colors.push(tint.r,tint.g,tint.b);
          }
        }
        positions.push(...points);
      }
      build(add,beam,poly);
      const geom = new T.BufferGeometry();
      geom.setAttribute("position",new T.Float32BufferAttribute(positions,3));
      geom.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
      geom.setAttribute("color",new T.Float32BufferAttribute(colors,3));
      geom.computeBoundingSphere();
      geometryCache.set(key,geom);
    }
    const mesh = new T.Mesh(geometryCache.get(key),material);
    // Moving characters use a contact shadow that follows their feet.
    mesh.castShadow = false;
    return mesh;
  }

  function at(parent, child, x, y, z) {
    parent.add(child);
    child.position.set(x,y,z);
    return child;
  }

  window.createGoblin = function(index=0) {
    const id=Math.abs(Math.floor(index))%palette.length;
    const p=palette[id], root=new T.Group(), rig=new T.Group();
    root.name="Гоблин "+(index+1);
    root.add(rig);
    const torso=part("torso"+id,(add,beam)=>{
      add(bulb,p.vest,[0,.395,-.015],[.167,.203,.122],[-.10,0,0]);
      add(bulb,p.sleeve,[0,.513,-.021],[.172,.13,.12]);
      // Bib, leather straps, two rivets and the canvas chest pocket.
      add(block,p.vest,[0,.467,.104],[.202,.164,.027],[-.09,0,0]);
      for (const s of [-1,1]) {
        beam([s*.069,.499,.12],[s*.108,.611,.048],.044,0x463d30,block);
        add(bulb,0xe5b55a,[s*.074,.517,.13],[.014,.014,.008]);
      }
      add(block,0x536062,[0,.443,.124],[.075,.056,.012]);
      add(tube,0x42392e,[0,.355,-.007],[.17,.047,.123]);
      add(block,0xbb9152,[.018,.355,.115],[.056,.037,.012]);
      add(block,0x453d30,[.018,.356,.123],[.029,.017,.008]);
      add(bulb,0x69503c,[-.139,.325,.042],[.046,.065,.047]);
      add(tube,p.skin,[0,.615,0],[.07,.106,.062]);
      add(bulb,p.cap,[0,.591,-.009],[.132,.066,.106]);
      // Stiff folded collar sticks out behind the head for the claw to pinch.
      beam([0,.587,-.07],[0,.647,-.232],.077,p.cap,block);
    });
    rig.add(torso);
    const head=part("head"+id,(add,beam,poly)=>{
      add(bulb,p.skin,[0,.080,0],[.209,.177,.16]);
      add(bulb,p.skin,[0,-.012,.059],[.146,.095,.118]);
      for (const s of [-1,1]) {
        const ear=[[.151,.15,-.008],[.38,.235,-.045],[.267,.055,-.008],
          [.185,.029,.013],[.237,.117,.035],[.225,.116,-.062]].map(([x,y,z])=>[s*x,y,z]);
        poly(ear,[[0,1,4,p.skin],[1,2,4,p.ears],[2,3,4,p.cheeks],[3,0,4,p.skin],
          [1,0,5,p.skin],[2,1,5,p.skin],[3,2,5,p.cheeks],[0,3,5,p.cheeks]]);
        add(lowBulb,p.cheeks,[s*.124,.028,.098],[.069,.052,.061]);
        add(bulb,0xf2d889,[s*.09,.094,.125],[.066,.042,.044],[0,s*.17,s*.18]);
        add(bulb,0x272017,[s*.087,.093,.163],[.024,.03,.012]);
        add(lowBulb,0xfff7c4,[s*.087+.007,.103,.173],[.008,.008,.005]);
        beam([s*.033,.125,.153],[s*.142,.166,.101],.031,0x405134,block);
      }
      add(lowBulb,p.skin,[.002,.056,.17],[.062,.064,.075],[-.32,0,0]);
      add(lowBulb,p.cheeks,[.006,.031,.211],[.067,.041,.054]);
      add(lowBulb,0x4b5432,[-.025,.024,.248],[.012,.007,.006]);
      add(lowBulb,0x4b5432,[.037,.023,.247],[.013,.008,.006]);
      add(bulb,0x44392c,[.012,-.017,.155],[.083,.018,.022],[0,0,.08]);
      for (const s of [-1,1]) add(cone,0xf4e2b4,[s*.064,-.001,.177],[.014,.043,.014],[0,0,-s*.15]);
      // The cap silhouettes alternate between a padded work cap and a knit beanie.
      if (id%2===0) {
        add(bulb,p.cap,[-.014,.191,-.029],[.196,.082,.142],[0,0,.12]);
        add(tube,0x514735,[0,.182,-.008],[.197,.026,.148],[0,0,-.055]);
        add(bulb,p.cap,[.01,.179,.118],[.143,.018,.088],[.10,.03,-.06]);
        add(bulb,p.cap,[-.03,.263,-.026],[.027,.016,.029]);
      } else {
        add(bulb,p.cap,[-.018,.185,-.018],[.19,.105,.147],[0,0,.15]);
        add(tube,p.cap,[0,.17,-.011],[.199,.045,.151],[0,0,.07]);
        for(let k=0;k<7;k++) {
          const a=(k-3)*.36;
          beam([.19*Math.sin(a),.151,.145*Math.cos(a)-.011],[.19*Math.sin(a),.18,.145*Math.cos(a)-.011],.004,0x5f5a4a);
        }
      }
      if(id===0 || id===3) add(tube,0xc79b51,[-.259,.080,.002],[.016,.039,.014],[0,0,-.27]);
    });
    at(rig,head,0,.713,.026);
    const arms=[],legs=[];
    for(const s of [-1,1]) {
      const arm=part("arm"+id+s,(add,beam)=>{
        beam([0,-.012,0],[s*.048,-.10,-.015],.058,p.sleeve);
        add(bulb,p.sleeve,[0,-.026,-.004],[.064,.065,.061]);
        beam([s*.048,-.096,-.015],[s*.08,-.19,.063],.043,p.skin);
        add(lowBulb,p.skin,[s*.08,-.19,.062],[.048,.05,.043]);
        add(lowBulb,p.cheeks,[s*.048,-.18,.082],[.021,.031,.022]);
      });
      arms.push(at(rig,arm,s*.157,.532,0));
      const leg=part("leg"+id+s,(add,beam)=>{
        beam([0,0,0],[s*.02,-.146,.021],.071,p.vest);
        add(bulb,p.vest,[s*.019,-.126,.012],[.071,.069,.068]);
        beam([s*.022,-.149,.016],[s*.021,-.232,-.014],.054,0x534534);
        add(bulb,0x493b2d,[s*.023,-.238,.031],[.073,.051,.113],[-.02,0,0]);
        add(block,0x393128,[s*.023,-.272,.041],[.13,.024,.172]);
        add(block,0x9b8558,[s*.023,-.219,.084],[.073,.014,.017]);
      });
      legs.push(at(rig,leg,s*.083,.285,-.007));
    }
    const phase=index*2.41;
    function animate(time,speed=1,state="run") {
      const held=state==="held", fall=state==="fall", emerge=state==="emerge";
      const strength=Math.min(1,Math.max(0,Number(speed)||0));
      const stride=Math.sin(time*(held?5.6:fall?10:9)+phase);
      const fidget=Math.sin(time*3.8+phase);
      rig.position.y=held||fall?0:Math.abs(stride)*.046*strength;
      rig.rotation.z=(held?.017:.035)*stride*(held?1:strength);
      head.rotation.y=.15*Math.sin(time*2.3+phase);
      head.rotation.z=(held?.067:.033)*fidget;
      head.rotation.x=held?-.23+.05*fidget:fall?-.16:.043*stride;
      for(let j=0;j<2;j++){
        const side=j?1:-1, step=side*stride;
        legs[j].rotation.x=held?.16+step*.26:fall?-.20+step*.73:step*(emerge?.8:.77)*strength;
        legs[j].rotation.z=held?side*(.16+.06*fidget):side*.06;
        arms[j].rotation.x=held?-.87-step*.34:fall?-1.40+.30*step:-step*.83*strength-.17;
        arms[j].rotation.z=side*(held?.41+.13*fidget:fall?1.08:.10);
      }
    }
    animate(0,0,"run");
    return {root,animate,collarHeight:.647,collarZ:-.232};
  };

  window.createOperatorCab=function(photo){
    const cab=new T.Group();
    cab.name='Кабина оператора на настенной каретке';
    const painted=new T.MeshStandardMaterial({color:0xc98f33,roughness:.69});
    const trim=new T.MeshStandardMaterial({color:0x393f39,roughness:.64});
    const steel=new T.MeshStandardMaterial({color:0x818477,metalness:.22,roughness:.66});
    const shell=new T.Group();
    shell.position.set(.12,.65,0);
    shell.rotation.set(-.67,1.04,0,'YXZ');
    cab.add(shell);

    // These cross sections form the cab body, the pressed lip and the inset glazing.
    const outline=[[-.66,-.52],[.54,-.52],[.78,-.32],[.78,.38],[.56,.63],[-.48,.63],[-.78,.41],[-.78,-.32]];
    function section(scale,depth,offsetY=0){
      return outline.map(([x,y])=>new T.Vector3(x*scale,y*scale+offsetY,depth));
    }
    function strip(a,b,material){
      const xyz=[];
      for(let i=0;i<a.length;i++){
        const j=(i+1)%a.length;
        for(const point of [a[i],a[j],b[j],a[i],b[j],b[i]])xyz.push(...point.toArray());
      }
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geo.computeVertexNormals();
      shell.add(new T.Mesh(geo,material));
    }
    function cap(vertices,material,withUV){
      const xyz=[],uv=[];
      for(let i=1;i<vertices.length-1;i++)for(const p of [vertices[0],vertices[i],vertices[i+1]]){
        xyz.push(...p.toArray());
        if(withUV)uv.push(.5+p.x/1.38,.50+(p.y-.10)/1.20);
      }
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
      if(withUV)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      geo.computeVertexNormals();shell.add(new T.Mesh(geo,material));
    }
    const rear=section(.82,-.48), shoulder=section(1,.19), rim=section(.97,.29);
    const seal=section(.86,.29,.035), glass=section(.805,.25,.052);
    strip(rear,shoulder,painted);strip(shoulder,rim,painted);strip(rim,seal,painted);strip(seal,glass,trim);
    cap([...rear].reverse(),trim,false);
    const glazing=document.createElement('canvas');
    glazing.width=glazing.height=192;
    const portrait=new T.CanvasTexture(glazing);
    portrait.colorSpace=T.SRGBColorSpace;portrait.anisotropy=2;
    function fitPhoto(){
      glazing.getContext('2d').drawImage(photo,0,0,192,192);
      portrait.needsUpdate=true;
    }
    if(photo.complete&&photo.naturalWidth)fitPhoto();
    else photo.addEventListener('load',fitPhoto,{once:true});
    cap(glass,new T.MeshBasicMaterial({map:portrait,toneMapped:false}),true);

    const cube=new T.BoxGeometry();
    function block(parent,x,y,z,w,h,d,mat){
      const m=new T.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);
    }
    block(cab,0,.04,0,1.02,.21,1.66,painted);
    block(cab,.07,.24,0,.68,.39,1.18,trim);
    const wheel=new T.CylinderGeometry(.17,.17,.16,12);
    for(const z of [-.59,.59]){
      const roller=new T.Mesh(wheel,steel);
      roller.rotation.z=Math.PI/2;roller.position.set(-.23,-.07,z);cab.add(roller);
    }
    for(const y of [-.19,-.035,.12])block(shell,.705,y,-.05,.065,.041,.34,trim);
    // The roof projects over the windshield as a shallow sun visor.
    block(shell,.02,.63,.205,1.08,.065,.29,painted);
    return cab;
  };

  window.createClaw=function() {
    const root=new T.Group();
    root.name="Подъёмная клешня";
    const hub=part("hoist",(add,beam)=>{
      const yellow=0xe4a833, dark=0x303a39, edge=0x596461, metal=0x9ba7a2;
      add(tube,dark,[0,.48,0],[.169,.078,.169]);
      add(tube,yellow,[0,.581,0],[.185,.154,.185]);
      add(tube,edge,[0,.672,0],[.13,.033,.13]);
      add(tube,dark,[0,.726,0],[.074,.086,.074]);
      for(let n=0;n<10;n++) {
        const a=2*Math.PI*n/10;
        add(block,dark,[.177*Math.sin(a),.585,.177*Math.cos(a)],[.066,.115,.011],[0,a,-.37]);
      }
      for(let n=0;n<3;n++) {
        const a=2*Math.PI*n/3;
        add(bulb,metal,[.108*Math.sin(a),.684,.108*Math.cos(a)],[.019,.011,.019]);
      }
      beam([0,.76,0],[0,1.59,0],.019,dark);
      for(let j=0;j<5;j++) add(tube,edge,[0,.786+j*.033,0],[.029,.016,.029]);
      add(block,yellow,[0,1.60,0],[.197,.103,.125]);
      add(tube,dark,[0,1.642,0],[.063,.135,.063],[0,0,Math.PI/2]);
    });
    root.add(hub);
    const arms=[];
    for(let i=0;i<3;i++){
      const axis=new T.Group();
      root.add(axis);
      axis.rotation.y=(i+.22)*2*Math.PI/3;
      const jaw=part("hoist-jaw",(add,beam)=>{
        const pin=0x343e3c, steel=0x7c8a86, tip=0xc2c6ac, yellow=0xd4962c;
        add(tube,pin,[0,0,0],[.061,.106,.061],[0,0,Math.PI/2]);
        beam([0,0,0],[0,-.166,.079],.088,yellow,block);
        add(tube,steel,[0,-.166,.079],[.054,.107,.054],[0,0,Math.PI/2]);
        add(tube,pin,[0,-.166,.079],[.027,.119,.027],[0,0,Math.PI/2]);
        beam([0,-.166,.079],[0,-.333,.029],.071,steel,block);
        beam([0,-.333,.029],[0,-.433,-.086],.054,tip,block);
        beam([0,-.433,-.086],[0,-.439,-.119],.041,pin,block);
      });
      arms.push(at(axis,jaw,0,.453,.121));
    }
    let amount=0, previous=null;
    function animate(time,closed) {
      const wanted=closed?1:0;
      const dt=previous===null?.016:Math.max(0,Math.min(.1,time-previous));
      previous=time;
      amount+=(wanted-amount)*(1-Math.exp(-18*dt));
      arms.forEach(j=>{j.rotation.x=-.48*(1-amount);});
    }
    animate(0,false);
    return {root,animate};
  };
})();
