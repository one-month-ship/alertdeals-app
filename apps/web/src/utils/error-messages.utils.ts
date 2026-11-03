import {
  EAccountErrorCode,
  EAlertErrorCode,
  EAuthErrorCode,
  EGeneralErrorCode,
  EPriceAnalysisErrorCode,
  EPushErrorCode,
  ESettingsErrorCode,
  ESubscriptionErrorCode,
  EWhatsAppErrorCode,
  EWorkerErrorCode,
  type TErrorCode,
} from '@alertdeals/shared';

const GENERAL_ERROR_MESSAGES: Record<EGeneralErrorCode, string> = {
  [EGeneralErrorCode.UNAUTHORIZED]: 'Tu dois être connecté pour effectuer cette action.',
  [EGeneralErrorCode.FORBIDDEN]: "Tu n'as pas les droits nécessaires pour effectuer cette action.",
  [EGeneralErrorCode.VALIDATION_FAILED]: 'Les informations saisies ne sont pas valides.',
  [EGeneralErrorCode.NOT_FOUND]: "L'élément demandé est introuvable.",
  [EGeneralErrorCode.DATABASE_ERROR]:
    "Une erreur est survenue côté serveur. Réessaie plus tard.",
  [EGeneralErrorCode.UNKNOWN_ERROR]:
    "Une erreur inattendue s'est produite. Réessaie plus tard.",
};

const ACCOUNT_ERROR_MESSAGES: Record<EAccountErrorCode, string> = {
  [EAccountErrorCode.ACCOUNT_NOT_FOUND]:
    "Ton compte n'a pas été trouvé. Essaie de te reconnecter.",
};

const SUBSCRIPTION_ERROR_MESSAGES: Record<ESubscriptionErrorCode, string> = {
  [ESubscriptionErrorCode.SUBSCRIPTION_REQUIRED]:
    'Un abonnement actif est requis pour cette action.',
  [ESubscriptionErrorCode.TRIAL_ALERT_LIMIT_REACHED]:
    "Pendant l'essai gratuit, tu es limité à une seule alerte. Abonne-toi pour en créer d'autres.",
  [ESubscriptionErrorCode.CHECKOUT_FAILED]:
    "Impossible de démarrer le paiement. Réessaie dans quelques instants.",
  [ESubscriptionErrorCode.BILLING_PORTAL_FAILED]:
    "Impossible d'ouvrir l'espace de gestion de l'abonnement. Réessaie plus tard.",
  [ESubscriptionErrorCode.NO_ACTIVE_CUSTOMER]:
    "Tu n'as pas encore d'abonnement à gérer.",
};

const ALERT_ERROR_MESSAGES: Record<EAlertErrorCode, string> = {
  [EAlertErrorCode.ALERT_NOT_FOUND]: 'Alerte introuvable.',
  [EAlertErrorCode.ALERT_SAVE_FAILED]:
    "Impossible d'enregistrer l'alerte. Réessaie.",
};

const PRICE_ANALYSIS_ERROR_MESSAGES: Record<EPriceAnalysisErrorCode, string> = {
  [EPriceAnalysisErrorCode.AD_NOT_FOUND]:
    "Cette annonce est introuvable. Actualise la page et réessaie.",
  [EPriceAnalysisErrorCode.ANALYSIS_FAILED]:
    "L'analyse tarifaire est momentanément indisponible. Réessaie dans un instant.",
};

const SETTINGS_ERROR_MESSAGES: Record<ESettingsErrorCode, string> = {
  [ESettingsErrorCode.SETTINGS_SAVE_FAILED]:
    "Impossible d'enregistrer les réglages. Réessaie.",
};

// Côté web on ne déclenche jamais le cron, mais le code d'erreur existe dans le shared union.
// On fournit un libellé générique pour rester exhaustif sur `Record<TErrorCode, string>`.
const WORKER_ERROR_MESSAGES: Record<EWorkerErrorCode, string> = {
  [EWorkerErrorCode.CRON_DISPATCH_FAILED]:
    "Le déclenchement automatique a échoué. Réessaie plus tard ou contacte-nous.",
};

