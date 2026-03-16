import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email: string | undefined;
  isTeacher: boolean;
  /** Org-level admin: can edit their own organisation's data/members */
  isAdmin: boolean;
  /** System-level super-admin: can edit all organisations and all profiles */
  isSystemAdmin: boolean;
}

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

/**
 * Verifies the Supabase Bearer JWT, then loads the user's role flags
 * (is_teacher, is_admin, is_system_admin) from the `profiles` table.
 * A missing profile row is treated as a plain student (all flags false).
 *
 * On success, attaches req.authUser = { id, email, isTeacher, isAdmin, isSystemAdmin }.
 * On failure, responds 401.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const user = data.user;

  // Load role flags from the profiles table (missing row → default false/false/false)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_teacher, is_admin, is_system_admin')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  req.authUser = {
    id: user.id,
    email: user.email,
    isTeacher: profile?.is_teacher === true,
    isAdmin: profile?.is_admin === true,
    isSystemAdmin: profile?.is_system_admin === true,
  };

  next();
}

/**
 * Same as requireAuth, but also enforces the is_teacher flag.
 */
export async function requireTeacher(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!req.authUser?.isTeacher) {
      res.status(403).json({ error: 'Forbidden: teacher access required' });
      return;
    }
    next();
  });
}

/**
 * Requires is_system_admin = true (super-admin, formerly is_admin).
 */
export async function requireSystemAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, async () => {
    if (!req.authUser?.isSystemAdmin) {
      res.status(403).json({ error: 'Forbidden: system admin access required' });
      return;
    }
    next();
  });
}

/**
 * Kept as an alias for requireSystemAdmin so existing route files compile
 * without changes. New code should use requireSystemAdmin directly.
 * @deprecated Use requireSystemAdmin
 */
export const requireAdmin = requireSystemAdmin;
