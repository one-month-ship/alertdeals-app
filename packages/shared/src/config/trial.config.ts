// Trial spec: every new account has 3 free days starting on their first alert creation.
// After that, alerts are paused and the user must subscribe to continue.
export const TRIAL_DURATION_DAYS = 3;

// Anti-abus : pendant l'essai (démarré ou non), un compte est limité à ce
// nombre d'alertes. L'abonnement lève la limite.
export const TRIAL_MAX_ALERTS = 1;
