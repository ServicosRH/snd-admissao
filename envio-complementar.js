(function(){
  let ENDPOINT_URL = null;
  fetch('config.json').then(r=>r.ok?r.json():null).then(cfg=>{
    if(cfg) ENDPOINT_URL = cfg.endpointUrl || cfg.flowUrl;
  });

  const form = document.getElementById('complementar-form');
  if(!form) return;

  const onlyDigits = v => (v||'').replace(/\D+/g,'');

  async function fileToBase64(f){
    return new Promise((resolve,reject)=>{
      const r = new FileReader();
      r.onload = ()=>{
        const [meta,b64] = String(r.result).split(',');
        const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'application/octet-stream';
        resolve({ fileName:f.name, contentType:mime, contentBase64:b64, size:f.size });
      };
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  }

  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const out = document.getElementById('resultado2'); out.textContent='';

    if(!ENDPOINT_URL){ out.textContent = 'Erro: config.json não encontrado ou endpointUrl ausente.'; return; }

    const fd = new FormData(form);
    const cpf = onlyDigits(fd.get('cpf')||'');
    const nomeCompleto = (fd.get('nomeCompleto')||'').trim();
    const email = (fd.get('email')||'').trim();

    if(!cpf || !nomeCompleto){
      out.textContent = 'Preencha CPF e Nome completo.';
      return;
    }

    const files = document.getElementById('anexos2').files;
    if(!files || !files.length){
      out.textContent = 'Selecione pelo menos um arquivo.';
      return;
    }

    const anexos=[];
    for(const f of files){
      if(f.size > 10*1024*1024){ out.textContent=`O arquivo ${f.name} excede 10 MB.`; return; }
      anexos.push(await fileToBase64(f));
    }

    const payload = {
      metadata: {
        fonte: 'form-web-snd',
        versao: '2.4.0',
        enviadoEm: new Date().toISOString(),
        modo: 'complementar'
      },
      dados: { cpf, nomeCompleto, email },
      anexos,
      declaracao: null
    };

    const btn = document.getElementById('enviar-complementar');
    btn.disabled=true; btn.textContent='Enviando…';

    try{
      const resp = await fetch(ENDPOINT_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      out.textContent = resp.ok ? 'Documentos enviados com sucesso.' : 'Falha ao enviar.';
      if(resp.ok) form.reset();
    }catch(e){
      console.error(e);
      out.textContent = 'Erro de rede.';
    }finally{
      btn.disabled=false; btn.textContent='Enviar documentos';
    }
  });
})();
