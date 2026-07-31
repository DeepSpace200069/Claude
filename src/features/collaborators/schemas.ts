import { z } from 'zod';

/** Uloge koje saradnik može da dobije; vlasnik se ne dodeljuje. */
export const COLLABORATOR_ROLES = ['editor', 'guest_manager', 'viewer'] as const;

export const inviteCollaboratorSchema = z.object({
  eventId: z.uuid(),
  email: z.email('Unesite ispravnu email adresu.'),
  role: z.enum(COLLABORATOR_ROLES),
});

export const collaboratorRoleSchema = z.object({
  eventId: z.uuid(),
  collaboratorId: z.uuid(),
  role: z.enum(COLLABORATOR_ROLES),
});

export const collaboratorRefSchema = z.object({
  eventId: z.uuid(),
  collaboratorId: z.uuid(),
});

export type InviteCollaboratorInput = z.input<typeof inviteCollaboratorSchema>;
