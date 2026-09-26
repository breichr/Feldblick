import { h } from './dom';

/** Modal message with one or two buttons. Resolves true on confirm. */
function showDialog(title: string, message: string, confirmLabel: string, cancelLabel?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = h(
      'dialog',
      { class: 'dialog' },
      h('h2', {}, title),
      h('p', {}, message),
      h(
        'form',
        { method: 'dialog', class: 'dialog-actions' },
        cancelLabel ? h('button', { value: 'cancel', class: 'btn' }, cancelLabel) : null,
        h('button', { value: 'ok', class: 'btn btn-primary' }, confirmLabel),
      ),
    );
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'ok');
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function confirmDialog(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return showDialog(title, message, confirmLabel, 'Abbrechen');
}

export async function alertDialog(title: string, message: string): Promise<void> {
  await showDialog(title, message, 'OK');
}
