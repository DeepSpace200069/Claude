// Odbrojavanje do venčanja; datum je upisan direktno u kod, kao na pravim sajtovima.
const DATUM = '2026-09-12T17:00:00';
const zvuk = 'img/zvono.mp3';

function preostalo() {
  const razlika = new Date(DATUM).getTime() - Date.now();
  return Math.max(0, Math.floor(razlika / 86400000));
}

document.addEventListener('DOMContentLoaded', () => {
  const element = document.querySelector('#datum');
  if (element) element.dataset.dana = String(preostalo());
  if (zvuk) new Audio(zvuk);
});
