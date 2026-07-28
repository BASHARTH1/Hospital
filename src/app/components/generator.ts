import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Assignment, RosterConfig, StaffMember, isHaStaff } from '../models/types';
import { GeminiService } from '../services/gemini.service';
import { RosterScheduler, SchedulerReport } from '../services/roster-scheduler';
import { Icon } from '../ui/icon';

export type Engine = 'local' | 'ai';

@Component({
  selector: 'app-generator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './generator.html',
})
export class Generator {
  private readonly gemini = inject(GeminiService);
  private readonly scheduler = inject(RosterScheduler);

  readonly staff = input.required<StaffMember[]>();
  readonly config = input.required<RosterConfig>();
  readonly assignments = input.required<Assignment[]>();

  readonly generated = output<Assignment[]>();
  readonly completed = output<void>();

  readonly engine = signal<Engine>('local');
  readonly isGenerating = signal(false);
  readonly error = signal<string | null>(null);
  readonly report = signal<SchedulerReport | null>(null);

  readonly rosterStaff = computed(() => this.staff().filter((s) => !s.isCounterPart));
  readonly haCount = computed(() => this.rosterStaff().filter((s) => isHaStaff(s.name)).length);
  readonly counterpartCount = computed(() => this.staff().length - this.rosterStaff().length);

  readonly hasApiKey = computed(
    () => !!(typeof localStorage !== 'undefined' && localStorage.getItem('GEMINI_API_KEY')),
  );

  readonly localFeatures = [
    'Preserves every manually entered duty as a fixed anchor',
    'Fills each shift to its weekday / weekend / holiday minimum',
    'Keeps at least the required seniors on every regular shift',
    'Caps male staff per shift and respects per-person monthly limits',
    'Enforces recovery days after a night series, and never night → morning',
    'Limits consecutive evening, night, and total duty days',
    'Balances the load in proportion to each person’s own capacity',
    'Runs entirely in the browser — no API key, no data leaves the device',
  ];

  readonly aiFeatures = [
    'Preserves all manually entered duties as fixed assignments',
    'Ensures all shift sequence rules are followed',
    'Maintains minimum staffing levels for each shift',
    'Respects senior staff and gender distribution requirements',
    'Limits consecutive evening/night shifts',
    'Assigns recovery days after night shifts',
    'Balances workload across all staff members',
  ];

  readonly features = computed(() => (this.engine() === 'local' ? this.localFeatures : this.aiFeatures));

  /** Shortfalls collapsed to one line per shift kind, so a thin month is readable. */
  readonly shortfallSummary = computed(() => {
    const r = this.report();
    if (!r) return [];
    const grouped = new Map<string, { shift: string; category: string; days: number; worstGap: number }>();
    for (const s of r.shortfalls) {
      const key = `${s.category}|${s.shift}`;
      const entry = grouped.get(key) ?? { shift: s.shift, category: s.category, days: 0, worstGap: 0 };
      entry.days += 1;
      entry.worstGap = Math.max(entry.worstGap, s.required - s.filled);
      grouped.set(key, entry);
    }
    return [...grouped.values()];
  });

  readonly seniorGapDays = computed(() => this.report()?.seniorGaps.length ?? 0);

  setEngine(engine: Engine): void {
    this.engine.set(engine);
    this.error.set(null);
    this.report.set(null);
  }

  async generate(): Promise<void> {
    this.isGenerating.set(true);
    this.error.set(null);
    this.report.set(null);

    try {
      if (this.engine() === 'local') {
        const result = this.scheduler.generateRoster(this.staff(), this.config(), this.assignments());
        this.report.set(result.report);
        this.generated.emit(result.assignments);
        // Stay on this tab when something could not be satisfied, so the report is seen.
        if (result.report.shortfalls.length === 0 && result.report.seniorGaps.length === 0) {
          this.completed.emit();
        }
      } else {
        const newAssignments = await this.gemini.generateRoster(this.staff(), this.config(), this.assignments());
        this.generated.emit(newAssignments);
        this.completed.emit();
      }
    } catch (err) {
      this.error.set(
        (err as Error)?.message || 'Failed to generate schedule. Please check your API key and try again.',
      );
    } finally {
      this.isGenerating.set(false);
    }
  }
}
