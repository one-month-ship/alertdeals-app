export const ALERT_STATUS_DEFINITIONS = [
  {
    key: 'ACTIVE',
    value: 'active',
    label: 'Active',
    description: 'Alerte active',
    icon: 'play',
    color: 'green',
  },
  {
    key: 'PAUSED',
    value: 'paused',
    label: 'En pause',
    description: 'Alerte mise en pause',
    icon: 'pause',
    color: 'orange',
  },
] as const;

export const EAlertStatus = Object.fromEntries(
  ALERT_STATUS_DEFINITIONS.map((status) => [status.key, status.value]),
) as {
  [K in (typeof ALERT_STATUS_DEFINITIONS)[number]['key']]: Extract<
    (typeof ALERT_STATUS_DEFINITIONS)[number],
    { key: K }
  >['value'];
};

export type TAlertStatus = (typeof ALERT_STATUS_DEFINITIONS)[number]['value'];

export const ALERT_STATUS_VALUES = ALERT_STATUS_DEFINITIONS.map((s) => s.value) as [
  TAlertStatus,
  ...TAlertStatus[],
];

export const getAlertStatusConfig = (status: TAlertStatus) => {
  const config = ALERT_STATUS_DEFINITIONS.find((s) => s.value === status);
  if (!config) throw new Error(`Invalid alert status: ${status}`);
  return config;
};

// "Prix d'alerte" mode — user picks one when creating an alert.
export const ALERT_MODE_DEFINITIONS = [
  {
    key: 'PRICE_MAX',
    value: 'price_max',
    label: 'Je vise un prix max',
    description: 'Vous serez alerté dès qu’une annonce est moins chère que ce prix',
  },
  {
    key: 'MARGIN_MIN',
    value: 'margin_min',
    label: 'Je vise une marge min',
    description: 'Vous serez alerté dès qu’une annonce offre une marge égale ou supérieure',
  },
] as const;

export const EAlertMode = Object.fromEntries(
  ALERT_MODE_DEFINITIONS.map((mode) => [mode.key, mode.value]),
) as {
  [K in (typeof ALERT_MODE_DEFINITIONS)[number]['key']]: Extract<
    (typeof ALERT_MODE_DEFINITIONS)[number],
    { key: K }
  >['value'];
};

export type TAlertMode = (typeof ALERT_MODE_DEFINITIONS)[number]['value'];

export const ALERT_MODE_VALUES = ALERT_MODE_DEFINITIONS.map((m) => m.value) as [
  TAlertMode,
  ...TAlertMode[],
];

export type TAlertNotificationChannels = {
  email: boolean;
  phone: boolean;
  whatsapp: boolean;
};
