(function () {
  "use strict";

  const labels = {
    age: { "30-39":"30 a 39 anos", "40-49":"40 a 49 anos", "50-59":"50 a 59 anos", "60+":"60 anos ou mais" },
    pilates: { studio:"Já praticou em estúdio", videos:"Já praticou por vídeos ou app", never:"Nunca praticou Pilates" },
    complaint: {
      morning:"Rigidez ao acordar", bending:"Trava ao levantar ou abaixar", lumbar:"Dor na lombar ou costas",
      neck:"Dor ou tensão na cervical ou ombros", leg:"Dor que desce para a perna", mobility:"Falta de mobilidade nos treinos"
    },
    region: { lumbar:"lombar", neck:"cervical e pescoço", shoulders:"ombros", hips:"quadril", knees:"joelhos", spine:"coluna em geral" },
    duration: { weeks:"algumas semanas", months:"alguns meses", years1to3:"1 a 3 anos", years3plus:"mais de 3 anos" },
    tried: { stretch:"alongamento por conta própria", gym:"academia ou musculação", physio:"fisioterapia", medicine:"remédio ou relaxante muscular", nothing:"nada ainda" },
    limitation: { chronic:"dor crônica diagnosticada", disc:"hérnia ou problema de disco", injury:"lesão antiga", none:"nenhuma condição diagnosticada" },
    flexibility: { locked:"bem travada", stiff:"mais dura do que gostaria", fair:"razoável", good:"boa" },
    morning: { painful:"muito rígida ou dolorida", firstMoves:"travada nos primeiros movimentos", varies:"depende do dia", calm:"tranquila" },
    activity: { simple:"trava até em coisas simples", discomfort:"consegue se mover, mas com desconforto", prevention:"move-se bem e quer prevenir" },
    fear: { avoid:"evita movimentos com medo de travar", quit:"já desistiu de coisas que gostava", frustrated:"fica frustrada com o próprio corpo", worse:"tem medo de piorar com o tempo" },
    routine: { seated:"sentada a maior parte do dia", standing:"em pé o dia todo", mixed:"mista, com pausas ativas", home:"aposentada ou em casa" },
    dailyTime: { "5":"5 minutos", "10":"10 minutos", "15":"15 minutos", "15+":"mais de 15 minutos" }
  };

  function label(group, value) {
    if (Array.isArray(value)) return value.map(item => label(group, item)).join(", ");
    return labels[group]?.[value] || value || "não informado";
  }

  function calculateResult(answers) {
    let score = 0;
    score += ({ weeks:0, months:1, years1to3:2, years3plus:3 })[answers.duration] || 0;
    score += ({ locked:3, stiff:2, fair:1, good:0 })[answers.flexibility] || 0;
    score += ({ painful:3, firstMoves:2, varies:1, calm:0 })[answers.morning] || 0;
    score += ({ simple:3, discomfort:2, prevention:0 })[answers.activity] || 0;
    score += ({ morning:1, bending:2, lumbar:2, neck:2, leg:2, mobility:1 })[answers.complaint] || 0;

    const selectedRegions = Array.isArray(answers.region) ? answers.region : [];
    if (selectedRegions.length >= 3) score += 1;

    let level = "Leve";
    let key = "light";
    let width = 34;
    let descriptor = "Seu corpo ainda responde bem aos movimentos e apresenta sinais iniciais de proteção.";
    let recommendation = "Com estímulos suaves e consistentes, a tendência é recuperar segurança e evitar que a rigidez se instale.";
    if (score >= 6) {
      level = "Moderada";
      key = "moderate";
      width = 67;
      descriptor = "O padrão de proteção já aparece em situações recorrentes e está limitando parte da sua rotina.";
      recommendation = "Seu plano deve começar pelo Reset da Trava e avançar gradualmente para mobilidade e estabilidade.";
    }
    if (score >= 10) {
      level = "Avançada";
      key = "advanced";
      width = 91;
      descriptor = "Seu corpo repete esse padrão há mais tempo e já associa alguns movimentos a uma sensação de ameaça.";
      recommendation = "Começar com movimentos curtos, precisos e progressivos é essencial para devolver confiança sem forçar.";
    }

    const regions = selectedRegions.length ? label("region", selectedRegions) : "região principal indicada";
    return {
      score,
      level,
      key,
      width,
      descriptor,
      recommendation,
      regions,
      primaryRegion: selectedRegions.length ? label("region", selectedRegions[0]) : "região principal",
      age: label("age", answers.age),
      complaint: label("complaint", answers.complaint),
      duration: label("duration", answers.duration),
      tried: label("tried", answers.tried),
      fear: label("fear", answers.fear),
      dailyTime: label("dailyTime", answers.dailyTime),
      routine: label("routine", answers.routine),
      limitation: label("limitation", answers.limitation)
    };
  }

  window.RXCalc = { labels, label, calculateResult };
})();
