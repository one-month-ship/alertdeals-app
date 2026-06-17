import { accounts, getDBAdminClient, sql, whatsappGroups } from '@alertdeals/db';
import type { DetectedGroup } from '@alertdeals/whatsapp';

/**
 * Persiste un groupe WhatsApp fraîchement détecté.
 *
 * La liaison au compte se fait via `addedBy` (numéro de la personne qui a
 * ajouté notre bot) comparé à `accounts.whatsappPhoneNumber`. Le numéro stocké
 * en settings peut contenir "+", espaces, etc. : on compare donc les chiffres
 * uniquement, des deux côtés, directement en SQL.
 *
 * Ne throw jamais : appelé en fire-and-forget depuis l'écoute du socket, une
 * erreur ici ne doit pas affecter la connexion WhatsApp.
 */
export async function handleDetectedGroup(group: DetectedGroup): Promise<void> {
  // [DEBUG group-detection] le handler est-il bien appelé, et avec quoi ?
  console.log('[DEBUG group-detection] handleDetectedGroup appelé avec', group);

  if (!group.addedBy) {
    console.warn('[whatsapp-group] groupe détecté sans auteur, ignoré', group.groupId);
    return;
  }

  const db = getDBAdminClient();

  // Retrouve le compte dont le numéro WhatsApp (chiffres only) == addedBy.
  // `addedBy` est déjà normalisé en chiffres par le package whatsapp.
  // NB : `'\\D'` (double backslash) est indispensable — dans un template JS,
  // `'\D'` serait interprété en `'D'` et la regex retirerait la lettre D au
  // lieu des non-chiffres, cassant le matching (`+212…` resterait avec son `+`).
  const account = await db.query.accounts.findFirst({
    columns: { id: true },
    where: sql`regexp_replace(${accounts.whatsappPhoneNumber}, '\\D', '', 'g') = ${group.addedBy}`,
  });

  // [DEBUG group-detection] résultat du matching numéro → compte.
  console.log(
    `[DEBUG group-detection] recherche compte avec whatsappPhoneNumber (chiffres) == ${group.addedBy} → ${account ? `trouvé ${account.id}` : 'AUCUN'}`,
  );

  if (!account) {
    // Personne n'a renseigné ce numéro : on ne sait pas à qui rattacher le
    // groupe. L'utilisateur doit d'abord enregistrer son numéro en settings.
    console.warn(
      `[whatsapp-group] aucun compte pour le numéro ${group.addedBy}, groupe ${group.groupId} ignoré`,
    );
    return;
  }

  // Upsert idempotent : si l'event est rejoué (reconnexion du socket), la
  // contrainte UNIQUE(account_id, group_id) évite les doublons.
  await db
    .insert(whatsappGroups)
    .values({
      accountId: account.id,
      groupId: group.groupId,
      groupName: group.groupName,
      addedBy: group.addedBy,
    })
    .onConflictDoNothing({
      target: [whatsappGroups.accountId, whatsappGroups.groupId],
    });

  console.log(
    `[whatsapp-group] groupe ${group.groupId} rattaché au compte ${account.id}`,
  );
}
