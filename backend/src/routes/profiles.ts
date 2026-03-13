import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /v1/profile/me
 * Returns the authenticated user's profile (is_teacher, is_admin).
 * If no profile row exists yet, returns defaults { is_teacher: false, is_admin: false }.
 */
router.get('/profile/me', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser!;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_teacher, is_admin')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({
    auth_user_id: authUser.id,
    is_teacher: profile?.is_teacher ?? false,
    is_admin: profile?.is_admin ?? false,
  });
});

export default router;
