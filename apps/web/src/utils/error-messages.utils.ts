import {
  EAccountErrorCode,
  EAlertErrorCode,
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

const ERROR_MESSAGES: Record<TErrorCode, string> = {
  ...GENERAL_ERROR_MESSAGES,
  ...ACCOUNT_ERROR_MESSAGES,
  ...SUBSCRIPTION_ERROR_MESSAGES,
  ...ALERT_ERROR_MESSAGES,
};

export const getErrorMessage = (errorOrCode: unknown): string => {
  const code =
    errorOrCode instanceof Error ? errorOrCode.message : String(errorOrCode ?? '');
  return (
    ERROR_MESSAGES[code as TErrorCode] ??
    GENERAL_ERROR_MESSAGES[EGeneralErrorCode.UNKNOWN_ERROR]
  );
};
