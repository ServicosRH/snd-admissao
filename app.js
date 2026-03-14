/* SND – Portal Admissional V2.3 (app.js)
   -> Mantém SEU layout premium e a UX do wizard.
   -> Adiciona: integração com Power Automate (HTTP), validações e anexos em base64.
   -> Validação especial: uploads de filhos >= quantidade informada.
   -> Dependentes: enviados no payload em dados.filhos[] (Flow grava na tabela BD_DEPENDENTES).
*/

let ENDPOINT_URL = null;
fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
  if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
});

// ========= Seletores base =========
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
