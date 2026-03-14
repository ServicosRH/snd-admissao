/* SND – Portal Admissional (app.js)
   - Navegação por etapas + validações de dados
   - Uploads opcionais (nenhum arquivo obrigatório)
   - Integração Flow (HTTP POST via config.json)
   - Logins rápidos na tela inicial (Candidato / Consultor em linhas)
   - Primeiro acesso do Consultor (cadastro) -> metadata.modo = "consultor_registrar"
*/

let ENDPOINT_URL = null;
fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
  if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
});

// ===== Elementos base =====
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

const ALLOWED_EXT = ['pdf','jpg','jpeg','png'];
const stepMeta = [
  { title:'Boas-vindas', desc:'Avance para iniciar o preenchimento do portal.' },
  { title:'Dados pessoais', desc:'Preencha informações pessoais, dependentes e endereço.' },
  { title:'Documentação admissional', desc:'Informe documentação civil, PIS, CTPS e dados eleitorais.' },
  { title:'Dados complementares', desc:'Registre informações adicionais para o processo interno.' },
  { title:'Documentos (opcionais)', desc:'Envie anexos; você poderá complementar depois pela Minha Área.' }
];

let currentStep = 0;
const q = name => form.elements[name];
const gid = id => document.getElementById(id);
const onlyDigits = v => (v||'').replace(/\D+/g,'');
function showToast(m){ toast.textContent=m; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 2600); }
function isVisibleField(el){ if(!el) return false; const card=el.closest('.step-card'); const hidden=el.closest('.hidden-by-rule'); return card?.classList.contains('active') && !hidden && !el.disabled; }

// ===== Navegação =====
function bindEvents(){
  prevBtn.addEventListener('click', ()=>{ if(currentStep>0) showStep(currentStep-1); });
  nextBtn.addEventListener('click', ()=>{ if(!validateCurrentStep()) return; if(currentStep<steps.length-1) showStep(currentStep+1); });
  saveDraftBtn?.addEventListener('click', saveDraft);
  previewBtn?.addEventListener('click', openSummary);
  startFlowBtn?.addEventListener('click', ()=> showStep(1));
  timelineItems.forEach((btn, idx)=>{
    btn.addEventListener('click', ()=>{
      if(idx===currentStep) return;
      if(idx>currentStep && !validateCurrentStep()) return;
      showStep(idx);
    });
  });
  closeSummaryBtn?.addEventListener('click', ()=> summaryDialog.close());
  restartBtn?.addEventListener('click', restartFlow);
  successSummaryBtn?.addEventListener('click', openSummary);

  togglePayloadBtn?.addEventListener('click', ()=>{
    payloadPreview.classList.toggle('collapsed');
    togglePayloadBtn.textContent = payloadPreview.classList.contains('collapsed') ? 'Exibir payload' : 'Ocultar payload';
  });

  form.addEventListener('input', onFieldChange);
  form.addEventListener('change', onFieldChange);

  form.addEventListener('submit', onSubmit);

  // Logins rápidos (Tela 0)
  bindQuickLogins();
}

function showStep(i){
  if(successScreen) successScreen.classList.add('hidden');
  form?.classList.remove('flow-complete');
  currentStep = i;
  steps.forEach((s,idx)=> s.classList.toggle('active', idx===i));
  timelineItems.forEach((it,idx)=>{ it.classList.toggle('active', idx===i); it.classList.toggle('done', idx<i); });
  const progress = ((i+1)/steps.length)*100;
  progressBar.style.width = `${progress}%`;
  stepCounter.textContent = `${i+1}/${steps.length}`;
  footerTitle.textContent = stepMeta[i].title;
  footerText.textContent = stepMeta[i].desc;
  prevBtn.disabled = (i===0);
  nextBtn.classList.toggle('hidden', i===steps.length-1);
  submitBtn.classList.toggle('hidden', i!==steps.length-1);
  window.scrollTo({top:0, behavior:'smooth'});
}
function onFieldChange(e){
  const t=e.target;
  if(t.id==='childrenCount' || t.id==='hasChildren'){ renderChildrenRows(); }
  if(t.matches('input[type="file"]')){ updateFileFeedback(t); }
  if(t.matches('select, input')){ refreshConditionals(); updatePayloadPreview(); }
}

