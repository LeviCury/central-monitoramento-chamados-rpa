/**
 * Schemas Zod para validar respostas vindas do GLPI.
 *
 * Mantemos os schemas tolerantes (`passthrough`) e usamos `safeParse`
 * nas chamadas para nunca quebrar a aplicação por mudança no upstream —
 * apenas registramos warnings.
 */
import { z } from 'zod';

export const glpiSessionSchema = z
  .object({
    session_token: z.string().min(1),
  })
  .passthrough();

export const glpiUserSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    name: z.string().optional(),
    firstname: z.string().nullable().optional(),
    realname: z.string().nullable().optional(),
  })
  .passthrough();

export const glpiTicketRawSchema = z.record(z.unknown());

export const glpiSearchResponseSchema = z.union([
  z.array(glpiTicketRawSchema),
  z
    .object({
      data: z.array(glpiTicketRawSchema).optional(),
      totalcount: z.number().optional(),
      count: z.number().optional(),
    })
    .passthrough(),
]);

export const glpiTicketTaskSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    actiontime: z.union([z.string(), z.number(), z.null()]).optional(),
    taskcategories_id: z.union([z.string(), z.number(), z.null()]).optional(),
    users_id: z.union([z.string(), z.number(), z.null()]).optional(),
    users_id_tech: z.union([z.string(), z.number(), z.null()]).optional(),
    users_id_editor: z.union([z.string(), z.number(), z.null()]).optional(),
    user_id: z.union([z.string(), z.number(), z.null()]).optional(),
    date: z.string().nullable().optional(),
    date_creation: z.string().nullable().optional(),
    date_mod: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
  })
  .passthrough();

export const glpiTicketTaskListSchema = z.array(glpiTicketTaskSchema);

export type GlpiTicketRaw = z.infer<typeof glpiTicketRawSchema>;
export type GlpiTicketTaskRaw = z.infer<typeof glpiTicketTaskSchema>;
