/* SND – Portal Admissional (app.js)
 - 8 telas: Boas-vindas, Dados Pessoais, Documentação, Complementares, Uploads,
   Declaração & Assinatura, Minha Área (Candidato), Portal do Consultor
 - Uploads opcionais (sem selo e sem required)
 - Assinatura: canvas + upload de imagem (JPG/JPEG/PNG). Upload tem prioridade.
 - Integração com Flow: cadastro, consulta, upload adicional,
   login/primeiro acesso consultor, autocomplete, detalhe/progresso, notificação.
*/

// ====== URLs FIXAS DOS FLOWS (Power Automate) ======
const ENDPOINT_URL =
  "https://b35122430f23e4409d91713fc00cbf.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/3e4cdb53156244a19e84085f43f7d984/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=PTLmCKrbX5qghBpHs-8g04eCrlygIMrwtz_ZhbLHuf8";

// Flow específico para ALTERAR SENHA DO CONSULTOR (já existia no config.json)
const PASSWORD_CHANGE_URL =
  "https://deb285e085e3ef0f9a83cd1a5098d7.ec.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/1000a6f1ddb74ce19130b8d3c34f5eb3/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=wZvw2JZ9NrlRSF7rzidaV9X_5-AUu0J0fpPYRF7cUnw";

// ===== Elementos principais =====
const form = document.getElementById('admissionForm');
const steps = Array.from(document.querySelectorAll('.step-card'));
const timelineItems = Array.from(document.querySelectorAll('#timeline .step-nav-btn'));
const progressBar = document.getElementById('progressBar');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const previewBtn = document.getElementById('previewBtn');
const startFlowBtn = document.getElementById('startFlowBtn');
const toast = document.getElementById('toast');
const summaryDialog = document.getElementById('summaryDialog');
const summaryContent = document.getElementById('summaryContent');
const closeSummaryBtn = document.getElementById('closeSummaryBtn');
const successScreen = document.getElementById('successScreen');
const restartBtn = document.getElementById('restartBtn');
const dlgAlterarSenha = document.getElementById('dlgAlterarSenha');
const dlgFecharAlterarSenha = document.getElementById('dlgFecharAlterarSenha');
const ALLOWED_EXT = ['pdf','jpg','jpeg','png'];

let currentStep = 0;

// ===== Utilidades =====
const q  = name => form.elements[name];
const gid = id   => document.getElementById(id);
const onlyDigits = v => (v || '').replace(/\D+/g,'');

