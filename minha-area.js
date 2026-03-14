let ENDPOINT_URL = null;
fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
  if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
});

const loginSection = document.getElementById('loginSection');
const areaSection  = document.getElementById('areaSection');
const loginForm    = document.getElementById('loginForm');
const loginMsg     = document.getElementById('loginMsg');
const resumoTela1  = document.getElementById('resumoTela1');
const uploadForm   = document.getElementById('uploadForm');
const uploadMsg    = document.getElementById('uploadMsg');
const toast        = document.getElementById('toast');

function showToast(m){ toast.textContent=m; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 2500); }
function showArea(){ loginSection.classList.add('hidden'); areaSection.classList.remove('hidden'); }
function showLogin(){ areaSection.classList.add('hidden'); loginSection.classList.remove('hidden'); }

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault(); loginMsg.textContent='';
  if(!ENDPOINT_URL){ loginMsg.textContent='Erro: config.json ausente.'; return; }
  const email = new FormData(loginForm).get('email')?.trim();
  if(!email){ loginMsg.textContent='Informe o e‑mail.'; return; }

  const payload = { metadata:{ fonte:'form-web-snd', versao:'MA-1.1', modo:'consulta_por_email', enviadoEm:new Date().toISOString() }, filtro:{ email } };
  try{
    const resp = await fetch(ENDPOINT_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    if(!resp.ok){ loginMsg.textContent='Cadastro não localizado. Verifique o e‑mail.'; return; }
    const data = await resp.json();
    const d = data?.dados||{};
    resumoTela1.innerHTML = `
      <label>Nome completo<span>${d.nomeCompleto||'-'}</span></label>
      <label>E‑mail<span>${d.email||email}</span></label>
      <label>Telefone<span>${d.telCel||'-'}</span></label>
      <label>Data de Nascimento<span>${d.dataNascimento||'-'}</span></label>
      <label>Local de Nascimento<span>${d.localNascimento||'-'}</span></label>
      <label>Estado civil<span>${d.estadoCivil||'-'}</span></label>
      ${(d.estadoCivil||'').includes('Casado')|| (d.estadoCivil||'').includes('União') ? `<label>Cônjuge<span>${d.conjuge||'-'}</span></label>` : ''}
      <label>Escolaridade<span>${d.grauEscolaridade||'-'}</span></label>
      <label>Raça/Cor<span>${d.racaCor||'-'}</span></label>
      <label>Nome do Pai<span>${d.nomePai||'-'}</span></label>
      <label>Nome da Mãe<span>${d.nomeMae||'-'}</span></label>
      <label>Sexo Biológico<span>${d.sexoBiologico||'-'}</span></label>`;
    uploadForm.querySelector('input[name=email]').value = email;
    showArea();
  }catch(err){ console.error(err); loginMsg.textContent='Erro de rede na consulta.'; }
});

uploadForm.addEventListener('submit', async (e)=>{
  e.preventDefault(); uploadMsg.textContent='';
  if(!ENDPOINT_URL){ uploadMsg.textContent='Erro: config.json ausente.'; return; }
  const email = uploadForm.querySelector('input[name=email]')?.value?.trim();
  const files = document.getElementById('up_extra')?.files || [];
  if(!files.length){ uploadMsg.textContent='Selecione ao menos um arquivo.'; return; }

  const anexos = [];
  for(const f of files){
    const ext = (f.name.split('.').pop()||'').toLowerCase();
    if(!['pdf','jpg','jpeg','png'].includes(ext)){ uploadMsg.textContent=`Tipo não permitido: ${f.name}`; return; }
    if(f.size > 10*1024*1024){ uploadMsg.textContent=`Arquivo grande: ${f.name}`; return; }
    const b64 = await fileToBase64(f);
    anexos.push({ fileName:`Outros_${f.name}`, contentType:b64.contentType||f.type||'application/octet-stream', contentBase64:b64.contentBase64, size:f.size });
  }

  const payload = { metadata:{ fonte:'form-web-snd', versao:'MA-1.1', modo:'minha_area_upload', enviadoEm:new Date().toISOString() }, filtro:{ email }, anexos };
  try{
    const resp = await fetch(ENDPOINT_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    uploadMsg.textContent = resp.ok ? 'Arquivos enviados com sucesso.' : 'Falha ao enviar arquivos.';
    if(resp.ok) uploadForm.reset();
  }catch(err){ console.error(err); uploadMsg.textContent='Erro de rede ao enviar arquivos.'; }
});

async function fileToBase64(f){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{ const [meta,b64]=String(r.result).split(','); const mime=/data:(.*?);base64/.exec(meta)?.[1]||'application/octet-stream'; resolve({contentType:mime, contentBase64:b64}); };
    r.onerror=reject; r.readAsDataURL(f);
  });
}
