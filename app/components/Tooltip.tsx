import React, { useRef, useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-center' | 'bottom-center' | 'top-right' | 'bottom-right';
  className?: string;
  wrapperClassName?: string;
}

const GAP = 6;

// Dernier moyen d'interaction utilisé (toucher, souris/stylet, clavier), suivi pour toute la page.
// Au doigt, l'infobulle ne s'affiche jamais : le navigateur simule un « survol » après chaque toucher,
// sans le « départ » correspondant, et l'infobulle restait affichée.
let lastInput: 'touch' | 'pointer' | 'keyboard' = 'pointer';
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => { lastInput = e.pointerType === 'touch' ? 'touch' : 'pointer'; }, true);
  document.addEventListener('keydown', () => { lastInput = 'keyboard'; }, true);
}

/** Le nœud contient-il du texte visible (et donc déjà un nom accessible) ? */
function hasText(node: React.ReactNode): boolean {
  if (typeof node === 'string') return node.trim().length > 0;
  if (typeof node === 'number') return true;
  if (Array.isArray(node)) return node.some(hasText);
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return hasText(node.props.children);
  return false;
}

function computeStyle(rect: DOMRect, position: string): React.CSSProperties {
  switch (position) {
    case 'top':
      return { top: rect.top - GAP, left: rect.left, transform: 'translateY(-100%)' };
    case 'top-center':
      return { top: rect.top - GAP, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' };
    case 'bottom':
      return { top: rect.bottom + GAP, left: rect.left };
    case 'bottom-center':
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - GAP, transform: 'translate(-100%, -50%)' };
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + GAP, transform: 'translateY(-50%)' };
    case 'top-right':
      return { top: rect.top - GAP, left: rect.right, transform: 'translate(-100%, -100%)' };
    case 'bottom-right':
      return { top: rect.bottom + GAP, left: rect.right, transform: 'translateX(-100%)' };
    default:
      return { top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
  }
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'bottom-center',
  className = '',
  wrapperClassName = '',
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  const show = useCallback(() => {
    if (!wrapperRef.current || !content) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setStyle(computeStyle(rect, position));
  }, [position, content]);

  const hide = useCallback(() => setStyle(null), []);

  // Survol : souris ou stylet seulement (événements « pointer », qui disent d'où vient le survol).
  const onPointerEnter = useCallback((e: React.PointerEvent) => { if (e.pointerType !== 'touch') show(); }, [show]);
  // Focus : au clavier ou après un clic, pas après un toucher.
  const onFocus = useCallback(() => { if (lastInput !== 'touch') show(); }, [show]);
  // Un toucher ferme toute infobulle encore ouverte.
  const onPointerDown = useCallback((e: React.PointerEvent) => { if (e.pointerType === 'touch') hide(); }, [hide]);

  // Guard against missed mouseleave events (race between React re-renders and browser event delivery)
  useEffect(() => {
    const el = wrapperRef.current;
    if (style && el && !el.matches(':hover') && !el.contains(document.activeElement)) {
      setStyle(null);
    }
  });

  // Accessibilité : un bouton réduit à une icône prend le texte de l'infobulle comme nom
  // (sinon un lecteur d'écran annonce seulement « bouton »).
  const labelledChildren = typeof content === 'string' && React.isValidElement<Record<string, unknown>>(children)
    && !children.props['aria-label'] && !hasText(children.props.children as React.ReactNode)
    ? React.cloneElement(children, { 'aria-label': content })
    : children;

  return (
    <div
      ref={wrapperRef}
      className={`inline-flex ${wrapperClassName}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={hide}
      onFocus={onFocus}
      onBlur={hide}
      onPointerDown={onPointerDown}
    >
      {labelledChildren}
      {style &&
        ReactDOM.createPortal(
          <div
            style={{ ...style, position: 'fixed', zIndex: 99999 }}
            className={`px-2.5 py-1.5 bg-white dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-600 text-xs rounded-md shadow-lg pointer-events-none font-normal ${className.includes('whitespace-nowrap') ? '' : 'max-w-[220px] break-words'} ${className}`}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;
