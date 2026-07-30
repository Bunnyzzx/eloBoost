import { MotionConfig } from 'framer-motion';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { ThemeEffects } from '@/app/ThemeEffects';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ToastViewport } from '@/components/ui/Toast';
import { TRANSITION } from '@/constants/motion';
import { useUiStore } from '@/stores/uiStore';

export function App() {
  const reduceMotionSetting = useUiStore((state) => state.reduceMotion);

  return (
    <ErrorBoundary area="aplicativo">
      {/*
        Ponto único de configuração do movimento.

        `reducedMotion="user"` faz o Framer respeitar `prefers-reduced-motion` do
        sistema automaticamente; `"always"` força a redução quando o usuário
        desliga animações nas configurações do eloBoost. Nos dois casos o Framer
        mantém opacidade e cor, removendo apenas transform e layout — que é
        exatamente a política do produto.
      */}
      <MotionConfig reducedMotion={reduceMotionSetting ? 'always' : 'user'} transition={TRANSITION}>
        <ThemeEffects />
        <RouterProvider router={router} />
        <ToastViewport />
      </MotionConfig>
    </ErrorBoundary>
  );
}
