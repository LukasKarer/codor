import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { strRandom } from '../lib/utils';
import { requireAuth } from '../middleware/auth';

const router = Router();

function tryExtractExerciseTitle(content: string | null): string {
  if (!content) return 'Untitled Exercise';
  try {
    const parsed = JSON.parse(content) as { title?: unknown };
    if (typeof parsed.title === 'string' && parsed.title.trim()) {
      return parsed.title.trim();
    }
  } catch {
    // ignore invalid JSON and use fallback title
  }
  return 'Untitled Exercise';
}

/**
 * POST /v1/users/new
 * Enrolls the authenticated user into an exercise (or returns their existing
 * enrollment so they can resume from where they left off).
 *
 * Behaviour:
 *  - Non-test: idempotent — if a row already exists for (auth_user_id, exercise_id,
 *    is_test=false) it is returned as-is, including any previously saved content
 *    so the frontend can restore the editor state.
 *  - Test (is_test=true): always creates a new row, preserving every teacher test run.
 *
 * Body:
 *   exercise_sub  string   – exercise opaque sub token (also accepted as exercise_id)
 *   is_test       boolean  – optional, default false
 *
 * Response:
 *   { sub, exercise_sub, creation_time, is_test, saved_content }
 */
router.post('/users/new', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser!;
  const exercise_sub: string | undefined = req.body?.exercise_sub ?? req.body?.exercise_id;
  const is_test: boolean = req.body?.is_test === true || req.body?.is_test === 'true';

  if (!exercise_sub) {
    res.status(400).json({ error: 'exercise_sub is required' });
    return;
  }

  // Resolve exercise
  const { data: exercise, error: exError } = await supabase
    .from('exercises')
    .select('id')
    .eq('sub', exercise_sub)
    .maybeSingle();

  if (exError) {
    res.status(500).json({ error: exError.message });
    return;
  }

  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  // Ensure a profile row exists for this auth user (idempotent, never overwrites flags)
  await supabase
    .from('profiles')
    .upsert({ auth_user_id: authUser.id }, { onConflict: 'auth_user_id', ignoreDuplicates: true });

  // For real students: return the existing enrollment so they resume their saved work.
  // For test sessions: always create a fresh row so every test run is preserved.
  if (!is_test) {
    const { data: existing } = await supabase
      .from('entries')
      .select('sub, creation_time, content, submitted_at, submitted_content')
      .eq('auth_user_id', authUser.id)
      .eq('exercise_id', exercise.id)
      .eq('is_test', false)
      .maybeSingle();

    if (existing) {
      res.json({
        sub: existing.sub,
        exercise_sub,
        creation_time: existing.creation_time,
        is_test: false,
        saved_content: existing.content ?? null,
        submitted_at: existing.submitted_at ?? null,
        is_finished: existing.submitted_content !== null,
      });
      return;
    }
  }

  // Generate a unique sub token for this enrollment row
  let sub: string;
  do {
    sub = strRandom(32);
    const { data } = await supabase.from('entries').select('id').eq('sub', sub).maybeSingle();
    if (!data) break;
  } while (true);

  const creation_time = Math.floor(Date.now() / 1000);

  const { error } = await supabase.from('entries').insert({
    sub,
    exercise_id: exercise.id,
    creation_time,
    auth_user_id: authUser.id,
    is_test,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Brand-new enrollment — no saved content yet, not submitted
  res.json({
    sub,
    exercise_sub,
    creation_time,
    is_test,
    saved_content: null,
    submitted_at: null,
    is_finished: false,
  });
});

/**
 * GET /v1/student/dashboard
 * Returns all non-test exercises for the authenticated student, including
 * completion status, teacher feedback and score.
 */
router.get('/student/dashboard', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser!;

  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select(
      'id, sub, exercise_id, creation_time, submitted_at, submitted_content, note, teacher_feedback, content, is_test',
    )
    .eq('auth_user_id', authUser.id)
    .eq('is_test', false)
    .order('creation_time', { ascending: false });

  if (entriesError) {
    res.status(500).json({ error: entriesError.message });
    return;
  }

  const entryRows = entries ?? [];
  if (entryRows.length === 0) {
    res.json({ exercises: [] });
    return;
  }

  const exerciseIds = [...new Set(entryRows.map((e) => e.exercise_id))];
  const entryIds = entryRows.map((e) => e.id);

  const [{ data: exercises, error: exercisesError }, { data: reports, error: reportsError }] = await Promise.all([
    supabase.from('exercises').select('id, sub, content').in('id', exerciseIds),
    supabase.from('student_reports').select('entry_id, score').in('entry_id', entryIds),
  ]);

  if (exercisesError) {
    res.status(500).json({ error: exercisesError.message });
    return;
  }

  if (reportsError) {
    res.status(500).json({ error: reportsError.message });
    return;
  }

  const exerciseById = new Map((exercises ?? []).map((ex) => [ex.id, ex]));
  const reportByEntryId = new Map((reports ?? []).map((r) => [r.entry_id, r]));

  const payload = entryRows.map((entry) => {
    const exercise = exerciseById.get(entry.exercise_id);
    const report = reportByEntryId.get(entry.id);
    const score = report?.score ?? entry.note ?? null;
    const isCompleted = entry.submitted_content !== null || entry.submitted_at !== null;

    return {
      entry_sub: entry.sub,
      exercise_sub: exercise?.sub ?? null,
      title: tryExtractExerciseTitle(exercise?.content ?? null),
      is_completed: isCompleted,
      is_locked: entry.submitted_at !== null,
      has_saved_content: entry.content !== null,
      score,
      teacher_feedback: entry.teacher_feedback ?? null,
      creation_time: entry.creation_time,
      submitted_at: entry.submitted_at ?? null,
    };
  });

  res.json({ exercises: payload });
});

