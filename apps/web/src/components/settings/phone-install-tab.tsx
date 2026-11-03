'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { Bell, Check, Download, PlayCircle, Share, Smartphone } from 'lucide-react';

// Tutoriels vidéo pas-à-pas pour installer l'app sur l'écran d'accueil.
const INSTALL_VIDEO_ANDROID_URL = 'https://www.youtube.com/watch?v=P5mbnM4UAvw';
const INSTALL_VIDEO_IOS_URL = 'https://www.youtube.com/shorts/zArPzLKdw_8';

// Onglet "Installation téléphone" du dashboard settings. Deux blocs distincts :
//  1. installer AlertDeals en PWA (prompt natif Android vs. ajout manuel iOS),
//  2. activer les notifications push sur l'appareil.
// Sur iOS le push n'est possible qu'une fois l'app installée, d'où l'ordre.
export function PhoneInstallTab() {
  return (
    <div className="space-y-6">
      <InstallCard />
      <NotificationsCard />
    </div>
  );
}

function InstallCard() {
  const {
    canPrompt,
    isIOS,
    isSamsungInternet,
    openInChromeUrl,
    isInstalled,
    promptInstall,
  } = usePwaInstall();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Installation téléphone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isInstalled ? (
          // App déjà lancée en standalone : rien à installer.
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-primary" />
            AlertDeals est déjà installée sur cet appareil.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Installe AlertDeals sur ton téléphone pour la lancer en plein écran
              comme une vraie app et recevoir les notifications.
            </p>

            {isSamsungInternet && (
              // Samsung Internet : l'installation PWA y est bloquée par Play
              // Protect (message « appli conçue pour une ancienne version
              // d'Android »). On guide vers Chrome, où l'installation marche.
              <div className="space-y-3 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
                <p className="font-medium">Tu navigues avec Samsung Internet</p>
                <p className="text-muted-foreground">
                  Android bloque pour l'instant l'installation des applications
                  web depuis ce navigateur (message « application bloquée »).
                  Ouvre AlertDeals dans Chrome pour l'installer sans blocage.
                </p>
                <Button asChild className="gap-2">
                  <a href={openInChromeUrl}>
                    <Download className="h-4 w-4" />
                    Ouvrir dans Chrome
                  </a>
                </Button>
              </div>
            )}

            {canPrompt && !isSamsungInternet && (
              // Android/Chrome : prompt d'installation natif disponible.
              <Button onClick={promptInstall} className="gap-2">
                <Download className="h-4 w-4" />
                Installer l'application
              </Button>
            )}

            {isIOS && (
              // iOS ne propose aucun prompt : on guide l'ajout manuel via Safari.
              <div className="rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
                <p className="mb-2 font-medium">Sur iPhone / iPad (Safari) :</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    Appuie sur <Share className="inline h-4 w-4" /> Partager
                  </li>
                  <li>Choisis « Sur l'écran d'accueil »</li>
                  <li>Valide avec « Ajouter »</li>
                </ol>
              </div>
            )}

            {!canPrompt && !isIOS && !isSamsungInternet && (
              // Desktop ou navigateur sans prompt : install via le menu du navigateur.
              <p className="text-sm text-muted-foreground">
                Ouvre le menu de ton navigateur puis « Installer AlertDeals » pour
                l'ajouter à ton appareil.
              </p>
            )}

            <InstallVideos isIOS={isIOS} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Liens vers les tutoriels vidéo. Les deux plateformes sont toujours listées
// (l'utilisateur peut consulter depuis son PC pour installer sur son téléphone),
// celle correspondant à l'appareil détecté est affichée en premier.
function InstallVideos({ isIOS }: { isIOS: boolean }) {
  const videos = [
    { label: 'Tutoriel Android', href: INSTALL_VIDEO_ANDROID_URL, isIOS: false },
    { label: 'Tutoriel iPhone', href: INSTALL_VIDEO_IOS_URL, isIOS: true },
  ].sort((a, b) => Number(b.isIOS === isIOS) - Number(a.isIOS === isIOS));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Besoin d'aide ? Regarde la vidéo :</p>
      <div className="flex flex-wrap gap-2">
        {videos.map((video, index) => (
          <Button
            key={video.href}
            asChild
            variant={index === 0 ? 'default' : 'outline'}
            className="gap-2"
          >
            <a href={video.href} target="_blank" rel="noopener noreferrer">
              <PlayCircle className="h-4 w-4" />
              {video.label}
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}

function NotificationsCard() {
  const { isSupported, isSubscribed, isBusy, enable, disable } = usePushSubscription();
  // Tant que l'app n'est pas installée (standalone), on bloque l'activation :
  // sur iOS le push ne fonctionne pas hors PWA, et on veut que l'utilisateur
  // suive l'ordre installer → activer sur tous les appareils.
  const { isInstalled } = usePwaInstall();
  const canEnable = isInstalled && !isBusy;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSupported ? (
          // Navigateur sans support (ou iOS pas encore installé en PWA).
          <p className="text-sm text-muted-foreground">
            Les notifications ne sont pas disponibles sur cet appareil. Sur iPhone,
            installe d'abord l'app sur ton écran d'accueil.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Reçois une notification sur cet appareil dès qu'une nouvelle
              opportunité correspond à tes alertes.
            </p>

            {isSubscribed ? (
              <Button variant="outline" onClick={disable} disabled={isBusy}>
                Désactiver les notifications
              </Button>
            ) : (
              <>
                {!isInstalled && (
                  // App non installée : bouton grisé + explication.
                  <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
                    Installe d'abord AlertDeals sur ton écran d'accueil (voir
                    ci-dessus), puis ouvre l'app installée pour activer les
                    notifications.
                  </p>
                )}
                <Button onClick={enable} disabled={!canEnable} className="gap-2">
                  <Bell className="h-4 w-4" />
                  Activer les notifications
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
