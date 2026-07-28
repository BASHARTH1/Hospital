import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { environment } from '../../environments/environment';
import { Assignment, RosterConfig, StaffMember, isHaStaff } from '../models/types';

/**
 * Generates a full month staff duty roster using Gemini 3 Pro reasoning.
 * Employs a thinking budget so complex constraints like senior distribution,
 * gender balance, and recovery periods are handled with high accuracy.
 * Explicitly preserves all manual/requested assignments as absolute anchors.
 */
@Injectable({ providedIn: 'root' })
export class GeminiService {
  private apiKey(): string {
    const runtimeKey = typeof localStorage !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null;
    return runtimeKey || environment.geminiApiKey || '';
  }

  async generateRoster(
    staff: StaffMember[],
    config: RosterConfig,
    manualAssignments: Assignment[],
  ): Promise<Assignment[]> {
    const key = this.apiKey();
    if (!key) {
      throw new Error(
        'No Gemini API key configured. Set it in src/environments/environment.ts, or run ' +
          "localStorage.setItem('GEMINI_API_KEY', '<your key>') in the browser console and reload.",
      );
    }

    const ai = new GoogleGenAI({ apiKey: key });

    const normalStaff = staff.filter((s) => !s.isCounterPart);
    const regularNormalStaff = normalStaff.filter((s) => !isHaStaff(s.name));
    const haNormalStaff = normalStaff.filter((s) => isHaStaff(s.name));

    const regularManualAssignments = manualAssignments.filter((a) =>
      regularNormalStaff.some((s) => s.id === a.staffId),
    );
    const haManualAssignments = manualAssignments.filter((a) => haNormalStaff.some((s) => s.id === a.staffId));

    try {
      const [regularAssignments, haAssignments] = await Promise.all([
        this.generateForGroup(ai, config, regularNormalStaff, regularManualAssignments, 'Regular Staff'),
        this.generateForGroup(ai, config, haNormalStaff, haManualAssignments, 'HA Staff'),
      ]);
      return [...regularAssignments, ...haAssignments];
    } catch (error) {
      console.error('Roster Generation Error:', error);
      throw error;
    }
  }

