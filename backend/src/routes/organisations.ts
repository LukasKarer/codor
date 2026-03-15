import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

// ============================================================
// Helper: check if the calling user is an admin of an org
// (either global is_admin flag OR listed in the org's admins array)
// ============================================================
function isOrgAdmin(authUserId: string, orgAdmins: string[], isGlobalAdmin: boolean): boolean {
  return isGlobalAdmin || orgAdmins.includes(authUserId);
}

// ============================================================
// GET /v1/admin/organisations
// Returns all organisations. Global admin only.
// ============================================================
router.get('/admin/organisations', requireAdmin, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, admins, data')
    .order('id');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data ?? []);
});

// ============================================================
// POST /v1/admin/organisations/new
// Creates a new organisation. Global admin only.
// Body: { admins?: string[], data?: object }
// ============================================================
router.post('/admin/organisations/new', requireAdmin, async (req: Request, res: Response) => {
  const admins: string[] = req.body?.admins ?? [];
  const data: Record<string, unknown> = req.body?.data ?? {};

  const { data: row, error } = await supabase
    .from('organisations')
    .insert({ admins, data })
    .select('id, admins, data')
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json(row);
});

// ============================================================
// GET /v1/admin/organisation/:org_id
// Returns a single organisation.
// Accessible by global admins or org admins listed in admins[].
// ============================================================
router.get(
  '/admin/organisation/:org_id',
  requireAuth,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { org_id } = req.params;

    const { data: org, error } = await supabase
      .from('organisations')
      .select('id, admins, data')
      .eq('id', org_id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!org) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const admins: string[] = (org.admins as string[]) ?? [];
    if (!isOrgAdmin(authUser.id, admins, authUser.isAdmin)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(org);
  },
);

// ============================================================
// POST /v1/admin/organisation/:org_id/update
// Updates admins and/or data of an organisation.
// Accessible by global admins or org admins listed in admins[].
// Body: { admins?: string[], data?: object }
// ============================================================
router.post(
  '/admin/organisation/:org_id/update',
  requireAuth,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { org_id } = req.params;

    // Load current org to authorise
    const { data: org, error: fetchError } = await supabase
      .from('organisations')
      .select('id, admins')
      .eq('id', org_id)
      .maybeSingle();

    if (fetchError) {
      res.status(500).json({ error: fetchError.message });
      return;
    }

    if (!org) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const currentAdmins: string[] = (org.admins as string[]) ?? [];
    if (!isOrgAdmin(authUser.id, currentAdmins, authUser.isAdmin)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body?.admins !== undefined) updates['admins'] = req.body.admins;
    if (req.body?.data !== undefined) updates['data'] = req.body.data;

    const { data: updated, error } = await supabase
      .from('organisations')
      .update(updates)
      .eq('id', org_id)
      .select('id, admins, data')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(updated);
  },
);

// ============================================================
// DELETE /v1/admin/organisation/:org_id/delete
// Deletes an organisation. Global admin only.
// ============================================================
router.delete(
  '/admin/organisation/:org_id/delete',
  requireAdmin,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const { org_id } = req.params;

    const { error } = await supabase
      .from('organisations')
      .delete()
      .eq('id', org_id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: `Organisation ${org_id} deleted` });
  },
);

// ============================================================
// GET /v1/admin/organisation/:org_id/members
// Returns all profiles belonging to this org.
// Accessible by global admins or org admins.
// ============================================================
router.get(
  '/admin/organisation/:org_id/members',
  requireAuth,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { org_id } = req.params;

    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('admins')
      .eq('id', org_id)
      .maybeSingle();

    if (orgError) {
      res.status(500).json({ error: orgError.message });
      return;
    }

    if (!org) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const admins: string[] = (org.admins as string[]) ?? [];
    if (!isOrgAdmin(authUser.id, admins, authUser.isAdmin)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { data: members, error } = await supabase
      .from('profiles')
      .select('auth_user_id, is_teacher, is_admin, organisation_id')
      .eq('organisation_id', org_id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(members ?? []);
  },
);

// ============================================================
// POST /v1/admin/profile/:auth_user_id/update
// Updates a user's profile flags and/or organisation membership.
// Global admin only.
// Body: { is_teacher?: boolean, is_admin?: boolean, organisation_id?: string | null }
// ============================================================
router.post(
  '/admin/profile/:auth_user_id/update',
  requireAdmin,
  async (req: Request<{ auth_user_id: string }>, res: Response) => {
    const { auth_user_id } = req.params;
    const updates: Record<string, unknown> = {};

    if (req.body?.is_teacher !== undefined) updates['is_teacher'] = req.body.is_teacher;
    if (req.body?.is_admin !== undefined) updates['is_admin'] = req.body.is_admin;
    if (req.body?.organisation_id !== undefined) updates['organisation_id'] = req.body.organisation_id;

    // Upsert so that even profiles that haven't been created yet can be updated
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({ auth_user_id, ...updates }, { onConflict: 'auth_user_id' })
      .select('auth_user_id, is_teacher, is_admin, organisation_id')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(profile);
  },
);

// ============================================================
// GET /v1/admin/profiles
// Returns all profiles. Global admin only.
// ============================================================
router.get('/admin/profiles', requireAdmin, async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('auth_user_id, is_teacher, is_admin, organisation_id')
    .order('auth_user_id');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data ?? []);
});

export default router;
