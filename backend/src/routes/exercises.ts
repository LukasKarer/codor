import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { strRandom } from '../lib/utils';

const router = Router();

/**
 * POST /v1/exercises/new
 * Creates a new exercise.
 */
router.post('/exercises/new', async (req: Request, res: Response) => {
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
 * Returns exercise metadata and content.
 */
router.get('/exercise/:exercise_sub/info', async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub as string;

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
 * Updates the content of an existing exercise.
 */
router.post('/exercise/:exercise_sub/update', async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub as string;
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
 * Deletes an exercise.
 */
router.delete('/exercise/:exercise_sub/delete', async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub as string;

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
 * GET /v1/exercise/:exercise_sub/participants
 * Returns list of user subs participating in the exercise.
 */
router.get('/exercise/:exercise_sub/participants', async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub as string;

  // Resolve exercise id
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
    .from('users')
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
 * Returns a participant's submission for an exercise.
 */
router.get(
  '/exercise/:exercise_sub/participant/:user_sub',
  async (req: Request<{ exercise_sub: string; user_sub: string }>, res: Response) => {
    const exercise_sub = req.params.exercise_sub as string;
    const user_sub = req.params.user_sub as string;

    // Resolve exercise id
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
      .from('users')
      .select('sub, academic_id, content')
      .eq('sub', user_sub)
      .eq('exercise_id', exercise.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!user) {
      res.status(404).json({ error: `Return not found for user ${user_sub}` });
      return;
    }

    res.json({
      sub: user.sub,
      academic_id: user.academic_id,
      content: user.content ?? null,
    });
  }
);

export default router;
