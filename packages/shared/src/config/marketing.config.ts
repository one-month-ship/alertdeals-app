// ============================================================================
// MARKETING ATTRIBUTION
// ============================================================================
// La landing transmet utm_* / fbclid / gclid dans l'URL de ses CTA. L'aller-retour
// magic link / OAuth perd la query string, donc le proxy stocke ces paramètres dans
// un cookie httpOnly de courte durée, lu une seule fois à la première connexion et
// persisté sur accounts.attribution (colonne jsonb).

export const attributionConfig = {
  cookieName: 'ad_attribution',
  /** Durée de vie du cookie — assez longue pour un magic link ouvert plus tard */
  cookieMaxAgeDays: 7,
  params: [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'utm_id',
    'fbclid',
    'gclid',
  ] as const,
};

// Attribution marketing capturée depuis l'URL de la landing au signup (champ JSONB).
// utm_* suivent le nommage standard ; fbclid/gclid sont les identifiants de clic Meta/Google.
export type TAccountAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_id?: string;
  fbclid?: string;
  gclid?: string;
  /** Date ISO de la première visite portant ces paramètres */
  capturedAt: string;
};
