/**
 * Реестр выбранных фото по формам (клиент). PhotoPicker регистрирует сюда сжатые файлы,
 * а buildFormData(form) собирает FormData с ними — надёжно даже там, где
 * нельзя программно заполнить <input type="file"> через DataTransfer.
 */

type Entry = { files: File[]; busy: Promise<void> | null };

const registry = new WeakMap<HTMLFormElement, Map<string, Entry>>();

export function registerPhotos(
  form: HTMLFormElement,
  name: string,
  files: File[],
  busy: Promise<void> | null,
): void {
  let byName = registry.get(form);
  if (!byName) {
    byName = new Map();
    registry.set(form, byName);
  }
  byName.set(name, { files, busy });
}

export function unregisterPhotos(form: HTMLFormElement, name: string): void {
  registry.get(form)?.delete(name);
}

/** Дождаться окончания сжатия фото во всех PhotoPicker формы. */
export async function waitForPhotos(form: HTMLFormElement): Promise<void> {
  const byName = registry.get(form);
  if (!byName) return;
  await Promise.all([...byName.values()].map((e) => e.busy ?? Promise.resolve()));
}

/** Добавить фото из PhotoPicker формы в уже собранный FormData (поле с тем же name заменяется). */
export function appendPhotos(form: HTMLFormElement, fd: FormData): FormData {
  const byName = registry.get(form);
  if (byName) {
    for (const [name, entry] of byName) {
      fd.delete(name);
      for (const f of entry.files) fd.append(name, f, f.name);
    }
  }
  return fd;
}

/**
 * FormData формы + сжатые фото из PhotoPicker.
 * Используйте в onSubmit, если отправляете форму вручную (useActionForm делает это сам).
 */
export function buildFormData(form: HTMLFormElement): FormData {
  return appendPhotos(form, new FormData(form));
}
