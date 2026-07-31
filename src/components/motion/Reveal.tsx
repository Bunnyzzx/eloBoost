import { useEffect, useRef, useState, type ReactNode } from 'react';

import { DURATION, EASE, OFFSET } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/utils/cn';

export interface RevealProps {
  children: ReactNode;
  /** Fração do elemento visível para disparar a entrada. */
  threshold?: number;
  className?: string;
}

/** `IntersectionObserver` existe neste ambiente? */
function hasObserver(): boolean {
  return typeof IntersectionObserver !== 'undefined';
}

/**
 * Entrada ao entrar no viewport — **opcional e só para seções abaixo da linha
 * de dobra em páginas longas.**
 *
 * Três garantias de robustez:
 *
 * 1. **O conteúdo nunca fica preso invisível.** Se `IntersectionObserver` não
 *    existir, ou se o usuário pediu redução de movimento, o elemento começa e
 *    permanece visível. A visibilidade é *derivada* — nenhum caminho de código
 *    consegue deixá-la em `false` permanentemente.
 * 2. **O conteúdo está sempre no DOM**, mesmo antes de aparecer: busca na
 *    página, leitores de tela e `Ctrl+F` continuam funcionando.
 * 3. **Dispara uma vez.** O observer é desconectado na primeira aparição, para
 *    não custar nada durante a rolagem.
 *
 * Implementado em CSS puro — duas propriedades interpoladas por seção é mais
 * barato que um componente animado por seção numa página longa.
 */
export function Reveal({ children, threshold = 0.15, className }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Estado inicial decidido no primeiro render, sem efeito: sem suporte à API,
  // nada é escondido.
  const [entered, setEntered] = useState(() => !hasObserver());

  // A visibilidade é derivada, não armazenada: qualquer uma das condições
  // basta para exibir, e uma mudança de preferência revela na hora.
  const visible = entered || reduceMotion;

  useEffect(() => {
    if (visible) return;

    const element = ref.current;
    if (element == null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // `setState` acontece no callback do observer, nunca no corpo do efeito.
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      // A margem negativa faz a entrada acontecer um pouco depois de a seção
      // encostar na borda, e não exatamente nela.
      { threshold, rootMargin: '0px 0px -5% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, threshold]);

  const transition = `opacity ${DURATION.base}ms cubic-bezier(${EASE.join(',')}), transform ${DURATION.base}ms cubic-bezier(${EASE.join(',')})`;

  return (
    <div
      ref={ref}
      data-revealed={visible}
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : `translateY(${OFFSET.page}px)`,
        transition: reduceMotion ? undefined : transition,
      }}
    >
      {children}
    </div>
  );
}
