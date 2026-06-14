(function () {
  "use strict";

  const config = window.RX_CONFIG || {};
  const STATE_KEY = "recupere_tracking_state_v2";
  const VISITOR_KEY = "recupere_visitor_id";
  const VISIT_KEY = "recupere_visit_id";
  const VISIT_COUNT_KEY = "recupere_visit_count";
  const VISIT_STARTED_KEY = "recupere_visit_started_at";
  const META_CACHE_KEY = "recupere_visitor_meta";
  const ATTRIBUTION_KEY = "recupere_attribution_v1";
  const ATTRIBUTION_KEYS = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "src", "sck", "s1", "s2", "s3", "fbclid", "gclid", "ttclid", "msclkid"
  ];
  const IMPORTANT_EVENTS = new Set([
    "quiz_started", "quiz_completed", "result_viewed", "offer_viewed", "checkout_clicked",
    "exit_popup_viewed", "exit_popup_accepted", "video_1_started", "video_2_started"
  ]);

  const STEP_META = {
    age: { index: 1, label: "Faixa etária", section: "profile" },
    welcome: { index: 2, label: "Boas-vindas", section: "profile" },
    pilates: { index: 3, label: "Experiência com Pilates", section: "profile" },
    concept: { index: 4, label: "Conceito", section: "profile" },
    complaint: { index: 5, label: "Incômodo principal", section: "profile" },
    region: { index: 6, label: "Regiões de dor", section: "profile" },
    mirror: { index: 7, label: "Leitura inicial", section: "profile" },
    duration: { index: 8, label: "Tempo de dor", section: "body" },
    tried: { index: 9, label: "O que já tentou", section: "body" },
    partial: { index: 10, label: "Diagnóstico parcial", section: "body" },
    video1: { index: 11, label: "Vídeo 1", section: "body" },
    limitation: { index: 12, label: "Condições associadas", section: "body" },
    flexibility: { index: 13, label: "Flexibilidade", section: "body" },
    morning: { index: 14, label: "Como acorda", section: "body" },
    activity: { index: 15, label: "Movimentos do dia", section: "body" },
    fear: { index: 16, label: "Impacto emocional", section: "body" },
    routine: { index: 17, label: "Rotina", section: "lifestyle" },
    dailyTime: { index: 18, label: "Tempo diário", section: "lifestyle" },
    processing: { index: 19, label: "Processamento", section: "diagnosis" },
    result: { index: 20, label: "Resultado", section: "diagnosis" },
    video2: { index: 21, label: "Vídeo 2", section: "diagnosis" },
    offer: { index: 22, label: "Oferta", section: "diagnosis" }
  };

  function randomId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function ensureVisitorId() {
    try {
      let id = localStorage.getItem(VISITOR_KEY) || localStorage.getItem("rx_global_session_id") || "";
      if (!id) id = randomId("rcv");
      localStorage.setItem(VISITOR_KEY, id);
      if (!localStorage.getItem("rx_global_session_id")) localStorage.setItem("rx_global_session_id", id);
      return id;
    } catch (_) {
      return randomId("rcv");
    }
  }

  function ensureVisit() {
    let visitId = "";
    let visitStartedAt = "";
    let visitCount = 1;
    try {
      visitId = sessionStorage.getItem(VISIT_KEY) || "";
      visitStartedAt = sessionStorage.getItem(VISIT_STARTED_KEY) || "";
      if (!visitId) {
        visitId = randomId("rcvisit");
        visitStartedAt = new Date().toISOString();
        sessionStorage.setItem(VISIT_KEY, visitId);
        sessionStorage.setItem(VISIT_STARTED_KEY, visitStartedAt);
        visitCount = Math.max(0, Number(localStorage.getItem(VISIT_COUNT_KEY) || 0)) + 1;
        localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));
      } else {
        visitCount = Math.max(1, Number(localStorage.getItem(VISIT_COUNT_KEY) || 1));
      }
    } catch (_) {
      visitId = visitId || randomId("rcvisit");
      visitStartedAt = visitStartedAt || new Date().toISOString();
    }
    return { visitId, visitStartedAt, visitCount };
  }

  const visitorId = ensureVisitorId();
  const visitInfo = ensureVisit();

  function readStoredAttribution() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function captureAttribution() {
    const stored = readStoredAttribution();
    const current = new URLSearchParams(window.location.search);
    const merged = { ...stored };
    ATTRIBUTION_KEYS.forEach(key => {
      const value = current.get(key);
      if (value !== null && value !== "") merged[key] = value;
    });
    try { localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(merged)); } catch (_) {}
    return merged;
  }

  function appendTrackingParams(url) {
    if (!url || url === "#") return url || "";
    try {
      const target = new URL(url, window.location.href);
      const values = captureAttribution();
      ATTRIBUTION_KEYS.forEach(key => {
        const value = values[key];
        if (value !== undefined && value !== null && String(value) !== "") target.searchParams.set(key, String(value));
      });
      return target.toString();
    } catch (_) {
      return url;
    }
  }

  function readCachedMeta() {
    try { return JSON.parse(localStorage.getItem(META_CACHE_KEY) || "{}") || {}; } catch (_) { return {}; }
  }

  function clientMeta() {
    return {
      visitor_id: visitorId,
      visit_id: visitInfo.visitId,
      visit_started_at: visitInfo.visitStartedAt,
      visit_count: visitInfo.visitCount,
      browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      browser_language: navigator.language || "",
      screen_width: window.screen ? window.screen.width : "",
      screen_height: window.screen ? window.screen.height : "",
      cached_geo: readCachedMeta()
    };
  }

  function proxyUrl() {
    const configured = String(config.trackingProxyUrl || "").trim();
    if (configured) return configured;
    const base = String(config.siteUrl || "").trim().replace(/\/$/, "");
    if (base) return `${base}/api/track.php`;
    return new URL("api/track.php", document.baseURI).toString();
  }

  function cacheMeta(meta) {
    if (!meta || typeof meta !== "object") return;
    try { localStorage.setItem(META_CACHE_KEY, JSON.stringify(meta)); } catch (_) {}
  }

  function emptyState() {
    const now = new Date().toISOString();
    const attribution = captureAttribution();
    return {
      session_id: visitorId,
      visitor_id: visitorId,
      visit_id: visitInfo.visitId,
      visit_started_at: visitInfo.visitStartedAt,
      visit_count: visitInfo.visitCount,
      started_at: now,
      updated_at: now,
      first_seen: now,
      last_seen: now,
      page_url: window.location.href,
      page_path: window.location.pathname,
      referrer: document.referrer || "",
      user_agent: navigator.userAgent || "",
      device: device(),
      current_step: "",
      current_step_label: "",
      current_step_section: "",
      max_step_index: 0,
      last_event: "page_loaded",
      answers: {},
      result: {},
      steps: {},
      step_times: {},
      events: {},
      event_count: 0,
      answer_count: 0,
      last_step_started_at: 0,
      current_step_started_at: 0,
      ...Object.fromEntries(ATTRIBUTION_KEYS.map(key => [key, attribution[key] || ""]))
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
      if (parsed && typeof parsed === "object" && parsed.session_id === visitorId) return parsed;
    } catch (_) {}
    return emptyState();
  }

  let state = loadState();
  state.device = device();
  state.visit_id = visitInfo.visitId;
  state.visit_started_at = visitInfo.visitStartedAt;
  state.visit_count = Math.max(Number(state.visit_count || 0), visitInfo.visitCount);

  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function device() {
    const width = window.innerWidth || 0;
    return width < 768 ? "mobile" : width < 1100 ? "tablet" : "desktop";
  }

  function eventRecord(name, now, extra) {
    const prev = state.events[name] || {};
    return {
      count: Number(prev.count || 0) + 1,
      first_at: prev.first_at || now,
      last_at: now,
      ...prev,
      ...extra
    };
  }

  function finishPreviousStep(nowIso) {
    if (!state.current_step || !state.current_step_started_at) return;
    const elapsed = Math.max(0, Date.now() - Number(state.current_step_started_at || 0));
    const prev = state.step_times[state.current_step] || { total_ms: 0, exits: 0 };
    state.step_times[state.current_step] = {
      total_ms: Number(prev.total_ms || 0) + Math.min(elapsed, 30 * 60 * 1000),
      exits: Number(prev.exits || 0) + 1,
      last_exited_at: nowIso
    };
  }

  function inferStepMeta(payload) {
    const screenId = payload.screen_id || payload.step_id || payload.question || payload.current_step || "";
    const base = STEP_META[screenId] || {};
    return {
      stepId: screenId,
      stepIndex: Number(payload.step || base.index || 0),
      stepLabel: base.label || screenId || "",
      stepSection: payload.section || base.section || ""
    };
  }

  function captureEvent(name, payload = {}) {
    const nowIso = new Date().toISOString();
    const meta = inferStepMeta(payload);
    state.updated_at = nowIso;
    state.last_seen = nowIso;
    state.last_event = name;
    state.page_url = window.location.href;
    state.page_path = window.location.pathname;
    state.device = device();
    state.event_count = Number(state.event_count || 0) + 1;

    if (name === "screen_viewed" && meta.stepId) {
      if (state.current_step && state.current_step !== meta.stepId) finishPreviousStep(nowIso);
      const prev = state.steps[meta.stepId] || {};
      state.steps[meta.stepId] = {
        index: meta.stepIndex,
        label: meta.stepLabel,
        section: meta.stepSection,
        views: Number(prev.views || 0) + 1,
        first_viewed_at: prev.first_viewed_at || nowIso,
        last_viewed_at: nowIso
      };
      state.current_step = meta.stepId;
      state.current_step_label = meta.stepLabel;
      state.current_step_section = meta.stepSection;
      state.current_step_started_at = Date.now();
      state.max_step_index = Math.max(Number(state.max_step_index || 0), meta.stepIndex);
    }

    if (name === "question_answered") {
      const key = payload.question || meta.stepId || "";
      if (key) {
        state.answers[key] = payload.answer;
        state.answer_count = Number(state.answer_count || 0) + 1;
      }
      if (payload.answers && typeof payload.answers === "object") {
        Object.assign(state.answers, payload.answers);
      }
    }

    if (name === "quiz_completed" || payload.result) {
      if (payload.result && typeof payload.result === "object") state.result = payload.result;
    }

    state.events[name] = eventRecord(name, nowIso, {
      step_id: meta.stepId,
      step_index: meta.stepIndex,
      section: meta.stepSection,
      progress: Number(payload.progress || 0) || undefined,
      discounted: payload.discounted === true ? true : undefined,
      checkout_url: payload.checkout_url || undefined
    });

    saveState();
    return sendSnapshot(IMPORTANT_EVENTS.has(name));
  }

  function setAnswers(answers) {
    if (!answers || typeof answers !== "object") return;
    state.answers = { ...state.answers, ...answers };
    state.updated_at = new Date().toISOString();
    saveState();
  }

  function setResult(result) {
    if (!result || typeof result !== "object") return;
    state.result = { ...result };
    state.updated_at = new Date().toISOString();
    saveState();
  }

  async function sendSnapshot(useBeacon = false) {
    const payload = { type: "session_snapshot", session: state, client_meta: clientMeta() };
    if (useBeacon && navigator.sendBeacon) {
      try {
        const ok = navigator.sendBeacon(proxyUrl(), new Blob([JSON.stringify(payload)], { type: "text/plain;charset=UTF-8" }));
        if (ok) return { ok: true, beacon: true };
      } catch (_) {}
    }
    try {
      const response = await fetch(proxyUrl(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "same-origin"
      });
      const data = await response.json().catch(() => ({}));
      if (data && data.visitor_meta) cacheMeta(data.visitor_meta);
      return data;
    } catch (error) {
      console.warn("Falha ao enviar snapshot", error);
      return { ok: false, error: String(error && error.message || error) };
    }
  }

  function decorateCheckoutLinks(root = document) {
    root.querySelectorAll('a[href*="hotmart.com"], a[href*="kiwify.com"], a[data-checkout]').forEach(link => {
      const original = link.dataset.originalCheckoutUrl || link.getAttribute("href") || "";
      if (!original) return;
      link.dataset.originalCheckoutUrl = original;
      link.setAttribute("href", appendTrackingParams(original));
    });
  }

  window.RXIntegrations = {
    captureEvent,
    setAnswers,
    setResult,
    sendSnapshot,
    getState: () => state,
    getUtmParams: () => captureAttribution(),
    appendTrackingParams,
    decorateCheckoutLinks,
    device,
    isConfigured: () => Boolean(proxyUrl())
  };

  window.addEventListener("beforeunload", () => {
    finishPreviousStep(new Date().toISOString());
    saveState();
    sendSnapshot(true);
  });
})();
