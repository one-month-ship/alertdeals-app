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
