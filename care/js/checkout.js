import { showNotice } from './config.js';

const statusBox = document.querySelector('#checkoutStatus');
const params = new URLSearchParams(window.location.search);
const selectedPlan = params.get('plan');

if (selectedPlan) {
  document.querySelector(`[data-plan-card="${selectedPlan}"]`)?.classList.add('featured');
}

document.querySelectorAll('[data-checkout-plan]').forEach((button) => {
  button.addEventListener('click', async () => {
    const plan = button.dataset.checkoutPlan;
    button.disabled = true;
    showNotice(statusBox, 'Opening secure Stripe checkout...');

    try {
      const response = await fetch('/care/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout could not be started.');
      }

      window.location.href = data.url;
    } catch (error) {
      showNotice(statusBox, error.message, true);
      button.disabled = false;
    }
  });
});
