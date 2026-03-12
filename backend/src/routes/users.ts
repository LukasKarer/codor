import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { strRandom } from '../lib/utils';

const router = Router();

/**
 * POST /v1/users/new
 * Creates a new user linked to an exercise.
 */
router.post('/users/new', async (req: Request, res: Response) => {
  const academic_id: number | undefined = req.body?.academic_id;
  const exercise_sub: string | undefined = req.body?.exercise_sub ?? req.body?.exercise_id;

  if (!academic_id || !exercise_sub) {
    res.status(400).json({ error: 'academic_id and exercise_sub are required' });
    return;
  }

  // Verify exercise exists
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

  // Generate a unique user sub
  let sub: string;
  do {
    sub = strRandom(32);
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('sub', sub)
      .maybeSingle();
    if (!data) break;
  } while (true);

  const creation_time = Math.floor(Date.now() / 1000);

  const { error } = await supabase.from('users').insert({
    sub,
    exercise_id: exercise.id,
    creation_time,
    academic_id: Number(academic_id),
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ sub, exercise_sub, academic_id: Number(academic_id), creation_time });
});

/**
 * POST /v1/user/:user_sub/push
 * Stores or updates the user's submitted content.
 */
router.post('/user/:user_sub/push', async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub as string;
  const content: string = req.body?.content ?? '';

  // Verify user exists
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('sub', user_sub)
    .maybeSingle();

  if (userError) {
    res.status(500).json({ error: userError.message });
    return;
  }

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ content })
    .eq('sub', user_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Content of user ${user_sub} updated` });
});

/**
 * DELETE /v1/user/:user_sub/delete
 * Deletes a user.
 */
router.delete('/user/:user_sub/delete', async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub as string;

  // Check existence first to replicate PHP 404 behaviour
  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('sub', user_sub)
    .maybeSingle();

  if (findError) {
    res.status(500).json({ error: findError.message });
    return;
  }

  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { error } = await supabase.from('users').delete().eq('sub', user_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `User ${user_sub} deleted` });
});

/**
 * GET /v1/user/:user_sub/info
 * Returns user information.
 */
router.get('/user/:user_sub/info', async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub as string;

  const { data: user, error } = await supabase
    .from('users')
    .select('sub, exercise_id, creation_time, academic_id, note')
    .eq('sub', user_sub)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(user);
});

/**
 * POST /v1/user/:user_sub/note
 * Assigns a grade/note to a user.
 */
router.post('/user/:user_sub/note', async (req: Request<{ user_sub: string }>, res: Response) => {
  const user_sub = req.params.user_sub as string;
  const note = req.body?.note ?? null;

  // Verify user exists
  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('sub', user_sub)
    .maybeSingle();

  if (findError) {
    res.status(500).json({ error: findError.message });
    return;
  }

  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ note: note !== null ? Number(note) : null })
    .eq('sub', user_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `User ${user_sub} noted` });
});

export default router;