// Erreurs WhatsApp : remontées par le worker mais aussi exposables au user via
// l'onglet WhatsApp des settings (numéro invalide, session non appairée, etc.).
const WHATSAPP_ERROR_MESSAGES: Record<EWhatsAppErrorCode, string> = {
  [EWhatsAppErrorCode.RECIPIENT_PHONE_INVALID]:
    "Ce numéro n'est pas joignable sur WhatsApp. Vérifie qu'il est correct dans tes réglages.",
  [EWhatsAppErrorCode.MESSAGE_SEND_FAILED]:
    "L'envoi du message WhatsApp a échoué. Réessaie plus tard.",
  [EWhatsAppErrorCode.SESSION_NOT_PAIRED]:
    "Le service WhatsApp n'est pas encore configuré. Contacte-nous.",
  [EWhatsAppErrorCode.SESSION_DECRYPT_FAILED]:
    "Erreur technique côté WhatsApp. Contacte-nous si le problème persiste.",
  [EWhatsAppErrorCode.CONNECTION_FAILED]:
    "La connexion à WhatsApp a échoué. Réessaie dans quelques instants.",
  [EWhatsAppErrorCode.QR_GENERATION_FAILED]:
    "Impossible de générer le QR code WhatsApp. Réessaie dans quelques instants.",
};

// Erreurs Push : activation/désactivation des notifications depuis l'onglet
// "Installation téléphone" des settings.
const PUSH_ERROR_MESSAGES: Record<EPushErrorCode, string> = {
  [EPushErrorCode.SUBSCRIBE_FAILED]:
    "Impossible d'activer les notifications sur cet appareil. Réessaie.",
  [EPushErrorCode.UNSUBSCRIBE_FAILED]:
    'Impossible de désactiver les notifications. Réessaie.',
};

const AUTH_ERROR_MESSAGES: Record<EAuthErrorCode, string> = {
  [EAuthErrorCode.AUTH_ERROR]:
    'La connexion a échoué. Réessaie ou contacte-nous si le problème persiste.',
  [EAuthErrorCode.LINK_EXPIRED]:
    'Ton lien de connexion a expiré. Demande un nouveau lien depuis la page de connexion.',
  [EAuthErrorCode.LINK_INVALID]:
    'Lien de connexion invalide. Demande un nouveau lien depuis la page de connexion.',
  [EAuthErrorCode.OAUTH_DENIED]: 'Connexion Google annulée. Réessaie quand tu veux.',
  [EAuthErrorCode.ACCOUNT_PENDING_VALIDATION]:
    'Ton compte est en attente de validation par notre équipe. Tu recevras un email dès qu’il sera prêt.',
  [EAuthErrorCode.ACCOUNT_FETCH_FAILED]:
    'Impossible d’accéder à ton compte pour le moment. Réessaie dans quelques instants.',
  [EAuthErrorCode.USER_ALREADY_EXISTS]:
    'Un compte existe déjà avec cette adresse email.',
  [EAuthErrorCode.EMAIL_INVALID]: "L'email ne semble pas valide.",
  [EAuthErrorCode.EMAIL_UPDATE_FAILED]:
    "Impossible de modifier ton email pour le moment. Réessaie plus tard.",
  [EAuthErrorCode.EMAIL_UNCHANGED]:
    "C'est déjà ton adresse email actuelle.",
};

const ERROR_MESSAGES: Record<TErrorCode, string> = {
  ...GENERAL_ERROR_MESSAGES,
  ...ACCOUNT_ERROR_MESSAGES,
  ...SUBSCRIPTION_ERROR_MESSAGES,
  ...ALERT_ERROR_MESSAGES,
  ...PRICE_ANALYSIS_ERROR_MESSAGES,
  ...SETTINGS_ERROR_MESSAGES,
  ...WORKER_ERROR_MESSAGES,
  ...WHATSAPP_ERROR_MESSAGES,
  ...PUSH_ERROR_MESSAGES,
  ...AUTH_ERROR_MESSAGES,
};

export const getErrorMessage = (errorOrCode: unknown): string => {
  const code =
    errorOrCode instanceof Error ? errorOrCode.message : String(errorOrCode ?? '');
  return (
    ERROR_MESSAGES[code as TErrorCode] ||
    code ||
    GENERAL_ERROR_MESSAGES[EGeneralErrorCode.UNKNOWN_ERROR]
  );
};
