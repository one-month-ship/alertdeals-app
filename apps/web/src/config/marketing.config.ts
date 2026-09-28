/**
 * Meta Conversions API (pixel côté serveur).
 *
 * Les événements d'inscription et d'abonnement se passent dans l'app, pas sur la
 * landing : sans envoi serveur, la campagne s'optimiserait sur des clics au lieu de
 * clients, et les visiteurs sous bloqueur de pub seraient invisibles.
 *
 * Le service est désactivé silencieusement tant que META_PIXEL_ID et
 * META_CAPI_ACCESS_TOKEN ne sont pas tous les deux renseignés.
 *
 * Le pixel (ensemble de données) est partagé avec Auto-Prospect, qui fait
 * référence : même entreprise et même cible, donc un seul dataset pour cumuler le
 * signal à petit budget. Le token doit donc être celui du dataset Auto-Prospect.
 * Les deux produits envoient les mêmes noms d'événements ; la séparation par
 * produit se fait dans Ads Manager via des conversions personnalisées sur
 * l'URL (`event_source_url`), pas via des noms d'événements distincts.
 *
 * La config d'attribution (nom du cookie, paramètres capturés) vit dans
 * @alertdeals/shared car le proxy et le service la partagent.
 */
export const metaCapiConfig = {
  pixelId: process.env.META_PIXEL_ID,
  accessToken: process.env.META_CAPI_ACCESS_TOKEN,
  /** Events Manager → « Tester les événements » : route les événements vers la vue de test */
  testEventCode: process.env.META_CAPI_TEST_EVENT_CODE,
  apiVersion: 'v22.0',
  get enabled() {
    return Boolean(this.pixelId && this.accessToken);
  },
  get endpoint() {
    return `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events`;
  },
};
