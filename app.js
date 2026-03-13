(function(){
  let ENDPOINT_URL = null;
  fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
    if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
  });

  // --- navegação entre etapas ---
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

  const form=document.getElementById('cadastro-form'); if(!form) return;

  // --- helpers ---
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

  // --- dados condicionais já existentes ---
  const outroEmprego=form.querySelector('[name=outroEmprego]');
  const cnpjWrapper=document.getElementById('cnpjEmpresaWrapper');
  if(outroEmprego){
    outroEmprego.addEventListener('change', e=>{
      const show=(e.target.value==='sim');
      toggleWrapper(cnpjWrapper, show, show);
    });
    toggleWrapper(cnpjWrapper, (outroEmprego.value==='sim'), (outroEmprego.value==='sim'));
  }

  const aposentado=form.querySelector('[name=aposentado]');
  const aposentWrapper=document.getElementById('dataAposentadoriaWrapper');
  if(aposentado){
    aposentado.addEventListener('change', e=>{
      const show=(e.target.value==='sim');
      toggleWrapper(aposentWrapper, show, show);
    });
    toggleWrapper(aposentWrapper, (aposentado.value==='sim'), (aposentado.value==='sim'));
  }

  const temParente=form.querySelector('[name=temParenteSnd]');
  const parentescoWrapper=document.getElementById('parentescoWrapper');
  if(temParente){
    temParente.addEventListener('change', e=>{
      const show=(e.target.value==='sim');
      toggleWrapper(parentescoWrapper, show, show);
    });
    toggleWrapper(parentescoWrapper, (temParente.value==='sim'), (temParente.value==='sim'));
  }

  const estadoCivil=form.querySelector('[name=estadoCivil]');
  const conjugeWrapper=document.getElementById('conjugeWrapper');
  function onEstadoCivilChange(){
    const v=(estadoCivil?.value||'').toLowerCase();
    const precisaConjuge=(v.includes('casado')||v.includes('união'));
    toggleWrapper(conjugeWrapper, precisaConjuge, true);
  }
  if(estadoCivil){ estadoCivil.addEventListener('change', onEstadoCivilChange); onEstadoCivilChange(); }

  const ctpsNumero=form.querySelector('[name=ctpsNumero]');
  const ctpsSerieWrapper=document.getElementById('ctpsSerieWrapper');
  function onCtpsNumeroInput(){
    const hasNum=!!(ctpsNumero && ctpsNumero.value.trim());
    toggleWrapper(ctpsSerieWrapper, hasNum, hasNum);
  }
  if(ctpsNumero){ ctpsNumero.addEventListener('input', onCtpsNumeroInput); onCtpsNumeroInput(); }

  const registroProf=form.querySelector('[name=registroProfissional]');
  const regProfOrgaoUfWrapper=document.getElementById('regProfOrgaoUfWrapper');
  const regProfDataWrapper=document.getElementById('regProfDataWrapper');
  function onRegProfChange(){
    const hasReg=!!(registroProf && registroProf.value.trim());
    toggleWrapper(regProfOrgaoUfWrapper, hasReg, hasReg);
    toggleWrapper(regProfDataWrapper, hasReg, hasReg);
  }
  if(registroProf){ registroProf.addEventListener('input', onRegProfChange); onRegProfChange(); }

  // --- controles de documentos (ramificações) ---
  const selects = {
    reservistaTem: form.querySelector('[name=reservistaTem]'),
    pisTem:        form.querySelector('[name=pisTem]'),
    casadoDoc:     form.querySelector('[name=casadoDoc]'),
    filhosTem:     form.querySelector('[name=filhosTem]'),
    empregoAnteriorTem: form.querySelector('[name=empregoAnteriorTem]'),
    contaItauTem:  form.querySelector('[name=contaItauTem]'),
    regProfCarteiraTem: form.querySelector('[name=regProfCarteiraTem]')
  };
  const wrappers = {
    up_reservista_wrapper: document.getElementById('up_reservista_wrapper'),
    up_pis_wrapper:        document.getElementById('up_pis_wrapper'),
    up_cert_casamento_wrapper: document.getElementById('up_cert_casamento_wrapper'),
    up_cpf_conjuge_wrapper:    document.getElementById('up_cpf_conjuge_wrapper'),
    up_certidao_filhos_wrapper: document.getElementById('up_certidao_filhos_wrapper'),
    up_cpf_filhos_wrapper:      document.getElementById('up_cpf_filhos_wrapper'),
    up_carta_referencia_wrapper: document.getElementById('up_carta_referencia_wrapper'),
    up_carteira_regprof_wrapper: document.getElementById('up_carteira_regprof_wrapper')
  };
  function updateUploadsUI(){
    toggleWrapper(wrappers.up_reservista_wrapper, (selects.reservistaTem?.value==='sim'), true);
    toggleWrapper(wrappers.up_pis_wrapper,        (selects.pisTem?.value==='sim'),        true);
    toggleWrapper(wrappers.up_cert_casamento_wrapper, (selects.casadoDoc?.value==='sim'), true);
    toggleWrapper(wrappers.up_cpf_conjuge_wrapper,    (selects.casadoDoc?.value==='sim'), true);
    toggleWrapper(wrappers.up_certidao_filhos_wrapper,(selects.filhosTem?.value==='sim'), true);
    toggleWrapper(wrappers.up_cpf_filhos_wrapper,     (selects.filhosTem?.value==='sim'), true);
    toggleWrapper(wrappers.up_carta_referencia_wrapper,(selects.empregoAnteriorTem?.value==='sim'), true);
    toggleWrapper(wrappers.up_carteira_regprof_wrapper,(selects.regProfCarteiraTem?.value==='sim'), true);
  }
  Object.values(selects).forEach(sel=>{ if(sel) sel.addEventListener('change', updateUploadsUI); });
  updateUploadsUI();

  // --- mapa dos uploads (id, rótulo e regras) ---
  const uploadMap = [
    { id:'up_ctps',             label:'CTPS',                       required: ()=>true, max:1 },
    { id:'up_rg',               label:'RG',                         required: ()=>true, max:2 },
    { id:'up_cpf',              label:'CPF',                        required: ()=>true, max:1 },
    { id:'up_reservista',       label:'Certificado_Reservista',     required: ()=>selects.reservistaTem?.value==='sim', max:1, wrapperId:'up_reservista_wrapper' },
    { id:'up_titulo',           label:'Titulo_Eleitor',             required: ()=>true, max:1 },
    { id:'up_pis',              label:'PIS',                        required: ()=>selects.pisTem?.value==='sim',        max:1, wrapperId:'up_pis_wrapper' },
    { id:'up_comprov_resid',    label:'Comprovante_Residencia',     required: ()=>true, max:1 },
    { id:'up_cert_casamento',   label:'Certidao_Casamento',         required: ()=>selects.casadoDoc?.value==='sim',     max:1, wrapperId:'up_cert_casamento_wrapper' },
    { id:'up_cpf_conjuge',      label:'CPF_Conjuge',                required: ()=>selects.casadoDoc?.value==='sim',     max:1, wrapperId:'up_cpf_conjuge_wrapper' },
    { id:'up_certidao_filhos',  label:'Certidao_Nascimento_Filho',  required: ()=>selects.filhosTem?.value==='sim',     max:10, wrapperId:'up_certidao_filhos_wrapper' },
    { id:'up_cpf_filhos',       label:'CPF_Filho',                  required: ()=>selects.filhosTem?.value==='sim',     max:10, wrapperId:'up_cpf_filhos_wrapper' },
    { id:'up_carta_referencia', label:'Carta_Referencia',           required: ()=>selects.empregoAnteriorTem?.value==='sim', max:1, wrapperId:'up_carta_referencia_wrapper' },
    { id:'up_diploma',          label:'Diploma_Escolaridade',       required: ()=>true, max:1 },
    { id:'up_dados_conta',      label:'Dados_Conta_Bancaria',       required: ()=>true, max:1 },
    { id:'up_carteira_regprof', label:'Carteira_Registro_Prof',     required: ()=>selects.regProfCarteiraTem?.value==='sim', max:1, wrapperId:'up_carteira_regprof_wrapper' }
  ];

  // --- assinatura ---
  const canvas=document.getElementById('signature');
  const ctx=canvas?canvas.getContext('2d'):null;
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
    document.getElementById('limparAssinatura')?.addEventListener('click',()=>{ ctx.clearRect(0,0,canvas.width,canvas.height); emptySignature=true; });
  }

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

  // --- SUBMIT ---
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const out=document.getElementById('resultado'); out.textContent='';

    if(!document.getElementById('consentimento').checked){ out.textContent='Você deve ler e concordar com a declaração.'; return; }
    if(canvas && emptySignature){ out.textContent='Por favor, assine no campo de assinatura.'; return; }
    if(!ENDPOINT_URL){ out.textContent='Erro: config.json não encontrado ou endpointUrl ausente.'; return; }

    // 1) valida uploads e empacota anexos
    const anexos=[];
    for(const item of uploadMap){
      const input=document.getElementById(item.id);
      if(!input) continue;

      const files=input.files;
      const isRequired=item.required();
      const max=parseInt(input.dataset.max||item.max||1,10);

      if(item.wrapperId){
        const w=document.getElementById(item.wrapperId);
        toggleWrapper(w, isRequired, isRequired);
      }

      if(isRequired && (!files || files.length===0)){
        out.textContent=`Anexe o documento obrigatório: ${item.label}.`; input.focus(); return;
      }
      if(files && files.length>max){
        out.textContent=`O documento "${item.label}" permite no máximo ${max} arquivo(s).`; input.focus(); return;
      }

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

    // 2) coleta/sanitiza dados
    const dados=Object.fromEntries(new FormData(form).entries());
    // checklist "neutro" apenas p/ compatibilidade de schema (não usado p/ validar)
    dados.checklist = { rg:false, cpf:false, comprovEndereco:false, carteiraTrabalho:false, certidao:false, comprovEscolaridade:false };

    dados.cpf=onlyDigits(dados.cpf);
    dados.cep=onlyDigits(dados.cep);
    dados.pis=onlyDigits(dados.pis);
    dados.ctpsNumero=onlyDigits(dados.ctpsNumero);
    dados.ctpsSerie=onlyDigits(dados.ctpsSerie);
    dados.telFixo=onlyDigits(dados.telFixo);
    dados.telCel=onlyDigits(dados.telCel);
    if(dados.cnpjEmpresa) dados.cnpjEmpresa=onlyDigits(dados.cnpjEmpresa);

    // 3) assinatura
    let assinaturaBase64=''; if(canvas){ assinaturaBase64=canvas.toDataURL('image/png').split(',')[1]; }

    const payload={
      metadata:{fonte:'form-web-snd',versao:'2.6.0',enviadoEm:new Date().toISOString()},
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

    const btn=document.getElementById('enviar'); btn.disabled=true; btn.textContent='Enviando…';
    try{
      const resp=await fetch(ENDPOINT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      out.textContent = resp.ok ? 'Cadastro enviado com sucesso. Obrigado!' : 'Falha ao enviar.';
      if(resp.ok) form.reset();
    }catch(e){ console.error(e); out.textContent='Erro de rede.'; }
    finally{ btn.disabled=false; btn.textContent='Enviar cadastro'; updateStep(0); }
  });

  updateStep(0);
})();