/**
 * DELETE /v1/user/:user_sub/delete
 * Deletes an enrollment row. The caller must be the owner (auth_user_id match).
 */
router.delete('/user/:user_sub/delete', requireAuth, async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub;
  const authUser = req.authUser!;

  const { data: existing, error: findError } = await supabase
    .from('entries')
    .select('id, auth_user_id')
    .eq('sub', user_sub)
    .maybeSingle();

  if (findError) {
    res.status(500).json({ error: findError.message });
    return;
  }

  if (!existing) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }

  if (existing.auth_user_id !== authUser.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { error } = await supabase.from('entries').delete().eq('sub', user_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Enrollment ${user_sub} deleted` });
});

/**
 * GET /v1/user/:user_sub/info
 * Returns enrollment information. Caller must be the owner.
 */
router.get('/user/:user_sub/info', requireAuth, async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub;
  const authUser = req.authUser!;

  const { data: user, error } = await supabase
    .from('entries')
    .select('sub, exercise_id, creation_time, note, auth_user_id, is_test, content')
    .eq('sub', user_sub)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!user) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }

  if (user.auth_user_id !== authUser.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json(user);
});

/**
 * POST /v1/user/:user_sub/note
 * Assigns a grade to an enrollment row. Requires teacher role.
 */
router.post('/user/:user_sub/note', requireAuth, async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub;
  const authUser = req.authUser!;
  const note = req.body?.note ?? null;

  if (!authUser.isTeacher) {
    res.status(403).json({ error: 'Forbidden: teacher access required' });
    return;
  }

  const { data: existing, error: findError } = await supabase
    .from('entries')
    .select('id')
    .eq('sub', user_sub)
    .maybeSingle();

  if (findError) {
    res.status(500).json({ error: findError.message });
    return;
  }

  if (!existing) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: { note: number | null; submitted_at?: number } = {
    note: note !== null ? Number(note) : null,
  };
  if (note !== null) {
    payload.submitted_at = now;
  }

  const { error } = await supabase
    .from('entries')
    .update(payload)
    .eq('sub', user_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Enrollment ${user_sub} noted` });
});

/**
 * POST /v1/user/:user_sub/feedback
 * Assigns written feedback to an enrollment row. Requires teacher role.
 */
router.post('/user/:user_sub/feedback', requireAuth, async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub;
  const authUser = req.authUser!;
  const feedback = req.body?.feedback ?? null;

  if (!authUser.isTeacher) {
    res.status(403).json({ error: 'Forbidden: teacher access required' });
    return;
  }

  const { data: existing, error: findError } = await supabase
    .from('entries')
    .select('id')
    .eq('sub', user_sub)
    .maybeSingle();

  if (findError) {
    res.status(500).json({ error: findError.message });
    return;
  }

  if (!existing) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }

  const { error } = await supabase
    .from('entries')
    .update({ teacher_feedback: feedback !== null ? String(feedback) : null })
    .eq('sub', user_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Feedback saved for ${user_sub}` });
});

export default router;

