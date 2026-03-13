import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { strRandom } from '../lib/utils';
import { requireAuth, requireTeacher } from '../middleware/auth';

const router = Router();

/**
 * POST /v1/exercises/new
 * Creates a new exercise. Requires teacher role.
 */
router.post('/exercises/new', requireTeacher, async (req: Request, res: Response) => {
  const content: string = req.body?.content ?? '';

  // Generate a unique sub
  let sub: string;
  do {
    sub = strRandom(16);
    const { data } = await supabase
      .from('exercises')
      .select('id')
      .eq('sub', sub)
      .maybeSingle();
    if (!data) break;
  } while (true);

  const creation_time = Math.floor(Date.now() / 1000);

  const { error } = await supabase.from('exercises').insert({
    sub,
    creation_time,
    content,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ sub, creation_time });
});

/**
 * GET /v1/exercise/:exercise_sub/info
 * Returns exercise metadata and content. Requires auth.
 */
router.get('/exercise/:exercise_sub/info', requireAuth, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;

  const { data: exercise, error } = await supabase
    .from('exercises')
    .select('sub, creation_time, content')
    .eq('sub', exercise_sub)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  res.json(exercise);
});

/**
 * POST /v1/exercise/:exercise_sub/update
 * Updates the content of an existing exercise. Requires teacher role.
 */
router.post('/exercise/:exercise_sub/update', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;
  const content: string = req.body?.content ?? '';

  const { error } = await supabase
    .from('exercises')
    .update({ content })
    .eq('sub', exercise_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Exercise ${exercise_sub} updated` });
});

/**
 * DELETE /v1/exercise/:exercise_sub/delete
 * Deletes an exercise. Requires teacher role.
 */
router.delete('/exercise/:exercise_sub/delete', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;

  const { error } = await supabase
    .from('exercises')
    .delete()
    .eq('sub', exercise_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Exercise ${exercise_sub} deleted` });
});

/**
 * POST /v1/exercise/:exercise_sub/push
 * Authenticated push: stores the calling user's code for this exercise.
 * The user record is resolved via auth_user_id. If no record exists yet
 * (e.g. first push before /users/new) it is created automatically.
 *
 * Body: { content: string }
 */
router.post('/exercise/:exercise_sub/push', requireAuth, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;
  const authUser = req.authUser!;
  const content: string = req.body?.content ?? '';

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

  // Find the user's record for this exercise (prefer non-test; most recent test otherwise)
  const { data: userRecord, error: userError } = await supabase
    .from('entries')
    .select('id, sub')
    .eq('auth_user_id', authUser.id)
    .eq('exercise_id', exercise.id)
    .order('creation_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (userError) {
    res.status(500).json({ error: userError.message });
    return;
  }

  if (!userRecord) {
    res.status(404).json({ error: 'No enrollment found for this user and exercise. Call /v1/users/new first.' });
    return;
  }

  const { error } = await supabase
    .from('entries')
    .update({ content })
    .eq('id', userRecord.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Content pushed for user ${userRecord.sub}` });
});

/**
 * GET /v1/exercise/:exercise_sub/participants
 * Returns list of participant user subs. Requires teacher role.
 */
router.get('/exercise/:exercise_sub/participants', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;

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

  const { data: users, error } = await supabase
    .from('entries')
    .select('sub')
    .eq('exercise_id', exercise.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json((users ?? []).map((u) => u.sub));
});

/**
 * GET /v1/exercise/:exercise_sub/participant/:user_sub
 * Returns a participant's submission. Requires teacher role.
 * Includes is_test and auth_user_id (email resolved separately by the client).
 */
router.get(
  '/exercise/:exercise_sub/participant/:user_sub',
  requireTeacher,
  async (req: Request<{ exercise_sub: string; user_sub: string }>, res: Response) => {
    const { exercise_sub, user_sub } = req.params;

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

    const { data: user, error } = await supabase
      .from('entries')
      .select('sub, content, is_test, auth_user_id, note')
      .eq('sub', user_sub)
      .eq('exercise_id', exercise.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!user) {
      res.status(404).json({ error: `Participant not found` });
      return;
    }

    // Resolve display label: for test users, fetch the email from Supabase auth admin
    let displayLabel: string | null = null;
    if (user.is_test && user.auth_user_id) {
      const { data: authData } = await supabase.auth.admin.getUserById(user.auth_user_id);
      displayLabel = authData?.user?.email ?? user.auth_user_id;
    }

    res.json({
      sub: user.sub,
      content: user.content ?? null,
      is_test: user.is_test,
      note: user.note ?? null,
      test_label: displayLabel,
    });
  },
);

export default router;