// ===== Condicionais =====
function refreshConditionals(){
  document.querySelectorAll('.conditional').forEach(block=>{
    const [field, expected] = (block.dataset.showWhen||'').split('=');
    const active = q(field)?.value===expected;
    const wasHidden = block.classList.contains('hidden-by-rule');
    block.classList.toggle('hidden-by-rule', !active);
    if(!active && !wasHidden) clearHiddenFields(block);
  });
  syncRequired();
}
function syncRequired(){
  // Campos de dados que permanecem obrigatórios conforme regras
  const req = {
    spouseName: q('maritalStatus')?.value==='Casado(a)',
    childrenCount: q('hasChildren')?.value==='Sim',

    hasReservist: q('biologicalSex')?.value==='Masculino',
    reservistNumber: q('hasReservist')?.value==='Sim',
    dispenseReason: q('hasReservist')?.value==='Sim',

    ctpsNumber: q('ctpsType')?.value==='Físico',
    ctpsSeries: q('ctpsType')?.value==='Físico',

    pisNumber: q('hasPis')?.value==='Sim',

    otherJobCnpj: q('hasOtherJob')?.value==='Sim',
    retirementDate: q('hasRetirement')?.value==='Sim',
    relativeName: q('hasRelativeAtSnd')?.value==='Sim',
    relationshipDegree: q('hasRelativeAtSnd')?.value==='Sim',

    itauAgency: q('hasItauAccount')?.value==='Sim',
    itauAccountNumber: q('hasItauAccount')?.value==='Sim'
  };
  Object.entries(req).forEach(([name,required])=>{ const f=q(name); if(f) f.required=required; });

  // Todos os inputs de arquivo NÃO são obrigatórios
  form.querySelectorAll('input[type="file"]').forEach(inp=> inp.required = false);
  // Filhos (dados) obrigatórios apenas quando hasChildren = "Sim"
  childrenRows.querySelectorAll('input').forEach(inp=> inp.required = (q('hasChildren')?.value==='Sim'));
}
function clearHiddenFields(container){
  container.querySelectorAll('input, select').forEach(input=>{
    if(input.type==='file'){ input.value=''; updateFileFeedback(input); }
    else if(!input.name.startsWith('child')){ input.value=''; }
  });
}

