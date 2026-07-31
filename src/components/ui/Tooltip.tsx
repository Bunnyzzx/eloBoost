import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  content: ReactNode;
  /** Lado preferido. Se não couber na janela, o tooltip vira para o oposto. */
  side?: TooltipSide;
  children: ReactNode;
  className?: string;
  /** Desliga o tooltip sem precisar remover o componente da árvore. */
  disabled?: boolean;
}

/** Distância entre o gatilho e o balão. */
const GAP = 8;
/** Respiro mínimo até a borda da janela. */
const MARGIN = 8;

const OPPOSITE: Record<TooltipSide, TooltipSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

interface Placement {
  top: number;
  left: number;
}

function clamp(value: number, min: number, max: number): number {
  // `min` vence quando o balão é maior que o espaço disponível: é melhor
  // vazar pela borda oposta do que sumir pela borda de referência.
  return Math.max(min, Math.min(value, max));
}

function fits(side: TooltipSide, trigger: DOMRect, tip: DOMRect): boolean {
  switch (side) {
    case 'top':
      return trigger.top - GAP - tip.height >= MARGIN;
    case 'bottom':
      return trigger.bottom + GAP + tip.height <= window.innerHeight - MARGIN;
    case 'left':
      return trigger.left - GAP - tip.width >= MARGIN;
    case 'right':
      return trigger.right + GAP + tip.width <= window.innerWidth - MARGIN;
  }
}

function place(side: TooltipSide, trigger: DOMRect, tip: DOMRect): Placement {
  const centerX = trigger.left + trigger.width / 2 - tip.width / 2;
  const centerY = trigger.top + trigger.height / 2 - tip.height / 2;

  const raw: Placement = (() => {
    switch (side) {
      case 'top':
        return { top: trigger.top - GAP - tip.height, left: centerX };
      case 'bottom':
        return { top: trigger.bottom + GAP, left: centerX };
      case 'left':
        return { top: centerY, left: trigger.left - GAP - tip.width };
      case 'right':
        return { top: centerY, left: trigger.right + GAP };
    }
  })();

  // O deslize no eixo transversal é o que salva os casos das pontas: o chip de
  // privilégio no canto direito do cabeçalho e a última linha de uma ficha
  // técnica encostada no rodapé continuam com o balão inteiro visível.
  return {
    top: clamp(raw.top, MARGIN, window.innerHeight - MARGIN - tip.height),
    left: clamp(raw.left, MARGIN, window.innerWidth - MARGIN - tip.width),
  };
}

/**
 * Calcula a posição do balão em coordenadas de janela, virando de lado quando
 * o lado preferido não tem espaço e deslizando para dentro quando o balão
 * ultrapassaria uma borda.
 */
function resolve(side: TooltipSide, trigger: DOMRect, tip: DOMRect): Placement {
  const chosen =
    fits(side, trigger, tip) || !fits(OPPOSITE[side], trigger, tip) ? side : OPPOSITE[side];

  return place(chosen, trigger, tip);
}

interface BubbleProps {
  id: string;
  content: ReactNode;
  side: TooltipSide;
  triggerRef: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * O balão em si, montado só enquanto está visível.
 *
 * Ser um componente separado é o que dispensa qualquer reinicialização de
 * estado: ao fechar, ele desmonta e leva a posição junto — a próxima abertura
 * sempre mede do zero, em vez de herdar as coordenadas de onde o ponteiro
 * esteve da última vez.
 *
 * O `scroll` é ouvido em fase de captura porque a rolagem que importa não é a
 * da janela: é a do `<main>` e a do corpo do diálogo, que não borbulham.
 */
function TooltipBubble({ id, content, side, triggerRef, className }: BubbleProps) {
  const tipRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (trigger == null || tip == null) return;

    setPlacement(resolve(side, trigger.getBoundingClientRect(), tip.getBoundingClientRect()));
  }, [side, triggerRef]);

  useLayoutEffect(() => {
    measure();

    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <span
      ref={tipRef}
      id={id}
      role="tooltip"
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        // Enquanto a primeira medição não aconteceu o balão já está no DOM (é
        // preciso medi-lo), mas não pode piscar no canto da tela.
        visibility: placement == null ? 'hidden' : 'visible',
      }}
      className={cn(
        'pointer-events-none fixed z-(--elo-z-tooltip) w-max',
        // Nunca mais largo que a janela: em 16rem o texto ainda respira, e o
        // limite menor cobre a escala de interface em 130%.
        'max-w-[min(16rem,calc(100vw-1rem))]',
        'rounded-[8px] border border-strong bg-elevated px-2.5 py-1.5',
        'text-[0.75rem] leading-snug font-normal text-fg shadow-elo-md',
        className,
      )}
    >
      {content}
    </span>
  );
}

/**
 * Tooltip acessível para termos técnicos.
 *
 * Aparece tanto no hover quanto no foco por teclado, e é associado ao gatilho
 * por `aria-describedby` — quem usa leitor de tela recebe a mesma informação
 * que quem usa mouse.
 *
 * O balão é renderizado num portal para o `<body>`, e não como filho do
 * gatilho. Posicionado de forma absoluta dentro do card, ele era recortado
 * pelo `overflow-y-auto` do `<main>` e pelo `overflow-hidden` da moldura da
 * aplicação — uma explicação pela metade é pior que nenhuma. Fora da árvore
 * rolável não existe ancestral que possa cortá-lo, e `position: fixed` deixa
 * de ser refém dos `transform` das animações de página, que criariam um bloco
 * de contenção próprio.
 */
export function Tooltip({ content, side = 'top', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  if (disabled === true) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        <span aria-describedby={visible ? id : undefined} className="inline-flex">
          {children}
        </span>
      </span>

      {visible &&
        typeof document !== 'undefined' &&
        createPortal(
          <TooltipBubble
            id={id}
            content={content}
            side={side}
            triggerRef={triggerRef}
            className={className}
          />,
          document.body,
        )}
    </>
  );
}
