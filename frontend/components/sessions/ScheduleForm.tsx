'use client';

import { useState, type FormEvent } from 'react';
import { scheduleSession } from '@/lib/sessions/client';
import { fieldErrors, scheduleSchema } from '@/lib/sessions/schemas';
import { SUPPORT_MODES, type ScheduleContext, type SessionView, type SupportMode } from '@/lib/sessions/types';
import { ConfirmationSummary } from './ConfirmationSummary';
import { SlotPicker } from './SlotPicker';
import s from './sessions.module.css';

export function ScheduleForm({ context, slots }: { context: ScheduleContext; slots: string[] }) {
  const [slot, setSlot] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [mode, setMode] = useState<SupportMode | null>(null);
  const [link, setLink] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<SessionView | null>(null);

  if (done) {
    return (
      <div className={s.panel}>
        <ConfirmationSummary session={done} />
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const parsed = scheduleSchema.safeParse({
      requestId: context.requestId,
      scheduledDatetime: slot ?? undefined,
      supportMode: mode ?? undefined,
      meetingLink: mode === 'Online' && link.trim() ? link : undefined,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    try {
      const res = await scheduleSession(parsed.data);
      if (res.ok) return setDone(res.session);
      setFormError(res.message);
      if (res.error === 'slot_taken') {
        setTaken((t) => [...t, parsed.data.scheduledDatetime]);
        setSlot(null);
      }
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.panel} onSubmit={onSubmit} noValidate>
      <div className={s.requestBox}>
        <strong>{context.requestTitle}</strong>
        {context.requester.name} (Help Seeker) with {context.volunteer.name} (Volunteer) · {context.category}
      </div>

      <div aria-live="assertive">{formError && <p className={s.formError}>{formError}</p>}</div>

      <fieldset className={s.fieldset}>
        <legend className={s.legend}>1. Pick a date and time</legend>
        <p className={s.hint}>Times are in Kuala Lumpur time and come from the Volunteer&apos;s availability.</p>
        <SlotPicker slots={slots.filter((x) => !taken.includes(x))} value={slot} onChange={setSlot} />
        {errors.scheduledDatetime && <p className={s.fieldError} role="alert">{errors.scheduledDatetime}</p>}
      </fieldset>

      <fieldset className={s.fieldset}>
        <legend className={s.legend}>2. Support mode</legend>
        <div className={s.radioRow}>
          {SUPPORT_MODES.map((m) => (
            <label key={m} className={`${s.radioLabel} ${mode === m ? s.radioLabelActive : ''}`}>
              <input type="radio" name="supportMode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              {m}
            </label>
          ))}
        </div>
        {errors.supportMode && <p className={s.fieldError} role="alert">{errors.supportMode}</p>}
      </fieldset>

      {mode === 'Online' && (
        <div className={s.fieldset}>
          <label className={s.label} htmlFor="meetingLink">Meeting link (optional)</label>
          <p className={s.hint} id="meetingLinkHint">Paste a Google Meet or Zoom link. CampusLink has no built-in video.</p>
          <input
            id="meetingLink"
            className={s.input}
            type="url"
            inputMode="url"
            placeholder="https://meet.google.com/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-invalid={!!errors.meetingLink}
            aria-describedby={errors.meetingLink ? 'meetingLinkErr meetingLinkHint' : 'meetingLinkHint'}
          />
          {errors.meetingLink && <p className={s.fieldError} id="meetingLinkErr" role="alert">{errors.meetingLink}</p>}
        </div>
      )}

      <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>
        {busy ? 'Scheduling…' : 'Confirm Support Session'}
      </button>
    </form>
  );
}
