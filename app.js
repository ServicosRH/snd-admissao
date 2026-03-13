(function(){
  let ENDPOINT_URL = null;
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

  const form=document.getElementById('cadastro-form'); if(!form) return;

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

  // --------- TELA 1: Estado civil -> cônjuge ----------
  const estadoCivil=q('[name=estadoCivil]'); const conjugeWrapper=gid('conjugeWrapper');
  function onEstadoCivil(){
    const v=(estadoCivil?.value||'').toLowerCase();
    toggleWrapper(conjugeWrapper, v.includes('casado')||v.includes('união'), true);
    // Upload de Certidão de Casamento: só quando Casado(a) (tratado mais abaixo)
  }
  if(estadoCivil){ estadoCivil.addEventListener('change', onEstadoCivil); onEstadoCivil(); }

  // --------- TELA 1: Filhos (dropdown) + Quantos? + linhas dinâmicas ----------
  const filhosTem=q('[name=filhosTem]');
  const qtdFilhosWrapper=gid('qtdFilhosWrapper');
  const filhosDetalhesWrapper=gid('filhosDetalhesWrapper');

  function renderFilhosDetalhes(qtd){
    filhosDetalhesWrapper.innerHTML = '';
    for(let i=1;i<=qtd;i++){
      const row = document.createElement('div');
      row.className = 'grid';
      row.innerHTML = `
        <label>Nome completo do Filho ${i}*<input name="filho_nome_${i}" type="text" required/></label>
        <label>Dt. Nascimento (Filho ${i})*<input name="filho_data_${i}" type="date" required/></label>
        <label>CPF (Filho ${i})*<input name="filho_cpf_${i}" type="text" inputmode="numeric" required/></label>
      `;
      filhosDetalhesWrapper.appendChild(row);
    }
  }
  function onFilhosChange(){
    const sim = (filhosTem?.value==='sim');
    toggleWrapper(qtdFilhosWrapper, sim, sim);
    toggleWrapper(filhosDetalhesWrapper, false, false);
    if(!sim) return;
    const qtdInput = q('[name=qtdFilhos]');
    const qtd = parseInt(qtdInput?.value||'0',10);
    if(qtd>0 && qtd<=10){
      toggleWrapper(filhosDetalhesWrapper, true, false);
      renderFilhosDetalhes(qtd);
    }
  }
  if(filhosTem){ filhosTem.addEventListener('change', onFilhosChange); }
  q('[name=qtdFilhos]')?.addEventListener('input', onFilhosChange);
  onFilhosChange();

  // --------- TELA 2: Outro Emprego / Aposentadoria / Parente ----------
  const outroEmprego=q('[name=outroEmprego]'); const cnpjWrapper=gid('cnpjEmpresaWrapper');
  function onOutroEmprego(){ const show=(outroEmprego?.value==='sim'); toggleWrapper(cnpjWrapper, show, show); }
  if(outroEmprego){ outroEmprego.addEventListener('change', onOutroEmprego); onOutroEmprego(); }

  const aposentado=q('[name=aposentado]'); const aposentWrapper=gid('dataAposentadoriaWrapper');
  function onAposent(){ const show=(aposentado?.value==='sim'); toggleWrapper(aposentWrapper, show, show); }
  if(aposentado){ aposentado.addEventListener('change', onAposent); onAposent(); }

  const temParente=q('[name=temParenteSnd]'); const parentescoWrapper=gid('parentescoWrapper');
  function onParente(){ const show=(temParente?.value==='sim'); toggleWrapper(parentescoWrapper, show, show); }
  if(temParente){ temParente.addEventListener('change', onParente); onParente(); }

  // --------- TELA 2: Sexo / Reservista (dados + upload condicional) ----------
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
    // Upload do certificado: visível p/ Masculino; obrigatório só quando tem=sim (no uploadMap)
    toggleWrapper(gid('reservistaUploadWrapper'), isMasc, false);
  }
  if(sexo){ sexo.addEventListener('change', updateReservista); }
  if(reservistaTem){ reservistaTem.addEventListener('change', updateReservista); }
  updateReservista();

  // --------- TELA 2: PIS (dropdown + número) ----------
  const possuiPis=q('[name=possuiPis]'); const pisNumeroWrapper=gid('pisNumeroWrapper');
  function onPis(){ const sim=(possuiPis?.value==='sim'); toggleWrapper(pisNumeroWrapper, sim, sim); }
  if(possuiPis){ possuiPis.addEventListener('change', onPis); onPis(); }

  // --------- TELA 2: CTPS (tipo) ----------
  const ctpsTipo=q('[name=ctpsTipo]');
  const ctpsNumeroWrapper=gid('ctpsNumeroWrapper');
  const ctpsSerieWrapper=gid('ctpsSerieWrapper');
  function onCtpsTipo(){
    const fisico=(ctpsTipo?.value||'').toLowerCase()==='físico' || (ctpsTipo?.value||'').toLowerCase()==='fisico';
    toggleWrapper(ctpsNumeroWrapper, fisico, fisico);
    toggleWrapper(ctpsSerieWrapper, fisico, fisico);
  }
  if(ctpsTipo){ ctpsTipo.addEventListener('change', onCtpsTipo); onCtpsTipo(); }

  // --------- TELA 2: Registro Profissional ----------
  const regProfTem=q('[name=regProfTem]');
  const regNumWrapper=gid('regProfNumeroWrapper');
  const regOrgaoWrapper=gid('regProfOrgaoUfWrapper');
  const regDataWrapper=gid('regProfDataWrapper');
  function onRegProf(){
    const tem=(regProfTem?.value==='sim');
    toggleWrapper(regNumWrapper, tem, tem);
    const regNum=q('[name=registroProfissional]')?.value?.trim();
    const filled=!!regNum;
    toggleWrapper(regOrgaoWrapper, tem && filled, tem && filled);
    toggleWrapper(regDataWrapper, tem && filled, tem && filled);
  }
  if(regProfTem){ regProfTem.addEventListener('change', onRegProf); }
  q('[name=registroProfissional]')?.addEventListener('input', onRegProf);
  onRegProf();

  // --------- UPLOADS: Itaú (61/62) ----------
  const contaItauTem=q('[name=contaItauTem]');
  const itauDadosWrapper=gid('itauDadosWrapper');
  const up_dados_conta_wrapper=gid('up_dados_conta_wrapper');
  function onItau(){
    const sim=(contaItauTem?.value==='sim');
    toggleWrapper(itauDadosWrapper, sim, sim);
    toggleWrapper(up_dados_conta_wrapper, sim, sim);
  }
  if(contaItauTem){ contaItauTem.addEventListener('change', onItau); onItau(); }

  // --------- UPLOADS: Condições extras (Casado, Filhos) ----------
  const up_cert_casamento_wrapper=gid('up_cert_casamento_wrapper');
  function syncCasadoUpload(){
    const isCasado=(estadoCivil?.value||'').toLowerCase().includes('casado');
    toggleWrapper(up_cert_casamento_wrapper, isCasado, isCasado);
  }
  if(estadoCivil){ estadoCivil.addEventListener('change', syncCasadoUpload); syncCasadoUpload(); }

  function syncFilhosUploads(){
    const sim=(filhosTem?.value==='sim');
    toggleWrapper(gid('up_certidao_filhos_wrapper'), sim, sim);
    toggleWrapper(gid('up_cpf_filhos_wrapper'), sim, sim);
  }
  if(filhosTem){ filhosTem.addEventListener('change', syncFilhosUploads); syncFilhosUploads(); }

  // --------- Uploads: mapa e validação ----------
  const uploadMap = [
    // Sempre obrigatórios
    { id:'up_ctps',            label:'CTPS',                      required:()=>true, max:1 },
    { id:'up_rg',              label:'RG',                        required:()=>true, max:2 },
    { id:'up_cpf',             label:'CPF',                       required:()=>true, max:1 },
    { id:'up_titulo',          label:'Titulo_Eleitor',            required:()=>true, max:1 },
    { id:'up_comprov_resid',   label:'Comprovante_Residencia',    required:()=>true, max:1 },
    { id:'up_diploma',         label:'Diploma_Escolaridade',      required:()=>true, max:1 },

    // Itaú (61/62)
    { id:'up_dados_conta',     label:'Dados_Conta_Bancaria',      required:()=> (contaItauTem?.value==='sim'), max:1, wrapperId:'up_dados_conta_wrapper' },

    // Reservista
    { id:'up_reservista',
      label:'Certificado_Reservista',
      required:()=> ((q('[name=sexoBiologico]')?.value||'').toLowerCase()==='masculino' && (q('[name=reservistaTem]')?.value||'nao')==='sim'),
      max:1, wrapperId:'reservistaUploadWrapper'
    },

    // PIS upload
    { id:'up_pis',             label:'PIS',                       required:()=> (q('[name=possuiPis]')?.value==='sim'), max:1, wrapperId:'up_pis_wrapper' },

    // Casado
    { id:'up_cert_casamento',  label:'Certidao_Casamento',        required:()=> ( (estadoCivil?.value||'').toLowerCase().includes('casado') ), max:1, wrapperId:'up_cert_casamento_wrapper' },

    // Filhos
    { id:'up_certidao_filhos', label:'Certidao_Nascimento_Filho', required:()=> (filhosTem?.value==='sim'), max:10, wrapperId:'up_certidao_filhos_wrapper' },
    { id:'up_cpf_filhos',      label:'CPF_Filho',                 required:()=> (filhosTem?.value==='sim'), max:10, wrapperId:'up_cpf_filhos_wrapper' },

    // Emprego anterior
    { id:'up_carta_referencia',label:'Carta_Referencia',          required:()=> (q('[name=empregoAnteriorTem]')?.value==='sim'), max:1, wrapperId:'up_carta_referencia_wrapper' },

    // Opcional
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

  // --------- Assinatura digital ----------
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

    // Validação especial: filhos detalhados
    if(filhosTem?.value==='sim'){
      const qtd = parseInt(q('[name=qtdFilhos]')?.value||'0',10);
      if(!(qtd>0)){ out.textContent='Informe a quantidade de filhos e preencha os dados.'; return; }
      for(let i=1;i<=qtd;i++){
        const n = q(`[name=filho_nome_${i}]`); const d = q(`[name=filho_data_${i}]`); const c = q(`[name=filho_cpf_${i}]`);
        if(!n?.value?.trim() || !d?.value || !c?.value?.trim()){ out.textContent=`Preencha os dados do Filho ${i}.`; return; }
      }
    }

    // UPLOADS: validação e empacotamento
    const anexos=[];
    for(const item of uploadMap){
      const input=gid(item.id); if(!input) continue;
      const files=input.files;
      const need=item.required();
      const max=parseInt(input.dataset.max||item.max||1,10);

      if(item.wrapperId){ /* UI já está sincronizada pelos listeners */ }

      if(need && (!files || files.length===0)){ out.textContent=`Anexe o documento obrigatório: ${item.label}.`; input.focus(); return; }
      if(files && files.length>max){ out.textContent=`O documento "${item.label}" permite no máximo ${max} arquivo(s).`; input.focus(); return; }

      if(files && files.length){
        let idx=1;
        for(const f of files){
          if(f.size>10*1024*1024){ out.textContent=`O arquivo ${f.name} excede 10 MB.`; return; }
          const ext=(f.name.split('.').pop()||'').toLowerCase();
          const allowed=['pdf','doc','docx','xls','xlsx','ppt','pptx','jpg','jpeg','png'];
          if(!allowed.includes(ext)){ out.textContent=`Tipo de arquivo não permitido: ${f.name}`; return; }
          const b64=await fileToBase64(f);
          const safeName = `${item.label}${(files.length>1?`_${idx}`:'')}.${ext}`;
          anexos.push({ fileName:safeName, contentType:b64.contentType||f.type||'application/octet-stream', contentBase64:b64.contentBase64, size:f.size });
          idx++;
        }
      }
    }

    // Coleta/sanitiza dados
    const dados=Object.fromEntries(new FormData(form).entries());

    // Normalizações
    dados.cpf=onlyDigits(dados.cpf);
    dados.cep=onlyDigits(dados.cep);
    dados.ctpsNumero=onlyDigits(dados.ctpsNumero);
    dados.ctpsSerie=onlyDigits(dados.ctpsSerie);
    dados.telCel=onlyDigits(dados.telCel);
    if(dados.contaCorrente) dados.contaCorrente=onlyDigits(dados.contaCorrente);
    if(dados.agencia) dados.agencia=onlyDigits(dados.agencia);
    if(dados.cnpjEmpresa) dados.cnpjEmpresa=onlyDigits(dados.cnpjEmpresa);
    if(dados.pisNumero) dados.pisNumero=onlyDigits(dados.pisNumero);

    // Monta estrutura de filhos (se houver)
    if(filhosTem?.value==='sim'){
      const qtd = parseInt(dados.qtdFilhos||'0',10);
      const filhos=[];
      for(let i=1;i<=qtd;i++){
        filhos.push({
          nome: q(`[name=filho_nome_${i}]`)?.value?.trim()||'',
          dataNascimento: q(`[name=filho_data_${i}]`)?.value||'',
          cpf: onlyDigits(q(`[name=filho_cpf_${i}]`)?.value||'')
        });
      }
      dados.filhos = filhos;
    }

    // “Checklist” neutro (compatibilidade)
    dados.checklist = { rg:false, cpf:false, comprovEndereco:false, carteiraTrabalho:false, certidao:false, comprovEscolaridade:false };

    // Assinatura
    const canvas=gid('signature'); let assinaturaBase64='';
    if(canvas){ assinaturaBase64 = canvas.toDataURL('image/png').split(',')[1]; }

    const payload={
      metadata:{fonte:'form-web-snd',versao:'3.0.0',enviadoEm:new Date().toISOString()},
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
