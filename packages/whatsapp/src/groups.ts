import { WASocket } from '@whiskeysockets/baileys';

// Un groupe détecté quand notre numéro central vient d'être ajouté dedans.
// Volontairement générique (pas de notion de compte AlertDeals) : c'est le
// worker qui reliera `addedBy` à un compte via `accounts.whatsappPhoneNumber`.
export type DetectedGroup = {
  // JID complet du groupe, ex. "120363...@g.us".
  groupId: string;
  // Nom du groupe au moment de la détection (null si la métadonnée échoue).
  groupName: string | null;
  // Numéro (chiffres uniquement) de la personne qui nous a ajoutés. C'est la
  // clé de liaison avec un compte. Null si Baileys ne fournit pas d'auteur.
  addedBy: string | null;
};

export type GroupAddedHandler = (group: DetectedGroup) => void | Promise<void>;

/**
 * Normalise un JID Baileys en numéro à chiffres uniquement.
 *  - "33612345678@s.whatsapp.net" → "33612345678"
 *  - "33612345678:12@s.whatsapp.net" (suffixe device) → "33612345678"
 * Permet de comparer des JIDs entre eux et avec un numéro stocké en settings.
 */
function jidToPhone(jid: string | null | undefined): string | null {
  if (!jid) return null;
  // On retire le domaine (@...) puis l'éventuel suffixe device (:NN), et on ne
  // garde que les chiffres pour une comparaison robuste.
  const beforeDomain = jid.split('@')[0] ?? '';
  const beforeDevice = beforeDomain.split(':')[0] ?? '';
  const digits = beforeDevice.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

// Forme partielle d'un participant de groupe telle que renvoyée par Baileys.
// On s'appuie sur `phoneNumber` (JID `@s.whatsapp.net`, le vrai numéro) plutôt
// que sur `id` qui est souvent un `@lid` (identifiant masqué non reliable à un
// compte).
type GroupParticipantLike = {
  id: string;
  phoneNumber?: string | null;
  admin?: string | null;
};

/**
 * Écoute l'ajout de notre numéro central dans un groupe WhatsApp.
 *
 * Quand le bot est ajouté à un groupe, Baileys émet `groups.upsert` avec la
 * métadonnée du groupe (sujet + participants). Chaque participant expose son
 * vrai numéro dans `phoneNumber` (le `id` est un LID masqué). On :
 *   1. vérifie que notre numéro central est bien membre du groupe,
 *   2. déduit `addedBy` = le numéro de l'owner/créateur du groupe (celui qui
 *      nous a ajoutés), résolu depuis la liste des participants,
 *   3. remonte `{ groupId, groupName, addedBy }` au handler fourni.
 *
 * Le handler ne doit pas throw : une erreur de traitement (DB, etc.) ne doit
 * pas casser le socket. On loggue défensivement ici.
 */
export function onWhatsAppGroupAdded(
  socket: WASocket,
  handler: GroupAddedHandler,
): void {
  // [DEBUG group-detection] confirme que l'écouteur est bien branché.
  console.log('[DEBUG group-detection] onWhatsAppGroupAdded listener attaché');

  socket.ev.on('groups.upsert', async (groups) => {
    // [DEBUG group-detection] l'event fire-t-il ? combien de groupes ?
    console.log(
      `[DEBUG group-detection] groups.upsert reçu — ${groups.length} groupe(s)`,
    );

    // Numéro du compte central (celui qui est appairé sur ce socket).
    const ourPhone = jidToPhone(socket.user?.id);
    // [DEBUG group-detection] notre numéro central est-il bien résolu ?
    console.log(
      `[DEBUG group-detection] socket.user?.id=${socket.user?.id} → ourPhone=${ourPhone}`,
    );
    if (!ourPhone) {
      console.warn('[DEBUG group-detection] ABORT: ourPhone null, event ignoré');
      return;
    }

    for (const group of groups) {
      const participants = (group.participants ?? []) as GroupParticipantLike[];

      // [DEBUG group-detection] structure brute des participants : on veut voir
      // si `phoneNumber` est rempli ou si Baileys ne donne que des LID (`id`).
      console.log(
        `[DEBUG group-detection] groupe id=${group.id} subject=${group.subject} owner=${group.owner} participants=`,
        JSON.stringify(
          participants.map((p) => ({
            id: p.id,
            phoneNumber: p.phoneNumber,
            admin: p.admin,
          })),
        ),
      );

      // Numéro réel de chaque participant (depuis `phoneNumber`, pas le LID).
      const numbered = participants
        .map((p) => ({ id: p.id, phone: jidToPhone(p.phoneNumber) }))
        .filter((p): p is { id: string; phone: string } => p.phone !== null);

      // [DEBUG group-detection] combien de participants ont un vrai numéro ?
      console.log(
        `[DEBUG group-detection] participants avec numéro résolu: ${numbered.length}/${participants.length} →`,
        JSON.stringify(numbered),
      );

      // On ne réagit que si notre numéro central est bien membre du groupe
      // (`groups.upsert` peut aussi fire lors d'une resync de session).
      const weAreMember = numbered.some((p) => p.phone === ourPhone);
      if (!weAreMember) {
        console.warn(
          `[DEBUG group-detection] ABORT: notre numéro (${ourPhone}) absent des participants du groupe ${group.id}`,
        );
        continue;
      }

      // `addedBy` = l'owner du groupe (le créateur, qui nous a ajoutés).
      // `group.owner` est un LID → on retrouve le participant correspondant
      // pour récupérer son vrai numéro. Fallback : 1er participant non-central.
      const owner = numbered.find((p) => p.id === group.owner);
      const addedBy =
        owner?.phone ??
        numbered.find((p) => p.phone !== ourPhone)?.phone ??
        null;

      // [DEBUG group-detection] qui est désigné comme "addedBy" ?
      console.log(
        `[DEBUG group-detection] addedBy résolu=${addedBy} (owner match=${owner?.phone ?? 'aucun'})`,
      );

      try {
        await handler({
          groupId: group.id,
          groupName: group.subject ?? null,
          addedBy,
        });
      } catch (error) {
        console.error(
          '[whatsapp] group-added handler error:',
          error instanceof Error ? error.message : error,
        );
      }
    }
  });

  // [DEBUG group-detection] écouteur temporaire : si `groups.upsert` ne fire
  // jamais quand le bot est ajouté, c'est probablement cet event qui porte
  // l'info. Sert juste à confirmer quel event WhatsApp émet réellement.
  socket.ev.on('group-participants.update', (update) => {
    console.log(
      '[DEBUG group-detection] group-participants.update reçu →',
      JSON.stringify(update),
    );
  });
}
