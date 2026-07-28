import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RosterConfig } from '../models/types';
import { Icon } from '../ui/icon';

export interface OnCallPerson {
  id: string;
  name: string;
  phone?: string;
  isSenior: boolean;
  isHa: boolean;
}

export interface OnCallRow {
  dayNum: number;
  weekdayShort: string;
  isHoliday: boolean;
  rowBg: string;
  dateBadgeStyle: string;
  morning: OnCallPerson[];
  evening: OnCallPerson[];
  night: OnCallPerson[];
}

export interface OnCallThemeStyles {
  headerBg: string;
  subHeaderBg: string;
  borderColor: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
  bgTint: string;
}

/** The printable on-call log sheet, rendered once for preview and once for print. */
@Component({
  selector: 'app-on-call-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, NgTemplateOutlet],
  template: `
    <div class="w-full font-sans text-black bg-white">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 class="text-xl sm:text-2xl font-black uppercase tracking-wider" [class]="themeStyles().accentText">
            {{ config().wardName ? config().wardName + ' ' : '' }}On-Call Duty Roster
          </h1>
          <p class="text-[10px] sm:text-xs font-bold text-gray-500 uppercase mt-0.5 tracking-wider">
            {{ config().month }} {{ config().year }} &bull; Official Duty Log &amp; Confirmation Sheet
          </p>
        </div>
        <div class="mt-2 sm:mt-0 text-left sm:text-right text-[10px] font-black uppercase text-gray-500">
          <div>Status: Confirmed</div>
          <div>Printed: {{ printedOn() }}</div>
        </div>
      </div>

      @if (rows().length === 0) {
        <div class="text-center py-12 text-sm text-gray-400 font-bold uppercase">
          No days selected or match the filter parameters
        </div>
      } @else {
        <table class="w-full text-left text-xs border-collapse border-2 border-black">
          <thead>
            <tr
              class="font-black uppercase text-[10px] tracking-tight border-b-2 border-black"
              [class]="themeStyles().headerBg"
            >
              <th class="px-3 py-2 border-r border-black w-24">Date</th>
              <th class="px-3 py-2 border-r border-black">Morning On-Call (O1)</th>
              <th class="px-3 py-2 border-r border-black">Evening On-Call (O2)</th>
              <th class="px-3 py-2">Night On-Call (O3)</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.dayNum) {
              <tr class="border-b border-black/30 last:border-b-0 hover:bg-gray-50/40" [class]="row.rowBg">
                <td class="px-3 py-2.5 border-r border-black/30 text-center font-bold">
                  <div class="flex flex-col justify-center items-center">
                    <span class="text-base leading-none" [class]="row.dateBadgeStyle">{{ row.dayNum }}</span>
                    <span class="text-[9px] uppercase font-bold tracking-tight text-gray-500 mt-0.5">
                      {{ row.weekdayShort }}
                      @if (row.isHoliday) {
                        <span class="text-rose-500 font-black ml-0.5">*</span>
                      }
                    </span>
                  </div>
                </td>

                <td class="px-3 py-2.5 border-r border-black/30">
                  <ng-container *ngTemplateOutlet="people; context: { $implicit: row.morning }" />
                </td>
                <td class="px-3 py-2.5 border-r border-black/30">
                  <ng-container *ngTemplateOutlet="people; context: { $implicit: row.evening }" />
                </td>
                <td class="px-3 py-2.5">
                  <ng-container *ngTemplateOutlet="people; context: { $implicit: row.night }" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      <div class="mt-8 border-t border-gray-300 pt-6">
        <div class="flex flex-col sm:flex-row justify-between items-end gap-6">
          <div class="space-y-5 w-full sm:w-72">
            <div class="w-full h-px bg-slate-950 mb-1"></div>
            <p class="text-[10px] font-black uppercase text-gray-600 tracking-wider">
              Authorized Department head Signature
            </p>
          </div>
          <div class="text-left sm:text-right text-[9px] font-bold uppercase text-gray-400">
            On-Call List &bull; {{ config().month }} {{ config().year }} &bull; Final Duty Log
          </div>
        </div>
      </div>
    </div>

    <ng-template #people let-list>
      @if (list.length > 0) {
        <div class="space-y-1.5">
          @for (s of list; track s.id) {
            <div class="leading-tight">
              <div class="font-bold flex items-center gap-1">
                @if (s.isSenior && !s.isHa) {
                  <span class="text-[8px] px-1 bg-amber-500 text-white rounded font-black">S</span>
                }
                <span [class.text-emerald-800]="s.isHa">{{ s.name }}</span>
              </div>
              @if (s.phone) {
                <div class="text-[10px] text-gray-500 font-medium font-mono flex items-center gap-0.5 mt-0.5">
                  <app-icon name="Phone" [size]="9" class="text-gray-400 shrink-0" />
                  <span>{{ s.phone }}</span>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <span class="text-[10px] text-gray-400 font-medium italic">—</span>
      }
    </ng-template>
  `,
})
export class OnCallTable {
  readonly config = input.required<RosterConfig>();
  readonly rows = input.required<OnCallRow[]>();
  readonly themeStyles = input.required<OnCallThemeStyles>();
  readonly printedOn = input('');
}
