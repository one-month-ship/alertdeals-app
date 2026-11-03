'use client';

import {
  canPromptInstall,
  subscribePwaInstall,
  triggerInstallPrompt,
} from '@/lib/pwa-install';
import { useEffect, useState } from 'react';

type TPwaInstall = {
  // Android/Chrome : un prompt d'install natif est disponible.
  canPrompt: boolean;
  // iOS : pas de prompt programmable, on affiche un tuto manuel à la place.
  isIOS: boolean;
  // Samsung Internet : l'installation PWA y est bloquée par Play Protect
  // (« appli conçue pour une ancienne version d'Android ») — bug connu côté
  // Samsung, non corrigé. On redirige vers Chrome au lieu de proposer l'install.
  isSamsungInternet: boolean;
  // Lien `intent://` Android qui rouvre la page courante dans Chrome
  // (fallback Play Store si Chrome est absent). Vide hors Samsung Internet.
  openInChromeUrl: string;
  // L'app est déjà lancée en mode installé (standalone) → rien à proposer.
  isInstalled: boolean;
  // Déclenche le prompt natif (no-op si indisponible).
  promptInstall: () => Promise<void>;
};

// Page Play Store de Chrome, en fallback de l'intent si Chrome n'est pas installé.
const CHROME_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.android.chrome';

/**
 * Expose l'état d'installation de la PWA à l'UI. La capture de
 * `beforeinstallprompt` est faite globalement au chargement (cf. PwaSetup) ;
 * ce hook se contente de lire l'état partagé et de détecter iOS / standalone.
 */
export function usePwaInstall(): TPwaInstall {
  const [canPrompt, setCanPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSamsungInternet, setIsSamsungInternet] = useState(false);
  const [openInChromeUrl, setOpenInChromeUrl] = useState('');

  useEffect(() => {
    // Détection standalone : media query (Android/desktop) + `navigator.standalone` (iOS).
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    // Samsung Internet s'identifie via « SamsungBrowser/xx » dans l'UA.
    const samsung = /samsungbrowser/i.test(window.navigator.userAgent);
    setIsSamsungInternet(samsung);
    if (samsung) {
      // intent:// force l'ouverture de la page courante dans Chrome ;
      // S.browser_fallback_url envoie vers le Play Store si Chrome manque.
      const { host, pathname, search } = window.location;
      setOpenInChromeUrl(
        `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(CHROME_PLAY_STORE_URL)};end`,
      );
    }

    // État initial + abonnement aux changements captés globalement par PwaSetup.
    setCanPrompt(canPromptInstall());
    return subscribePwaInstall(() => setCanPrompt(canPromptInstall()));
  }, []);

  return {
    canPrompt,
    isIOS,
    isSamsungInternet,
    openInChromeUrl,
    isInstalled,
    promptInstall: triggerInstallPrompt,
  };
}
