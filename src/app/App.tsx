import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { ThemeEffects } from '@/app/ThemeEffects';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ToastViewport } from '@/components/ui/Toast';

export function App() {
  return (
    <ErrorBoundary area="aplicativo">
      <ThemeEffects />
      <RouterProvider router={router} />
      <ToastViewport />
    </ErrorBoundary>
  );
}
