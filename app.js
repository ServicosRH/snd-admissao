/* SND – Portal Admissional V2.3
   Integração Power Automate + validações adicionais
   Mantém seu wizard/condicionais e adiciona POST ao Flow.
   Base visual/IDs: index.html (seu arquivo)  ─> [1](https://mailsnd-my.sharepoint.com/personal/vagner_moraes_snd_com_br/Documents/Arquivos%20de%20Microsoft%20Copilot%20Chat/README.md)
   Base do wizard/validações originais: script.js (seu) ─> [2](https://mailsnd-my.sharepoint.com/personal/vagner_moraes_snd_com_br/Documents/Arquivos%20de%20Microsoft%20Copilot%20Chat/style.css)
*/

let ENDPOINT_URL = null;
fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
  if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
});

// ======= Seletores e metadados do wizard (mantidos do seu script) =======
const form = document.getElementById('admissionForm');
const steps = Array.from(document.querySelectorAll('.step-card'));
const timelineItems = Array.from(document.querySelectorAll('#timeline .step-nav-btn'));
const progressBar = document.getElementById('progressBar');
const stepCounter = document.getElementById('stepCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const previewBtn = document.getElementById('previewBtn');
const startFlowBtn = document.getElementById('startFlowBtn');
const footerTitle = document.getElementById('footerTitle');
const footerText = document.getElementById('footerText');
const toast = document.getElementById('toast');
const childrenRows = document.getElementById('childrenRows');
const payloadPreview = document.getElementById('payloadPreview');
const togglePayloadBtn = document.getElementById('togglePayloadBtn');
const summaryDialog = document.getElementById('summaryDialog');
const summaryContent = document.getElementById('summaryContent');
const closeSummaryBtn = document.getElementById('closeSummaryBtn');
const successScreen = document.getElementById('successScreen');
const restartBtn = document.getElementById('restartBtn');
const successSummaryBtn = document.getElementById('successSummaryBtn');

// Extensões permitidas (mantidas conforme seu layout)
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];  // [1](https://mailsnd-my.sharepoint.com/personal/vagner_moraes_snd_com_br/Documents/Arquivos%20de%20Microsoft%20Copilot%20Chat/README.md)

const stepMeta = [
  { title: 'Boas-vindas', desc: 'Avance para iniciar o preenchimento do portal.' },
  { title: 'Dados pessoais', desc: 'Preencha informações pessoais, dependentes e endereço.' },
  { title: 'Documentação admissional', desc: 'Informe documentação civil, PIS, CTPS e dados eleitorais.' },
  { title: 'Dados complementares', desc: 'Registre informações adicionais para o processo interno.' },
  { title: 'Documentos obrigatórios', desc: 'Envie os anexos com validação de formato e regras condicionais.' }
];

let currentStep = 0;

// ======= Utilitários =======
const q = name => form.elements[name];
const gid = id => document.getElementById(id);
const onlyDigits = v => (v||'').replace(/\D+/g,'');
function showToast(message){ toast.textContent = message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 2800); }
function isVisibleField(el){ // visibilidade por classe de regra ou CSS
  if (!el) return false;
  const card = el.closest('.step-card');
  const hiddenByRule = el.closest('.hidden-by-rule');
  return card?.classList.contains('active') && !hiddenByRule && !el.disabled;
}

