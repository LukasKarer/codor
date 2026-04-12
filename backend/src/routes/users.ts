import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { strRandom } from '../lib/utils';
import { requireAuth } from '../middleware/auth';

const router = Router();

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
      .select('sub, creation_time, content, submitted_at')
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
  res.json({ sub, exercise_sub, creation_time, is_test, saved_content: null, submitted_at: null });
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

  const { error } = await supabase
    .from('entries')
    .update({ note: note !== null ? Number(note) : null })
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

