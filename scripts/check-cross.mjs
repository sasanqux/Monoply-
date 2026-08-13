// 围绕中心渝中的折线环：解放碑(36,48)在环左侧中段(紧邻中心渝中半岛)
const SEGMENTS = [
  [36, 48], [36, 16], [64, 16], [64, 8], [92, 8], [92, 34], [84, 34], [84, 52],
  [92, 52], [92, 76], [64, 76], [36, 76], [36, 84], [12, 84], [12, 60], [20, 60],
  [20, 48], [28, 48], [36, 48],
]
const ASSIGN = [4,4,1,4,4,1,3,1,4,4,4,1,4,4,1,2,1,1]
function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function onSeg(a,b,p){return Math.min(a[0],b[0])<=p[0]&&p[0]<=Math.max(a[0],b[0])&&Math.min(a[1],b[1])<=p[1]&&p[1]<=Math.max(a[1],b[1])}
function intersect(s1,s2){const[a,b]=s1,[c,d]=s2;const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);if(o1*o2<0&&o3*o4<0)return true;return(o1===0&&onSeg(a,b,c))||(o2===0&&onSeg(a,b,d))||(o3===0&&onSeg(c,d,a))||(o4===0&&onSeg(c,d,b))}
let cross=0
for(let i=0;i<SEGMENTS.length-1;i++)for(let j=i+2;j<SEGMENTS.length-1;j++){
  if(i===0&&j===SEGMENTS.length-2)continue
  if(intersect([SEGMENTS[i],SEGMENTS[i+1]],[SEGMENTS[j],SEGMENTS[j+1]])){cross++;console.log(`交叉 段${i}×段${j}`)}
}
console.log(cross===0?'✓ 无自交':`✗ ${cross} 处交叉`)
const tileStart=[0];for(let i=0;i<ASSIGN.length;i++)tileStart.push(tileStart[i]+ASSIGN[i])
const N=tileStart[tileStart.length-1]
const pts=[]
for(let id=1;id<=N;id++){
  let si=0;for(let j=0;j<ASSIGN.length;j++){if(tileStart[j+1]>=id){si=j;break}}
  if(ASSIGN[si]===0){si--;while(ASSIGN[si]===0)si--}
  const k=id-1-tileStart[si]
  const t=(k+1)/(ASSIGN[si]+1)
  const a=SEGMENTS[si],b=SEGMENTS[si+1]
  pts.push({id,x:+(a[0]+(b[0]-a[0])*t).toFixed(1),y:+(a[1]+(b[1]-a[1])*t).toFixed(1)})
}
let minGap=99,minPair=''
for(let i=0;i<N;i++){const a=pts[i],b=pts[(i+1)%N];const d=Math.hypot((a.x-b.x)*0.9,a.y-b.y);if(d<minGap){minGap=d;minPair=`${a.id}→${b.id}`}}
console.log('总格数', N, '间距min', minGap.toFixed(1), `(${minPair})`)
console.log('解放碑(1):', JSON.stringify(pts[0]))
console.log('x', Math.min(...pts.map(p=>p.x)).toFixed(1),'-',Math.max(...pts.map(p=>p.x)).toFixed(1),'y', Math.min(...pts.map(p=>p.y)).toFixed(1),'-',Math.max(...pts.map(p=>p.y)).toFixed(1))
