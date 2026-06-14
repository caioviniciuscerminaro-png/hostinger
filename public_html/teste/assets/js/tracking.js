(function () {
  "use strict";

  function event(name, parameters) {
    const params = parameters || {};
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...params });
    } catch (_) {}
    try {
      if (typeof window.clarity === "function") window.clarity("event", name);
    } catch (_) {}
    try {
      window.RXIntegrations?.captureEvent?.(name, params);
    } catch (error) {
      console.warn("Não foi possível registrar o evento interno.", error);
    }
  }

  window.RXTrack = { event, init: function () {} };
})();