// ===== Filhos =====
function renderChildrenRows(){
  const count = Math.min(Math.max(Number(q('childrenCount')?.value||0),0),10);
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

// ===== Upload feedback =====
function initFileUploads(){ form.querySelectorAll('input[type="file"]').forEach(updateFileFeedback); }
function updateFileFeedback(input){
  const card=input.closest('.upload-card'); if(!card) return;
  const fb=card.querySelector('.file-feedback');
  const files=Array.from(input.files||[]);
  card.classList.toggle('has-file', files.length>0);
  if(!fb) return;
  fb.textContent = files.length ? (files.length===1?`✔ ${files[0].name}`:`✔ ${files.length} arquivo(s)`) : '';
}

// ===== Validações =====
function clearErrors(panel){
  panel.querySelectorAll('.invalid').forEach(el=>el.classList.remove('invalid'));
  panel.querySelectorAll('.error-text').forEach(el=>el.remove());
}
function setFieldError(field,message){
  const w=field.closest('.field, .upload-card'); if(!w) return;
  w.classList.add('invalid');
  const s=document.createElement('small'); s.className='error-text'; s.textContent=message; w.appendChild(s);
}
function validateFileInput(input){
  const files=Array.from(input.files||[]);
  if(files.length===0) return true; // opcional
  return files.every(f=> ALLOWED_EXT.includes((f.name.split('.').pop()||'').toLowerCase()) && f.size<=10*1024*1024 );
}
function validateCurrentStep(){
  const panel=steps[currentStep];
  clearErrors(panel);
  let valid=true;
  const fields=Array.from(panel.querySelectorAll('input, select')).filter(isVisibleField);
  fields.forEach(field=>{
    if(field.disabled) return;
    if(field.type==='file'){
      if(!validateFileInput(field)){ valid=false; setFieldError(field,'Envie PDF/JPG/JPEG/PNG até 10MB.'); }
      return;
    }
    if(field.required && !String(field.value||'').trim()){ valid=false; setFieldError(field,'Preenchimento obrigatório.'); }
    if(field.name==='childrenCount' && field.value){
      const n=Number(field.value); if(n<1||n>10){ valid=false; setFieldError(field,'Informe entre 1 e 10.'); }
    }
  });

  if(currentStep===1 && q('hasChildren')?.value==='Sim'){
    childrenRows.querySelectorAll('input').forEach(inp=>{
      if(!String(inp.value||'').trim()){ valid=false; setFieldError(inp,'Preenchimento obrigatório.'); }
    });
  }
  return valid;
}

// ===== Rascunho =====
function saveDraft(){
  const snap={};
  Array.from(form.elements).forEach(f=>{ if(!f.name||f.type==='file') return; snap[f.name]=f.value; });
  localStorage.setItem('sndAdmissionDraftV2', JSON.stringify(snap));
  showToast('Rascunho salvo.');
}
function restoreDraft(){
  const raw=localStorage.getItem('sndAdmissionDraftV2'); if(!raw) return;
  try{ const s=JSON.parse(raw); Object.entries(s).forEach(([n,v])=>{ const f=q(n); if(f&&f.type!=='file') f.value=v; }); }catch{}
}

// ===== Resumo técnico =====
function openSummary(){ updatePayloadPreview(); const p=buildPayloadPreview(); summaryContent.innerHTML=buildSummaryMarkup(p); summaryDialog.showModal(); }
function buildSummaryMarkup(p){
  const ch=p.dadosPessoais.filhos||[];
  return `
  <section class="summary-block"><h4>Dados pessoais</h4><ul>
    <li><span>Nome</span><span>${p.dadosPessoais.nomeCompleto||'-'}</span></li>
    <li><span>E-mail</span><span>${p.dadosPessoais.email||'-'}</span></li>
    <li><span>Telefone</span><span>${p.dadosPessoais.telefone||'-'}</span></li>
    <li><span>Estado civil</span><span>${p.dadosPessoais.estadoCivil||'-'}</span></li>
    <li><span>Possui filhos</span><span>${p.dadosPessoais.possuiFilhos||'-'}</span></li>
    <li><span>Qtd. filhos</span><span>${p.dadosPessoais.quantidadeFilhos||'0'}</span></li>
  </ul></section>
  <section class="summary-block"><h4>Endereço</h4><ul>
    <li><span>Logradouro</span><span>${p.dadosPessoais.endereco.logradouro||'-'}</span></li>
    <li><span>Número</span><span>${p.dadosPessoais.endereco.numero||'-'}</span></li>
    <li><span>Cidade/UF</span><span>${p.dadosPessoais.endereco.cidade||'-'}/${p.dadosPessoais.endereco.estado||'-'}</span></li>
    <li><span>CEP</span><span>${p.dadosPessoais.endereco.cep||'-'}</span></li>
  </ul></section>
  <section class="summary-block"><h4>Documentação</h4><ul>
    <li><span>CPF</span><span>${p.documentacaoAdmissional.cpf||'-'}</span></li>
    <li><span>CTPS (tipo)</span><span>${p.documentacaoAdmissional.ctpsTipo||'-'}</span></li>
    <li><span>Título de Eleitor</span><span>${p.documentacaoAdmissional.tituloEleitor||'-'}</span></li>
    <li><span>Possui PIS</span><span>${p.documentacaoAdmissional.possuiPis||'-'}</span></li>
    <li><span>PIS Nº</span><span>${p.documentacaoAdmissional.numeroPis||'-'}</span></li>
  </ul></section>
  <section class="summary-block"><h4>Dependentes</h4><ul>
    ${ch.length? ch.map((c,i)=>`<li><span>Filho ${i+1}</span><span>${c.nomeCompleto||'-'} · ${c.dataNascimento||'-'} · ${c.cpf||'-'}</span></li>`).join('') : '<li><span>Dependentes</span><span>Não informado</span></li>'}
  </ul></section>`;
}
function buildPayloadPreview(){
  return {
    dadosPessoais:{
      nomeCompleto:q('fullName')?.value, email:q('email')?.value, telefone:q('phone')?.value,
      dataNascimento:q('birthDate')?.value, localNascimento:q('birthPlace')?.value,
      estadoCivil:q('maritalStatus')?.value, nomeConjuge:q('spouseName')?.value,
      escolaridade:q('education')?.value, racaCor:q('raceColor')?.value,
      nomePai:q('fatherName')?.value, nomeMae:q('motherName')?.value, sexoBiologico:q('biologicalSex')?.value,
      possuiFilhos:q('hasChildren')?.value, quantidadeFilhos:q('childrenCount')?.value,
      filhos: collectChildrenData(),
      endereco:{ logradouro:q('street')?.value, numero:q('number')?.value, complemento:q('complement')?.value, bairro:q('district')?.value, cidade:q('city')?.value, estado:q('state')?.value, cep:q('zipCode')?.value }
    },
    documentacaoAdmissional:{
      possuiReservista:q('hasReservist')?.value, numeroReservista:q('reservistNumber')?.value, motivoDispensa:q('dispenseReason')?.value,
      documentoIdentidade:q('identityDoc')?.value, orgaoEmissor:q('issuer')?.value, dataEmissaoIdentidade:q('identityIssueDate')?.value,
      cpf:q('cpf')?.value, ctpsTipo:q('ctpsType')?.value, ctpsNumero:q('ctpsNumber')?.value, ctpsSerie:q('ctpsSeries')?.value,
      possuiRegistroProfissional:q('hasProfessionalRecord')?.value, registroProfissional:q('professionalRecord')?.value,
      orgaoRegistroProfissional:q('professionalIssuer')?.value, dataRegistroProfissional:q('professionalIssueDate')?.value,
      tituloEleitor:q('voterTitle')?.value, zonaEleitoral:q('voterZone')?.value, secaoEleitoral:q('voterSection')?.value, dataEmissaoTitulo:q('voterIssueDate')?.value,
      possuiPis:q('hasPis')?.value, numeroPis:q('pisNumber')?.value
    }
  };
}
function updatePayloadPreview(){ payloadPreview.textContent = JSON.stringify(buildPayloadPreview(), null, 2); }

// ===== Submit → Flow =====
async function onSubmit(ev){
  ev.preventDefault();
  if(!validateCurrentStep()) return;
  if(!ENDPOINT_URL){ showToast('Erro: config.json ausente.'); return; }

  submitBtn.disabled=true; submitBtn.textContent='Enviando…';
  try{
    const payload = await buildFlowPayload();
    const resp = await fetch(ENDPOINT_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(resp.ok){
      showSuccessScreen();
      localStorage.removeItem('sndAdmissionDraftV2');
    }else{
      showToast('Falha ao enviar. Tente novamente.');
    }
  }catch(e){
    console.error(e);
    showToast(e?.message||'Erro de rede.');
  }finally{
    submitBtn.disabled=false; submitBtn.textContent='Concluir cadastro';
  }
}

async function buildFlowPayload(){
  const dados = {
    // Tela 1
    nomeCompleto:q('fullName')?.value?.trim(),
    email:q('email')?.value?.trim(),
    telCel:onlyDigits(q('phone')?.value||''),
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
    qtdFilhos:Number(q('childrenCount')?.value||0),
    filhos: collectChildrenData(),

    endereco:q('street')?.value?.trim(),
    numero:q('number')?.value?.trim(),
    complemento:q('complement')?.value?.trim(),
    bairro:q('district')?.value?.trim(),
    cidade:q('city')?.value?.trim(),
    estado:q('state')?.value,
    cep:onlyDigits(q('zipCode')?.value||''),

    // Tela 2
    hasReservista:q('hasReservist')?.value,
    reservistaCodigo:q('reservistNumber')?.value?.trim(),
    dispensaMotivo:q('dispenseReason')?.value?.trim(),

    rgNumero:q('identityDoc')?.value?.trim(),
    rgOrgaoUf:q('issuer')?.value?.trim(),
    rgData:q('identityIssueDate')?.value,

    cpf:onlyDigits(q('cpf')?.value||''),

    ctpsTipo:q('ctpsType')?.value,
    ctpsNumero:onlyDigits(q('ctpsNumber')?.value||''),
    ctpsSerie:onlyDigits(q('ctpsSeries')?.value||''),

    regProfTem:q('hasProfessionalRecord')?.value,
    registroProfissional:q('professionalRecord')?.value?.trim(),
    regProfOrgaoUf:q('professionalIssuer')?.value?.trim(),
    regProfData:q('professionalIssueDate')?.value,

    tituloNumero:onlyDigits(q('voterTitle')?.value||''),
    tituloZona:onlyDigits(q('voterZone')?.value||''),
    tituloSecao:onlyDigits(q('voterSection')?.value||''),
    tituloData:q('voterIssueDate')?.value,

    possuiPis:q('hasPis')?.value,
    pisNumero:onlyDigits(q('pisNumber')?.value||''),

    // Tela 3
    outroEmprego:q('hasOtherJob')?.value==='Sim' ? 'sim':'nao',
    cnpjEmpresa:onlyDigits(q('otherJobCnpj')?.value||''),
    aposentado:q('hasRetirement')?.value==='Sim' ? 'sim':'nao',
    dataAposentadoria:q('retirementDate')?.value,
    temParenteSnd:q('hasRelativeAtSnd')?.value==='Sim' ? 'sim':'nao',
    nomeParente:q('relativeName')?.value?.trim(),
    parentesco:q('relationshipDegree')?.value?.trim(),

    contaItauTem:q('hasItauAccount')?.value==='Sim' ? 'sim':'nao',
    agencia:onlyDigits(q('itauAgency')?.value||''),
    contaCorrente:onlyDigits(q('itauAccountNumber')?.value||''),

    // Compatibilidade antiga
    checklist:{ rg:false, cpf:false, comprovEndereco:false, carteiraTrabalho:false, certidao:false, comprovEscolaridade:false }
  };

  // ANEXOS (todos opcionais)
  const map = [
    { id:'workCard', label:'CTPS', max:1 },
    { id:'identityUpload', label:'RG', max:2 },
    { id:'cpfUpload', label:'CPF', max:1 },
    { id:'reservistUpload', label:'Certificado_Reservista', max:1 },
    { id:'voterTitleUpload', label:'Titulo_Eleitor', max:1 },
    { id:'pisUpload', label:'PIS', max:1 },
    { id:'proofOfAddress', label:'Comprovante_Residencia', max:1 },
    { id:'marriageCertificate', label:'Certidao_Casamento', max:1 },
    { id:'spouseCpfUpload', label:'CPF_Conjuge', max:1 },
    { id:'childrenBirthUpload', label:'Certidao_Nascimento_Filho', max:10 },
    { id:'childrenCpfUpload', label:'CPF_Filho', max:10 },
    { id:'itauProofUpload', label:'Dados_Conta_Bancaria', max:1 },
    { id:'referenceLetterUpload', label:'Carta_Referencia', max:1 },
    { id:'professionalLicenseUpload', label:'Carteira_Registro_Prof', max:1 }
  ];

  const anexos=[];
  for(const item of map){
    const input=gid(item.id); if(!input) continue;
    const files=Array.from(input.files||[]);
    if(!files.length) continue; // opcional
    if(files.length > (item.max||1)) throw new Error(`"${item.label}": máximo ${item.max} arquivo(s).`);

    let idx=1;
    for(const f of files){
      const ext=(f.name.split('.').pop()||'').toLowerCase();
      if(!ALLOWED_EXT.includes(ext)) throw new Error(`Tipo não permitido: ${f.name}`);
      if(f.size>10*1024*1024) throw new Error(`Arquivo muito grande: ${f.name}`);
      const b64 = await fileToBase64(f);
      const safe = `${item.label}${files.length>1?`_${idx}`:''}.${ext}`;
      anexos.push({ fileName:safe, contentType:b64.contentType||f.type||'application/octet-stream', contentBase64:b64.contentBase64, size:f.size });
      idx++;
    }
  }

  const declaracao = { texto:'Declaro veracidade das informações.', aceito:true, assinadoEm:new Date().toISOString(), assinatura:null };
  const payload = { metadata:{ fonte:'form-web-snd', versao:'3.3.0', enviadoEm:new Date().toISOString(), modo:'cadastro' }, dados, anexos, declaracao };
  payloadPreview.textContent = JSON.stringify(payload, null, 2);
  return payload;
}
async function fileToBase64(f){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{ const [meta,b64]=String(r.result).split(','); const mime=/data:(.*?);base64/.exec(meta)?.[1]||'application/octet-stream'; resolve({contentType:mime, contentBase64:b64}); };
    r.onerror=reject; r.readAsDataURL(f);
  });
}

