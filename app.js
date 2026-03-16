/* SND – Portal Admissional (app.js)
 - 5 telas principais do fluxo: Boas-vindas (0), Dados Pessoais (1),
   Documentação (2), Complementares (3), Uploads (4),
   Declaração & Assinatura (5).
 - Telas 6 e 7: Minha Área (Candidato) e Portal do Consultor (via atalhos).
 - Tela 8: Alterar Senha do Consultor (primeiro acesso).
 - Uploads opcionais (sem required no HTML).
 - Assinatura: canvas + upload de imagem (JPG/JPEG/PNG). Upload tem prioridade.
 - Integração com Flow (config.json): cadastro, consulta, upload adicional,
   login consultor, troca de senha, autocomplete, detalhe/progresso, notificação.
*/
let ENDPOINT_URL = null;
fetch('config.json')
  .then(r => r.ok ? r.json() : null)
  .then(cfg => {
    ENDPOINT_URL = cfg?.endpointUrl ??
                   cfg?.flowUrl ??
                   null;
  });

// ===== Elementos principais =====
const form          = document.getElementById('admissionForm');
const steps         = Array.from(document.querySelectorAll('.step-card'));
const timelineItems = Array.from(document.querySelectorAll('#timeline .step-nav-btn'));
const progressBar   = document.getElementById('progressBar');
const saveDraftBtn  = document.getElementById('saveDraftBtn');
const previewBtn    = document.getElementById('previewBtn');
const startFlowBtn  = document.getElementById('startFlowBtn');
const toast         = document.getElementById('toast');
const summaryDialog = document.getElementById('summaryDialog');
const summaryContent= document.getElementById('summaryContent');
const closeSummaryBtn = document.getElementById('closeSummaryBtn');
const successScreen = document.getElementById('successScreen');
const restartBtn    = document.getElementById('restartBtn');
const ALLOWED_EXT   = ['pdf','jpg','jpeg','png'];
let currentStep     = 0;

// ===== Utilidades =====
const q   = name => form.elements[name];
const gid = id   => document.getElementById(id);
const onlyDigits = v => (v ?? '').replace(/\D+/g,'');

function showToast(m){
  toast.textContent = m;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function isVisibleField(el){
  if (!el) return false;
  const card   = el.closest('.step-card');
  const hidden = el.closest('.hidden-by-rule');
  return card?.classList.contains('active') && !hidden && !el.disabled;
}

const debounce = (fn,ms) => {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
};

// ===== Navegação interna por tela =====
function bindStepNavigation(stepIndex){
  const panel = steps[stepIndex];
  if (!panel) return;

  const prevBtnLocal   = panel.querySelector('[data-nav="prev"]');
  const nextBtnLocal   = panel.querySelector('[data-nav="next"]');
  const finishBtnLocal = panel.querySelector('[data-nav="finish"]');

  if (prevBtnLocal && !prevBtnLocal.dataset.bound){
    prevBtnLocal.addEventListener('click', () => {
      if (stepIndex > 0){
        showStep(stepIndex - 1);
      } else {
        showStep(0);
      }
    });
    prevBtnLocal.dataset.bound = 'true';
  }

  if (nextBtnLocal && !nextBtnLocal.dataset.bound){
    nextBtnLocal.addEventListener('click', () => {
      if (!validateCurrentStep()) return;
      if (stepIndex < 5){
        showStep(stepIndex + 1);
      }
    });
    nextBtnLocal.dataset.bound = 'true';
  }

  // finish = botão "Concluir cadastro" da tela 5 (type="submit")
  if (finishBtnLocal && !finishBtnLocal.dataset.bound){
    // type="submit" já dispara o onSubmit do form.
    finishBtnLocal.dataset.bound = 'true';
  }
}

// ===== Navegação geral =====
function bindEvents(){
  saveDraftBtn?.addEventListener('click', saveDraft);
  previewBtn?.addEventListener('click', openSummary);
  startFlowBtn?.addEventListener('click', () => showStep(1));

  timelineItems.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      if (idx === currentStep) return;
      if (idx > currentStep && !validateCurrentStep()) return;
      showStep(idx);
    });
  });

  closeSummaryBtn?.addEventListener('click', () => summaryDialog.close());
  restartBtn?.addEventListener('click', restartFlow);
  form.addEventListener('input',  onFieldChange);
  form.addEventListener('change', onFieldChange);
  form.addEventListener('submit', onSubmit);

  // Assinatura
  bindSignature();
  // Minha Área (Candidato)
  bindCandidateArea();
  // Portal do Consultor (login, painel, troca de senha)
  bindConsultantPortal();
  // Logins rápidos na capa
  bindQuickLogins();
  // Feedback inicial dos uploads
  initFileUploads();
}

