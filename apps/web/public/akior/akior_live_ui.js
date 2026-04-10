
const panel = document.querySelector('.panel');
const bg = document.getElementById('bgCanvas');
const fx = document.getElementById('fxCanvas');
const ctxBg = bg.getContext('2d');
const ctxFx = fx.getContext('2d');
const DPR = Math.min(window.devicePixelRatio || 1, 2);

let width = 0, height = 0;
let particles = [], orbs = [], frontDust = [];
let t0 = performance.now();

function resize(){
  const rect = panel.getBoundingClientRect();
  width = rect.width; height = rect.height;
  [bg, fx].forEach(c=>{
    c.width = Math.floor(width * DPR);
    c.height = Math.floor(height * DPR);
    c.style.width = width + 'px';
    c.style.height = height + 'px';
  });
  ctxBg.setTransform(DPR,0,0,DPR,0,0);
  ctxFx.setTransform(DPR,0,0,DPR,0,0);
  seed();
}
function rnd(min,max){ return Math.random()*(max-min)+min; }
function seed(){
  particles = Array.from({length: 90}, () => ({
    x:rnd(0,width), y:rnd(0,height), r:rnd(.8,2.3), a:rnd(.12,.65), s:rnd(.02,.12)
  }));
  frontDust = Array.from({length: 26}, () => ({
    x:rnd(0,width), y:rnd(height*0.08,height*0.86), r:rnd(1.2,3.4), a:rnd(.12,.34), s:rnd(.03,.09)
  }));
  orbs = Array.from({length: 14}, (_,i)=>({
    x:rnd(0,width), y:rnd(height*0.14,height*0.8),
    r:rnd(34,82), a:rnd(.05,.14), vx:rnd(-.03,.03), vy:rnd(-.02,.02),
  }));
}
function glowCircle(ctx, x, y, r, alpha){
  const g = ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0, `rgba(140,251,255,${alpha})`);
  g.addColorStop(.35, `rgba(99,246,255,${alpha*.34})`);
  g.addColorStop(1, 'rgba(99,246,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}
function drawBg(now){
  const t = (now - t0) * 0.001;
  ctxBg.clearRect(0,0,width,height);
  // far bokeh
  for(const o of orbs){
    o.x += o.vx; o.y += o.vy;
    if(o.x < -100) o.x = width + 100;
    if(o.x > width + 100) o.x = -100;
    if(o.y < -100) o.y = height + 100;
    if(o.y > height + 100) o.y = -100;
    glowCircle(ctxBg, o.x, o.y, o.r, o.a * (0.8 + Math.sin(t + o.r)*0.08));
  }
  // background stars
  for(const p of particles){
    const a = p.a * (0.75 + 0.25*Math.sin(t*0.6 + p.x*0.01));
    ctxBg.fillStyle = `rgba(126,240,255,${a})`;
    ctxBg.beginPath(); ctxBg.arc(p.x, p.y, p.r, 0, Math.PI*2); ctxBg.fill();
  }
  // subtle vertical haze
  const haze = ctxBg.createLinearGradient(0,0,0,height);
  haze.addColorStop(0, 'rgba(99,246,255,0)');
  haze.addColorStop(.35, 'rgba(99,246,255,.025)');
  haze.addColorStop(.7, 'rgba(99,246,255,.012)');
  haze.addColorStop(1, 'rgba(99,246,255,0)');
  ctxBg.fillStyle = haze;
  for(let i=0;i<8;i++){
    const x = (i/7) * width;
    ctxBg.fillRect(x + Math.sin(t*0.14 + i)*20, 0, 1.5, height);
  }
}
function drawWave(now){
  const t = (now - t0) * 0.001;
  ctxFx.clearRect(0,0,width,height);
  const cy = height * 0.367;
  const centerX = width * 0.5;
  // waveform
  ctxFx.save();
  ctxFx.strokeStyle = 'rgba(140,251,255,.78)';
  ctxFx.lineWidth = 1;
  ctxFx.shadowBlur = 18;
  ctxFx.shadowColor = 'rgba(99,246,255,.45)';
  ctxFx.beginPath();
  for(let x=0;x<width;x+=3){
    const d = Math.abs((x-centerX)/(width*0.5));
    const envelope = Math.max(0, 1 - d*1.6);
    const y = cy + Math.sin(x*0.04 + t*3.2)*7*envelope + Math.sin(x*0.013 - t*2.1)*5*envelope;
    if(x===0) ctxFx.moveTo(x,y); else ctxFx.lineTo(x,y);
  }
  ctxFx.stroke();
  ctxFx.restore();

  // pulse bars near center
  ctxFx.save();
  for(let i=-110;i<=110;i+=6){
    const d = Math.abs(i)/110;
    const h = (1-d) * (26 + 16*Math.sin(t*3 + i*0.1)**2);
    const a = 0.05 + (1-d)*0.20;
    ctxFx.strokeStyle = `rgba(99,246,255,${a})`;
    ctxFx.lineWidth = 1;
    ctxFx.shadowBlur = 12;
    ctxFx.shadowColor = 'rgba(99,246,255,.55)';
    ctxFx.beginPath();
    ctxFx.moveTo(centerX+i, cy-h);
    ctxFx.lineTo(centerX+i, cy+h);
    ctxFx.stroke();
  }
  ctxFx.restore();

  // front drifting dust
  for(const p of frontDust){
    p.y -= p.s;
    if(p.y < -20){ p.y = height + 20; p.x = rnd(0,width); }
    ctxFx.fillStyle = `rgba(140,251,255,${p.a})`;
    ctxFx.beginPath(); ctxFx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctxFx.fill();
  }
}
function loop(now){
  drawBg(now);
  drawWave(now);
  requestAnimationFrame(loop);
}
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);