// ======= Navegação (mantida) =======
function bindEvents(){
  prevBtn.addEventListener('click', ()=>{ if(currentStep>0) showStep(currentStep-1); });
  nextBtn.addEventListener('click', ()=>{ if(!validateCurrentStep()) return; if(currentStep<steps.length-1) showStep(currentStep+1); });
  saveDraftBtn.addEventListener('click', saveDraft);
  previewBtn?.addEventListener('click', openSummary);
  startFlowBtn?.addEventListener('click', ()=> showStep(1));
  timelineItems.forEach((btn, idx)=>{
    btn.addEventListener('click', ()=>{
      if(idx===currentStep) return;
      if(idx>currentStep && !validateCurrentStep()) return;
      showStep(idx);
    });
  });
  closeSummaryBtn.addEventListener('click', ()=> summaryDialog.close());
  restartBtn?.addEventListener('click', restartFlow);
  successSummaryBtn?.addEventListener('click', openSummary);

  togglePayloadBtn.addEventListener('click', ()=>{
    payloadPreview.classList.toggle('collapsed');
    togglePayloadBtn.textContent = payloadPreview.classList.contains('collapsed') ? 'Exibir payload' : 'Ocultar payload';
  });

  form.addEventListener('input', handleFieldEvents);
  form.addEventListener('change', handleFieldEvents);

  // SUBMIT REAL → ENVIO AO FLOW
  form.addEventListener('submit', async (event)=>{
    event.preventDefault();
    if(!validateCurrentStep()) return;
    if(!ENDPOINT_URL){ showToast('Erro: config.json não encontrado ou endpointUrl ausente.'); return; }

    // Validação especial de filhos x uploads (sua regra 3)
    if(q('hasChildren')?.value === 'Sim'){
      const count = Number(q('childrenCount')?.value||0);
      if(count<1){ showToast('Informe a quantidade de filhos.'); return; }
      const cert = gid('childrenBirthUpload')?.files || [];
      const cpfs = gid('childrenCpfUpload')?.files || [];
      if(cert.length < count){ showToast(`Anexe pelo menos ${count} certidão(ões) de nascimento.`); return; }
      if(cpfs.length < count){ showToast(`Anexe pelo menos ${count} CPF(s) dos filhos.`); return; }
    }

    // Monta payload e envia
    submitBtn.disabled = true; submitBtn.textContent = 'Enviando…';
    try{
      const payload = await buildFlowPayload(); // inclui anexos base64
      const resp = await fetch(ENDPOINT_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(resp.ok){
        // Sucesso → tela final visual
        showSuccessScreen();
        localStorage.removeItem('sndAdmissionDraftV2');
      }else{
        showToast('Falha ao enviar. Verifique os campos e tente novamente.');
      }
    }catch(err){
      console.error(err);
      showToast('Erro de rede ao enviar.');
    }finally{
      submitBtn.disabled = false; submitBtn.textContent = 'Concluir cadastro';
    }
  });
}

function showStep(stepIndex){
  if(successScreen) successScreen.classList.add('hidden');
  form?.classList.remove('flow-complete');
  currentStep = stepIndex;
  steps.forEach((s,i)=> s.classList.toggle('active', i===stepIndex));
  timelineItems.forEach((it,i)=>{ it.classList.toggle('active', i===stepIndex); it.classList.toggle('done', i<stepIndex); });
  const progress = ((stepIndex+1)/steps.length)*100;
  if(progressBar) progressBar.style.width = `${progress}%`;
  stepCounter.textContent = `${stepIndex+1}/${steps.length}`;
  footerTitle.textContent = stepMeta[stepIndex].title;
  footerText.textContent = stepMeta[stepIndex].desc;
  prevBtn.disabled = (stepIndex===0);
  nextBtn.classList.toggle('hidden', stepIndex===steps.length-1);
  submitBtn.classList.toggle('hidden', stepIndex!==steps.length-1);
  window.scrollTo({top:0, behavior:'smooth'});
}

function handleFieldEvents(e){
  const t = e.target;
  if(t.id==='childrenCount' || t.id==='hasChildren'){ renderChildrenRows(); }
  if(t.matches('input[type="file"]')){ updateFileFeedback(t); }
  if(t.matches('select, input')){ refreshConditionals(); updatePayloadPreview(); }
}

// ======= Condicionais (regras já existentes + complementos) =======
function refreshConditionals(){
  document.querySelectorAll('.conditional').forEach(block=>{
    const rule = (block.dataset.showWhen || '').split('=');
    const field = rule[0]; const expected = rule[1];
    const active = (q(field)?.value === expected);
    const wasHidden = block.classList.contains('hidden-by-rule');
    block.classList.toggle('hidden-by-rule', !active);
    if(!active && !wasHidden) clearHiddenFields(block);
  });

  syncConditionalRequirements();
}

function syncConditionalRequirements(){
  const requiredMap = {
    spouseName: q('maritalStatus')?.value === 'Casado(a)',

    // filhos
    childrenCount: q('hasChildren')?.value === 'Sim',

    // reservista
    hasReservist: q('biologicalSex')?.value === 'Masculino',
    reservistNumber: q('hasReservist')?.value === 'Sim',
    dispenseReason: q('hasReservist')?.value === 'Sim',

    // ctps
    ctpsNumber: q('ctpsType')?.value === 'Físico',
    ctpsSeries: q('ctpsType')?.value === 'Físico',

    // pis
    pisNumber: q('hasPis')?.value === 'Sim',

    // complementares
    otherJobCnpj: q('hasOtherJob')?.value === 'Sim',
    retirementDate: q('hasRetirement')?.value === 'Sim',
    relativeName: q('hasRelativeAtSnd')?.value === 'Sim',
    relationshipDegree: q('hasRelativeAtSnd')?.value === 'Sim',

    // Itaú (dados + upload)
    itauAgency: q('hasItauAccount')?.value === 'Sim',
    itauAccountNumber: q('hasItauAccount')?.value === 'Sim',
    itauProofUpload: q('hasItauAccount')?.value === 'Sim',

    // uploads condicionais
    reservistUpload: q('hasReservist')?.value === 'Sim',
    pisUpload: q('hasPis')?.value === 'Sim',
    marriageCertificate: q('maritalStatus')?.value === 'Casado(a)',
    spouseCpfUpload: q('maritalStatus')?.value === 'Casado(a)',
    childrenBirthUpload: q('hasChildren')?.value === 'Sim',
    childrenCpfUpload: q('hasChildren')?.value === 'Sim',

    // fixos
    educationUpload: true
  };
  Object.entries(requiredMap).forEach(([name, req])=>{
    const f = q(name);
    if(f) f.required = req;
  });

  // marca obrigatoriedade nos inputs gerados de filhos
  childrenRows.querySelectorAll('input').forEach(inp=>{
    inp.required = (q('hasChildren')?.value === 'Sim');
  });
}

function clearHiddenFields(container){
  container.querySelectorAll('input, select').forEach(input=>{
    if(input.type==='file'){ input.value=''; updateFileFeedback(input); }
    else if(!input.name.startsWith('child')){ input.value=''; }
  });
}

// ======= Filhos: linhas dinâmicas (layout) =======
function renderChildrenRows(){
  const count = Math.min(Math.max(Number(q('childrenCount')?.value||0),0),10);
  childrenRows.innerHTML = '';
  for(let i=0;i<count;i++){
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
  syncConditionalRequirements();
}

// ======= Feedback de upload (layout) =======
function initFileUploads(){
  form.querySelectorAll('input[type="file"]').forEach(updateFileFeedback);
}
function updateFileFeedback(input){
  const card = input.closest('.upload-card'); if(!card) return;
  const feedback = card.querySelector('.file-feedback');
  const files = Array.from(input.files||[]);
  card.classList.toggle('has-file', files.length>0);
  if(!feedback) return;
  if(!files.length){ feedback.textContent=''; return; }
  feedback.textContent = files.length===1 ? `✔ ${files[0].name}` : `✔ ${files.length} arquivo(s) selecionado(s)`;
}

// ======= Validação básica por etapa (mantida/ajustada) =======
function validateFileInput(input){
  const files = Array.from(input.files||[]);
  if(input.required && files.length===0) return false;
  return files.every(f=>{
    const ext = f.name.split('.').pop()?.toLowerCase();
    const sizeOk = f.size <= 10*1024*1024;
    return ALLOWED_EXT.includes(ext) && sizeOk;
  });
}
function validateCurrentStep(){
  const panel = steps[currentStep];
  clearErrors(panel);
  let valid = true;
  const fields = Array.from(panel.querySelectorAll('input, select')).filter(isVisibleField);

  fields.forEach(field=>{
    if(field.disabled) return;
    if(field.type==='file'){
      if(!validateFileInput(field)){
        valid = false; setFieldError(field, 'Envie PDF/JPG/JPEG/PNG até 10MB.');
      }
      if(field.id==='identityUpload' && field.files.length>2){
        valid = false; setFieldError(field, 'Envie no máximo 2 arquivos para Identidade.');
      }
      return;
    }
    if(field.required && !String(field.value||'').trim()){
      valid = false; setFieldError(field, 'Preenchimento obrigatório.');
    }
    if(field.name==='childrenCount' && field.value){
      const qty = Number(field.value); if(qty<1 || qty>10){
        valid = false; setFieldError(field, 'Informe uma quantidade entre 1 e 10.');
      }
    }
  });

  if(currentStep===1 && q('hasChildren')?.value==='Sim'){
    childrenRows.querySelectorAll('input').forEach(inp=>{
      if(!String(inp.value||'').trim()){ valid=false; setFieldError(inp, 'Preenchimento obrigatório.'); }
    });
  }
  return valid;
}

function clearErrors(panel){
  panel.querySelectorAll('.invalid').forEach(el=>el.classList.remove('invalid'));
  panel.querySelectorAll('.error-text').forEach(el=>el.remove());
}
function setFieldError(field, message){
  const wrapper = field.closest('.field, .upload-card'); if(!wrapper) return;
  wrapper.classList.add('invalid');
  const small = document.createElement('small'); small.className='error-text'; small.textContent = message;
  wrapper.appendChild(small);
}

// ======= Rascunho local (mantido) =======
function saveDraft(){
  const snapshot={};
  Array.from(form.elements).forEach(field=>{
    if(!field.name || field.type==='file') return;
    snapshot[field.name] = field.value;
  });
  localStorage.setItem('sndAdmissionDraftV2', JSON.stringify(snapshot));
  showToast('Rascunho salvo neste navegador.');
}
function restoreDraft(){
  const raw = localStorage.getItem('sndAdmissionDraftV2'); if(!raw) return;
  try{
    const data = JSON.parse(raw);
    Object.entries(data).forEach(([name,val])=>{ const f=q(name); if(f && f.type!=='file') f.value = val; });
  }catch(e){ console.error('Falha ao restaurar rascunho', e); }
}

// ======= Resumo técnico (mantido) =======
function openSummary(){
  updatePayloadPreview();
  const payload = buildPayloadPreview();
  summaryContent.innerHTML = buildSummaryMarkup(payload);
  summaryDialog.showModal();
}
function buildSummaryMarkup(pre){
  const ch = pre.dadosPessoais.filhos||[];
  return `
    <section class="summary-block">
      <h4>Dados pessoais</h4>
      <ul>
        <li><span>Nome</span><span>${pre.dadosPessoais.nomeCompleto||'-'}</span></li>
        <li><span>E-mail</span><span>${pre.dadosPessoais.email||'-'}</span></li>
        <li><span>Telefone</span><span>${pre.dadosPessoais.telefone||'-'}</span></li>
        <li><span>Estado civil</span><span>${pre.dadosPessoais.estadoCivil||'-'}</span></li>
        <li><span>Possui filhos</span><span>${pre.dadosPessoais.possuiFilhos||'-'}</span></li>
        <li><span>Qtd. filhos</span><span>${pre.dadosPessoais.quantidadeFilhos||'0'}</span></li>
      </ul>
    </section>
    <section class="summary-block">
      <h4>Endereço</h4>
      <ul>
        <li><span>Logradouro</span><span>${pre.dadosPessoais.endereco.logradouro||'-'}</span></li>
        <li><span>Número</span><span>${pre.dadosPessoais.endereco.numero||'-'}</span></li>
        <li><span>Cidade/UF</span><span>${pre.dadosPessoais.endereco.cidade||'-'}/${pre.dadosPessoais.endereco.estado||'-'}</span></li>
        <li><span>CEP</span><span>${pre.dadosPessoais.endereco.cep||'-'}</span></li>
      </ul>
    </section>
    <section class="summary-block">
      <h4>Documentação</h4>
      <ul>
        <li><span>CPF</span><span>${pre.documentacaoAdmissional.cpf||'-'}</span></li>
        <li><span>CTPS (tipo)</span><span>${pre.documentacaoAdmissional.ctpsTipo||'-'}</span></li>
        <li><span>Título de Eleitor</span><span>${pre.documentacaoAdmissional.tituloEleitor||'-'}</span></li>
        <li><span>Possui PIS</span><span>${pre.documentacaoAdmissional.possuiPis||'-'}</span></li>
        <li><span>PIS Nº</span><span>${pre.documentacaoAdmissional.numeroPis||'-'}</span></li>
      </ul>
    </section>
    <section class="summary-block">
      <h4>Dependentes</h4>
      <ul>
        ${ch.length? ch.map((c,i)=>`<li><span>Filho ${i+1}</span><span>${c.nomeCompleto||'-'} · ${c.dataNascimento||'-'} · ${c.cpf||'-'}</span></li>`).join('') : '<li><span>Dependentes</span><span>Não informado</span></li>'}
      </ul>
    </section>`;
}
function buildPayloadPreview(){
  // Estrutura só para pré-visualização técnica (sem anexos)
  return {
    dadosPessoais:{
      nomeCompleto: q('fullName')?.value, email: q('email')?.value, telefone: q('phone')?.value,
      dataNascimento: q('birthDate')?.value, localNascimento: q('birthPlace')?.value,
      estadoCivil: q('maritalStatus')?.value, nomeConjuge: q('spouseName')?.value,
      escolaridade: q('education')?.value, racaCor: q('raceColor')?.value,
      nomePai: q('fatherName')?.value, nomeMae: q('motherName')?.value, sexoBiologico: q('biologicalSex')?.value,
      possuiFilhos: q('hasChildren')?.value,
      quantidadeFilhos: q('childrenCount')?.value,
      filhos: collectChildrenData(),
      endereco:{
        logradouro: q('street')?.value, numero: q('number')?.value, complemento: q('complement')?.value,
        bairro: q('district')?.value, cidade: q('city')?.value, estado: q('state')?.value, cep: q('zipCode')?.value
      }
    },
    documentacaoAdmissional:{
      possuiReservista: q('hasReservist')?.value, numeroReservista: q('reservistNumber')?.value, motivoDispensa: q('dispenseReason')?.value,
      documentoIdentidade: q('identityDoc')?.value, orgaoEmissor: q('issuer')?.value, dataEmissaoIdentidade: q('identityIssueDate')?.value,
      cpf: q('cpf')?.value, ctpsTipo: q('ctpsType')?.value, ctpsNumero: q('ctpsNumber')?.value, ctpsSerie: q('ctpsSeries')?.value,
      possuiRegistroProfissional: q('hasProfessionalRecord')?.value, registroProfissional: q('professionalRecord')?.value,
      orgaoRegistroProfissional: q('professionalIssuer')?.value, dataRegistroProfissional: q('professionalIssueDate')?.value,
      tituloEleitor: q('voterTitle')?.value, zonaEleitoral: q('voterZone')?.value, secaoEleitoral: q('voterSection')?.value, dataEmissaoTitulo: q('voterIssueDate')?.value,
      possuiPis: q('hasPis')?.value, numeroPis: q('pisNumber')?.value
    }
  };
}
function updatePayloadPreview(){
  payloadPreview.textContent = JSON.stringify(buildPayloadPreview(), null, 2);
}
function collectChildrenData(){
  const qty = Number(q('childrenCount')?.value||0);
  const arr=[];
  for(let i=0;i<qty;i++){
    arr.push({
      nomeCompleto: q(`childName_${i}`)?.value||'',
      dataNascimento: q(`childBirth_${i}`)?.value||'',
      cpf: onlyDigits(q(`childCpf_${i}`)?.value||'')
    });
  }
  return arr;
}

// ======= Montagem do PAYLOAD para o Flow =======
async function buildFlowPayload(){
  // 1) DADOS
  const dados = {
    // Tela 1
    nomeCompleto: q('fullName')?.value?.trim(),
    email: q('email')?.value?.trim(),
    telCel: onlyDigits(q('phone')?.value||''),
    dataNascimento: q('birthDate')?.value,
    localNascimento: q('birthPlace')?.value?.trim(),
    estadoCivil: q('maritalStatus')?.value,
    conjuge: q('spouseName')?.value?.trim(),
    grauEscolaridade: q('education')?.value,
    racaCor: q('raceColor')?.value,
    nomePai: q('fatherName')?.value?.trim(),
    nomeMae: q('motherName')?.value?.trim(),
    sexoBiologico: q('biologicalSex')?.value,

    // Filhos
    possuiFilhos: q('hasChildren')?.value,
    qtdFilhos: Number(q('childrenCount')?.value||0),
    filhos: collectChildrenData(),

    // Endereço
    endereco: q('street')?.value?.trim(),
    numero: q('number')?.value?.trim(),
    complemento: q('complement')?.value?.trim(),
    bairro: q('district')?.value?.trim(),
    cidade: q('city')?.value?.trim(),
    estado: q('state')?.value,
    cep: onlyDigits(q('zipCode')?.value||''),

    // Documentação (Tela 2)
    hasReservista: q('hasReservist')?.value,
    reservistaCodigo: q('reservistNumber')?.value?.trim(),
    dispensaMotivo: q('dispenseReason')?.value?.trim(),

    rgNumero: q('identityDoc')?.value?.trim(),
    rgOrgaoUf: q('issuer')?.value?.trim(),
    rgData: q('identityIssueDate')?.value,

    cpf: onlyDigits(q('cpf')?.value||''),

    ctpsTipo: q('ctpsType')?.value,
    ctpsNumero: onlyDigits(q('ctpsNumber')?.value||''),
    ctpsSerie: onlyDigits(q('ctpsSeries')?.value||''),

    regProfTem: q('hasProfessionalRecord')?.value,
    registroProfissional: q('professionalRecord')?.value?.trim(),
    regProfOrgaoUf: q('professionalIssuer')?.value?.trim(),
    regProfData: q('professionalIssueDate')?.value,

    tituloNumero: onlyDigits(q('voterTitle')?.value||''),
    tituloZona: onlyDigits(q('voterZone')?.value||''),
    tituloSecao: onlyDigits(q('voterSection')?.value||''),
    tituloData: q('voterIssueDate')?.value,

    possuiPis: q('hasPis')?.value,
    pisNumero: onlyDigits(q('pisNumber')?.value||''),

    // Complementares (Tela 3)
    outroEmprego: q('hasOtherJob')?.value==='Sim' ? 'sim':'nao',
    cnpjEmpresa: onlyDigits(q('otherJobCnpj')?.value||''),
    aposentado: q('hasRetirement')?.value==='Sim' ? 'sim':'nao',
    dataAposentadoria: q('retirementDate')?.value,
    temParenteSnd: q('hasRelativeAtSnd')?.value==='Sim' ? 'sim':'nao',
    nomeParente: q('relativeName')?.value?.trim(),
    parentesco: q('relationshipDegree')?.value?.trim(),

    contaItauTem: q('hasItauAccount')?.value==='Sim' ? 'sim':'nao',
    agencia: onlyDigits(q('itauAgency')?.value||''),
    contaCorrente: onlyDigits(q('itauAccountNumber')?.value||''),

    // Compatibilidade
    checklist:{ rg:false, cpf:false, comprovEndereco:false, carteiraTrabalho:false, certidao:false, comprovEscolaridade:false }
  };

  // 2) ANEXOS
  const uploads = [
    { id:'workCard',              label:'CTPS',                       max:1 },
    { id:'identityUpload',        label:'RG',                         max:2 },
    { id:'cpfUpload',             label:'CPF',                        max:1 },
    { id:'reservistUpload',       label:'Certificado_Reservista',     max:1, required: ()=> (q('biologicalSex')?.value==='Masculino' && q('hasReservist')?.value==='Sim') },
    { id:'voterTitleUpload',      label:'Titulo_Eleitor',             max:1 },
    { id:'pisUpload',             label:'PIS',                        max:1, required: ()=> q('hasPis')?.value==='Sim' },
    { id:'proofOfAddress',        label:'Comprovante_Residencia',     max:1 },
    { id:'marriageCertificate',   label:'Certidao_Casamento',         max:1, required: ()=> q('maritalStatus')?.value==='Casado(a)' },
    { id:'spouseCpfUpload',       label:'CPF_Conjuge',                max:1, required: ()=> q('maritalStatus')?.value==='Casado(a)' }, // (1) manter
    { id:'childrenBirthUpload',   label:'Certidao_Nascimento_Filho',  max:10, required: ()=> q('hasChildren')?.value==='Sim' },
    { id:'childrenCpfUpload',     label:'CPF_Filho',                  max:10, required: ()=> q('hasChildren')?.value==='Sim' },
    { id:'itauProofUpload',       label:'Dados_Conta_Bancaria',       max:1, required: ()=> q('hasItauAccount')?.value==='Sim' },
    { id:'referenceLetterUpload', label:'Carta_Referencia',           max:1, required: ()=> q('hasOtherJob')?.value==='Sim' },
    { id:'professionalLicenseUpload', label:'Carteira_Registro_Prof', max:1, required: ()=> false }
  ];

  const anexos=[];
  for(const u of uploads){
    const input = gid(u.id); if(!input) continue;
    const files = Array.from(input.files||[]);
    const need = typeof u.required==='function' ? u.required() : (input.required===true);

    // Revalida quantidade/formatos no envio
    if(need && files.length===0){ throw new Error(`Falta documento obrigatório: ${u.label}`); }
    if(files.length > (u.max||1)){ throw new Error(`"${u.label}": máximo ${u.max} arquivo(s).`); }

    // Regra extra filhos x uploads (já checada no submit, revalida aqui):
    if(u.id==='childrenBirthUpload' && q('hasChildren')?.value==='Sim'){
      const n = Number(q('childrenCount')?.value||0);
      if(files.length < n) throw new Error(`Anexe pelo menos ${n} certidão(ões) de nascimento.`);
    }
    if(u.id==='childrenCpfUpload' && q('hasChildren')?.value==='Sim'){
      const n = Number(q('childrenCount')?.value||0);
      if(files.length < n) throw new Error(`Anexe pelo menos ${n} CPF(s) dos filhos.`);
    }

    let idx=1;
    for(const f of files){
      const ext = (f.name.split('.').pop()||'').toLowerCase();
      if(!ALLOWED_EXT.includes(ext)) throw new Error(`Tipo de arquivo não permitido: ${f.name}`);
      if(f.size > 10*1024*1024) throw new Error(`Arquivo muito grande (${f.name}). Máx. 10MB.`);
      const base64 = await fileToBase64(f);
      const fileName = `${u.label}${files.length>1?`_${idx}`:''}.${ext}`;
      anexos.push({ fileName, contentType: base64.contentType||f.type||'application/octet-stream', contentBase64: base64.contentBase64, size: f.size });
      idx++;
    }
  }

  // 3) DECLARAÇÃO (sem assinatura no layout novo; mantemos texto para compatibilidade)
  const declaracao = {
    texto: `Declaro que as informações são verdadeiras e estou ciente das responsabilidades.`,
    aceito: true,
    assinadoEm: new Date().toISOString(),
    assinatura: null
  };

  // 4) METADATA e retorno
  const payload = {
    metadata: { fonte:'form-web-snd', versao:'3.3.0', enviadoEm: new Date().toISOString(), modo:'cadastro' },
    dados,
    anexos,
    declaracao
  };

  // Atualiza painel de payload técnico
  payloadPreview.textContent = JSON.stringify(payload, null, 2);

  return payload;
}

async function fileToBase64(f){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=>{
      const [meta, b64] = String(r.result).split(',');
      const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'application/octet-stream';
      resolve({ contentType:mime, contentBase64:b64 });
    };
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

// ======= Tela final (visual, mantida) =======
function showSuccessScreen(){
  if(successScreen) successScreen.classList.remove('hidden');
  if(form) form.classList.add('flow-complete');
  steps.forEach(s=>s.classList.remove('active'));
  timelineItems.forEach(it=>it.classList.add('done'));
  if(progressBar) progressBar.style.width='100%';
  stepCounter.textContent = `${steps.length}/${steps.length}`;
  footerTitle.textContent = 'Processo concluído';
  footerText.textContent = 'Dados enviados para processamento institucional.';
  document.querySelector('.footer-actions')?.classList.add('hidden');
  window.scrollTo({top:0, behavior:'smooth'});
}
function restartFlow(){
  if(successScreen) successScreen.classList.add('hidden');
  document.querySelector('.footer-actions')?.classList.remove('hidden');
  showStep(0);
}

// ======= Inicialização =======
function init(){
  bindEvents();
  restoreDraft();
  showStep(0);
  refreshConditionals();
  renderChildrenRows();
  initFileUploads();
  updatePayloadPreview();
}
init();