function showStep(i){
  if (successScreen) successScreen.classList.add('hidden');
  form?.classList.remove('flow-complete');
  currentStep = i;

  steps.forEach((s,idx) => s.classList.toggle('active', idx === i));
  timelineItems.forEach((it,idx) => {
    it.classList.toggle('active', idx === i);
    it.classList.toggle('done',   idx <  i);
  });

  const progress = ((i+1) / steps.length) * 100;
  progressBar.style.width = `${progress}%`;

  bindStepNavigation(i);
  window.scrollTo({ top:0, behavior:'smooth' });
}

function onFieldChange(e){
  const t = e.target;
  if (t.id === 'childrenCount' || t.id === 'hasChildren'){
    renderChildrenRows();
  }
  if (t.matches('input[type="file"]')){
    updateFileFeedback(t);
  }
  if (t.matches('select, input')){
    refreshConditionals();
  }
}

// ===== Condicionais/Required =====
function refreshConditionals(){
  document.querySelectorAll('.conditional').forEach(block => {
    const [field, expected] = (block.dataset.showWhen ?? '').split('=');
    const active    = q(field)?.value === expected;
    const wasHidden = block.classList.contains('hidden-by-rule');
    block.classList.toggle('hidden-by-rule', !active);
    if (!active && !wasHidden) clearHiddenFields(block);
  });
  syncRequired();
}

function syncRequired(){
  // Campos obrigatórios dinâmicos
  const req = {
    spouseName:        q('maritalStatus')?.value === 'Casado(a)',
    childrenCount:     q('hasChildren')?.value  === 'Sim',
    hasReservist:      q('biologicalSex')?.value=== 'Masculino',
    reservistNumber:   q('hasReservist')?.value === 'Sim',
    dispenseReason:    q('hasReservist')?.value === 'Sim',
    ctpsNumber:        q('ctpsType')?.value     === 'Físico',
    ctpsSeries:        q('ctpsType')?.value     === 'Físico',
    pisNumber:         q('hasPis')?.value       === 'Sim',
    otherJobCnpj:      q('hasOtherJob')?.value  === 'Sim',
    retirementDate:    q('hasRetirement')?.value=== 'Sim',
    relativeName:      q('hasRelativeAtSnd')?.value === 'Sim',
    relationshipDegree:q('hasRelativeAtSnd')?.value === 'Sim',
    itauAgency:        q('hasItauAccount')?.value === 'Sim',
    itauAccountNumber: q('hasItauAccount')?.value === 'Sim'
  };

  Object.entries(req).forEach(([name,required]) => {
    const f = q(name); if (f) f.required = required;
  });

  // Nenhum input de arquivo é required no HTML
  form.querySelectorAll('input[type="file"]').forEach(inp => inp.required = false);

  // Filhos obrigatórios quando hasChildren = "Sim"
  const childrenRows = document.getElementById('childrenRows');
  childrenRows?.querySelectorAll('input').forEach(inp => {
    inp.required = (q('hasChildren')?.value === 'Sim');
  });
}

function clearHiddenFields(container){
  container.querySelectorAll('input, select').forEach(input => {
    if (input.type === 'file'){
      input.value = '';
      updateFileFeedback(input);
    } else if (!input.name?.startsWith('child')){
      input.value = '';
    }
  });
}

// ===== Filhos =====
function renderChildrenRows(){
  const childrenRows = document.getElementById('childrenRows');
  const count = Math.min(Math.max(Number(q('childrenCount')?.value ?? 0),0),10);
  childrenRows.innerHTML = '';
  for (let i=0; i<count; i++){
    const row = document.createElement('div');
    row.className = 'child-row';
    row.innerHTML = `
      <div class="field">
        <label for="childName_${i}">Nome completo do filho ${i+1} *</label>
        <input id="childName_${i}" name="childName_${i}" type="text" />
      </div>
      <div class="field">
        <label for="childBirth_${i}">Dt. Nascimento *</label>
        <input id="childBirth_${i}" name="childBirth_${i}" type="date" />
      </div>
      <div class="field">
        <label for="childCpf_${i}">CPF *</label>
        <input id="childCpf_${i}" name="childCpf_${i}" type="text" inputmode="numeric" />
      </div>`;
    childrenRows.appendChild(row);
  }
  syncRequired();
}

function collectChildrenData(){
  const qty = Number(q('childrenCount')?.value ?? 0);
  const arr = [];
  for (let i=0; i<qty; i++){
    arr.push({
      nomeCompleto:   q(`childName_${i}`)?.value ?? '',
      dataNascimento: q(`childBirth_${i}`)?.value ?? '',
      cpf:            onlyDigits(q(`childCpf_${i}`)?.value ?? '')
    });
  }
  return arr;
}

// ===== Upload feedback =====
function initFileUploads(){
  form.querySelectorAll('input[type="file"]').forEach(updateFileFeedback);
}

