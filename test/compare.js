const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
require(path.join(root,'src/classifier.js'));
require(path.join(root,'src/model.js'));
const C=globalThis.LDSClassifier;
const dir=process.argv[2]||'/tmp/ld';
const rows=[];
for(const f of fs.readdirSync(dir).filter(f=>f.startsWith('tp_')&&f.endsWith('.md'))){
  const t=fs.readFileSync(path.join(dir,f),'utf8');
  for(const p of t.split(/\n## post by /).slice(1)){
    const body=p.split('\n').slice(1).join(' ');
    const clean=body.replace(/!\[Image[^\]]*\]\([^)]*\)/g,'').replace(/\[[^\]]*\]\((https?:[^)]*)\)/g,'').replace(/\s+/g,' ').trim();
    if(clean.length<6||clean.startsWith('|')) continue;
    rows.push(clean);
  }
}
const hi=[];
for(const s of rows){const r=C.score(s),o=C.offensive(s); if(r.score>=12||o.p>=0.5) hi.push([r.score,+o.p.toFixed(2),s.slice(0,44)]);}
hi.sort((a,b)=>b[0]-a[0]);
console.log('总帖',rows.length,'报警',hi.length);
hi.slice(0,12).forEach(x=>console.log(x[0],x[1],x[2]));
const ps=rows.map(s=>C.offensive(s).p).sort((a,b)=>a-b);
console.log('LR p: 中位',ps[Math.floor(ps.length/2)].toFixed(3),'p90',ps[Math.floor(ps.length*0.9)].toFixed(3),'max',ps[ps.length-1].toFixed(3));
