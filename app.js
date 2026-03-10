
(function(){
  let ENDPOINT_URL = null;
  fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{ if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl; });
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepsHeader = Array.from(document.querySelectorAll('#steps li'));
  let current = 0;
  function updateStep(i){ steps.forEach((s,idx)=>s.classList.toggle('hidden', idx!==i)); stepsHeader.forEach((li,idx)=>li.classList.toggle('active', idx===i)); current=i; }
  document.querySelectorAll('.next').forEach(b=>b.addEventListener('click',()=>{ const sec=steps[current]; const req=sec.querySelectorAll('[required]'); for(const el of req){ if(!el.checkValidity()){ el.reportValidity(); return; } } updateStep(Math.min(current+1, steps.length-1)); }));
  document.querySelectorAll('.prev').forEach(b=>b.addEventListener('click',()=>updateStep(Math.max(current-1,0))));

  const form=document.getElementById('cadastro-form'); if(!form){return;} // só na página de cadastro
  const outroEmprego=form.querySelector('[name=outroEmprego]'); const cnpjWrapper=document.getElementById('cnpjEmpresaWrapper');
  const aposentado=form.querySelector('[name=aposentado]'); const aposentWrapper=document.getElementById('dataAposentadoriaWrapper');
  const temParente=form.querySelector('[name=temParenteSnd]'); const parentescoWrapper=document.getElementById('parentescoWrapper');
  if(outroEmprego) outroEmprego.addEventListener('change',e=> cnpjWrapper.classList.toggle('hidden', e.target.value!=='sim'));
  if(aposentado) aposentado.addEventListener('change',e=> aposentWrapper.classList.toggle('hidden', e.target.value!=='sim'));
  if(temParente) temParente.addEventListener('change',e=> parentescoWrapper.classList.toggle('hidden', e.target.value!=='sim'));

  // assinatura
  const canvas=document.getElementById('signature'); const ctx=canvas?canvas.getContext('2d'):null; let drawing=false,lastX=0,lastY=0, emptySignature=true;
  function pos(e){ const r=canvas.getBoundingClientRect(); const t=(e.touches?e.touches[0]:e); return {x:(t.clientX-r.left)*(canvas.width/r.width), y:(t.clientY-r.top)*(canvas.height/r.height)}; }
  function start(e){ drawing=true; const p=pos(e); lastX=p.x; lastY=p.y; e.preventDefault(); }
  function move(e){ if(!drawing) return; const p=pos(e); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.stroke(); lastX=p.x; lastY=p.y; emptySignature=false; e.preventDefault(); }
  function end(){ drawing=false; }
  if(canvas){ canvas.addEventListener('mousedown',start); canvas.addEventListener('mousemove',move); window.addEventListener('mouseup',end); canvas.addEventListener('touchstart',start,{passive:false}); canvas.addEventListener('touchmove',move,{passive:false}); canvas.addEventListener('touchend',end); document.getElementById('limparAssinatura').addEventListener('click',()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); emptySignature=true; }); }

  const onlyDigits=v=>(v||'').replace(/\D+/g,'');
  async function fileToBase64(f){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>{ const [meta,b64]=String(r.result).split(','); const mime=/data:(.*?);base64/.exec(meta)?.[1]||'application/octet-stream'; resolve({fileName:f.name, contentType:mime, contentBase64:b64, size:f.size}); }; r.onerror=reject; r.readAsDataURL(f); }); }

  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault(); const out=document.getElementById('resultado'); out.textContent='';
    if(!document.getElementById('consentimento').checked){ out.textContent='Você deve ler e concordar com a declaração.'; return; }
    if(canvas && emptySignature){ out.textContent='Por favor, assine no campo de assinatura.'; return; }
    if(!ENDPOINT_URL){ out.textContent='Configuração ausente: crie config.json com { "endpointUrl": "<sua URL>" }'; return; }

    const dados=Object.fromEntries(new FormData(form).entries());
    dados.cpf=onlyDigits(dados.cpf); dados.cep=onlyDigits(dados.cep); dados.pis=onlyDigits(dados.pis); dados.ctpsNumero=onlyDigits(dados.ctpsNumero); dados.ctpsSerie=onlyDigits(dados.ctpsSerie); dados.telFixo=onlyDigits(dados.telFixo); dados.telCel=onlyDigits(dados.telCel); if(dados.cnpjEmpresa) dados.cnpjEmpresa=onlyDigits(dados.cnpjEmpresa);

    const files=document.getElementById('anexos').files; const anexos=[]; for(const f of files){ if(f.size>10*1024*1024){ out.textContent=`O arquivo ${f.name} excede 10 MB.`; return; } anexos.push(await fileToBase64(f)); }
    let assinaturaBase64=''; if(canvas){ assinaturaBase64=canvas.toDataURL('image/png').split(',')[1]; }

    const payload={ metadata:{fonte:'form-web-snd',versao:'2.1.0',enviadoEm:new Date().toISOString()}, dados, anexos, declaracao:{ texto:`Declaramos para os devidos fins que as informações constantes desse formulário são fiéis a verdade e condizentes com a realidade dos fatos à época.
Declaro que todas as informações mencionadas nesse formulário foram extraídas dos meus documentos e são da minha inteira responsabilidade.
Além disso, fui informado que se houver qualquer alteração nos dados desta Declaração, a mesma deverá ser modificada junto ao Departamento Pessoal.
Por fim, fico ciente das responsabilidades pelas declarações prestada e firmo a presente.`, aceito:true, assinadoEm:new Date().toISOString(), assinatura:{fileName:'assinatura.png',contentType:'image/png',contentBase64:assinaturaBase64}} };

    const btn=document.getElementById('enviar'); btn.disabled=true; btn.textContent='Enviando…';
    try{ const resp=await fetch(ENDPOINT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const ok=resp.ok; out.textContent= ok? 'Cadastro enviado com sucesso.':'Falha ao enviar o cadastro.'; if(ok) form.reset(); }
    catch(e){ console.error(e); out.textContent='Erro de rede. Tente novamente.' }
    finally{ btn.disabled=false; btn.textContent='Enviar cadastro'; updateStep(0); }
  });

  updateStep(0);
})();