function updateFileFeedback(input){
  const card = input.closest('.upload-card'); if (!card) return;
  const fb   = card.querySelector('.file-feedback');
  const files= Array.from(input.files ?? []);
  card.classList.toggle('has-file', files.length>0);
  if (fb){
    fb.textContent = files.length
      ? (files.length === 1 ? `✔ ${files[0].name}` : `✔ ${files.length} arquivo(s)`)
      : '';
  }
}

// ===== Validação =====
function clearErrors(panel){
  panel.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  panel.querySelectorAll('.error-text').forEach(el => el.remove());
}

function setFieldError(field,message){
  const w = field.closest('.field, .upload-card'); if (!w) return;
  w.classList.add('invalid');
  const s = document.createElement('small');
  s.className = 'error-text';
  s.textContent = message;
  w.appendChild(s);
}

function validateFileInput(input){
  const files = Array.from(input.files ?? []);
  if (files.length === 0) return true; // opcional
  return files.every(f =>
    ALLOWED_EXT.includes((f.name.split('.').pop() ?? '').toLowerCase()) &&
    f.size <= 10*1024*1024
  );
}

function validateCurrentStep(){
  const panel = steps[currentStep];
  clearErrors(panel);
  let valid = true;

  const fields = Array.from(panel.querySelectorAll('input, select')).filter(isVisibleField);
  fields.forEach(field => {
    if (field.disabled) return;

    if (field.type === 'file'){
      if (!validateFileInput(field)){
        valid = false;
        setFieldError(field,'Envie PDF/JPG/JPEG/PNG até 10MB.');
      }
      return;
    }

    if (field.required && !String(field.value ?? '').trim()){
      valid = false;
      setFieldError(field,'Preenchimento obrigatório.');
    }

    if (field.name === 'childrenCount' && field.value){
      const n = Number(field.value);
      if (n < 1 || n > 10){
        valid = false;
        setFieldError(field,'Informe entre 1 e 10.');
      }
    }
  });

  // Tela de Declaração & Assinatura (step 5)
  if (currentStep === 5){
    const agree = gid('declAgree');
    if (agree && !agree.checked){
      valid = false;
      setFieldError(agree,'É obrigatório aceitar a declaração.');
    }
    if (!hasSignatureSelected()){
      valid = false;
      setFieldError(gid('signUpload') ?? gid('signPad'),
        'Forneça sua assinatura (desenhe ou envie imagem).');
    }
  }
  return valid;
}

// ===== Rascunho =====
function saveDraft(){
  const snap = {};
  Array.from(form.elements).forEach(f => {
    if (!f.name || f.type === 'file') return;
    snap[f.name] = f.value;
  });
  localStorage.setItem('sndAdmissionDraftV2', JSON.stringify(snap));
  showToast('Rascunho salvo.');
}

function restoreDraft(){
  const raw = localStorage.getItem('sndAdmissionDraftV2'); if (!raw) return;
  try{
    const s = JSON.parse(raw);
    Object.entries(s).forEach(([n,v]) => {
      const f = q(n); if (f && f.type!=='file') f.value = v;
    });
  }catch{}
}

// ===== Resumo (opcional) =====
function openSummary(){
  const p = buildPayloadPreview();
  summaryContent.innerHTML = `<pre>${JSON.stringify(p,null,2)}</pre>`;
  summaryDialog?.showModal();
}

// ===== Submit → Flow (cadastro) =====
form.addEventListener?.('submit', onSubmit);

