import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';

/**
 * Staff ID field that only commits on blur/Enter, so a half-typed ID never
 * collides with an existing one. Escape reverts.
 */
@Component({
  selector: 'app-editable-id-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      type="text"
      [value]="value()"
      (input)="value.set($any($event.target).value)"
      (blur)="commit()"
      (keydown.enter)="$any($event.target).blur()"
      (keydown.escape)="cancel($event)"
      class="w-20 bg-white border border-gray-200 focus:border-blue-500 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-gray-700 outline-none transition-all text-center focus:ring-1 focus:ring-blue-500"
      placeholder="ID"
    />
  `,
})
export class EditableIdInput {
  readonly id = input.required<string>();
  readonly idChange = output<{ oldId: string; newId: string }>();

  readonly value = signal('');

  constructor() {
    effect(() => this.value.set(this.id()));
  }

  commit(): void {
    const trimmed = this.value().trim();
    if (trimmed && trimmed !== this.id()) {
      this.idChange.emit({ oldId: this.id(), newId: trimmed });
    } else {
      this.value.set(this.id());
    }
  }

  cancel(event: Event): void {
    this.value.set(this.id());
    (event.target as HTMLInputElement).blur();
  }
}