// ===== Tela final =====
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
function restartFlow(){ if(successScreen) successScreen.classList.add('hidden'); document.querySelector('.footer-actions')?.classList.remove('hidden'); showStep(0); }

// ===== Logins rápidos =====
function bindQuickLogins(){
  // Candidato -> abre Minha Área com o e-mail
  const qlCandForm = document.getElementById('quickLoginCandidate');
  qlCandForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = document.getElementById('qlCandEmail')?.value?.trim();
    if(!email){ showToast('Informe o e‑mail do candidato.'); return; }
    window.location.href = `minha-area.html?email=${encodeURIComponent(email)}`;
  });

  // Consultor -> abre Portal do Consultor (login acontece lá)
  const qlConsForm = document.getElementById('quickLoginConsultor');
  qlConsForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = document.getElementById('qlConsEmail')?.value?.trim();
    const pass  = document.getElementById('qlConsPass')?.value||'';
    if(!email || !pass){ showToast('Informe e‑mail e senha do consultor.'); return; }
    window.location.href = `consultor.html?email=${encodeURIComponent(email)}`;
  });

  // Modal "Primeiro acesso"
  const dlgPA = document.getElementById('dlgPrimeiroAcesso');
  document.getElementById('btnPrimeiroAcesso')?.addEventListener('click', ()=> dlgPA?.showModal());
  document.getElementById('dlgFecharPrimeiroAcesso')?.addEventListener('click', ()=> dlgPA?.close());

  // Enviar cadastro do consultor (primeiro acesso) -> Flow: consultor_registrar
  const formPA = document.getElementById('formPrimeiroAcesso');
  formPA?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const paMsg = document.getElementById('paMsg');
    paMsg.textContent = '';
    if(!ENDPOINT_URL){ paMsg.textContent='Erro: config.json ausente.'; return; }
    const nome = document.getElementById('paNome')?.value?.trim();
    const email= document.getElementById('paEmail')?.value?.trim().toLowerCase();
    const senha= document.getElementById('paSenha')?.value||'';
    if(!nome || !email || !senha){ paMsg.textContent='Preencha nome, e‑mail e senha.'; return; }
    const hash = await sha256Hex(senha);
    const payload = { metadata:{ modo:'consultor_registrar', enviadoEm:new Date().toISOString() }, novo:{ nome, email, hash } };
    try{
      const resp = await fetch(ENDPOINT_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await resp.json().catch(()=> ({}));
      if(resp.ok && data?.ok){ paMsg.textContent='Conta criada com sucesso. Você já pode entrar.'; formPA.reset(); }
      else { paMsg.textContent = data?.mensagem||'Falha ao criar a conta.'; }
    }catch(err){ console.error(err); paMsg.textContent='Erro de rede ao criar conta.'; }
  });
}

// Web Crypto — SHA-256 (hex)
async function sha256Hex(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ===== Init =====
function init(){ bindEvents(); restoreDraft(); showStep(0); refreshConditionals(); renderChildrenRows(); initFileUploads(); updatePayloadPreview(); }
init();