async function onSubmit(ev){
  ev.preventDefault();
  if (!validateCurrentStep()) return;
  if (!ENDPOINT_URL){
    showToast('Erro: config.json ausente.');
    return;
  }
  const finishButton = form.querySelector('[data-nav="finish"]');
  if (finishButton){
    finishButton.disabled = true;
    finishButton.textContent = 'Enviando…';
  }
  try{
    const payload = await buildFlowPayload();
    const resp = await fetch(ENDPOINT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (resp.ok){
      showToast('Cadastro enviado com sucesso.');
      localStorage.removeItem('sndAdmissionDraftV2');
      form.reset();
      renderChildrenRows();
      refreshConditionals();
      currentStep = 0;
      showStep(0);
    }else{
      showToast('Falha ao enviar. Tente novamente.');
    }
  }catch(e){
    console.error(e);
    showToast(e?.message ?? 'Erro de rede.');
  }finally{
    if (finishButton){
      finishButton.disabled = false;
      finishButton.textContent = 'Concluir cadastro';
    }
  }
}

function showSuccessScreen(){
  successScreen?.classList.remove('hidden');
  form?.classList.add('flow-complete');
  steps.forEach(s  => s.classList.remove('active'));
  timelineItems.forEach(it => it.classList.add('done'));
  if (progressBar) progressBar.style.width='100%';
  window.scrollTo({top:0, behavior:'smooth'});
}

function restartFlow(){
  successScreen?.classList.add('hidden');
  showStep(0);
}

// ====== Payload ======
function buildPayloadPreview(){
  return {
    dadosPessoais:{
      nomeCompleto:    q('fullName')?.value,
      email:           q('email')?.value,
      telefone:        q('phone')?.value,
      dataNascimento:  q('birthDate')?.value,
      localNascimento: q('birthPlace')?.value,
      estadoCivil:     q('maritalStatus')?.value,
      nomeConjuge:     q('spouseName')?.value,
      escolaridade:    q('education')?.value,
      racaCor:         q('raceColor')?.value,
      nomePai:         q('fatherName')?.value,
      nomeMae:         q('motherName')?.value,
      sexoBiologico:   q('biologicalSex')?.value,
      possuiFilhos:    q('hasChildren')?.value,
      quantidadeFilhos:q('childrenCount')?.value,
      filhos: collectChildrenData(),
      endereco:{
        logradouro: q('street')?.value,
        numero:     q('number')?.value,
        complemento:q('complement')?.value,
        bairro:     q('district')?.value,
        cidade:     q('city')?.value,
        estado:     q('state')?.value,
        cep:        q('zipCode')?.value
      }
    },
    documentacaoAdmissional:{
      possuiReservista:          q('hasReservist')?.value,
      numeroReservista:          q('reservistNumber')?.value,
      motivoDispensa:            q('dispenseReason')?.value,
      documentoIdentidade:       q('identityDoc')?.value,
      orgaoEmissor:              q('issuer')?.value,
      dataEmissaoIdentidade:     q('identityIssueDate')?.value,
      cpf:                       q('cpf')?.value,
      ctpsTipo:                  q('ctpsType')?.value,
      ctpsNumero:                q('ctpsNumber')?.value,
      ctpsSerie:                 q('ctpsSeries')?.value,
      possuiRegistroProfissional:q('hasProfessionalRecord')?.value,
      registroProfissional:      q('professionalRecord')?.value,
      orgaoRegistroProfissional: q('professionalIssuer')?.value,
      dataRegistroProfissional:  q('professionalIssueDate')?.value,
      tituloEleitor:             q('voterTitle')?.value,
      zonaEleitoral:             q('voterZone')?.value,
      secaoEleitoral:            q('voterSection')?.value,
      dataEmissaoTitulo:         q('voterIssueDate')?.value,
      possuiPis:                 q('hasPis')?.value,
      numeroPis:                 q('pisNumber')?.value
    }
  };
}

async function buildFlowPayload(){
  const dados = {
    // Tela 1
    nomeCompleto:  q('fullName')?.value?.trim(),
    email:         q('email')?.value?.trim(),
    telCel:        onlyDigits(q('phone')?.value ?? ''),
    dataNascimento:q('birthDate')?.value,
    localNascimento:q('birthPlace')?.value?.trim(),
    estadoCivil:   q('maritalStatus')?.value,
    conjuge:       q('spouseName')?.value?.trim(),
    grauEscolaridade:q('education')?.value,
    racaCor:       q('raceColor')?.value,
    nomePai:       q('fatherName')?.value?.trim(),
    nomeMae:       q('motherName')?.value?.trim(),
    sexoBiologico: q('biologicalSex')?.value,
    possuiFilhos:  q('hasChildren')?.value,
    qtdFilhos:     Number(q('childrenCount')?.value ?? 0),
    filhos:        collectChildrenData(),
    endereco:      q('street')?.value?.trim(),
    numero:        q('number')?.value?.trim(),
    complemento:   q('complement')?.value?.trim(),
    bairro:        q('district')?.value?.trim(),
    cidade:        q('city')?.value?.trim(),
    estado:        q('state')?.value,
    cep:           onlyDigits(q('zipCode')?.value ?? ''),

    // Tela 2
    hasReservista:   q('hasReservist')?.value,
    reservistaCodigo:q('reservistNumber')?.value?.trim(),
    dispensaMotivo:  q('dispenseReason')?.value?.trim(),
    rgNumero:        q('identityDoc')?.value?.trim(),
    rgOrgaoUf:       q('issuer')?.value?.trim(),
    rgData:          q('identityIssueDate')?.value,
    cpf:             onlyDigits(q('cpf')?.value ?? ''),
    ctpsTipo:        q('ctpsType')?.value,
    ctpsNumero:      onlyDigits(q('ctpsNumber')?.value ?? ''),
    ctpsSerie:       onlyDigits(q('ctpsSeries')?.value ?? ''),
    regProfTem:      q('hasProfessionalRecord')?.value,
    registroProfissional:q('professionalRecord')?.value?.trim(),
    regProfOrgaoUf:  q('professionalIssuer')?.value?.trim(),
    regProfData:     q('professionalIssueDate')?.value,
    tituloNumero:    onlyDigits(q('voterTitle')?.value ?? ''),
    tituloZona:      onlyDigits(q('voterZone')?.value ?? ''),
    tituloSecao:     onlyDigits(q('voterSection')?.value ?? ''),
    tituloData:      q('voterIssueDate')?.value,
    possuiPis:       q('hasPis')?.value,
    pisNumero:       onlyDigits(q('pisNumber')?.value ?? ''),

    // Tela 3
    outroEmprego:    q('hasOtherJob')?.value  === 'Sim' ? 'sim':'nao',
    cnpjEmpresa:     onlyDigits(q('otherJobCnpj')?.value ?? ''),
    aposentado:      q('hasRetirement')?.value=== 'Sim' ? 'sim':'nao',
    dataAposentadoria:q('retirementDate')?.value,
    temParenteSnd:   q('hasRelativeAtSnd')?.value === 'Sim' ? 'sim':'nao',
    nomeParente:     q('relativeName')?.value?.trim(),
    parentesco:      q('relationshipDegree')?.value?.trim(),
    contaItauTem:    q('hasItauAccount')?.value === 'Sim' ? 'sim':'nao',
    agencia:         onlyDigits(q('itauAgency')?.value ?? ''),
    contaCorrente:   onlyDigits(q('itauAccountNumber')?.value ?? '')
  };

  // ANEXOS (todos opcionais)
  const map = [
    { id:'workCard',            label:'CTPS',                               max:1  },
    { id:'identityUpload',      label:'RG',                                 max:2  },
    { id:'cpfUpload',           label:'CPF',                                max:1  },
    { id:'reservistUpload',     label:'Certificado_Reservista',             max:1  },
    { id:'voterTitleUpload',    label:'Titulo_Eleitor',                     max:1  },
    { id:'pisUpload',           label:'PIS',                                max:1  },
    { id:'proofOfAddress',      label:'Comprovante_Residencia',             max:1  },
    { id:'marriageCertificate', label:'Certidao_Casamento',                 max:1  },
    { id:'spouseCpfUpload',     label:'CPF_Conjuge',                        max:1  },
    { id:'childrenBirthUpload', label:'Certidao_Nascimento_Filho',          max:10 },
    { id:'childrenCpfUpload',   label:'CPF_Filho',                          max:10 },
    { id:'itauProofUpload',     label:'Dados_Conta_Bancaria',               max:1  },
    { id:'referenceLetterUpload',label:'Carta_Referencia',                  max:1  },
    { id:'diplomaUpload',       label:'Diploma_Declaracao_Escolaridade',    max:1  },
    { id:'professionalLicenseUpload',label:'Carteira_Registro_Prof',        max:1  }
  ];

  const anexos = [];
  for (const item of map){
    const input = gid(item.id); if (!input) continue;
    const files = Array.from(input.files ?? []);
    if (!files.length) continue;
    if (files.length > (item.max ?? 1)) throw new Error(`"${item.label}": máximo ${item.max} arquivo(s).`);
    let idx = 1;
    for (const f of files){
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) throw new Error(`Tipo não permitido: ${f.name}`);
      if (f.size > 10*1024*1024)      throw new Error(`Arquivo muito grande: ${f.name}`);
      const b64  = await fileToBase64(f);
      const safe = `${item.label}${files.length>1 ? `_${idx}`:''}.${ext}`;
      anexos.push({
        fileName:      safe,
        contentType:   b64.contentType ?? f.type ?? 'application/octet-stream',
        contentBase64: b64.contentBase64,
        size:          f.size
      });
      idx++;
    }
  }

  // Declaração e Assinatura
  const assinaturaDataUrl = await getSignatureDataUrl(); // pode ser null
  const declaracao = {
    texto:      'Declaro veracidade das informações.',
    aceito:     !!(gid('declAgree')?.checked),
    assinadoEm: new Date().toISOString(),
    assinatura: assinaturaDataUrl
  };

  return {
    metadata:{
      fonte:     'form-web-snd',
      versao:    '5.0.0',
      enviadoEm: new Date().toISOString(),
      modo:      'cadastro'
    },
    dados,
    anexos,
    declaracao
  };
}

