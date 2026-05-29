import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, footer, size = 'md' }: Props) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto w-full ${sizeMap[size]} surface-elevated max-h-[88vh] flex flex-col`}
            >
              {title && (
                <header className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                  <h2 className="heading text-lg font-bold">{title}</h2>
                  <button
                    onClick={onClose}
                    className="h-8 w-8 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4 mx-auto" />
                  </button>
                </header>
              )}
              <div className="flex-1 overflow-y-auto p-5">{children}</div>
              {footer && (
                <footer className="border-t border-border-subtle px-5 py-3 flex justify-end gap-2">
                  {footer}
                </footer>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
