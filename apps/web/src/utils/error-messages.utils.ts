import {
  EAccountErrorCode,
  EAlertErrorCode,
  EAuthErrorCode,
  EGeneralErrorCode,
  ESubscriptionErrorCode,
  type TErrorCode,
} from '@alertdeals/shared';

const GENERAL_ERROR_MESSAGES: Record<EGeneralErrorCode, string> = {
  [EGeneralErrorCode.UNAUTHORIZED]: 'Tu dois être connecté pour effectuer cette action.',
  [EGeneralErrorCode.VALIDATION_FAILED]: 'Les informations saisies ne sont pas valides.',
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
};

const ALERT_ERROR_MESSAGES: Record<EAlertErrorCode, string> = {
  [EAlertErrorCode.ALERT_NOT_FOUND]: 'Alerte introuvable.',
  [EAlertErrorCode.ALERT_SAVE_FAILED]:
    "Impossible d'enregistrer l'alerte. Réessaie.",
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
};

const ERROR_MESSAGES: Record<TErrorCode, string> = {
  ...GENERAL_ERROR_MESSAGES,
  ...ACCOUNT_ERROR_MESSAGES,
  ...SUBSCRIPTION_ERROR_MESSAGES,
  ...ALERT_ERROR_MESSAGES,
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