async function fileToBase64(f){
  return new Promise((resolve,reject) => {
    const r = new FileReader();
    r.onload = () => {
      const [meta,b64] = String(r.result).split(',');
      const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? 'application/octet-stream';
      resolve({ contentType:mime, contentBase64:b64, dataUrl:String(r.result) });
    };
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

// ====== Assinatura (canvas + upload) ======
let signing = false, hasStroke = false, last = null;

function bindSignature(){
  const signPad = gid('signPad');
  const clearBtn= gid('clearSignBtn');
  if (!signPad) return;
  const ctx = signPad.getContext('2d');
  ctx.lineWidth   = 2.0;
  ctx.lineCap     = 'round';
  ctx.strokeStyle = '#183553';

  const pos = e => {
    const rect = signPad.getBoundingClientRect();
    const p = ('touches' in e) ? e.touches[0] : e;
    return {
      x: (p.clientX - rect.left) * (signPad.width  / rect.width),
      y: (p.clientY - rect.top)  * (signPad.height / rect.height)
    };
  };

  const start = e => { signing = true; hasStroke = true; last = pos(e); e.preventDefault(); };
  const move  = e => {
    if (!signing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.x,last.y);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
    last = p;
    e.preventDefault();
  };
  const end = () => { signing = false; };

  signPad.addEventListener('mousedown', start);
  signPad.addEventListener('mousemove', move);
  window.addEventListener('mouseup',   end);

  signPad.addEventListener('touchstart', start, {passive:false});
  signPad.addEventListener('touchmove',  move,  {passive:false});
  signPad.addEventListener('touchend',   end);

  clearBtn?.addEventListener('click', () => {
    ctx.clearRect(0,0,signPad.width,signPad.height);
    hasStroke = false;
  });
}

function hasSignatureSelected(){
  const file = gid('signUpload')?.files?.[0];
  if (file) return true;
  return hasStroke;
}

async function getSignatureDataUrl(){
  const file = gid('signUpload')?.files?.[0];
  if (file){
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!['jpg','jpeg','png'].includes(ext)) throw new Error('Assinatura: envie JPG/JPEG/PNG.');
    if (file.size > 10*1024*1024)         throw new Error('Assinatura: arquivo >10MB.');
    const data = await fileToBase64(file);
    return data.dataUrl;
  }
  const signPad = gid('signPad');
  if (signPad && hasStroke) return signPad.toDataURL('image/png');
  return null;
}

// ====== Minha Área (Candidato) ======
function bindCandidateArea(){
  const loginForm = gid('candLoginForm');
  const msg       = gid('candLoginMsg');
  const area      = gid('candArea');
  const resumo    = gid('candResumo');
  const upForm    = gid('candUploadForm');
  const upInput   = gid('candUpFiles');
  const upMsg     = gid('candUpMsg');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); msg.textContent='';
    if (!ENDPOINT_URL){ msg.textContent='Erro: config.json ausente.'; return; }
    const email = gid('candEmail')?.value?.trim();
    if (!email){ msg.textContent='Informe o e‑mail.'; return; }

    const payload = {
      metadata:{ modo:'consulta_por_email', enviadoEm:new Date().toISOString() },
      filtro:{ email }
    };

    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!resp.ok){ msg.textContent='Cadastro não localizado.'; return; }
      const data = await resp.json();
      const d = data?.dados ?? {};
      resumo.innerHTML = `
        <div class="field readonly"><label>Nome</label><span>${d.NomeCompleto ?? '-'}</span></div>
        <div class="field readonly"><label>E‑mail</label><span>${d.Email ?? email}</span></div>
        <div class="field readonly"><label>Telefone</label><span>${d.TelCel ?? '-'}</span></div>
        <div class="field readonly"><label>Estado civil</label><span>${d.EstadoCivil ?? '-'}</span></div>`;
      upForm.elements.email.value = email;
      area.classList.remove('hidden');
    }catch(err){
      console.error(err);
      msg.textContent='Erro de rede.';
    }
  });

  upForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); upMsg.textContent='';
    if (!ENDPOINT_URL){ upMsg.textContent='Erro: config.json ausente.'; return; }
    const email = upForm.elements.email.value?.trim();
    const files = Array.from(upInput?.files ?? []);
    if (files.length===0){ upMsg.textContent='Selecione ao menos um arquivo.'; return; }

    const anexos = [];
    for (const f of files){
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)){
        upMsg.textContent = `Tipo não permitido: ${f.name}`;
        return;
      }
      if (f.size > 10*1024*1024){
        upMsg.textContent = `Arquivo grande: ${f.name}`;
        return;
      }
      const b64 = await fileToBase64(f);
      anexos.push({
        fileName:      `Outros_${f.name}`,
        contentType:   b64.contentType ?? f.type ?? 'application/octet-stream',
        contentBase64: b64.contentBase64,
        size:          f.size
      });
    }

    const payload = {
      metadata:{ modo:'minha_area_upload', enviadoEm:new Date().toISOString() },
      filtro:{ email },
      anexos
    };

    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      upMsg.textContent = resp.ok ? 'Arquivos enviados.' : 'Falha ao enviar.';
      if (resp.ok) upForm.reset();
    }catch(err){
      console.error(err);
      upMsg.textContent='Erro de rede.';
    }
  });
}

