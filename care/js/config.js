export async function getPublicConfig() {
  const response = await fetch('/care/api/config');
  if (!response.ok) {
    throw new Error('Unable to load app configuration.');
  }
  return response.json();
}

export function showNotice(element, message, isError = false) {
  element.textContent = message;
  element.classList.remove('hidden');
  element.style.borderColor = isError ? 'rgba(251, 113, 133, 0.5)' : 'rgba(20, 184, 166, 0.22)';
}

export function hideNotice(element) {
  element.textContent = '';
  element.classList.add('hidden');
}
