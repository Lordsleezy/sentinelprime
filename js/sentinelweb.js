(function () {
  const API_BASE = (window.SENTINELWEB_API_BASE || "https://sentinelweb-production-1d18.up.railway.app").replace(/\/$/, "");
  const form = document.getElementById("sentinelweb-form");
  const queryEl = document.getElementById("sw-query");
  const locationEl = document.getElementById("sw-location");
  const skuEl = document.getElementById("sw-sku");
  const submitEl = document.getElementById("sw-submit");
  const voiceEl = document.getElementById("sw-voice");
  const statusEl = document.getElementById("sw-status");
  const errorEl = document.getElementById("sw-error");
  const progressEl = document.getElementById("sw-progress");
  const summaryEl = document.getElementById("sw-summary");
  const resultsEl = document.getElementById("sw-results");
  const healthChip = document.getElementById("health-chip");
  const healthDetail = document.getElementById("health-detail");
  const healthList = document.getElementById("health-list");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(text, loading) {
    statusEl.classList.toggle("loading", Boolean(loading));
    statusEl.querySelector("span:last-child").textContent = text;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add("show");
  }

  function clearOutput() {
    errorEl.classList.remove("show");
    errorEl.textContent = "";
    progressEl.innerHTML = "";
    summaryEl.innerHTML = "";
    summaryEl.classList.remove("show");
    resultsEl.innerHTML = "";
  }

  function selectedProviders() {
    return [...document.querySelectorAll('input[name="provider"]:checked')].map((input) => input.value);
  }

  function buildProductQuery() {
    const pieces = [queryEl.value.trim()];
    if (skuEl.value.trim()) pieces.push(`SKU/model: ${skuEl.value.trim()}`);
    return pieces.filter(Boolean).join(" ");
  }

  async function fetchJson(path, options) {
    const response = await fetch(`${API_BASE}${path}`, {
      mode: "cors",
      credentials: "include",
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.detail || data.error || `Request failed with ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function checkHealth() {
    try {
      const data = await fetchJson("/health", { method: "GET" });
      healthChip.classList.toggle("ok", Boolean(data.inventory_ready));
      healthChip.classList.toggle("bad", !data.inventory_ready);
      healthChip.querySelector("span:last-child").textContent = data.inventory_ready ? "Backend ready" : "Backend degraded";
      healthDetail.textContent = data.inventory_ready
        ? "Railway backend is reachable and inventory is ready."
        : "Railway backend is reachable, but inventory is not ready yet.";
      healthList.innerHTML = [
        `AI helper: ${data.ai_helper_connected ? "connected" : "unavailable"}`,
        `Model: ${data.ai_helper_model || "unknown"}`,
        `Browser: ${data.browser_ready ? "ready" : "not ready"}`,
        `Inventory: ${data.inventory_ready ? "ready" : "unready"}`
      ].map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    } catch (error) {
      healthChip.classList.add("bad");
      healthChip.querySelector("span:last-child").textContent = "Backend unreachable";
      healthDetail.textContent = "Unable to reach SentinelWeb health endpoint.";
      healthList.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
    }
  }

  function renderProgress(progress) {
    const items = Array.isArray(progress) ? progress.slice(-8) : [];
    progressEl.innerHTML = items.map((item) => {
      const label = [item.provider, item.state, item.detail].filter(Boolean).join(" - ");
      return `<li>${escapeHtml(label)}</li>`;
    }).join("");
  }

  function renderResults(data) {
    const cacheHit = Boolean(data.cache_hit);
    const aiSummary = data.ai_summary || {};
    const providerResults = data.provider_results || data.results || [];
    if (aiSummary.summary || aiSummary.best_option || cacheHit) {
      summaryEl.classList.add("show");
      summaryEl.innerHTML = `
        <h3>AI summary ${cacheHit ? '<span class="sw-pill">Cache hit</span>' : ""}</h3>
        <p>${escapeHtml(aiSummary.summary || "No summary returned yet.")}</p>
        ${aiSummary.best_option ? `<p><strong>Best option:</strong> ${escapeHtml(aiSummary.best_option)}</p>` : ""}
        ${Number.isFinite(Number(data.confidence)) ? `<p class="sw-muted">Confidence: ${Math.round(Number(data.confidence) * 100)}%</p>` : ""}
      `;
    }

    if (!providerResults.length) {
      resultsEl.innerHTML = '<p class="sw-muted">No provider results returned.</p>';
      return;
    }

    resultsEl.innerHTML = providerResults.map((result) => {
      const unavailable = result.status !== "completed";
      const statusClass = unavailable ? "sw-pill warn" : "sw-pill";
      return `
        <article class="sw-result-card">
          <div class="sw-result-head">
            <strong>${escapeHtml(result.provider || "provider")}</strong>
            <span class="${statusClass}">${escapeHtml(result.status || "unknown")}</span>
          </div>
          <p><strong>Availability:</strong> ${escapeHtml(result.availability || result.error || "Unavailable")}</p>
          <p><strong>Price:</strong> ${escapeHtml(result.price || "Not returned")}</p>
          ${result.source_url ? `<p><a href="${escapeHtml(result.source_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--il-cyan)">Source</a></p>` : ""}
        </article>
      `;
    }).join("");
  }

  async function pollSearch(searchId) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      const data = await fetchJson(`/inventory/search/${encodeURIComponent(searchId)}`, { method: "GET" });
      renderProgress(data.progress);
      if (data.status === "completed" || data.status === "unavailable") {
        setStatus(data.status === "completed" ? "Search complete." : "Search unavailable.", false);
        renderResults(data);
        return;
      }
    }
    throw new Error("Search timed out while polling for progress.");
  }

  async function submitSearch(event) {
    event.preventDefault();
    clearOutput();
    const providers = selectedProviders();
    if (!providers.length) {
      showError("Select at least one retailer.");
      return;
    }

    submitEl.disabled = true;
    setStatus("Submitting private beta inventory search...", true);
    try {
      const data = await fetchJson("/inventory/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: buildProductQuery(),
          location: locationEl.value.trim(),
          providers
        })
      });
      if (data.cache_hit && data.result) {
        setStatus("Cached result loaded.", false);
        renderProgress(data.result.progress);
        renderResults(data.result);
      } else {
        setStatus("Search running. Polling progress...", true);
        await pollSearch(data.search_id);
      }
    } catch (error) {
      setStatus("Search stopped.", false);
      if (error.status === 403) {
        showError("Private beta access required. Contact Sentinel Prime for access.");
      } else {
        showError(error.message || "SentinelWeb request failed.");
      }
    } finally {
      submitEl.disabled = false;
    }
  }

  function setupVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !voiceEl) return;
    voiceEl.hidden = false;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    voiceEl.addEventListener("click", () => {
      voiceEl.disabled = true;
      voiceEl.textContent = "Listening...";
      recognition.start();
    });
    recognition.addEventListener("result", (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) queryEl.value = transcript;
    });
    recognition.addEventListener("end", () => {
      voiceEl.disabled = false;
      voiceEl.textContent = "Voice input";
    });
    recognition.addEventListener("error", () => {
      voiceEl.disabled = false;
      voiceEl.textContent = "Voice input";
    });
  }

  form.addEventListener("submit", submitSearch);
  setupVoice();
  checkHealth();
})();