  private async generateForGroup(
    ai: GoogleGenAI,
    config: RosterConfig,
    groupStaff: StaffMember[],
    groupManual: Assignment[],
    groupLabel: string,
  ): Promise<Assignment[]> {
    if (groupStaff.length === 0) return [];

    const monthIdx = new Date(Date.parse(config.month + ' 1, ' + config.year)).getMonth();
    const daysInMonth = new Date(config.year, monthIdx + 1, 0).getDate();

    const isHA = groupLabel === 'HA Staff';
    const minM = isHA ? (config.haMinMorning ?? config.minMorning) : config.minMorning;
    const minE = isHA ? (config.haMinEvening ?? config.minEvening) : config.minEvening;
    const minN = isHA ? (config.haMinNight ?? config.minNight) : config.minNight;

    const minMWeekend = isHA ? (config.haMinMorningWeekend ?? config.minMorningWeekend) : config.minMorningWeekend;
    const minEWeekend = isHA ? (config.haMinEveningWeekend ?? config.minEveningWeekend) : config.minEveningWeekend;
    const minNWeekend = isHA ? (config.haMinNightWeekend ?? config.minNightWeekend) : config.minNightWeekend;

    const minMHoliday = isHA
      ? (config.haMinMorningHoliday ?? config.minMorningHoliday ?? config.minMorning)
      : (config.minMorningHoliday ?? config.minMorning);
    const minEHoliday = isHA
      ? (config.haMinEveningHoliday ?? config.minEveningHoliday ?? config.minEvening)
      : (config.minEveningHoliday ?? config.minEvening);
    const minNHoliday = isHA
      ? (config.haMinNightHoliday ?? config.minNightHoliday ?? config.minNight)
      : (config.minNightHoliday ?? config.minNight);

    const minSeniorVal = isHA ? (config.haMinSenior ?? config.minSenior) : config.minSenior;
    const maxMaleVal = isHA ? (config.haMaxMale ?? config.maxMale) : config.maxMale;
    const maxConsecutiveDutyVal = isHA
      ? (config.haMaxConsecutiveDuty ?? config.maxConsecutiveDuty)
      : config.maxConsecutiveDuty;
    const offAfterNightVal = isHA ? (config.haOffAfterNight ?? config.offAfterNight) : config.offAfterNight;

    const balancingRules = isHA
      ? `2. BALANCING RULES:
       - Recovery: EXACTLY ${offAfterNightVal} Off (W) days MUST follow any Night (3) shift series.
       - Max Consecutive Duties: ${maxConsecutiveDutyVal} days max working before a 'W'.
       - Limits: Max ${config.maxConsecutiveEvening} Eve shifts and ${config.maxConsecutiveNight} Night shifts consecutively.`
      : `2. BALANCING RULES:
       - Every shift MUST have at least ${minSeniorVal} Senior staff members (isSenior: true) from this category if available.
       - Max Male staff per shift: ${maxMaleVal}.
       - Recovery: EXACTLY ${offAfterNightVal} Off (W) days MUST follow any Night (3) shift series.
       - Max Consecutive Duties: ${maxConsecutiveDutyVal} days max working before a 'W'.
       - Limits: Max ${config.maxConsecutiveEvening} Eve shifts and ${config.maxConsecutiveNight} Night shifts consecutively.`;

    const prompt = `
    TASK: Generate a complete monthly duty roster for ${config.month} ${config.year} (${daysInMonth} days) for the "${groupLabel}" staff category.

    CRITICAL INSTRUCTION:
    Any assignment starting with 'R' (R1, R2, R3, RW), 'L' (Leave), 'H' (Public Holiday), or 'O' (On-call) in the PROVIDED ASSIGNMENTS list is SACRED.
    You MUST NOT change these. You MUST include them in your output exactly as they are.

    STAFF DATABASE (INCLUDING INDIVIDUAL LIMITS) FOR ${groupLabel.toUpperCase()} STAFF:
    ${JSON.stringify(groupStaff)}

    ROSTER RULES (100% ADHERENCE REQUIRED FOR THIS CATEGORY):
    1. OPERATIONAL HEADCOUNT (DAILY MINIMUMS FOR THIS CATEGORY):
       - On Holidays (${
         config.holidays && config.holidays.length > 0
           ? `specifically the following dates: ${config.holidays.join(', ')}`
           : 'None defined'
       }):
         * Morning (1, R1, 1S, O1): >= ${minMHoliday} staff
         * Evening (2, R2, O2): >= ${minEHoliday} staff
         * Night (3, R3, O3): >= ${minNHoliday} staff
       - On Weekdays (Sunday, Monday, Tuesday, Wednesday, Thursday) (excluding any holidays listed above):
         * Morning (1, R1, 1S, O1): >= ${minM} staff
         * Evening (2, R2, O2): >= ${minE} staff
         * Night (3, R3, O3): >= ${minN} staff
       - On Weekends (Friday, Saturday) (excluding any holidays listed above):
         * Morning (1, R1, 1S, O1): >= ${minMWeekend} staff
         * Evening (2, R2, O2): >= ${minEWeekend} staff
         * Night (3, R3, O3): >= ${minNWeekend} staff

    ${balancingRules}

    3. INDIVIDUAL STAFF CONSTRAINTS:
       - Each staff member has monthly limits for Morning, Evening, and Night shifts (maxMorning, maxEvening, maxNight).
       - You MUST NOT exceed these monthly totals for any staff member.

    4. ROTATION LOGIC:
       - No Night (3) shifts followed by Morning (1) the next day.
       - Distribute duties fairly among all staff not on Leave (L).

    CURRENT MANUAL ASSIGNMENTS (ANCHORS) FOR ${groupLabel.toUpperCase()} STAFF:
    ${JSON.stringify(groupManual)}

    OUTPUT:
    Return a JSON array where every staffId has one entry for every day of the month.
    Fields: "staffId", "date" (YYYY-MM-DD), "shift" (string code).
  `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 16384 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                staffId: { type: Type.STRING },
                date: { type: Type.STRING },
                shift: { type: Type.STRING },
              },
              required: ['staffId', 'date', 'shift'],
            },
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error(`AI returned empty response for ${groupLabel}`);

      const generatedAssignments: Assignment[] = JSON.parse(text.trim());

      // FORCED SAFETY LAYER: re-apply manual overrides for this group.
      const manualMap = new Map<string, Assignment['shift']>();
      groupManual.forEach((a) => manualMap.set(`${a.staffId}|${a.date}`, a.shift));

      const finalAssignments = generatedAssignments.map((a) => {
        const key = `${a.staffId}|${a.date}`;
        return manualMap.has(key) ? { ...a, shift: manualMap.get(key)! } : a;
      });

      // Ensure no anchored day went missing.
      const finalKeys = new Set(finalAssignments.map((a) => `${a.staffId}|${a.date}`));
      groupManual.forEach((ma) => {
        if (!finalKeys.has(`${ma.staffId}|${ma.date}`)) finalAssignments.push(ma);
      });

      return finalAssignments;
    } catch (error) {
      console.error(`Error generating roster for ${groupLabel}:`, error);
      throw error;
    }
  }
}
