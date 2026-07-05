/**
 * Download Click Tracker for Sentinel Prime
 * Tracks all download button clicks to Supabase
 */

(function() {
  const TRACK_ENDPOINT = '/.netlify/functions/track-download';

  function trackDownload(product, button) {
    const data = {
      product: product,
      page: window.location.pathname + window.location.search,
      user_agent: navigator.userAgent,
      referrer: document.referrer || null,
      country: Intl.DateTimeFormat().resolvedOptions().timeZone || null
    };

    // Fire and forget - don't block the download
    fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(err => {
      // Silent fail - don't block user
      console.debug('Download tracking failed:', err);
    });
  }

  function initDownloadTracking() {
    // Map of download button selectors to products
    const downloadButtons = [
      { selector: 'a[href*="SentinelShield"]', product: 'guardian' },
      { selector: 'a[href*="Shift.by.Sentinel"]', product: 'linux' },
      { selector: 'a[href*="projects.sentinelprime.org"]', product: 'projects' },
      { selector: 'a[href*="/care"]', product: 'care' }
    ];

    downloadButtons.forEach(({ selector, product }) => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        // Only add listener once
        if (button.dataset.trackingAttached) return;
        button.dataset.trackingAttached = 'true';

        button.addEventListener('click', function(e) {
          // Try to get more specific product info from data attribute
          const specificProduct = button.dataset.product || product;
          trackDownload(specificProduct, button);
        });
      });
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDownloadTracking);
  } else {
    initDownloadTracking();
  }

  // Also re-scan after a short delay for dynamically added content
  setTimeout(initDownloadTracking, 1000);
  setTimeout(initDownloadTracking, 3000);
})();
