import 'server-only';

import {
  defaultRsvpSection,
  readGuestbookSection,
  readRsvpSection,
} from '@/features/rsvp/section-data';
import type { LiveInteractionContext } from '@/features/rsvp/types';
import { issueFormNonce } from '@/lib/form-nonce';
import { submitGuestbookEntryAction } from '@/server/actions/guestbook';
import { submitRsvpAction } from '@/server/actions/rsvp';

import { listApprovedEntries } from './guestbook';
import type { PublicInvitation } from './public-invitation';
import {
  findRecipientByToken,
  listRsvpQuestions,
  loadResponseByEditToken,
  loadResponseForRecipient,
} from './rsvp';

/**
 * Interaktivni deo javne pozivnice (zahtev 12 i 9).
 *
 * Sve ovde zavisi od **ovog** gosta i **ovog** trenutka - njegov token, njegov
 * raniji odgovor, ključ obrasca - pa se namerno računa van keša sadržaja
 * pozivnice. Kada se pitanja i odobrene poruke ne traže (sekcije nisu na
 * pozivnici), upiti se ni ne izvršavaju.
 */

/** Opseg potpisa obrasca; isti ga proverava server akcija. */
export function formScope(slug: string): string {
  return `pozivnica:${slug}`;
}

export async function buildLiveContext(input: {
  invitation: PublicInvitation;
  recipientToken?: string | null;
  editToken?: string | null;
}): Promise<LiveInteractionContext> {
  const { invitation } = input;
  const recipientToken = input.recipientToken ?? null;
  const editToken = input.editToken ?? null;

  /*
   * Pozivnica od uvezenog sajta nema sekcije, ali ima RSVP: forma stoji tamo
   * gde je u šablonu bila ukrasna. Podešavanja su podrazumevana iz iste šeme,
   * pa server prihvata tačno ono što forma pita.
   */
  const rsvpSettings =
    invitation.html?.status === 'ok'
      ? defaultRsvpSection()
      : readRsvpSection(invitation.document);
  const guestbookSettings = readGuestbookSection(invitation.document);

  const recipient = recipientToken
    ? await findRecipientByToken(invitation.invitationId, recipientToken)
    : null;

  const questions = rsvpSettings
    ? await listRsvpQuestions(invitation.invitationId)
    : [];

  /*
   * Link za izmenu ima prednost nad ličnim linkom: gost koji je stigao baš njim
   * hoće da vidi odgovor koji je poslao, čak i ako je u međuvremenu otvorio
   * pozivnicu i kroz svoj lični link.
   */
  const existingResponse = editToken
    ? await loadResponseByEditToken(invitation.invitationId, editToken)
    : recipient
      ? await loadResponseForRecipient(recipient.id)
      : null;

  const guestbookEntries =
    guestbookSettings && guestbookSettings.showPublicly
      ? await listApprovedEntries(invitation.invitationId)
      : [];

  return {
    slug: invitation.slug,
    recipientToken,
    greetingName: recipient?.greetingName ?? null,
    maxGuests: recipient?.maxGuests ?? null,
    formNonce: issueFormNonce(formScope(invitation.slug)),
    questions,
    existingResponse,
    editToken,
    guestbookEntries,
    submitRsvp: submitRsvpAction,
    submitGuestbookEntry: submitGuestbookEntryAction,
  };
}
