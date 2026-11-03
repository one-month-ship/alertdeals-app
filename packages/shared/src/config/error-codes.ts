export enum EGeneralErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
export type TGeneralErrorCode = EGeneralErrorCode;

export enum EAccountErrorCode {
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
}
export type TAccountErrorCode = EAccountErrorCode;

export enum ESubscriptionErrorCode {
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  // Essai gratuit : le compte a déjà atteint TRIAL_MAX_ALERTS alertes.
  TRIAL_ALERT_LIMIT_REACHED = 'TRIAL_ALERT_LIMIT_REACHED',
  CHECKOUT_FAILED = 'CHECKOUT_FAILED',
  BILLING_PORTAL_FAILED = 'BILLING_PORTAL_FAILED',
  NO_ACTIVE_CUSTOMER = 'NO_ACTIVE_CUSTOMER',
}
export type TSubscriptionErrorCode = ESubscriptionErrorCode;

// Raison de blocage de la création d'alerte, partagée entre le gate serveur
// (trial.service) et l'UI (AlertForm) pour afficher le bon encart.
export type TAlertCreationBlockReason =
  | ESubscriptionErrorCode.SUBSCRIPTION_REQUIRED
  | ESubscriptionErrorCode.TRIAL_ALERT_LIMIT_REACHED;

export enum EAlertErrorCode {
  ALERT_NOT_FOUND = 'ALERT_NOT_FOUND',
  ALERT_SAVE_FAILED = 'ALERT_SAVE_FAILED',
}
export type TAlertErrorCode = EAlertErrorCode;

export enum EPriceAnalysisErrorCode {
  AD_NOT_FOUND = 'PRICE_ANALYSIS_AD_NOT_FOUND',
  ANALYSIS_FAILED = 'PRICE_ANALYSIS_FAILED',
}
export type TPriceAnalysisErrorCode = EPriceAnalysisErrorCode;

export enum ESettingsErrorCode {
  SETTINGS_SAVE_FAILED = 'SETTINGS_SAVE_FAILED',
}
export type TSettingsErrorCode = ESettingsErrorCode;

export enum EWorkerErrorCode {
  CRON_DISPATCH_FAILED = 'CRON_DISPATCH_FAILED',
}
export type TWorkerErrorCode = EWorkerErrorCode;

export enum EWhatsAppErrorCode {
  RECIPIENT_PHONE_INVALID = 'RECIPIENT_PHONE_INVALID',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  SESSION_NOT_PAIRED = 'SESSION_NOT_PAIRED',
  SESSION_DECRYPT_FAILED = 'SESSION_DECRYPT_FAILED',
  // Pairing web (page admin) : la connexion au compte WhatsApp a échoué ou le
  // QR n'a pas pu être généré.
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QR_GENERATION_FAILED = 'QR_GENERATION_FAILED',
}
export type TWhatsAppErrorCode = EWhatsAppErrorCode;

export enum EPushErrorCode {
  SUBSCRIBE_FAILED = 'PUSH_SUBSCRIBE_FAILED',
  UNSUBSCRIBE_FAILED = 'PUSH_UNSUBSCRIBE_FAILED',
}
export type TPushErrorCode = EPushErrorCode;

export enum EAuthErrorCode {
  AUTH_ERROR = 'AUTH_ERROR',
  LINK_EXPIRED = 'LINK_EXPIRED',
  LINK_INVALID = 'LINK_INVALID',
  OAUTH_DENIED = 'OAUTH_DENIED',
  ACCOUNT_PENDING_VALIDATION = 'ACCOUNT_PENDING_VALIDATION',
  ACCOUNT_FETCH_FAILED = 'ACCOUNT_FETCH_FAILED',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  EMAIL_INVALID = 'EMAIL_INVALID',
  EMAIL_UPDATE_FAILED = 'EMAIL_UPDATE_FAILED',
  EMAIL_UNCHANGED = 'EMAIL_UNCHANGED',
}
export type TAuthErrorCode = EAuthErrorCode;

export type TErrorCode =
  | TGeneralErrorCode
  | TAccountErrorCode
  | TSubscriptionErrorCode
  | TAlertErrorCode
  | TPriceAnalysisErrorCode
  | TSettingsErrorCode
  | TAuthErrorCode
  | TWorkerErrorCode
  | TWhatsAppErrorCode
  | TPushErrorCode;
