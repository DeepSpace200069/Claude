/**
 * Greška uvoza.
 *
 * Zaseban tip da bi CLI mogao da razlikuje „šablon nije ispravan” (poruka
 * operatoru, izlaz 1) od neočekivanog pada (stack trace). Uvoz nikad ne
 * nastavlja posle ove greške: šablon koji se „skoro” uvezao je gori od
 * neuvezenog, jer bi se greška videla tek na tuđoj proslavi.
 */
export class ImportError extends Error {
  override readonly name = 'ImportError';
}
