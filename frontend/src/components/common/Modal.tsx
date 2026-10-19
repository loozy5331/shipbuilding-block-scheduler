import { useEffect, useRef, type ReactNode } from 'react';
import { useStore } from '../../store/schedulerStore';

export function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !ref.current) return;
      // 포커스를 대화상자 안에 가둔다
      const list = [...ref.current.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex="0"]')].filter((el) => !(el as HTMLButtonElement).disabled);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section ref={ref} className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const ref = useRef<number>(0);
  const clear = () => useStore.setState({ toast: null });
  useEffect(() => {
    if (!toast) return;
    window.clearTimeout(ref.current);
    ref.current = window.setTimeout(clear, 3600);
    return () => window.clearTimeout(ref.current);
  }, [toast]);
  return (
    <div className="toast-root" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
