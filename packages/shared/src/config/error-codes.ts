export enum EGeneralErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
export type TGeneralErrorCode = EGeneralErrorCode;

export enum EAccountErrorCode {
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
}
export type TAccountErrorCode = EAccountErrorCode;

export enum ESubscriptionErrorCode {
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
}
export type TSubscriptionErrorCode = ESubscriptionErrorCode;

export enum EAlertErrorCode {
  ALERT_NOT_FOUND = 'ALERT_NOT_FOUND',
  ALERT_SAVE_FAILED = 'ALERT_SAVE_FAILED',
}
export type TAlertErrorCode = EAlertErrorCode;

export enum EAuthErrorCode {
  AUTH_ERROR = 'AUTH_ERROR',
  LINK_EXPIRED = 'LINK_EXPIRED',
  LINK_INVALID = 'LINK_INVALID',
  OAUTH_DENIED = 'OAUTH_DENIED',
  ACCOUNT_PENDING_VALIDATION = 'ACCOUNT_PENDING_VALIDATION',
  ACCOUNT_FETCH_FAILED = 'ACCOUNT_FETCH_FAILED',
}
export type TAuthErrorCode = EAuthErrorCode;

export type TErrorCode =
  | TGeneralErrorCode
  | TAccountErrorCode
  | TSubscriptionErrorCode
  | TAlertErrorCode
  | TAuthErrorCode;
