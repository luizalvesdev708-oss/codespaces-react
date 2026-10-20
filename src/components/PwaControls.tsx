import { useEffect, useRef, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface RegistrationEvent extends Event {
  detail?: ServiceWorkerRegistration;
}

export default function PwaControls() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => (
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  ));
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hadController = Boolean(navigator.serviceWorker?.controller);
    let isReloading = false;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setMessage('Aplicativo instalado neste dispositivo.');
    };
    const handleControllerChange = () => {
      if (!hadController || isReloading) return;
      isReloading = true;
      window.location.reload();
    };
    const watchRegistration = (nextRegistration?: ServiceWorkerRegistration) => {
      if (!nextRegistration || registrationRef.current === nextRegistration) return;
      registrationRef.current = nextRegistration;
      setUpdateReady(Boolean(nextRegistration.waiting));
      nextRegistration.addEventListener('updatefound', () => {
        const installing = nextRegistration.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    };
    const handleRegistration = (event: Event) => {
      watchRegistration((event as RegistrationEvent).detail);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-registration', handleRegistration);
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then(watchRegistration).catch((error: unknown) => {
        console.error('Não foi possível verificar atualizações do aplicativo.', error);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-registration', handleRegistration);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setMessage('Instalação iniciada.');
    } catch (error) {
      console.error('Não foi possível iniciar a instalação do aplicativo.', error);
      setMessage('Não foi possível iniciar a instalação. Tente novamente pelo navegador.');
      setInstallPrompt(null);
    }
  };

  const updateApp = () => {
    const waitingWorker = registrationRef.current?.waiting;
    if (!waitingWorker) {
      setUpdateReady(false);
      return;
    }
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <>
      {(installPrompt && !isInstalled || updateReady || message) && (
        <aside className="pwa-controls" aria-live="polite">
          {installPrompt && !isInstalled && (
            <button className="pwa-controls__button" type="button" onClick={() => void installApp()}>
              Instalar app
            </button>
          )}
          {updateReady && (
            <button className="pwa-controls__button" type="button" onClick={updateApp}>
              Nova versão disponível, clique para atualizar
            </button>
          )}
          {message && <span>{message}</span>}
        </aside>
      )}
    </>
  );
}
