(function() {
  let queue = window._ptrack = window._ptrack || [];
  let accountId = "default_email";

  // Send logs to server
  function log(msg, ...args) {
    fetch("http://185.202.223.81:5002/js-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        args: args,
        timestamp: new Date().toISOString()
      })
    }).catch(e => {
      console.error("Failed to send JS log", e);
    });
  }

  function processQueue() {
    while (queue.length) {
      const [method, ...args] = queue.shift();
      log("Processing queue item", method, args);

      if (method === "setAccount") {
        accountId = args[0];
        log("Account set to", accountId);
      } 
      else if (method === "trackProduct") {
        sendProductData(args[0]);
      } else {
        log("Unknown method", method);
      }
    }
  }

  function sendProductData(data) {
    if (!data.id) {
      log("Product tracking requires at least an ID", data);
      return;
    }

    const payload = {
      account: accountId,
      timestamp: new Date().toISOString(),
      ...data
    };

    log("Sending product data", payload);

    fetch("http://185.202.223.81:5002/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(res => log("Server response", res))
    .catch(e => log("Tracking error", e));
  }

  processQueue();
  queue.push = function(item) {
    Array.prototype.push.apply(this, arguments);
    log("Queue push called", item);
    processQueue();
    return this.length;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const productEl = document.querySelector("[data-track-product]");
    if (productEl) {
      const data = {
        id: productEl.dataset.productId,
        name: productEl.dataset.productName,
        price: productEl.dataset.productPrice,
        category: productEl.dataset.productCategory
      };
      if (data.id) _ptrack.push(["trackProduct", data]);
    }
  });
})();
