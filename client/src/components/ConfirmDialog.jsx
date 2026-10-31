import { useEffect, useRef } from 'react';

// Native <dialog>: focus trapping, Esc to cancel and backdrop come from the browser.
export default function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-stone bg-paper p-6 text-forest shadow-2xl"
    >
      <h2 id="confirm-title" className="text-lg font-bold">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-forest/80">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="rounded-xl border border-stone px-4 py-2.5 text-sm font-semibold hover:bg-stone/60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-paper hover:bg-forest/90"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