// ====== Portal do Consultor (login, painel, troca de senha) ======
function bindConsultantPortal(){
  const loginForm = gid('consLoginForm2');
  const msg       = gid('consLoginMsg2');
  const dash      = gid('consDash');
  const consTag   = gid('consTag');

  const searchBox = gid('searchBox2');
  const drop      = gid('drop2');
  const candPanel = gid('candPanel2');
  const candName  = gid('candName2');
  const candEmail = gid('candEmail2');
  const candStatus= gid('candStatus2');
  const progFill  = gid('progFill2');
  const progPct   = gid('progPct2');
  const chkMissing= gid('chkMissing2');
  const chkPresent= gid('chkPresent2');
  const notifyForm= gid('notifyForm2');
  const notifyMsg = gid('notifyMsg2');

  // Campos da tela 8 - Alterar Senha
  const changePassForm = gid('changePassForm');
  const cpEmail   = gid('cpEmail');
  const cpCurrent = gid('cpCurrent');
  const cpNew     = gid('cpNew');
  const cpConfirm = gid('cpConfirm');
  const cpMsg     = gid('cpMsg');

  // ===== Login do consultor (consultor_login) =====
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';

    if (!ENDPOINT_URL){
      msg.textContent = 'Erro: config.json ausente.';
      return;
    }

    const emailInput = gid('consEmail2');
    const passInput  = gid('consPass2');
    const email = emailInput?.value?.trim().toLowerCase();
    const pass  = passInput?.value ?? '';

    if (!email || !pass){
      msg.textContent = 'Preencha e-mail e senha.';
      return;
    }

    try{
      const hash = await sha256Hex(pass);
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          metadata:{ modo:'consultor_login', enviadoEm:new Date().toISOString() },
          cred:{ email, hash }
        })
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok){
        msg.textContent = data?.mensagem ?? 'Erro no login do consultor.';
        return;
      }

      // Caso de primeiro acesso (senha padrão)
      if (data?.primeiroAcesso === true){
        msg.textContent = data?.mensagem ?? 'Senha padrão detectada. Altere sua senha.';

        if (changePassForm) changePassForm.reset();
        if (cpEmail) cpEmail.value = email;

        showStep(8); // Tela de alteração de senha
        return;
      }

      // Login normal mas ok = false
      if (!data?.ok){
        msg.textContent = data?.mensagem ?? 'Credenciais inválidas.';
        return;
      }

      // Login normal bem sucedido
      consTag.textContent = data?.nome
        ? `Consultor · ${data.nome}`
        : `Consultor · ${email}`;

      dash?.classList.remove('hidden');
      showStep(7);
      searchBox?.focus();

    }catch(err){
      console.error(err);
      msg.textContent='Erro de rede no login.';
    }
  });

  // ===== Troca de senha (consultor_alterar_senha) =====
  if (changePassForm && !changePassForm.dataset.bound){
    changePassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!ENDPOINT_URL){
        cpMsg.textContent = 'Erro: config.json ausente.';
        return;
      }
      cpMsg.textContent = '';

      const email      = cpEmail?.value?.trim().toLowerCase() ?? '';
      const senhaAtual = cpCurrent?.value ?? '';
      const novaSenha  = cpNew?.value ?? '';
      const repetir    = cpConfirm?.value ?? '';

      if (!email || !senhaAtual || !novaSenha || !repetir){
        cpMsg.textContent = 'Preencha todos os campos.';
        return;
      }
      if (novaSenha !== repetir){
        cpMsg.textContent = 'A nova senha e a confirmação não coincidem.';
        return;
      }

      try{
        const hashAtual = await sha256Hex(senhaAtual);
        const hashNova  = await sha256Hex(novaSenha);

        const resp = await fetch(ENDPOINT_URL,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            metadata:{ modo:'consultor_alterar_senha', enviadoEm:new Date().toISOString() },
            alterar:{
              email,
              senhaAtualHash: hashAtual,
              novaSenhaHash:  hashNova
            }
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data?.ok){
          cpMsg.textContent = data?.mensagem ?? 'Senha atualizada com sucesso.';

          const consEmail = gid('consEmail2');
          const consPass  = gid('consPass2');
          if (consEmail) consEmail.value = email;
          if (consPass)  consPass.value  = '';

          showToast('Senha atualizada. Faça login novamente com a nova senha.');
          showStep(7); // volta para tela de login do consultor
        }else{
          cpMsg.textContent = data?.mensagem ?? 'Falha ao atualizar a senha.';
        }

      }catch(err){
        console.error(err);
        cpMsg.textContent = 'Erro de rede ao atualizar senha.';
      }
    });
    changePassForm.dataset.bound = 'true';
  }

  // ===== Busca de candidatos (consultor_busca) =====
  const doSearch = debounce(async () => {
    const qv = (searchBox?.value ?? '').trim();
    if (qv.length < 2){
      if (drop){
        drop.innerHTML = '';
        drop.classList.add('hidden');
      }
      return;
    }
    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          metadata:{ modo:'consultor_busca' },
          filtro:{ q: qv }
        })
      });

      const data  = await resp.json().catch(() => ({}));
      const items = data?.items ?? [];
      if (!items.length){
        drop.innerHTML = '';
        drop.classList.add('hidden');
        return;
      }
      drop.innerHTML = items.map(i =>
        `<button type="button" data-email="${i.email}" data-nome="${i.nome}">${i.nome} · <small>${i.email}</small></button>`
      ).join('');
      drop.classList.remove('hidden');
    }catch{
      if (drop){
        drop.innerHTML = '';
        drop.classList.add('hidden');
      }
    }
  },260);

  searchBox?.addEventListener('input', doSearch);

  drop?.addEventListener('click',(e) => {
    const b = e.target.closest('button'); if (!b) return;
    showCandidateDetail({ email:b.dataset.email, nome:b.dataset.nome });
    drop.classList.add('hidden');
  });

  async function showCandidateDetail({email,nome}){
    if (candName)  candName.textContent  = nome  ?? '—';
    if (candEmail) candEmail.textContent = email ?? '—';
    if (chkMissing) chkMissing.innerHTML = '';
    if (chkPresent) chkPresent.innerHTML = '';
    if (progFill)   progFill.style.width = '0%';
    if (progPct)    progPct.textContent  = '0%';
    candPanel?.classList.remove('hidden');

    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          metadata:{ modo:'consultor_detalhe' },
          filtro:{ email }
        })
      });

      const d   = await resp.json().catch(() => ({}));
      const pct = Number(d?.progresso?.percent ?? 0);
      if (progFill) progFill.style.width = `${pct}%`;
      if (progPct)  progPct.textContent  = `${pct}%`;
      if (candStatus) candStatus.textContent = pct>=100 ? 'Concluído':'Em andamento';

      const missing = d?.progresso?.missing ?? [];
      const present = d?.progresso?.present ?? [];

      if (chkMissing){
        chkMissing.innerHTML = missing.length
          ? missing.map(x => `<li>☐ ${x}</li>`).join('')
          : '<li>— sem pendências —</li>';
      }
      if (chkPresent){
        chkPresent.innerHTML = present.length
          ? present.map(x => `<li>✔ ${x}</li>`).join('')
          : '<li>—</li>';
      }

      if (notifyForm){
        notifyForm.dataset.email   = email;
        notifyForm.dataset.missing = JSON.stringify(missing);
      }
    }catch(err){
      console.error(err);
      showToast('Falha ao carregar detalhes.');
    }
  }

  // ===== Notificação (consultor_notificar) =====
  notifyForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); notifyMsg.textContent='';
    if (!ENDPOINT_URL){
      notifyMsg.textContent='Erro: config.json ausente.';
      return;
    }

    const email     = notifyForm.dataset.email ?? '';
    const fd        = new FormData(notifyForm);
    const prazo     = fd.get('prazo');
    const remetente = fd.get('remetente');
    const mensagem  = fd.get('mensagem') ?? '';

    if (!email || !prazo || !remetente){
      notifyMsg.textContent='Preencha prazo e remetente.';
      return;
    }

    try{
      const missing = JSON.parse(notifyForm.dataset.missing ?? '[]');
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          metadata:{ modo:'consultor_notificar', enviadoEm:new Date().toISOString() },
          filtro:{ email },
          notificacao:{ prazo, remetente, mensagem, missing }
        })
      });

      const data = await resp.json().catch(() => ({}));
      notifyMsg.textContent = resp.ok && data?.ok
        ? 'Notificação enviado.' 
        : (data?.mensagem ?? 'Falha ao enviar.');

    }catch(err){
      console.error(err);
      notifyMsg.textContent='Erro de rede.';
    }
  });
}

