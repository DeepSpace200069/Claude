/**
 * Reč kojom se potvrđuje brisanje naloga.
 *
 * Stoji u zasebnom modulu jer je treba i akcija (provera) i stranica (natpis
 * polja), a modul sa `'use server'` sme da izvozi **samo** asinhrone funkcije -
 * konstanta u njemu obara ceo izvoz.
 *
 * Namerno nije „da”: potvrda za jedinu radnju koja se ne može poništiti mora da
 * traži malo truda.
 */
export const DELETE_CONFIRMATION = 'OBRIŠI';
