(function(){
  let ENDPOINT_URL = null;
  // Lê a URL do Flow (gatilho HTTP) do config.json
  fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
    if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
  });

  // --------- navegação entre etapas ----------
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepsHeader = Array.from(document.querySelectorAll('#steps li'));
  let current = 0;
  function updateStep(i){
    steps.forEach((s,idx)=>s.classList.toggle('hidden', idx!==i));
    stepsHeader.forEach((li,idx)=>li.classList.toggle('active', idx===i));
    current=i;
  }
  document.querySelectorAll('.next').forEach(btn=>btn.addEventListener('click',()=>{
    const sec=steps[current];
    const req=sec.querySelectorAll('[required]');
    for(const el of req){ if(!el.checkValidity()){ el.reportValidity(); return; } }
    updateStep(Math.min(current+1, steps.length-1));
  }));
  document.querySelectorAll('.prev').forEach(btn=>btn.addEventListener('click',()=>updateStep(Math.max(current-1,0))));

  const form=document.getElementById('cadastro-form');
  if(!form) return;

  // --------- helpers ----------
  const q = sel => form.querySelector(sel);
  const gid = id => document.getElementById(id);
  const onlyDigits=v=>(v||'').replace(/\D+/g,'');
  function setRequiredIn(wrapperEl, on){
    if(!wrapperEl) return;
    wrapperEl.querySelectorAll('input, select, textarea').forEach(el=>{
      if(on) el.setAttribute('required','required'); else el.removeAttribute('required');
    });
  }
  function toggleWrapper(wrapperEl, show, makeRequired=false){
    if(!wrapperEl) return;
    wrapperEl.classList.toggle('hidden', !show);
    setRequiredIn(wrapperEl, show && makeRequired);
  }

  // --------- ramificações de dados (Tela 1/2/3) ----------
  const estadoCivil=q('[name=estadoCivil]'); const conjugeWrapper=gid('conjugeWrapper');
  function onEstadoCivil(){ const v=(estadoCivil?.value||'').toLowerCase(); toggleWrapper(conjugeWrapper, v.includes('casado')||v.includes('união'), true); }
  if(estadoCivil){ estadoCivil.addEventListener('change', onEstadoCivil); onEstadoCivil(); }

  // Outro emprego
  const outroEmprego=q('[name=outroEmprego]'); const cnpjWrapper=gid('cnpjEmpresaWrapper');
  function onOutroEmprego(){ const show=(outroEmprego?.value==='sim'); toggleWrapper(cnpjWrapper, show, show); }
  if(outroEmprego){ outroEmprego.addEventListener('change', onOutroEmprego); onOutroEmprego(); }

  // Aposentadoria
  const aposentado=q('[name=aposentado]'); const aposentWrapper=gid('dataAposentadoriaWrapper');
  function onAposent(){ const show=(aposentado?.value==='sim'); toggleWrapper(aposentWrapper, show, show); }
  if(aposentado){ aposentado.addEventListener('change', onAposent); onAposent(); }

  // Parente
  const temParente=q('[name=temParenteSnd]'); const parentescoWrapper=gid('parentescoWrapper');
  function onParente(){ const show=(temParente?.value==='sim'); toggleWrapper(parentescoWrapper, show, show); }
  if(temParente){ temParente.addEventListener('change', onParente); onParente(); }

  // Sexo / Reservista (dados + upload condicional)
  const sexo=q('[name=sexoBiologico]');
  const reservistaPerguntaWrapper=gid('reservistaPerguntaWrapper');
  const reservistaCodigoWrapper=gid('reservistaCodigoWrapper');
  const dispensaMotivoWrapper=gid('dispensaMotivoWrapper');
  const reservistaTem=q('[name=reservistaTem]');
  function updateReservista(){
    const isMasc=(sexo?.value||'').toLowerCase()==='masculino';
    toggleWrapper(reservistaPerguntaWrapper, isMasc, isMasc);
    const tem=(reservistaTem?.value||'nao');
    const precisaDados = isMasc && (tem==='sim');
    toggleWrapper(reservistaCodigoWrapper, precisaDados, precisaDados);
    toggleWrapper(dispensaMotivoWrapper, precisaDados, precisaDados);
    // upload do certificado fica visível para Masculino; obrigatório só se tem=sim (feito no mapa)
    toggleWrapper(gid('reservistaUploadWrapper'), isMasc, false);
  }
  if(sexo){ sexo.addEventListener('change', updateReservista); }
  if(reservistaTem){ reservistaTem.addEventListener('change', updateReservista); }
  updateReservista();

  // PIS (texto) obrigatório com instrução
  const pisInput=q('[name=pis]');
  if(pisInput){
    pisInput.addEventListener('blur', ()=>{
      if(!pisInput.value.trim()){
        pisInput.setCustomValidity('Campo obrigatório. Se não possuir, digite: NAO POSSUI.');
      }else{
        pisInput.setCustomValidity('');
      }
    });
  }

  // CTPS (TIPO): Físico => obriga Nº e Série; Digital => oculta e desobriga
  const ctpsTipo=q('[name=ctpsTipo]');
  const ctpsNumeroWrapper=gid('ctpsNumeroWrapper');
  const ctpsSerieWrapper=gid('ctpsSerieWrapper');
  function onCtpsTipo(){
    const fisico=(ctpsTipo?.value||'').toLowerCase()==='físico' || (ctpsTipo?.value||'').toLowerCase()==='fisico';
    toggleWrapper(ctpsNumeroWrapper, fisico, fisico);
    toggleWrapper(ctpsSerieWrapper, fisico, fisico);
  }
  if(ctpsTipo){ ctpsTipo.addEventListener('change', onCtpsTipo); onCtpsTipo(); }

  // Registro Profissional (nº) ramifica Órgão/UF e Data
  const regProfTem=q('[name=regProfTem]');
  const regNumWrapper=gid('regProfNumeroWrapper');
  const regOrgaoWrapper=gid('regProfOrgaoUfWrapper');
  const regDataWrapper=gid('regProfDataWrapper');
  function onRegProf(){
    const tem=(regProfTem?.value==='sim');
    toggleWrapper(regNumWrapper, tem, tem);
    const regNum=q('[name=registroProfissional]')?.value?.trim();
    const filled = !!regNum;
    toggleWrapper(regOrgaoWrapper, tem && filled, tem && filled);
    toggleWrapper(regDataWrapper, tem && filled, tem && filled);
  }
  if(regProfTem){ regProfTem.addEventListener('change', onRegProf); }
  q('[name=registroProfissional]')?.addEventListener('input', onRegProf);
  onRegProf();

  // Itaú (61/62): se SIM => Agência/Conta + upload obrigatório
  const contaItauTem=q('[name=contaItauTem]');
  const itauDadosWrapper=gid('itauDadosWrapper');
  const up_dados_conta_wrapper=gid('up_dados_conta_wrapper');
  function onItau(){
    const sim=(contaItauTem?.value==='sim');
    toggleWrapper(itauDadosWrapper, sim, sim);
    toggleWrapper(up_dados_conta_wrapper, sim, sim);
  }
  if(contaItauTem){ contaItauTem.addEventListener('change', onItau); onItau(); }

  // --------- uploads (validação + empacotamento) ----------
  // Observação: apenas PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/JPG/JPEG/PNG (sem áudio/vídeo)
  const uploadMap = [
    // sempre obrigatórios
    { id:'up_ctps',            label:'CTPS',                      required:()=>true, max:1 },
    { id:'up_rg',              label:'RG',                        required:()=>true, max:2 },
    { id:'up_cpf',             label:'CPF',                       required:()=>true, max:1 },
    { id:'up_titulo',          label:'Titulo_Eleitor',            required:()=>true, max:1 },
    { id:'up_comprov_resid',   label:'Comprovante_Residencia',    required:()=>true, max:1 },
    { id:'up_diploma',         label:'Diploma_Escolaridade',      required:()=>true, max:1 },

    // Itaú: somente se SIM
    { id:'up_dados_conta',     label:'Dados_Conta_Bancaria',      required:()=> (contaItauTem?.value==='sim'), max:1, wrapperId:'up_dados_conta_wrapper' },

    // Reservista: obrigatório upload só se Sexo=Masculino & Possui=Sim
    { id:'up_reservista',
      label:'Certificado_Reservista',
      required:()=> ((q('[name=sexoBiologico]')?.value||'').toLowerCase()==='masculino' && (reservistaTem?.value||'nao')==='sim'),
      max:1, wrapperId:'reservistaUploadWrapper'
    },

    // PIS upload: somente se pisTem=sim
    { id:'up_pis',             label:'PIS',                       required:()=> (q('[name=pisTem]')?.value==='sim'), max:1, wrapperId:'up_pis_wrapper' },

    // Casado
    { id:'up_cert_casamento',  label:'Certidao_Casamento',        required:()=> (q('[name=casadoDoc]')?.value==='sim'), max:1, wrapperId:'up_cert_casamento_wrapper' },
    { id:'up_cpf_conjuge',     label:'CPF_Conjuge',               required:()=> (q('[name=casadoDoc]')?.value==='sim'), max:1, wrapperId:'up_cpf_conjuge_wrapper' },

    // Filhos
    { id:'up_certidao_filhos', label:'Certidao_Nascimento_Filho', required:()=> (q('[name=filhosTem]')?.value==='sim'), max:10, wrapperId:'up_certidao_filhos_wrapper' },
    { id:'up_cpf_filhos',      label:'CPF_Filho',                 required:()=> (q('[name=filhosTem]')?.value==='sim'), max:10, wrapperId:'up_cpf_filhos_wrapper' },

    // Emprego anterior
    { id:'up_carta_referencia',label:'Carta_Referencia',          required:()=> (q('[name=empregoAnteriorTem]')?.value==='sim'), max:1, wrapperId:'up_carta_referencia_wrapper' },

    // Carteira de Registro Profissional — opcional
    { id:'up_carteira_regprof',label:'Carteira_Registro_Prof',    required:()=>false, max:1 }
  ];

  async function fileToBase64(f){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>{
        const [meta,b64]=String(r.result).split(',');
        const mime=/data:(.*?);base64/.exec(meta)?.[1]||'application/octet-stream';
        resolve({fileName:f.name, contentType:mime, contentBase64:b64, size:f.size});
      };
      r.onerror=reject; r.readAsDataURL(f);
    });
  }

  // --------- assinatura ----------
  const canvas=gid('signature'); const ctx=canvas?canvas.getContext('2d'):null;
  let drawing=false,lastX=0,lastY=0, emptySignature=true;
  function pos(e){ const r=canvas.getBoundingClientRect(); const t=(e.touches?e.touches[0]:e);
    return {x:(t.clientX-r.left)*(canvas.width/r.width), y:(t.clientY-r.top)*(canvas.height/r.height)};
  }
  function start(e){ drawing=true; const p=pos(e); lastX=p.x; lastY=p.y; e.preventDefault(); }
  function move(e){ if(!drawing) return; const p=pos(e); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(p.x,p.y); ctx.stroke(); lastX=p.x; lastY=p.y; emptySignature=false; e.preventDefault(); }
  function end(){ drawing=false; }
  if(canvas){
    canvas.addEventListener('mousedown',start);
    canvas.addEventListener('mousemove',move);
    window.addEventListener('mouseup',end);
    canvas.addEventListener('touchstart',start,{passive:false});
    canvas.addEventListener('touchmove',move,{passive:false});
    canvas.addEventListener('touchend',end);
    gid('limparAssinatura')?.addEventListener('click',()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); emptySignature=true; });
  }

  // --------- SUBMIT ----------
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const out=gid('resultado'); out.textContent='';

    if(!gid('consentimento').checked){ out.textContent='Você deve ler e concordar com a declaração.'; return; }
    if(canvas && emptySignature){ out.textContent='Por favor, assine no campo de assinatura.'; return; }
    if(!ENDPOINT_URL){ out.textContent='Erro: config.json não encontrado ou endpointUrl ausente.'; return; }

    // Validação + empacotamento dos uploads
    const anexos=[];
    for(const item of uploadMap){
      const input=gid(item.id); if(!input) continue;
      const need=item.required();
      if(item.wrapperId){ toggleWrapper(gid(item.wrapperId), need || input.closest('#reservistaUploadWrapper')!==null ? true : need, need); }

      const files=input.files;
      const max=parseInt(input.dataset.max||item.max||1,10);

      if(need && (!files || files.length===0)){ out.textContent=`Anexe o documento obrigatório: ${item.label}.`; input.focus(); return; }
      if(files && files.length>max){ out.textContent=`O documento "${item.label}" permite no máximo ${max} arquivo(s).`; input.focus(); return; }

      if(files && files.length){
        let idx=1;
        for(const f of files){
          if(f.size>10*1024*1024){ out.textContent=`O arquivo ${f.name} excede 10 MB.`; return; }
          const b64=await fileToBase64(f);
          const ext=(f.name.split('.').pop()||'').toLowerCase();
          const safeName = ext ? `${item.label}${(files.length>1?`_${idx}`:'')}.${ext}` : `${item.label}${(files.length>1?`_${idx}`:'')}`;
          anexos.push({ fileName:safeName, contentType:b64.contentType||f.type||'application/octet-stream', contentBase64:b64.contentBase64, size:f.size });
          idx++;
        }
      }
    }

    // Coleta/sanitiza dados
    const dados=Object.fromEntries(new FormData(form).entries());
    dados.cpf=onlyDigits(dados.cpf);
    dados.cep=onlyDigits(dados.cep);
    dados.ctpsNumero=onlyDigits(dados.ctpsNumero);
    dados.ctpsSerie=onlyDigits(dados.ctpsSerie);
    dados.telCel=onlyDigits(dados.telCel);
    if(dados.telFixo) dados.telFixo=onlyDigits(dados.telFixo);
    if(dados.cnpjEmpresa) dados.cnpjEmpresa=onlyDigits(dados.cnpjEmpresa);

    // Checklist neutro (compatibilidade de schema, não usado para validar)
    dados.checklist = { rg:false, cpf:false, comprovEndereco:false, carteiraTrabalho:false, certidao:false, comprovEscolaridade:false };

    // Assinatura
    let assinaturaBase64=''; if(canvas){ assinaturaBase64=canvas.toDataURL('image/png').split(',')[1]; }

    const payload={
      metadata:{fonte:'form-web-snd',versao:'2.9.0',enviadoEm:new Date().toISOString()},
      dados,
      anexos,
      declaracao:{
        texto:`Declaramos para os devidos fins que as informações constantes desse formulário são fiéis a verdade e condizentes com a realidade dos fatos à época.
Declaro que todas as informações mencionadas nesse formulário foram extraídas dos meus documentos e são da minha inteira responsabilidade.
Além disso, fui informado que se houver qualquer alteração nos dados desta Declaração, a mesma deverá ser modificada junto ao Departamento Pessoal.
Por fim, fico ciente das responsabilidades pelas declarações prestada e firmo a presente.`,
        aceito:true,
        assinadoEm:new Date().toISOString(),
        assinatura:{fileName:'assinatura.png',contentType:'image/png',contentBase64:assinaturaBase64}
      }
    };

    const btn=gid('enviar'); btn.disabled=true; btn.textContent='Enviando…';
    try{
      const resp=await fetch(ENDPOINT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      out.textContent = resp.ok ? 'Cadastro enviado com sucesso. Obrigado!' : 'Falha ao enviar.';
      if(resp.ok) form.reset();
    }catch(e){ console.error(e); out.textContent='Erro de rede.'; }
    finally{ btn.disabled=false; btn.textContent='Enviar cadastro'; updateStep(0); }
  });

  updateStep(0);
})();