// ====== Logins rápidos da tela inicial ======
function bindQuickLogins(){
  // Candidato -> Tela 6
  const qlCandForm = gid('quickLoginCandidate');
  qlCandForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = gid('qlCandEmail')?.value?.trim();
    if (!email){
      showToast('Informe o e‑mail do candidato.');
      return;
    }
    const candEmail = gid('candEmail');
    if (candEmail) candEmail.value = email;
    showStep(6);
  });

  // Consultor -> Tela 7 (login será processado lá)
  const qlConsForm = gid('quickLoginConsultor');
  qlConsForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = gid('qlConsEmail')?.value?.trim();
    const pass  = gid('qlConsPass')?.value ?? '';
    if (!email || !pass){
      showToast('Informe e‑mail e senha do consultor.');
      return;
    }
    const consEmail = gid('consEmail2');
    const consPass  = gid('consPass2');
    if (consEmail) consEmail.value = email;
    if (consPass)  consPass.value  = pass;
    showStep(7);
  });

  // Toda a lógica antiga de "Primeiro acesso" (modal) foi removida,
  // pois agora o primeiro acesso é controlado pela senha padrão no Flow.
}

// ====== Cripto SHA‑256 (hex) ======
async function sha256Hex(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

// ===== Init =====
function init(){
  bindEvents();
  restoreDraft();
  showStep(0);
  refreshConditionals();
  renderChildrenRows();
}
init();
