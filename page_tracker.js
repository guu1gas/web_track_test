(function() {
  // --- Configuração ---
  // Endereço da API para a Prova de Conceito (PoC). Deve ser substituído pela URL de produção HTTPS.
  const API_ENDPOINT = "https://c0aef5ff730b.ngrok-free.app"; 
  
  const TRACK_PATH = "/event"; 
  const LOG_PATH = "/js-log";
  
  const CONSENT_COOKIE_NAME = "tracking_consent"; 
  const USER_ID_COOKIE_NAME = "_p_uid"; 
  const ACCOUNT_COOKIE_NAME = "_p_acc"; 
  const MAX_RETRIES = 3; // Limite de tentativas de reenvio em caso de falha de rede

  let queue = window._ptrack = window._ptrack || [];
  let accountId = "default_account";
  let userId = "unknown_user_id";
  let email = "unknown_email";
  let consentGiven = false;

  // --- Helpers e Cookies ---
  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }
  
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; secure; samesite=Lax";
  }

  // --- Logging ---
  function log(msg, ...args) {
    console.log("[PageTracker]", msg, ...args);
    
    // Tentativa de log para o endpoint da API se o consentimento for dado.
    if (!consentGiven) return; 

    try {
      fetch(API_ENDPOINT + LOG_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          args: args,
          timestamp: new Date().toISOString()
        })
      }).catch(e => console.warn("Log server unreachable", e));
    } catch (e) {
      console.warn("Logging failed", e);
    }
  }

  // --- Consentimento e Identificação ---
  function setConsent(status) {
      if (typeof status === 'boolean') {
          consentGiven = status;
          setCookie(CONSENT_COOKIE_NAME, status ? 'granted' : 'denied', 365);
          log(`Tracking consent set to: ${status}`);
          if (status) {
              // Tenta identificação e processa a fila após o consentimento.
              checkConsentAndLoadIds(); 
              processQueue(); 
          }
      }
  }

  function checkConsentAndLoadIds() {
      const consentCookie = getCookie(CONSENT_COOKIE_NAME);
      
      if (consentCookie === 'granted') {
          consentGiven = true;
          log("Consent granted via cookie.");
          
          // Carrega ID e Email de cookies persistidos.
          const storedUserId = getCookie(USER_ID_COOKIE_NAME);
          const storedAccountId = getCookie(ACCOUNT_COOKIE_NAME);
          
          if (storedUserId && storedAccountId) {
              userId = storedUserId;
              accountId = storedAccountId;
              email = storedAccountId; 
              log("User data loaded from cookies.", { accountId, userId, email });
          }
      } else {
          consentGiven = false;
          // Log local se não houver consentimento
          console.log("[PageTracker] Consent not granted via cookie. Tracking is paused.");
      }
  }

  // --- Tracking Manual Unificado ---
  function trackEvent(eventName, eventData, accountInfo = {}, retryCount = 0) {
    // 1. Atualizar e persistir a conta se novos dados forem fornecidos.
    if (accountInfo.id || accountInfo.email) {
        userId = accountInfo.id || userId;
        email = accountInfo.email || email;
        accountId = accountInfo.email || accountInfo.id || accountId;

        // Persiste as informações atualizadas em cookies (365 dias).
        setCookie(USER_ID_COOKIE_NAME, userId, 365);
        setCookie(ACCOUNT_COOKIE_NAME, accountId, 365);
        log("Account/user updated and persisted via trackEvent manual call.", { accountId, userId, email });
    }

    // 2. Checagem Crítica de Consentimento
    if (!consentGiven) {
      log(`Tracking skipped: Consent not given for event '${eventName}'`, { eventData });
      return;
    }

    // 3. Montar e Enviar Payload
    const payload = {
      eventName: eventName,
      account: accountId,
      userId,
      email,
      
      // Inclui os valores das cookies de controle no payload para registro no backend.
      cookie_user_id: getCookie(USER_ID_COOKIE_NAME) || null,
      cookie_consent_status: getCookie(CONSENT_COOKIE_NAME) || 'denied',
      
      timestamp: new Date().toISOString(),
      url: window.location.href,
      retryCount: retryCount, // Contador de tentativas para controle de loop
      ...eventData
    };

    log(`Sending event '${eventName}' data (Attempt ${retryCount + 1}/${MAX_RETRIES + 1})`, payload);

    fetch(API_ENDPOINT + TRACK_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => log("Server response", res))
    .catch(e => {
        if (retryCount < MAX_RETRIES) {
            const nextRetryCount = retryCount + 1;
            log(`Event '${eventName}' tracking failed (Attempt ${retryCount + 1}), retrying...`, e);
            // Relançar na fila, incrementando o contador
            queue.push(["trackEvent", eventName, eventData, accountInfo, nextRetryCount]);
        } else {
            log(`Event '${eventName}' permanently failed after ${MAX_RETRIES + 1} attempts. Giving up.`, e);
        }
    });
  }


  // --- Processamento da Fila ---
  function processQueue() {
    const failed = [];
    while (queue.length) {
      const [method, ...args] = queue.shift();
      console.log("[PageTracker] Processing queue item", method, args);
      try {
        if (method === "trackEvent") {
            // Extrai os 4 argumentos para trackEvent
            const eventName = args[0];
            const eventData = args[1];
            const accountInfo = args[2] || {};
            const retryCount = args[3] || 0; 
            
            trackEvent(eventName, eventData, accountInfo, retryCount);
        } else if (method === "setConsent") { 
          setConsent(args[0]);
        } else {
          log("Unknown method", method);
        }
      } catch (e) {
          // Apenas relança eventos de tracking (que dependem de rede) em caso de falha.
          if (method.startsWith("track")) { 
              log(`Tracking event '${method}' failed, will retry (via error push).`, e);
              failed.push([method, ...args]); 
          } else {
              log(`Configuration command '${method}' failed and will NOT be retried.`, e);
          }
      }
    }
    if (failed.length) queue.push(...failed);
  }

  // --- Inicialização ---
  checkConsentAndLoadIds(); // 1. Checa consentimento e carrega IDs

  // 2. Sobrescreve push para auto-processar a fila.
  const originalPush = queue.push.bind(queue);
  queue.push = function(...items) {
    const isConsentCommand = items.some(item => Array.isArray(item) && item[0] === "setConsent");
    const result = originalPush(...items);
    
    // Processa se houver consentimento OU se o comando for para definir o consentimento
    if (consentGiven || isConsentCommand) {
        processQueue(); 
    }
    return result;
  };

  // 3. Auto-track Pageview (Se houver consentimento)
  if (consentGiven) {
    // Adicionamos o retryCount inicial (0)
    queue.push(["trackEvent", "PageView", { page: document.title || window.location.pathname }, {}, 0]);
  }

  // 4. Processa itens já na fila (só enviará se consentGiven for true)
  processQueue();
  
  // 5. Expõe a função para verificação externa
  window._ptrack.getConsentStatus = () => consentGiven; 

})();