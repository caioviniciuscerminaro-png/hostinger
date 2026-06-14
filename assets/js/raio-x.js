(function () {
  "use strict";

  const cfg = window.RX_CONFIG || {};
  const screen = document.getElementById("screen");
  const progressWrap = document.getElementById("progressWrap");
  const progressSection = document.getElementById("progressSection");
  const progressLabel = document.getElementById("progressLabel");
  const progressBar = document.getElementById("progressBar");
  const navRow = document.getElementById("navRow");
  const backBtn = document.getElementById("backBtn");
  const STATE_KEY = "recupere_quiz_state_v1";
  let timers = [];
  let exitPopupShown = false;
  let exitPopupCleanup = null;

  const sections = {
    profile: "Meu perfil",
    body: "Seu corpo hoje",
    lifestyle: "Estilo de vida",
    diagnosis: "Diagnóstico e plano"
  };

  const steps = [
    { id:"age", type:"question", section:"profile", title:"Vamos descobrir o que está travando o seu corpo.", subtitle:"Selecione sua faixa de idade para começar:", image:"quiz-male-shoulder.webp", note:"O diagnóstico adapta a leitura ao momento do seu corpo.", options:[["30-39","30 a 39 anos"],["40-49","40 a 49 anos"],["50-59","50 a 59 anos"],["60+","60 anos ou mais"]] },
    { id:"welcome", type:"info", section:"profile", eyebrow:"Pilates Terapêutico em casa", title:"Seu corpo não precisa ser forçado para voltar a se mover.", paragraphs:["O Método Recupere-se foi criado pela instrutora de Pilates Terapêutico Karina Moura para quem sente rigidez, dor recorrente ou medo de travar.","Nas próximas etapas, vamos identificar onde o seu corpo entrou em modo de proteção e qual deve ser o primeiro foco do seu plano."], image:"karina-profile.webp", note:"Criado por Karina Moura, instrutora de Pilates Terapêutico." },
    { id:"pilates", type:"question", section:"profile", title:"Você já praticou Pilates antes?", subtitle:"Não existe resposta certa. Isso apenas ajusta a forma do seu plano.", image:"quiz-athlete-catcow.webp", options:[["studio","Sim, em estúdio ou presencial"],["videos","Sim, por vídeos ou aplicativo"],["never","Nunca pratiquei"]] },
    { id:"concept", type:"info", section:"profile", eyebrow:"Uma virada importante", title:"O problema quase nunca é falta de exercício.", bullets:["A rigidez pode ser um padrão de proteção que o corpo aprendeu a repetir.","Movimentos suaves e precisos ajudam o sistema nervoso a recuperar a sensação de segurança.","Com 5 minutos por dia, é possível começar em casa e sem equipamentos complexos."], image:"quiz-protection-insight.webp", note:"Não é fazer mais. É enviar o estímulo certo." },
    { id:"complaint", type:"question", section:"profile", title:"Qual incômodo mais atrapalha o seu dia hoje?", subtitle:"Escolha o que mais representa a sua rotina neste momento.", image:"quiz-pain-region.webp", options:[["morning","Rigidez ao acordar ou corpo duro"],["bending","Travo ao levantar ou abaixar"],["lumbar","Dor na lombar ou costas"],["neck","Dor ou tensão na cervical ou ombros"],["leg","Dor que desce para a perna"],["mobility","Falta de mobilidade nos treinos"]] },
    { id:"region", type:"multi", section:"profile", title:"Onde você sente mais?", subtitle:"Pode marcar mais de uma região.", image:"quiz-woman-back-pain.webp", options:[["lumbar","Lombar"],["neck","Cervical ou pescoço"],["shoulders","Ombros"],["hips","Quadril"],["knees","Joelhos"],["spine","Coluna em geral"]] },
    { id:"mirror", type:"dynamicInfo", section:"profile" },
    { id:"duration", type:"question", section:"body", title:"Há quanto tempo você convive com isso?", subtitle:"A duração ajuda a estimar o quanto esse padrão já se instalou.", image:"quiz-male-shoulder.webp", options:[["weeks","Algumas semanas"],["months","Alguns meses"],["years1to3","1 a 3 anos"],["years3plus","Mais de 3 anos"]] },
    { id:"tried", type:"question", section:"body", title:"O que você já tentou para resolver?", subtitle:"Escolha a tentativa que mais marcou sua experiência.", image:"quiz-stretch-failed.webp", options:[["stretch","Alongamento por conta própria"],["gym","Academia ou musculação"],["physio","Fisioterapia"],["medicine","Remédio ou relaxante muscular"],["nothing","Nada ainda"]] },
    { id:"partial", type:"partial", section:"body" },
    { id:"video1", type:"video", section:"body", video:1, title:"A Karina vai explicar o que pode estar realmente acontecendo.", subtitle:"Assista antes de continuar. Na próxima etapa, o teste fica mais específico para o seu caso." },
    { id:"limitation", type:"question", section:"body", title:"Você tem alguma destas condições?", subtitle:"Essa resposta não substitui avaliação profissional, mas ajuda a manter a orientação responsável.", image:"quiz-senior-breath.webp", safety:"Em caso de condição diagnosticada, o método é complementar e não substitui a orientação do seu profissional de saúde.", options:[["chronic","Dor crônica diagnosticada"],["disc","Hérnia ou problema de disco"],["injury","Lesão antiga"],["none","Nenhuma"]] },
    { id:"flexibility", type:"question", section:"body", title:"Como você descreveria sua flexibilidade hoje?", subtitle:"Pense nos movimentos comuns, não em posições avançadas.", image:"quiz-pilates-movement.webp", options:[["locked","Bem travada"],["stiff","Mais dura do que gostaria"],["fair","Razoável"],["good","Boa"]] },
    { id:"morning", type:"question", section:"body", title:"Como você acorda de manhã?", subtitle:"Os primeiros movimentos do dia são um sinal importante.", image:"quiz-morning-stiffness.webp", options:[["painful","Muito rígida ou dolorida"],["firstMoves","Travada nos primeiros movimentos"],["varies","Depende do dia"],["calm","Tranquila"]] },
    { id:"activity", type:"question", section:"body", title:"Como está seu corpo nos movimentos do dia a dia?", subtitle:"Considere levantar, girar, abaixar e calçar um sapato.", image:"quiz-athlete-neck.webp", options:[["simple","Travo até em coisas simples"],["discomfort","Consigo, mas com desconforto"],["prevention","Me movo bem e quero prevenir"]] },
    { id:"fear", type:"question", section:"body", title:"E como isso afeta o seu dia?", subtitle:"Escolha o sentimento que mais se aproxima do seu momento.", image:"quiz-office-back.webp", options:[["avoid","Evito movimentos com medo de travar"],["quit","Já desisti de coisas que gostava"],["frustrated","Fico frustrada com meu corpo"],["worse","Tenho medo de piorar com o tempo"]] },
    { id:"routine", type:"question", section:"lifestyle", title:"Como é a sua rotina?", subtitle:"O corpo responde de formas diferentes conforme o tempo sentado, em pé e em movimento.", image:"quiz-seated-routine.webp", options:[["seated","Sentada a maior parte do dia"],["standing","Em pé o dia todo"],["mixed","Mista, com pausas ativas"],["home","Aposentada ou em casa"]] },
    { id:"dailyTime", type:"question", section:"lifestyle", title:"Quanto tempo você consegue dedicar ao seu corpo por dia?", subtitle:"A consistência vale mais do que uma sessão longa.", image:"quiz-five-minutes.webp", options:[["5","5 minutos"],["10","10 minutos"],["15","15 minutos"],["15+","Mais de 15 minutos"]] },
    { id:"processing", type:"processing", section:"diagnosis" },
    { id:"result", type:"result", section:"diagnosis" },
    { id:"video2", type:"video", section:"diagnosis", video:2, title:"Seu protocolo está definido.", subtitle:"A Karina preparou esta orientação para o momento em que você recebe o diagnóstico.", final:true },
    { id:"offer", type:"offer", section:"diagnosis" }
  ];

  function initialState() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
      if (stored && typeof stored === "object") return { step:Number(stored.step || 0), answers:stored.answers || {}, discountActive:Boolean(stored.discountActive) };
    } catch (_) {}
    return { step:0, answers:{}, discountActive:false };
  }

  if (new URLSearchParams(location.search).get("restart") === "1") {
    try { sessionStorage.removeItem(STATE_KEY); sessionStorage.removeItem("recupere_exit_seen"); } catch (_) {}
  }
  let state = initialState();

  function persist() {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
    window.RXIntegrations?.setAnswers?.(state.answers);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[ch]);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function addTimer(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
  function imagePath(name) { return `assets/images/${name}`; }

  function setLegalLinks() {
    [["privacyLink",cfg.privacyUrl],["termsLink",cfg.termsUrl],["contactLink",cfg.contactUrl]].forEach(([id,url]) => {
      const el = document.getElementById(id);
      if (el) el.href = url || "#";
    });
  }

  function countedSteps() { return steps.filter(step => step.type !== "offer"); }
  function countedIndex() { return Math.min(countedSteps().length, steps.slice(0, state.step + 1).filter(step => step.type !== "offer").length); }

  function updateChrome(step) {
    const isOffer = step.type === "offer";
    screen.classList.toggle("screen-offer", isOffer);
    progressWrap.classList.toggle("hidden", isOffer);
    const count = countedIndex();
    const total = countedSteps().length;
    progressSection.textContent = sections[step.section] || "Diagnóstico";
    progressLabel.textContent = `${count} de ${total}`;
    progressBar.style.width = `${Math.round((count / total) * 100)}%`;
    navRow.classList.toggle("hidden", state.step === 0 || isOffer || step.type === "processing");
  }

  function trackView(step) {
    const progress = Math.round((countedIndex() / countedSteps().length) * 100);
    window.RXTrack?.event?.("screen_viewed", { step:state.step + 1, screen_id:step.id, section:step.section, progress });
  }

  function render() {
    clearTimers();
    const step = steps[state.step] || steps[0];
    updateChrome(step);
    window.scrollTo({ top:0, behavior:"smooth" });
    if (step.type === "question" || step.type === "multi") renderQuestion(step);
    else if (step.type === "info") renderInfo(step);
    else if (step.type === "dynamicInfo") renderMirror();
    else if (step.type === "partial") renderPartial();
    else if (step.type === "video") renderVideo(step);
    else if (step.type === "processing") renderProcessing();
    else if (step.type === "result") renderResult();
    else if (step.type === "offer") renderOffer();
    trackView(step);
  }

  function next() {
    if (state.step < steps.length - 1) state.step += 1;
    persist();
    render();
  }

  function back() {
    if (state.step > 0) state.step -= 1;
    persist();
    render();
  }

  function optionHtml(value, label, detail, selected) {
    return `<button class="option${selected ? " selected" : ""}" type="button" data-value="${escapeHtml(value)}"><span class="option-marker">✓</span><span><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</span></button>`;
  }

  function renderQuestion(step) {
    const current = step.type === "multi" ? (Array.isArray(state.answers[step.id]) ? state.answers[step.id] : []) : state.answers[step.id];
    screen.innerHTML = `<div class="quiz-layout"><div class="quiz-copy"><span class="eyebrow">${escapeHtml(sections[step.section])}</span><h2>${escapeHtml(step.title)}</h2><p class="lead">${escapeHtml(step.subtitle)}</p><div class="options${step.options.length > 4 ? " two-cols" : ""}">${step.options.map(item => optionHtml(item[0],item[1],item[2],step.type === "multi" ? current.includes(item[0]) : current === item[0])).join("")}</div>${step.type === "multi" ? '<div class="multi-actions"><button class="btn btn-primary" id="multiContinue" type="button">Continuar →</button></div>' : ""}${step.safety ? `<p class="safety-note">${escapeHtml(step.safety)}</p>` : ""}</div><aside class="visual-card"><img src="${imagePath(step.image)}" alt=""><div class="visual-note">${escapeHtml(step.note || "Cada resposta deixa seu diagnóstico mais específico.")}</div></aside></div>`;

    screen.querySelectorAll(".option").forEach(button => button.addEventListener("click", () => {
      const value = button.dataset.value;
      if (step.type === "multi") {
        const selected = new Set(Array.isArray(state.answers[step.id]) ? state.answers[step.id] : []);
        selected.has(value) ? selected.delete(value) : selected.add(value);
        state.answers[step.id] = Array.from(selected);
        persist();
        renderQuestion(step);
        return;
      }
      state.answers[step.id] = value;
      persist();
      window.RXTrack?.event?.("question_answered", { step:state.step + 1, question:step.id, answer:value, answers:{ [step.id]:value }, section:step.section, progress:Math.round((countedIndex()/countedSteps().length)*100) });
      button.classList.add("selected");
      addTimer(next, 190);
    }));

    document.getElementById("multiContinue")?.addEventListener("click", () => {
      const values = state.answers[step.id] || [];
      if (!values.length) {
        screen.querySelector(".options")?.animate([{transform:"translateX(-4px)"},{transform:"translateX(4px)"},{transform:"translateX(0)"}],{duration:220});
        return;
      }
      window.RXTrack?.event?.("question_answered", { step:state.step + 1, question:step.id, answer:values.join(","), answers:{ [step.id]:values }, section:step.section });
      next();
    });
  }

  function renderInfo(step) {
    const paragraphs = (step.paragraphs || []).map(text => `<p>${escapeHtml(text)}</p>`).join("");
    const bullets = (step.bullets || []).map(text => `<div class="insight-item"><span>✓</span><div>${escapeHtml(text)}</div></div>`).join("");
    screen.innerHTML = `<div class="info-layout"><div><span class="eyebrow">${escapeHtml(step.eyebrow || sections[step.section])}</span><h2>${escapeHtml(step.title)}</h2><div class="copy-stack" style="margin-top:20px">${paragraphs}</div>${bullets ? `<div class="insight-list">${bullets}</div>` : ""}<button class="btn btn-primary" id="infoContinue" type="button">Continuar →</button></div><aside class="visual-card"><img src="${imagePath(step.image)}" alt=""><div class="visual-note">${escapeHtml(step.note || "Movimentos gentis, precisos e progressivos.")}</div></aside></div>`;
    document.getElementById("infoContinue").addEventListener("click", next);
  }

  function renderMirror() {
    const complaint = window.RXCalc.label("complaint", state.answers.complaint);
    const regions = window.RXCalc.label("region", state.answers.region || []);
    screen.innerHTML = `<div class="info-layout info-layout--single"><div><span class="eyebrow">Leitura inicial</span><h2>Faz sentido.</h2><p class="lead">Quem sente <strong>${escapeHtml(complaint)}</strong> costuma criar compensações e proteção principalmente em <strong>${escapeHtml(regions)}</strong>.</p><div class="insight-list"><div class="insight-item"><span>✓</span><div>Seu plano vai começar por movimentos seguros para essas regiões.</div></div><div class="insight-item"><span>✓</span><div>O objetivo não é forçar amplitude, e sim recuperar confiança no movimento.</div></div></div><button class="btn btn-primary" id="infoContinue" type="button">Continuar →</button></div></div>`;
    document.getElementById("infoContinue").addEventListener("click", next);
  }

  function renderPartial() {
    const tried = window.RXCalc.label("tried", state.answers.tried);
    screen.innerHTML = `<div class="info-layout"><div><span class="eyebrow">Diagnóstico parcial</span><h2>Isso explica muita coisa.</h2><p class="lead">Você tentou <strong>${escapeHtml(tried)}</strong>, mas a rigidez ou o desconforto voltou.</p><div class="mechanism-box"><h3>A Trava de Proteção</h3><p>Quando o corpo interpreta um movimento como ameaça, ele aumenta a tensão ao redor da região para proteger você. Forçar pode reforçar esse alarme em vez de desligá-lo.</p></div><div class="insight-list"><div class="insight-item"><span>✓</span><div>Não é simplesmente falta de alongamento.</div></div><div class="insight-item"><span>✓</span><div>É possível reaprender o movimento com estímulos mais seguros.</div></div></div><button class="btn btn-primary" id="infoContinue" type="button">Entender o próximo passo →</button></div><aside class="visual-card"><img src="${imagePath("quiz-protection-insight.webp")}" alt=""><div class="visual-note">A correção vem da precisão, não do esforço.</div></aside></div>`;
    document.getElementById("infoContinue").addEventListener("click", next);
  }

  function protectedVideo(id, posterTitle, posterImage) {
    const origin = encodeURIComponent(location.origin === "null" ? cfg.siteUrl : location.origin);
    const src = `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&origin=${origin}&controls=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=0&disablekb=1`;
    const posterStyle = posterImage ? ` style="background-image:linear-gradient(135deg, rgba(17,31,36,.72), rgba(60,93,100,.48)), url('${imagePath(posterImage)}');"` : '';
    return `<div class="protected-video"><iframe id="ytFrame" src="${src}" title="Vídeo explicativo" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="video-shield" aria-hidden="true"></div><div class="video-poster" id="videoPoster"${posterStyle}><div><strong>${escapeHtml(posterTitle)}</strong><button class="video-play" id="videoPlay" type="button" aria-label="Reproduzir vídeo">▶</button></div></div></div><div class="video-controls"><button id="videoToggle" type="button">Pausar vídeo</button><span>Player protegido: links e recomendações não são clicáveis.</span></div>`;
  }

  function youtubeCommand(command) {
    const frame = document.getElementById("ytFrame");
    frame?.contentWindow?.postMessage(JSON.stringify({ event:"command", func:command, args:[] }), "*");
  }

  function renderVideo(step) {
    const videoId = step.video === 1 ? cfg.video1Id : cfg.video2Id;
    const posterImage = step.video === 1 ? "karina-profile.webp" : "karina-movement-home.webp";
    const posterTitle = step.video === 1 ? "Entenda por que seu corpo continua travando" : "Veja o caminho indicado para o seu perfil";
    screen.innerHTML = `<div class="video-layout video-layout--single"><div class="video-shell wide"><span class="eyebrow">VÍDEO ${step.video}</span><h2>${escapeHtml(step.title)}</h2><p class="lead">${escapeHtml(step.subtitle)}</p>${protectedVideo(videoId, posterTitle, posterImage)}<div style="margin-top:20px"><button class="btn btn-primary" id="videoContinue" type="button">${step.final ? "Quero destravar meu corpo →" : "Continuar o diagnóstico →"}</button></div></div></div>`;
    let playing = false;
    document.getElementById("videoPlay").addEventListener("click", () => {
      document.getElementById("videoPoster").classList.add("hidden");
      youtubeCommand("playVideo");
      playing = true;
      document.getElementById("videoToggle").textContent = "Pausar vídeo";
      window.RXTrack?.event?.(`video_${step.video}_started`, { step:state.step + 1, screen_id:step.id, section:step.section });
    });
    document.getElementById("videoToggle").addEventListener("click", () => {
      playing = !playing;
      youtubeCommand(playing ? "playVideo" : "pauseVideo");
      document.getElementById("videoToggle").textContent = playing ? "Pausar vídeo" : "Continuar vídeo";
    });
    document.getElementById("videoContinue").addEventListener("click", () => { youtubeCommand("pauseVideo"); next(); });
  }

  function renderProcessing() {
    const region = window.RXCalc.label("region", state.answers.region || []);
    const time = window.RXCalc.label("dailyTime", state.answers.dailyTime);
    screen.innerHTML = `<div class="processing"><img src="${imagePath("quiz-protection-insight.webp")}" alt=""><span class="eyebrow">Cruzando suas respostas</span><h2>Analisando a sua Trava de Proteção</h2><p class="lead">Estamos montando um protocolo coerente com o seu corpo e a sua rotina.</p><div class="processing-list"><div class="processing-item" id="p1"><span class="processing-dot"></span>Mapeando os sinais de proteção</div><div class="processing-item" id="p2"><span class="processing-dot"></span>Analisando ${escapeHtml(region)}</div><div class="processing-item" id="p3"><span class="processing-dot"></span>Estimando o nível de rigidez</div><div class="processing-item" id="p4"><span class="processing-dot"></span>Montando seu protocolo de ${escapeHtml(time)} por dia</div></div></div>`;
    ["p1","p2","p3","p4"].forEach((id,index) => addTimer(() => document.getElementById(id)?.classList.add("done"), 500 + index * 600));
    addTimer(() => {
      const result = window.RXCalc.calculateResult(state.answers);
      window.RXIntegrations?.setResult?.(result);
      window.RXTrack?.event?.("quiz_completed", { step:state.step + 1, progress:100, result, answers:state.answers, section:"diagnosis" });
      next();
    }, 3200);
  }

  function renderResult() {
    const result = window.RXCalc.calculateResult(state.answers);
    window.RXIntegrations?.setResult?.(result);
    screen.innerHTML = `<div class="result-layout"><div><span class="eyebrow">Seu diagnóstico está pronto</span><h1>Seu corpo apresenta sinais de Trava de Proteção <span class="accent">${escapeHtml(result.level)}</span>.</h1><span class="level-badge">Nível ${escapeHtml(result.level)}</span><p class="lead">${escapeHtml(result.descriptor)}</p><div class="result-meter"><strong>Intensidade estimada do padrão</strong><div class="meter-track" style="--level-width:${result.width}%"><span></span></div><div class="meter-labels"><span>Leve</span><span>Moderada</span><span>Avançada</span></div></div><div class="result-points"><div>Foco inicial: ${escapeHtml(result.regions)}</div><div>Tempo convivendo com isso: ${escapeHtml(result.duration)}</div><div>Tempo disponível: ${escapeHtml(result.dailyTime)} por dia</div></div><p class="body-copy"><strong>${escapeHtml(result.recommendation)}</strong></p><button class="btn btn-primary" id="resultContinue" type="button">Ver meu protocolo →</button></div><aside class="visual-card"><img src="${imagePath("quiz-final-diagnosis.webp")}" alt="Pessoa em posição confortável após aliviar a rigidez"><div class="visual-note">Diagnóstico educativo baseado exclusivamente nas respostas informadas.</div></aside></div>`;
    window.RXTrack?.event?.("result_viewed", { step:state.step + 1, progress:100, result, answers:state.answers, section:"diagnosis" });
    document.getElementById("resultContinue").addEventListener("click", next);
  }

  function checkoutUrl(discounted) {
    const raw = discounted ? cfg.discountCheckoutUrl : cfg.checkoutUrl;
    return window.RXIntegrations?.appendTrackingParams?.(raw) || raw;
  }


  function testimonialVideosHtml() {
    const videos = [
      { id:"MIRK9hEC91g", title:"Depoimento 1" },
      { id:"wmzNVA5m6ic", title:"Depoimento 2" },
      { id:"p58j3-VIG48", title:"Depoimento 3" }
    ];
    return `<div class="testimonial-video-grid">${videos.map(video => `<article class="testimonial-video-card"><div class="testimonial-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1&playsinline=1" title="${video.title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></article>`).join("")}</div>`;
  }

  function offerHtml(result) {
    const regular = checkoutUrl(false);
    return `<div class="offer-page">
      <section class="offer-section offer-hero"><div class="offer-container offer-hero-grid offer-hero-grid--text"><div><span class="eyebrow" style="color:#fff;background:rgba(255,255,255,.14)">Plano personalizado</span><h1>Seu plano de Pilates Terapêutico para destravar o corpo está pronto.</h1><p class="lead">Identificamos uma Trava de Proteção <strong>${escapeHtml(result.level)}</strong>, com foco em <strong>${escapeHtml(result.regions)}</strong>.</p><div class="personal-summary">Você convive com esse padrão há <strong>${escapeHtml(result.duration)}</strong>, já tentou <strong>${escapeHtml(result.tried)}</strong> e consegue dedicar <strong>${escapeHtml(result.dailyTime)}</strong> por dia.</div><p class="offer-micro">Acesso imediato · 5 minutos por dia · Garantia de 7 dias</p></div></div></section>

      <section class="offer-section"><div class="offer-container story-copy-only"><div><h2>Você não está imaginando o que sente.</h2><div class="copy-stack" style="margin-top:20px"><p>Você chegou até aqui porque <strong>${escapeHtml(result.complaint)}</strong> está interferindo no seu dia.</p><p>Mesmo depois de tentar ${escapeHtml(result.tried)}, o alívio não se manteve. E quando isso se repete, é natural começar a evitar movimentos ou temer que o quadro piore.</p><p>Isso não é frescura e não precisa ser aceito simplesmente como consequência da idade.</p></div></div></div></section>

      <section class="offer-section" style="background:#edf0ec"><div class="offer-container"><div class="section-head"><span class="eyebrow">A virada de chave</span><h2>O problema não é falta de exercício. É a Trava de Proteção.</h2><p>Quando o sistema nervoso não confia na estabilidade de uma região, ele aumenta a tensão ao redor para proteger você.</p></div><div class="method-steps"><article class="method-step"><span>1</span><h3>É um padrão de proteção</h3><p>A rigidez pode continuar mesmo em quem se exercita, porque o corpo ainda interpreta certos movimentos como ameaça.</p></article><article class="method-step"><span>2</span><h3>Forçar pode reforçar</h3><p>Alongamentos intensos e exercícios aleatórios podem fazer o corpo aumentar a guarda.</p></article><article class="method-step"><span>3</span><h3>Segurança muda a resposta</h3><p>Estímulos curtos, precisos e progressivos mostram que o movimento pode voltar a ser seguro.</p></article><article class="method-step"><span>4</span><h3>Mobilidade volta com controle</h3><p>Ao recuperar estabilidade e confiança, o corpo deixa de limitar movimentos desnecessariamente.</p></article></div></div></section>

      <section class="offer-section"><div class="offer-container"><div class="section-head"><span class="eyebrow">Método Recupere-se</span><h2>Pilates Terapêutico aplicado em quatro etapas.</h2><p>Na prática, você acompanha sequências curtas em vídeo, em casa e sem equipamentos complexos.</p></div><div class="method-steps"><article class="method-step"><span>01</span><h3>Reset da Trava</h3><p>Começa a reduzir o sinal de ameaça e a rigidez ao longo do dia.</p></article><article class="method-step"><span>02</span><h3>Liberação dos Movimentos</h3><p>Recupera amplitude com controle e sem forçar.</p></article><article class="method-step"><span>03</span><h3>Reprogramação do Corpo</h3><p>Constrói um padrão de movimento mais fluido e natural.</p></article><article class="method-step"><span>04</span><h3>Blindagem da Mobilidade</h3><p>Reforça estabilidade para evitar que a rigidez retorne.</p></article></div></div></section>

      <section class="offer-section authority-section"><div class="offer-container authority-grid authority-grid--text"><div><span class="eyebrow">Quem está por trás do método</span><h2>Karina Moura</h2><p class="authority-quote" style="margin-top:18px">“Se você sente o corpo travar nos movimentos mais simples, isso é mais comum do que parece, mas não precisa ser o seu normal.”</p><div class="copy-stack" style="margin-top:20px"><p>Karina é instrutora de Pilates Terapêutico e trabalha diariamente com pessoas que chegam com dificuldade para abaixar, levantar ou girar o corpo.</p><p>Ao acompanhar esses casos, percebeu um padrão: por trás da rigidez e da limitação, muitas vezes existe uma resposta de proteção criada quando o corpo se sente ameaçado.</p><p>Assim nasceu o Método Recupere-se, agora disponível 100% online para ser aplicado em casa.</p></div></div></div></section>

      <section class="offer-section testimonials-section"><div class="offer-container"><div class="section-head"><span class="eyebrow">Experiências reais</span><h2>Veja relatos de alunas da Karina</h2><p>Os vídeos abaixo são os mesmos depoimentos usados na página de referência.</p></div>${testimonialVideosHtml()}</div></section>

      <section class="offer-section"><div class="offer-container price-grid"><div><span class="eyebrow">Tudo que você recebe</span><h2>Um caminho simples para começar hoje.</h2><div class="deliverables" style="margin-top:24px"><div class="deliverable"><b>✓</b><div><strong>Método Recupere-se completo</strong><br>As quatro etapas guiadas em vídeo.</div></div><div class="deliverable"><b>✓</b><div><strong>Foco em ${escapeHtml(result.primaryRegion)}</strong><br>Sequências coerentes com a sua principal região.</div></div><div class="deliverable"><b>✓</b><div><strong>Sessões curtas</strong><br>Rotina pensada para ${escapeHtml(result.dailyTime)} por dia.</div></div><div class="deliverable"><b>✓</b><div><strong>Suporte humano</strong><br>Orientação para dúvidas durante o processo.</div></div><div class="deliverable"><b>✓</b><div><strong>Bônus SOS Rigidez</strong><br>Protocolo para momentos em que o corpo trava de repente.</div></div><div class="deliverable"><b>✓</b><div><strong>Acesso imediato</strong><br>Assista pelo celular ou computador.</div></div></div></div><aside class="price-card"><span class="eyebrow" style="color:#fff;background:rgba(255,255,255,.13)">Condição desta página</span><p class="old">De R$ ${Number(cfg.referencePrice || 497).toLocaleString("pt-BR",{minimumFractionDigits:2})}</p><div class="price-main">R$ ${Number(cfg.productPrice || 97).toLocaleString("pt-BR",{minimumFractionDigits:2})}</div><p class="price-installments">ou ${escapeHtml(cfg.productInstallments)}</p><a class="btn btn-full checkout-link" data-checkout href="${escapeHtml(regular)}">Quero destravar meu corpo agora</a><p class="price-note">${escapeHtml(cfg.accessTerm)} · Garantia de ${Number(cfg.guaranteeDays || 7)} dias</p></aside></div></section>

      <section class="offer-section" style="background:#edf0ec"><div class="offer-container guarantee-box"><img src="${imagePath("guarantee-7-days.svg")}" alt="Garantia de 7 dias"><div><span class="eyebrow">Teste sem risco</span><h2>Experimente por 7 dias.</h2><p class="lead">Aplique o método com calma e observe como o seu corpo responde. Se sentir que não é para você, peça o reembolso dentro do prazo da garantia.</p></div></div></section>

      <section class="offer-section"><div class="offer-container"><div class="section-head"><span class="eyebrow">Dúvidas frequentes</span><h2>Antes de começar</h2></div><div class="faq-list"><details class="faq-item" open><summary>Preciso ter experiência com Pilates?</summary><p>Não. O programa é guiado do zero, com movimentos de baixo impacto e instruções passo a passo.</p></details><details class="faq-item"><summary>Funciona para a minha idade?</summary><p>O método respeita o ritmo do corpo e pode ser acompanhado por diferentes faixas etárias. O seu diagnóstico considerou ${escapeHtml(result.age)}.</p></details><details class="faq-item"><summary>E se eu estiver muito travada?</summary><p>O início é justamente o Reset da Trava, com movimentos suaves. Não é necessário alcançar posições difíceis para começar.</p></details><details class="faq-item"><summary>Quanto tempo preciso por dia?</summary><p>A base do método é de 5 minutos. Consistência e precisão importam mais do que duração.</p></details><details class="faq-item"><summary>Preciso de equipamento?</summary><p>Não. As sequências foram pensadas para serem feitas em casa, usando o peso do corpo.</p></details><details class="faq-item"><summary>O método substitui tratamento médico?</summary><p>Não. Em caso de dor aguda ou condição diagnosticada, o método é complementar e não substitui a orientação do seu profissional de saúde.</p></details></div></div></section>

      <section class="offer-section closing"><div class="offer-container"><h2>Seu corpo já espera há ${escapeHtml(result.duration)}.</h2><p>Agora você pode continuar repetindo o mesmo padrão ou começar a enviar ao corpo um sinal diferente, com segurança e poucos minutos por dia.</p><div class="offer-cta"><a class="btn btn-danger checkout-link" data-checkout href="${escapeHtml(regular)}">Quero começar o Método Recupere-se →</a><p class="offer-micro">Acesso imediato · Pilates Terapêutico em casa · Garantia de 7 dias</p></div></div></section>
      <div class="mobile-sticky"><a class="btn btn-danger btn-full checkout-link" data-checkout href="${escapeHtml(regular)}">Começar por ${escapeHtml(cfg.productInstallments)}</a></div>
    </div>`;
  }

  function renderOffer() {
    const result = window.RXCalc.calculateResult(state.answers);
    screen.innerHTML = offerHtml(result);
    window.RXIntegrations?.decorateCheckoutLinks?.(screen);
    screen.querySelectorAll(".checkout-link").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      const discounted = state.discountActive;
      const target = checkoutUrl(discounted);
      window.RXTrack?.event?.("checkout_clicked", { discounted, checkout_url:target, result, answers:state.answers, section:"diagnosis" });
      location.href = target;
    }));
    window.RXTrack?.event?.("offer_viewed", { step:state.step + 1, progress:100, result, answers:state.answers, section:"diagnosis" });
    armExitPopup(result);
  }

  function disarmExitPopup() {
    if (typeof exitPopupCleanup === "function") exitPopupCleanup();
    exitPopupCleanup = null;
  }

  function armExitPopup(result) {
    disarmExitPopup();
    if (cfg.exitPopupEnabled === false) return;

    exitPopupShown = false;
    let armed = false;
    let highestScroll = 0;
    let lastScrollY = window.scrollY || 0;
    let lastScrollAt = Date.now();

    const armTimer = addTimer(() => { armed = true; }, 1200);

    const desktopExit = event => {
      const leavingWindow = !event.relatedTarget && !event.toElement;
      if (armed && leavingWindow && event.clientY <= 12) showExitPopup(result);
    };

    const mouseLeave = event => {
      if (armed && event.clientY <= 12) showExitPopup(result);
    };

    const scrollHandler = () => {
      const current = window.scrollY || 0;
      const doc = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      highestScroll = Math.max(highestScroll, current / doc);
      const now = Date.now();
      const movingUpFast = current < lastScrollY - 180 && now - lastScrollAt < 700;
      if (armed && highestScroll >= 0.55 && movingUpFast) showExitPopup(result);
      lastScrollY = current;
      lastScrollAt = now;
    };

    const mobileBack = () => {
      if (!armed) {
        try { history.pushState({ recupereExitGuard:true }, "", location.href); } catch (_) {}
        return;
      }
      try { history.pushState({ recupereExitGuard:true }, "", location.href); } catch (_) {}
      showExitPopup(result);
    };

    document.addEventListener("mouseout", desktopExit);
    document.documentElement.addEventListener("mouseleave", mouseLeave);
    window.addEventListener("scroll", scrollHandler, { passive:true });

    try {
      history.replaceState(Object.assign({}, history.state || {}, { recupereExitBase:true }), "", location.href);
      history.pushState({ recupereExitGuard:true, armedAt:Date.now() }, "", location.href);
      window.addEventListener("popstate", mobileBack);
    } catch (_) {}

    exitPopupCleanup = () => {
      clearTimeout(armTimer);
      document.removeEventListener("mouseout", desktopExit);
      document.documentElement.removeEventListener("mouseleave", mouseLeave);
      window.removeEventListener("scroll", scrollHandler);
      window.removeEventListener("popstate", mobileBack);
    };
  }

  function showExitPopup(result) {
    if (document.querySelector(".exit-overlay") || exitPopupShown) return;
    exitPopupShown = true;
    disarmExitPopup();
    window.RXTrack?.event?.("exit_popup_viewed", { result, section:"diagnosis" });
    document.body.classList.add("modal-open");
    const overlay = document.createElement("div");
    overlay.className = "exit-overlay";
    overlay.innerHTML = `<div class="exit-popup" role="dialog" aria-modal="true"><button class="exit-popup__close" type="button" aria-label="Fechar">×</button><span class="exit-popup__eyebrow">Antes de sair</span><h2>Leve seu plano por uma condição especial.</h2><p>Seu diagnóstico apontou Trava de Proteção <strong>${escapeHtml(result.level)}</strong>. Para você começar agora, liberamos esta condição nesta sessão:</p><div class="exit-popup__offer"><span>Condição especial</span><strong>R$ ${Number(cfg.discountPrice || 77.6).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong><small>ou ${escapeHtml(cfg.discountInstallments)}</small></div><button class="btn btn-danger btn-full exit-popup__accept" type="button">Quero começar com desconto →</button><button class="exit-popup__leave" type="button">Continuar saindo</button><p style="font-size:11px">Acesso imediato e garantia de 7 dias.</p></div>`;
    document.body.appendChild(overlay);
    function close() { overlay.remove(); document.body.classList.remove("modal-open"); }
    overlay.querySelector(".exit-popup__close").addEventListener("click", close);
    overlay.querySelector(".exit-popup__leave").addEventListener("click", () => {
      close();
      try { history.go(-2); } catch (_) {}
    });
    overlay.querySelector(".exit-popup__accept").addEventListener("click", () => {
      state.discountActive = true;
      persist();
      const target = checkoutUrl(true);
      window.RXTrack?.event?.("exit_popup_accepted", { discounted:true, result, section:"diagnosis" });
      window.RXTrack?.event?.("checkout_clicked", { discounted:true, checkout_url:target, result, answers:state.answers, section:"diagnosis" });
      location.href = target;
    });
  }

  backBtn.addEventListener("click", back);
  setLegalLinks();
  if (state.step === 0) window.RXTrack?.event?.("quiz_started", { step:1, section:"profile", progress:0 });
  render();
})();
