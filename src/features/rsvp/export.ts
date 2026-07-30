import type { RsvpAnswerValue, RsvpQuestion } from './types';

/**
 * Prikaz odgovora na dodatno pitanje u čitljivom obliku.
 *
 * Za izbore to znači prevođenje ključa opcije (`o3`) u njen tekst: ključ je
 * stabilan zbog izmena formulacije, ali organizatoru sam po sebi ne znači
 * ništa - ni u tabeli ni u izvozu.
 */
export function formatAnswer(
  question: RsvpQuestion,
  value: RsvpAnswerValue,
  yesLabel: string,
  noLabel: string,
): string {
  const optionLabel = (key: string): string =>
    question.config.options?.find((option) => option.value === key)?.label ?? key;

  if (typeof value === 'boolean') return value ? yesLabel : noLabel;
  if (Array.isArray(value)) return value.map(optionLabel).join(', ');
  if (question.type === 'single_choice' && typeof value === 'string') {
    return optionLabel(value);
  }
  return String(value);
}

/**
 * Izvoz je uvek na jeziku pozivnice organizatora, a ne na jeziku pregledača
 * koji je fajl zatražio - fajl se otvara kasnije i deli dalje, pa mešanje
 * jezika u istoj koloni ne bi imalo smisla.
 */
export function formatAnswerForExport(
  question: RsvpQuestion,
  value: RsvpAnswerValue,
): string {
  return formatAnswer(question, value, 'Da', 'Ne');
}