function showToast(m){
  toast.textContent = m;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function isVisibleField(el){
  if(!el) return false;
  const card = el.closest('.step-card');
  const hidden = el.closest('.hidden-by-rule');
  return card?.classList.contains('active') && !hidden && !el.disabled;
}

const debounce = (fn,ms)=>{
  let h;
  return (...a)=>{
    clearTimeout(h);
    h=setTimeout(()=>fn(...a),ms);
  };
};

// ===== Navegação =====
function bindEvents(){
  prevBtn.addEventListener('click', ()=>{
    if(currentStep>0) showStep(currentStep-1);
  });

  nextBtn.addEventListener('click', ()=>{
    if(!validateCurrentStep()) return;
    if(currentStep<steps.length-1) showStep(currentStep+1);
  });

  saveDraftBtn?.addEventListener('click', saveDraft);
  previewBtn?.addEventListener('click', openSummary);
  startFlowBtn?.addEventListener('click', () => showStep(1));

  timelineItems.forEach((btn, idx)=>{
    btn.addEventListener('click', ()=>{
      if(idx===currentStep) return;
      if(idx>currentStep && !validateCurrentStep()) return;
      showStep(idx);
    });
  });

  closeSummaryBtn?.addEventListener('click', () => summaryDialog.close());
  restartBtn?.addEventListener('click', restartFlow);

  form.addEventListener('input', onFieldChange);
  form.addEventListener('change', onFieldChange);
  form.addEventListener('submit', onSubmit);

  // Assinatura
  bindSignature();
  // Minha Área (Candidato)
  bindCandidateArea();
  // Portal do Consultor
  bindConsultantPortal();
  // Logins rápidos na tela inicial
  bindQuickLogins();
  // Inicia feedback de uploads
  initFileUploads();

  // Fechar diálogo de alterar senha
  dlgFecharAlterarSenha?.addEventListener('click', closeChangePasswordDialog);
}

function showStep(i){
  if(successScreen) successScreen.classList.add('hidden');
  form?.classList.remove('flow-complete');

  currentStep = i;
  steps.forEach((s,idx)=> s.classList.toggle('active', idx===i));
  timelineItems.forEach((it,idx)=>{
    it.classList.toggle('active', idx===i);
    it.classList.toggle('done', idx<i);
  });

  const progress = ((i+1)/steps.length)*100;
  progressBar.style.width = `${progress}%`;

  prevBtn.disabled = (i===0);
  nextBtn.classList.toggle('hidden', i===steps.length-1);
  submitBtn.classList.toggle('hidden', i!==steps.length-1);

  window.scrollTo({top:0, behavior:'smooth'});
}

function onFieldChange(e){
  const t = e.target;
  if(t.id==='childrenCount' || t.id==='hasChildren'){
    renderChildrenRows();
  }
  if(t.matches('input[type="file"]')){
    updateFileFeedback(t);
  }
  if(t.matches('select, input')){
    refreshConditionals();
  }
}

// ===== Condicionais/Required =====
function refreshConditionals(){
  document.querySelectorAll('.conditional').forEach(block=>{
    const [field, expected] = (block.dataset.showWhen || '').split('=');
    const active = q(field)?.value===expected;
    const wasHidden = block.classList.contains('hidden-by-rule');
    block.classList.toggle('hidden-by-rule', !active);
    if(!active && !wasHidden) clearHiddenFields(block);
  });
  syncRequired();
}

function syncRequired(){
  // Campos de dados obrigatórios por regra
  const req = {
    spouseName:      q('maritalStatus')?.value==='Casado(a)',
    childrenCount:   q('hasChildren')?.value==='Sim',
    hasReservist:    q('biologicalSex')?.value==='Masculino',
    reservistNumber: q('hasReservist')?.value==='Sim',
    dispenseReason:  q('hasReservist')?.value==='Sim',
    ctpsNumber:      q('ctpsType')?.value==='Físico',
    ctpsSeries:      q('ctpsType')?.value==='Físico',
    pisNumber:       q('hasPis')?.value==='Sim',
    otherJobCnpj:    q('hasOtherJob')?.value==='Sim',
    retirementDate:  q('hasRetirement')?.value==='Sim',
    relativeName:    q('hasRelativeAtSnd')?.value==='Sim',
    relationshipDegree: q('hasRelativeAtSnd')?.value==='Sim',
    itauAgency:      q('hasItauAccount')?.value==='Sim',
    itauAccountNumber: q('hasItauAccount')?.value==='Sim'
  };

  Object.entries(req).forEach(([name,required])=>{
    const f = q(name);
    if(f) f.required = required;
  });

  // Todos os inputs de arquivo NÃO são obrigatórios (regra do front)
  form.querySelectorAll('input[type="file"]').forEach(inp=> inp.required = false);

  // Filhos (dados) obrigatórios quando hasChildren = "Sim"
  const childrenRows = document.getElementById('childrenRows');
  childrenRows?.querySelectorAll('input').forEach(inp=>{
    inp.required = (q('hasChildren')?.value==='Sim');
  });
}

function clearHiddenFields(container){
  container.querySelectorAll('input, select').forEach(input=>{
    if(input.type==='file'){
      input.value='';
      updateFileFeedback(input);
    }else if(!input.name?.startsWith('child')){
      input.value='';
    }
  });
}

// ===== Filhos =====
function renderChildrenRows(){
  const childrenRows = document.getElementById('childrenRows');
  const count = Math.min(Math.max(Number(q('childrenCount')?.value || 0),0),10);
  childrenRows.innerHTML='';
  for(let i=0;i<count;i++){
    const row=document.createElement('div');
    row.className='child-row';
    row.innerHTML=`
      <div class="field"><label for="childName_${i}">Nome completo do filho ${i+1} *</label><input id="childName_${i}" name="childName_${i}" type="text"/></div>
      <div class="field"><label for="childBirth_${i}">Dt. Nascimento *</label><input id="childBirth_${i}" name="childBirth_${i}" type="date"/></div>
      <div class="field"><label for="childCpf_${i}">CPF *</label><input id="childCpf_${i}" name="childCpf_${i}" type="text" inputmode="numeric"/></div>`;
    childrenRows.appendChild(row);
  }
  syncRequired();
}

function collectChildrenData(){
  const qty = Number(q('childrenCount')?.value || 0);
  const arr=[];
  for(let i=0;i<qty;i++){
    arr.push({
      nomeCompleto:    q(`childName_${i}`)?.value || '',
      dataNascimento:  q(`childBirth_${i}`)?.value || '',
      cpf:             onlyDigits(q(`childCpf_${i}`)?.value || '')
    });
  }
  return arr;
}

// ===== Upload feedback =====
function initFileUploads(){
  form.querySelectorAll('input[type="file"]').forEach(updateFileFeedback);
}
function updateFileFeedback(input){
  const card=input.closest('.upload-card'); if(!card) return;
  const fb=card.querySelector('.file-feedback');
  const files=Array.from(input.files || []);
  card.classList.toggle('has-file', files.length>0);
  if(fb) fb.textContent = files.length
    ? (files.length===1 ? `✔ ${files[0].name}` : `✔ ${files.length} arquivo(s)`)
    : '';
}

// ===== Validação =====
function clearErrors(panel){
  panel.querySelectorAll('.invalid').forEach(el=>el.classList.remove('invalid'));
  panel.querySelectorAll('.error-text').forEach(el=>el.remove());
}
function setFieldError(field,message){
  const w=field.closest('.field, .upload-card'); if(!w) return;
  w.classList.add('invalid');
  const s=document.createElement('small');
  s.className='error-text';
  s.textContent=message;
  w.appendChild(s);
}
function validateFileInput(input){
  const files=Array.from(input.files || []);
  if(files.length===0) return true; // opcional
  return files.every(f =>
    ALLOWED_EXT.includes((f.name.split('.').pop() || '').toLowerCase()) &&
    f.size<=10*1024*1024
  );
}
function validateCurrentStep(){
  const panel=steps[currentStep];
  clearErrors(panel);
  let valid=true;
  const fields=Array.from(panel.querySelectorAll('input, select')).filter(isVisibleField);

  fields.forEach(field=>{
    if(field.disabled) return;

    if(field.type==='file'){
      if(!validateFileInput(field)){
        valid=false;
        setFieldError(field,'Envie PDF/JPG/JPEG/PNG até 10MB.');
      }
      return;
    }

    if(field.required && !String(field.value || '').trim()){
      valid=false;
      setFieldError(field,'Preenchimento obrigatório.');
    }

    if(field.name==='childrenCount' && field.value){
      const n=Number(field.value);
      if(n<1 || n>10){
        valid=false;
        setFieldError(field,'Informe entre 1 e 10.');
      }
    }
  });

  // Tela de Declaração & Assinatura (step 5)
  if(currentStep===5){
    const agree = gid('declAgree');
    if(agree && !agree.checked){
      valid=false;
      setFieldError(agree,'É obrigatório aceitar a declaração.');
    }
    if(!hasSignatureSelected()){
      valid=false;
      setFieldError(gid('signUpload') || gid('signPad'),
        'Forneça sua assinatura (desenhe ou envie imagem).');
    }
  }
  return valid;
}

// ===== Rascunho =====
function saveDraft(){
  const snap={};
  Array.from(form.elements).forEach(f=>{
    if(!f.name || f.type==='file') return;
    snap[f.name]=f.value;
  });
  localStorage.setItem('sndAdmissionDraftV2', JSON.stringify(snap));
  showToast('Rascunho salvo.');
}
function restoreDraft(){
  const raw=localStorage.getItem('sndAdmissionDraftV2'); if(!raw) return;
  try{
    const s=JSON.parse(raw);
    Object.entries(s).forEach(([n,v])=>{
      const f=q(n);
      if(f && f.type!=='file') f.value=v;
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
  if(!validateCurrentStep()) return;

  if(!ENDPOINT_URL){
    showToast('Erro: URL do serviço ausente.');
    return;
  }

  submitBtn.disabled=true;
  submitBtn.textContent='Enviando…';

  try{
    const payload = await buildFlowPayload();
    const resp = await fetch(ENDPOINT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });

    if(resp.ok){
      showSuccessScreen();
      localStorage.removeItem('sndAdmissionDraftV2');
    }else{
      showToast('Falha ao enviar. Tente novamente.');
    }
  }catch(e){
    console.error(e);
    showToast(e?.message || 'Erro de rede.');
  }finally{
    submitBtn.disabled=false;
    submitBtn.textContent='Concluir cadastro';
  }
}

function showSuccessScreen(){
  successScreen?.classList.remove('hidden');
  form?.classList.add('flow-complete');
  steps.forEach(s=>s.classList.remove('active'));
  timelineItems.forEach(it=>it.classList.add('done'));
  if(progressBar) progressBar.style.width='100%';
  document.querySelector('.footer-actions')?.classList.add('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}
function restartFlow(){
  successScreen?.classList.add('hidden');
  document.querySelector('.footer-actions')?.classList.remove('hidden');
  showStep(0);
}

// ====== Payload ======
function buildPayloadPreview(){
  return {
    dadosPessoais:{
      nomeCompleto:q('fullName')?.value,
      email:q('email')?.value,
      telefone:q('phone')?.value,
      dataNascimento:q('birthDate')?.value,
      localNascimento:q('birthPlace')?.value,
      estadoCivil:q('maritalStatus')?.value,
      nomeConjuge:q('spouseName')?.value,
      escolaridade:q('education')?.value,
      racaCor:q('raceColor')?.value,
      nomePai:q('fatherName')?.value,
      nomeMae:q('motherName')?.value,
      sexoBiologico:q('biologicalSex')?.value,
      possuiFilhos:q('hasChildren')?.value,
      quantidadeFilhos:q('childrenCount')?.value,
      filhos: collectChildrenData(),
      endereco:{
        logradouro:q('street')?.value,
        numero:q('number')?.value,
        complemento:q('complement')?.value,
        bairro:q('district')?.value,
        cidade:q('city')?.value,
        estado:q('state')?.value,
        cep:q('zipCode')?.value
      }
    },
    documentacaoAdmissional:{
      possuiReservista:q('hasReservist')?.value,
      numeroReservista:q('reservistNumber')?.value,
      motivoDispensa:q('dispenseReason')?.value,
      documentoIdentidade:q('identityDoc')?.value,
      orgaoEmissor:q('issuer')?.value,
      dataEmissaoIdentidade:q('identityIssueDate')?.value,
      cpf:q('cpf')?.value,
      ctpsTipo:q('ctpsType')?.value,
      ctpsNumero:q('ctpsNumber')?.value,
      ctpsSerie:q('ctpsSeries')?.value,
      possuiRegistroProfissional:q('hasProfessionalRecord')?.value,
      registroProfissional:q('professionalRecord')?.value,
      orgaoRegistroProfissional:q('professionalIssuer')?.value,
      dataRegistroProfissional:q('professionalIssueDate')?.value,
      tituloEleitor:q('voterTitle')?.value,
      zonaEleitoral:q('voterZone')?.value,
      secaoEleitoral:q('voterSection')?.value,
      dataEmissaoTitulo:q('voterIssueDate')?.value,
      possuiPis:q('hasPis')?.value,
      numeroPis:q('pisNumber')?.value
    }
  };
}

async function buildFlowPayload(){
  const dados = {
    // Tela 1
    nomeCompleto:q('fullName')?.value?.trim(),
    email:q('email')?.value?.trim(),
    telCel:onlyDigits(q('phone')?.value || ''),
    dataNascimento:q('birthDate')?.value,
    localNascimento:q('birthPlace')?.value?.trim(),
    estadoCivil:q('maritalStatus')?.value,
    conjuge:q('spouseName')?.value?.trim(),
    grauEscolaridade:q('education')?.value,
    racaCor:q('raceColor')?.value,
    nomePai:q('fatherName')?.value?.trim(),
    nomeMae:q('motherName')?.value?.trim(),
    sexoBiologico:q('biologicalSex')?.value,
    possuiFilhos:q('hasChildren')?.value,
    qtdFilhos:Number(q('childrenCount')?.value || 0),
    filhos: collectChildrenData(),
    endereco:q('street')?.value?.trim(),
    numero:q('number')?.value?.trim(),
    complemento:q('complement')?.value?.trim(),
    bairro:q('district')?.value?.trim(),
    cidade:q('city')?.value?.trim(),
    estado:q('state')?.value,
    cep:onlyDigits(q('zipCode')?.value || ''),

    // Tela 2
    hasReservista:q('hasReservist')?.value,
    reservistaCodigo:q('reservistNumber')?.value?.trim(),
    dispensaMotivo:q('dispenseReason')?.value?.trim(),
    rgNumero:q('identityDoc')?.value?.trim(),
    rgOrgaoUf:q('issuer')?.value?.trim(),
    rgData:q('identityIssueDate')?.value,
    cpf:onlyDigits(q('cpf')?.value || ''),
    ctpsTipo:q('ctpsType')?.value,
    ctpsNumero:onlyDigits(q('ctpsNumber')?.value || ''),
    ctpsSerie:onlyDigits(q('ctpsSeries')?.value || ''),
    regProfTem:q('hasProfessionalRecord')?.value,
    registroProfissional:q('professionalRecord')?.value?.trim(),
    regProfOrgaoUf:q('professionalIssuer')?.value?.trim(),
    regProfData:q('professionalIssueDate')?.value,
    tituloNumero:onlyDigits(q('voterTitle')?.value || ''),
    tituloZona:onlyDigits(q('voterZone')?.value || ''),
    tituloSecao:onlyDigits(q('voterSection')?.value || ''),
    tituloData:q('voterIssueDate')?.value,
    possuiPis:q('hasPis')?.value,
    pisNumero:onlyDigits(q('pisNumber')?.value || ''),

    // Tela 3
    outroEmprego:q('hasOtherJob')?.value==='Sim' ? 'sim':'nao',
    cnpjEmpresa:onlyDigits(q('otherJobCnpj')?.value || ''),
    aposentado:q('hasRetirement')?.value==='Sim' ? 'sim':'nao',
    dataAposentadoria:q('retirementDate')?.value,
    temParenteSnd:q('hasRelativeAtSnd')?.value==='Sim' ? 'sim':'nao',
    nomeParente:q('relativeName')?.value?.trim(),
    parentesco:q('relationshipDegree')?.value?.trim(),
    contaItauTem:q('hasItauAccount')?.value==='Sim' ? 'sim':'nao',
    agencia:onlyDigits(q('itauAgency')?.value || ''),
    contaCorrente:onlyDigits(q('itauAccountNumber')?.value || '')
  };

  // ANEXOS (todos opcionais)
  const map = [
    { id:'workCard',              label:'CTPS',                             max:1  },
    { id:'identityUpload',        label:'RG',                               max:2  },
    { id:'cpfUpload',             label:'CPF',                              max:1  },
    { id:'reservistUpload',       label:'Certificado_Reservista',           max:1  },
    { id:'voterTitleUpload',      label:'Titulo_Eleitor',                   max:1  },
    { id:'pisUpload',             label:'PIS',                              max:1  },
    { id:'proofOfAddress',        label:'Comprovante_Residencia',           max:1  },
    { id:'marriageCertificate',   label:'Certidao_Casamento',               max:1  },
    { id:'spouseCpfUpload',       label:'CPF_Conjuge',                      max:1  },
    { id:'childrenBirthUpload',   label:'Certidao_Nascimento_Filho',        max:10 },
    { id:'childrenCpfUpload',     label:'CPF_Filho',                        max:10 },
    { id:'itauProofUpload',       label:'Dados_Conta_Bancaria',             max:1  },
    { id:'referenceLetterUpload', label:'Carta_Referencia',                 max:1  },
    { id:'diplomaUpload',         label:'Diploma_Declaracao_Escolaridade',  max:1  },
    { id:'professionalLicenseUpload', label:'Carteira_Registro_Prof',       max:1  }
  ];

  const anexos=[];
  for(const item of map){
    const input=gid(item.id); if(!input) continue;
    const files=Array.from(input.files || []);
    if(!files.length) continue;

    if(files.length > (item.max || 1))
      throw new Error(`"${item.label}": máximo ${item.max} arquivo(s).`);

    let idx=1;
    for(const f of files){
      const ext=(f.name.split('.').pop() || '').toLowerCase();
      if(!ALLOWED_EXT.includes(ext))
        throw new Error(`Tipo não permitido: ${f.name}`);
      if(f.size>10*1024*1024)
        throw new Error(`Arquivo muito grande: ${f.name}`);

      const b64 = await fileToBase64(f);
      const safe = `${item.label}${files.length>1?`_${idx}`:''}.${ext}`;
      anexos.push({
        fileName:safe,
        contentType:b64.contentType || f.type || 'application/octet-stream',
        contentBase64:b64.contentBase64,
        size:f.size
      });
      idx++;
    }
  }

  // Declaração e Assinatura
  const assinaturaDataUrl = await getSignatureDataUrl(); // pode ser null
  const declaracao = {
    texto: 'Declaro veracidade das informações.',
    aceito: !!(gid('declAgree')?.checked),
    assinadoEm: new Date().toISOString(),
    assinatura: assinaturaDataUrl // data:image/png;base64 ou data:image/jpeg;base64
  };

  return {
    metadata:{
      fonte:'form-web-snd',
      versao:'5.0.0',
      enviadoEm:new Date().toISOString(),
      modo:'cadastro'
    },
    dados,
    anexos,
    declaracao
  };
}

async function fileToBase64(f){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{
      const [meta,b64]=String(r.result).split(',');
      const mime=/data:(.*?);base64/.exec(meta)?.[1] || 'application/octet-stream';
      resolve({contentType:mime, contentBase64:b64, dataUrl:String(r.result)});
    };
    r.onerror=reject;
    r.readAsDataURL(f);
  });
}

// ====== Assinatura (canvas + upload) ======
let signing=false, hasStroke=false, last=null;
function bindSignature(){
  const signPad = gid('signPad');
  const clearBtn= gid('clearSignBtn');
  if(!signPad) return;
  const ctx = signPad.getContext('2d');
  ctx.lineWidth = 2.0;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#183553';

  const pos = e => {
    const rect = signPad.getBoundingClientRect();
    const p = ('touches' in e) ? e.touches[0] : e;
    return {
      x: (p.clientX - rect.left) * (signPad.width / rect.width),
      y: (p.clientY - rect.top) * (signPad.height / rect.height)
    };
  };
  const start = e => {
    signing = true;
    hasStroke = true;
    last = pos(e);
    e.preventDefault();
  };
  const move = e => {
    if(!signing) return;
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
  window.addEventListener('mouseup', end);

  signPad.addEventListener('touchstart', start, {passive:false});
  signPad.addEventListener('touchmove', move, {passive:false});
  signPad.addEventListener('touchend', end);

  clearBtn?.addEventListener('click', ()=>{
    ctx.clearRect(0,0,signPad.width,signPad.height);
    hasStroke = false;
  });
}
function hasSignatureSelected(){
  const file = gid('signUpload')?.files?.[0];
  if(file) return true;
  return hasStroke; // desenho no canvas
}
async function getSignatureDataUrl(){
  // Prioridade: upload de assinatura
  const file = gid('signUpload')?.files?.[0];
  if(file){
    const ext=(file.name.split('.').pop() || '').toLowerCase();
    if(!['jpg','jpeg','png'].includes(ext))
      throw new Error('Assinatura: envie JPG/JPEG/PNG.');
    if(file.size>10*1024*1024)
      throw new Error('Assinatura: arquivo >10MB.');
    const data = await fileToBase64(file);
    return data.dataUrl; // data:image/...
  }
  // Se não houver upload, usa o canvas (se houver traço)
  const signPad = gid('signPad');
  if(signPad && hasStroke) return signPad.toDataURL('image/png');
  return null;
}

// ====== Minha Área (Candidato) ======
function bindCandidateArea(){
  const loginForm = gid('candLoginForm');
  const msg = gid('candLoginMsg');
  const area = gid('candArea');
  const resumo = gid('candResumo');
  const upForm = gid('candUploadForm');
  const upInput = gid('candUpFiles');
  const upMsg = gid('candUpMsg');

  loginForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent='';

    if(!ENDPOINT_URL){
      msg.textContent='Erro: URL do serviço ausente.';
      return;
    }

    const email = gid('candEmail')?.value?.trim();
    if(!email){
      msg.textContent='Informe o e-mail.';
      return;
    }

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
      if(!resp.ok){
        msg.textContent='Cadastro não localizado.';
        return;
      }
      const data = await resp.json();
      const d = data?.dados || {};

      resumo.innerHTML = `
        <div class="field readonly"><label>Nome</label><span>${d.NomeCompleto || '-'}</span></div>
        <div class="field readonly"><label>E-mail</label><span>${d.Email || email}</span></div>
        <div class="field readonly"><label>Telefone</label><span>${d.TelCel || '-'}</span></div>
        <div class="field readonly"><label>Estado civil</label><span>${d.EstadoCivil || '-'}</span></div>
      `;

      upForm.elements.email.value = email;
      area.classList.remove('hidden');
    }catch(err){
      console.error(err);
      msg.textContent='Erro de rede.';
    }
  });

  upForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    upMsg.textContent='';

    if(!ENDPOINT_URL){
      upMsg.textContent='Erro: URL do serviço ausente.';
      return;
    }

    const email = upForm.elements.email.value?.trim();
    const files = Array.from(upInput?.files || []);
    if(files.length===0){
      upMsg.textContent='Selecione ao menos um arquivo.';
      return;
    }

    const anexos=[];
    for(const f of files){
      const ext=(f.name.split('.').pop() || '').toLowerCase();
      if(!ALLOWED_EXT.includes(ext)){
        upMsg.textContent=`Tipo não permitido: ${f.name}`;
        return;
      }
      if(f.size>10*1024*1024){
        upMsg.textContent=`Arquivo grande: ${f.name}`;
        return;
      }
      const b64 = await fileToBase64(f);
      anexos.push({
        fileName:`Outros_${f.name}`,
        contentType:b64.contentType || f.type || 'application/octet-stream',
        contentBase64:b64.contentBase64,
        size:f.size
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
      if(resp.ok){
        upMsg.textContent='Arquivos enviados.';
        upForm.reset();
      } else {
        upMsg.textContent='Falha ao enviar.';
      }
    }catch(err){
      console.error(err);
      upMsg.textContent='Erro de rede.';
    }
  });
}

// ====== Portal do Consultor ======
const DEFAULT_PASSWORD_HASH =
  "d033e22ae348aeb5660fc2140aec35850c4da997"; // exemplo: "admin" SHA‑1 (apenas ilustrativo)

function openChangePasswordDialog(email) {
  if(!dlgAlterarSenha) return;
  const emailInput = gid('cpEmail');
  if(emailInput) emailInput.value = email || '';
  dlgAlterarSenha.showModal();
}
function closeChangePasswordDialog() {
  dlgAlterarSenha?.close();
}

function bindConsultantPortal(){
  const loginForm = gid('consLoginForm2');
  const msg = gid('consLoginMsg2');
  const dash = gid('consDash');
  const consTag = gid('consTag');
  const searchBox = gid('searchBox2');
  const drop = gid('drop2');
  const candPanel = gid('candPanel2');
  const candName = gid('candName2');
  const candEmail = gid('candEmail2');
  const candStatus = gid('candStatus2');
  const progFill = gid('progFill2');
  const progPct = gid('progPct2');
  const chkMissing = gid('chkMissing2');
  const chkPresent = gid('chkPresent2');
  const notifyForm = gid('notifyForm2');
  const notifyMsg = gid('notifyMsg2');

  loginForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    msg.textContent='';

    if(!ENDPOINT_URL){
      msg.textContent='Erro: URL do serviço ausente.';
      return;
    }

    const email = gid('consEmail2')?.value?.trim().toLowerCase();
    const pass = gid('consPass2')?.value || '';
    if(!email || !pass){
      msg.textContent='Preencha e-mail e senha.';
      return;
    }

    const hash = await sha256Hex(pass);
    if (hash === DEFAULT_PASSWORD_HASH){
      msg.textContent = 'Senha padrão identificada. Defina uma nova senha para continuar.';
      openChangePasswordDialog(email);
      return;
    }

    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ metadata:{ modo:'consultor_login' }, cred:{ email, hash } })
      });
      const data = await resp.json().catch(()=> ({}));
      if(!resp.ok || !data?.ok){
        msg.textContent=data?.mensagem || 'Credenciais inválidas.';
        return;
      }
      consTag.textContent = data?.nome ? `Consultor · ${data.nome}` : `Consultor · ${email}`;
      dash.classList.remove('hidden');
      searchBox.focus();
    }catch(err){
      console.error(err);
      msg.textContent='Erro de rede no login.';
    }
  });

  const changePassForm = gid('changePassForm');
  changePassForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const cpMsg = gid('cpMsg');
    cpMsg.textContent = '';

    if(!PASSWORD_CHANGE_URL){
      cpMsg.textContent = 'Erro: URL de alteração de senha ausente.';
      return;
    }

    const email = gid('cpEmail')?.value?.trim().toLowerCase() || '';
    const senhaAtual = gid('cpCurrent')?.value || '';
    const novaSenha = gid('cpNew')?.value || '';
    const repetir   = gid('cpConfirm')?.value || '';

    if(!email || !senhaAtual || !novaSenha || !repetir){
      cpMsg.textContent = 'Preencha todos os campos.';
      return;
    }
    if(novaSenha !== repetir){
      cpMsg.textContent = 'A nova senha e a confirmação não coincidem.';
      return;
    }

    try{
      const senhaAtualHash = await sha256Hex(senhaAtual);
      const novaSenhaHash  = await sha256Hex(novaSenha);

      const resp = await fetch(PASSWORD_CHANGE_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          metadata:{ modo:'consultor_alterar_senha', enviadoEm:new Date().toISOString() },
          alterar:{ email, senhaAtualHash, novaSenhaHash }
        })
      });
      const data = await resp.json().catch(()=> ({}));

      if(resp.ok && (data?.ok ?? true)){
        cpMsg.textContent = data?.mensagem || 'Senha atualizada com sucesso.';
        showToast('Nova senha registrada. Faça login novamente.');
        closeChangePasswordDialog();
        gid('consEmail2').value = email;
        gid('consPass2').value = '';
        showStep(7);
      }else{
        cpMsg.textContent = data?.mensagem || 'Falha ao atualizar a senha.';
      }
    }catch(err){
      console.error(err);
      cpMsg.textContent = 'Erro de rede ao atualizar senha.';
    }
  });

  const doSearch = debounce(async ()=>{
    const q = (searchBox.value || '').trim();
    if(q.length<2){
      drop.innerHTML='';
      drop.classList.add('hidden');
      return;
    }
    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ metadata:{ modo:'consultor_busca' }, filtro:{ q } })
      });
      const data = await resp.json().catch(()=> ({}));
      const items = data?.items || [];
      if(!items.length){
        drop.innerHTML='';
        drop.classList.add('hidden');
        return;
      }
      drop.innerHTML = items.map(i=>
        `<button type="button" data-email="${i.email}" data-nome="${i.nome}">${i.nome} · <small>${i.email}</small></button>`
      ).join('');
      drop.classList.remove('hidden');
    }catch{
      drop.innerHTML='';
      drop.classList.add('hidden');
    }
  }, 260);

  searchBox?.addEventListener('input', doSearch);

  drop?.addEventListener('click',(e)=>{
    const b=e.target.closest('button'); if(!b) return;
    showCandidateDetail({ email:b.dataset.email, nome:b.dataset.nome });
    drop.classList.add('hidden');
  });

  async function showCandidateDetail({email,nome}){
    candName.textContent = nome || '—';
    candEmail.textContent = email || '—';
    chkMissing.innerHTML='';
    chkPresent.innerHTML='';
    progFill.style.width='0%';
    progPct.textContent='0%';
    candPanel.classList.remove('hidden');

    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ metadata:{ modo:'consultor_detalhe' }, filtro:{ email } })
      });
      const d = await resp.json().catch(()=> ({}));
      const pct = Number(d?.progresso?.percent || 0);
      progFill.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;
      candStatus.textContent = pct>=100?'Concluído':'Em andamento';

      const missing = d?.progresso?.missing || [];
      const present = d?.progresso?.present || [];

      chkMissing.innerHTML = missing.length
        ? missing.map(x=>`<li>☐ ${x}</li>`).join('')
        : '<li>— sem pendências —</li>';
      chkPresent.innerHTML = present.length
        ? present.map(x=>`<li>✔ ${x}</li>`).join('')
        : '<li>—</li>';

      notifyForm.dataset.email = email;
      notifyForm.dataset.missing = JSON.stringify(missing);
    }catch(err){
      console.error(err);
      showToast('Falha ao carregar detalhes.');
    }
  }

  notifyForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    notifyMsg.textContent='';

    if(!ENDPOINT_URL){
      notifyMsg.textContent='Erro: URL do serviço ausente.';
      return;
    }

    const email = notifyForm.dataset.email || '';
    const fd = new FormData(notifyForm);
    const prazo = fd.get('prazo');
    const remetente = fd.get('remetente');
    const mensagem = fd.get('mensagem') || '';

    if(!email || !prazo || !remetente){
      notifyMsg.textContent='Preencha prazo e remetente.';
      return;
    }

    try{
      const missing = JSON.parse(notifyForm.dataset.missing || '[]');
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          metadata:{ modo:'consultor_notificar', enviadoEm:new Date().toISOString() },
          filtro:{ email },
          notificacao:{ prazo, remetente, mensagem, missing }
        })
      });
      const data = await resp.json().catch(()=> ({}));
      notifyMsg.textContent =
        resp.ok && data?.ok ? 'Notificação enviada.' :
        (data?.mensagem || 'Falha ao enviar.');
    }catch(err){
      console.error(err);
      notifyMsg.textContent='Erro de rede.';
    }
  });
}

// ====== Logins rápidos da tela inicial (navegam para as telas internas) ======
function bindQuickLogins(){
  const qlCandForm = gid('quickLoginCandidate');
  qlCandForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = gid('qlCandEmail')?.value?.trim();
    if(!email){
      showToast('Informe o e-mail do candidato.');
      return;
    }
    gid('candEmail').value = email;
    showStep(6);
  });

  const qlConsForm = gid('quickLoginConsultor');
  qlConsForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = gid('qlConsEmail')?.value?.trim().toLowerCase();
    const pass = gid('qlConsPass')?.value || '';
    if(!email || !pass){
      showToast('Informe e-mail e senha do consultor.');
      return;
    }
    const hash = await sha256Hex(pass);
    if (hash === DEFAULT_PASSWORD_HASH){
      openChangePasswordDialog(email);
      return;
    }
    gid('consEmail2').value = email;
    gid('consPass2').value = pass;
    showStep(7);
  });
}

// ====== Cripto SHA‑256 (hex) ======
async function sha256Hex(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
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
