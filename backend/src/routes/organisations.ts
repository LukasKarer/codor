import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireSystemAdmin, requireAuth } from '../middleware/auth';

const router = Router();

// ============================================================
// Selector constant — every org select uses the same fields
// ============================================================
const ORG_SELECT = 'id, name, admins, email_patterns, data';
const PROFILE_SELECT = 'auth_user_id, name, is_teacher, is_admin, is_system_admin, organisation_id';

// ============================================================
// GET /v1/organisations/public
// Returns id + name + email_patterns for all organisations.
// Public — used on the signup page so users can pick their org.
// ============================================================
router.get('/organisations/public', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, email_patterns')
    .order('name');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data ?? []);
});

// ============================================================
// GET /v1/admin/organisations
// Returns all organisations.
// System admins see everything; org-admins see their own org only.
// ============================================================
router.get('/admin/organisations', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser!;

  if (authUser.isSystemAdmin) {
    const { data, error } = await supabase
      .from('organisations')
      .select(ORG_SELECT)
      .order('name');

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data ?? []);
    return;
  }

  // Org-admin: only return their own org
  if (authUser.isAdmin) {
    // Find org where this user is listed in admins
    const { data: profile } = await supabase
      .from('profiles')
      .select('organisation_id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (!profile?.organisation_id) { res.json([]); return; }

    const { data, error } = await supabase
      .from('organisations')
      .select(ORG_SELECT)
      .eq('id', profile.organisation_id)
      .maybeSingle();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data ? [data] : []);
    return;
  }

  res.status(403).json({ error: 'Forbidden' });
});

// ============================================================
// POST /v1/admin/organisations/new
// Creates a new organisation. System admin only.
// Body: { name: string, admins?: string[], email_patterns?: string[], data?: object }
// ============================================================
router.post('/admin/organisations/new', requireSystemAdmin, async (req: Request, res: Response) => {
  const name: string = req.body?.name ?? '';
  const admins: string[] = req.body?.admins ?? [];
  const email_patterns: string[] = req.body?.email_patterns ?? [];
  const data: Record<string, unknown> = req.body?.data ?? {};

  const { data: row, error } = await supabase
    .from('organisations')
    .insert({ name, admins, email_patterns, data })
    .select(ORG_SELECT)
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(row);
});

// ============================================================
// GET /v1/admin/organisation/:org_id
// Returns a single organisation.
// System admins see any org; org-admins see only their own.
// ============================================================
router.get(
  '/admin/organisation/:org_id',
  requireAuth,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { org_id } = req.params;

    if (!authUser.isSystemAdmin && !authUser.isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { data: org, error } = await supabase
      .from('organisations')
      .select(ORG_SELECT)
      .eq('id', org_id)
      .maybeSingle();

    if (error) { res.status(500).json({ error: error.message }); return; }
    if (!org) { res.status(404).json({ error: 'Organisation not found' }); return; }

    // Org-admin: verify they belong to this org
    if (!authUser.isSystemAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (profile?.organisation_id !== org_id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    res.json(org);
  },
);

// ============================================================
// POST /v1/admin/organisation/:org_id/update
// Updates an organisation.
//
// System admin  → can update name, admins, email_patterns, data
// Org-admin     → can update name and data only (not admins or email_patterns)
// ============================================================
router.post(
  '/admin/organisation/:org_id/update',
  requireAuth,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { org_id } = req.params;

    if (!authUser.isSystemAdmin && !authUser.isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Verify org exists
    const { data: org, error: fetchError } = await supabase
      .from('organisations')
      .select('id')
      .eq('id', org_id)
      .maybeSingle();

    if (fetchError) { res.status(500).json({ error: fetchError.message }); return; }
    if (!org) { res.status(404).json({ error: 'Organisation not found' }); return; }

    // Org-admin: verify they belong to this org
    if (!authUser.isSystemAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (profile?.organisation_id !== org_id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    const updates: Record<string, unknown> = {};
    // Both levels can update name, data, and email_patterns
    if (req.body?.name !== undefined) updates['name'] = req.body.name;
    if (req.body?.data !== undefined) updates['data'] = req.body.data;
    if (req.body?.email_patterns !== undefined) updates['email_patterns'] = req.body.email_patterns;
    // Only system admins can update the admins list
    if (authUser.isSystemAdmin) {
      if (req.body?.admins !== undefined) updates['admins'] = req.body.admins;
    }

    const { data: updated, error } = await supabase
      .from('organisations')
      .update(updates)
      .eq('id', org_id)
      .select(ORG_SELECT)
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(updated);
  },
);

// ============================================================
// DELETE /v1/admin/organisation/:org_id/delete
// Deletes an organisation. System admin only.
// ============================================================
router.delete(
  '/admin/organisation/:org_id/delete',
  requireSystemAdmin,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const { org_id } = req.params;

    const { error } = await supabase
      .from('organisations')
      .delete()
      .eq('id', org_id);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ message: `Organisation ${org_id} deleted` });
  },
);

// ============================================================
// GET /v1/admin/organisation/:org_id/members
// Returns all profiles belonging to this org.
// System admins see any org; org-admins see only their own.
// ============================================================
router.get(
  '/admin/organisation/:org_id/members',
  requireAuth,
  async (req: Request<{ org_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { org_id } = req.params;

    if (!authUser.isSystemAdmin && !authUser.isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Org-admin: verify they belong to this org
    if (!authUser.isSystemAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (profile?.organisation_id !== org_id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }

    const { data: members, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('organisation_id', org_id);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(members ?? []);
  },
);

// ============================================================
// POST /v1/admin/profile/:auth_user_id/update
// Updates a user's profile.
//
// System admin  → can update any field for any user
// Org-admin     → can update name and is_teacher for members
//                 of their own org only; cannot touch role flags
//                 is_admin / is_system_admin or organisation_id
// ============================================================
router.post(
  '/admin/profile/:auth_user_id/update',
  requireAuth,
  async (req: Request<{ auth_user_id: string }>, res: Response) => {
    const authUser = req.authUser!;
    const { auth_user_id } = req.params;

    if (!authUser.isSystemAdmin && !authUser.isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updates: Record<string, unknown> = {};

    if (authUser.isSystemAdmin) {
      // Full control
      if (req.body?.name !== undefined) updates['name'] = req.body.name;
      if (req.body?.is_teacher !== undefined) updates['is_teacher'] = req.body.is_teacher;
      if (req.body?.is_admin !== undefined) updates['is_admin'] = req.body.is_admin;
      if (req.body?.is_system_admin !== undefined) updates['is_system_admin'] = req.body.is_system_admin;
      if (req.body?.organisation_id !== undefined) updates['organisation_id'] = req.body.organisation_id;
    } else {
      // Org-admin: may only edit members of their own org
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('auth_user_id', auth_user_id)
        .maybeSingle();

      if (
        !callerProfile?.organisation_id ||
        callerProfile.organisation_id !== targetProfile?.organisation_id
      ) {
        res.status(403).json({ error: 'Forbidden: user is not in your organisation' });
        return;
      }

      // Limited fields only
      if (req.body?.name !== undefined) updates['name'] = req.body.name;
      if (req.body?.is_teacher !== undefined) updates['is_teacher'] = req.body.is_teacher;
      // Org-admin can promote/demote members to org-admin within their own org
      if (req.body?.is_admin !== undefined) updates['is_admin'] = req.body.is_admin;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updatable fields provided' });
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({ auth_user_id, ...updates }, { onConflict: 'auth_user_id' })
      .select(PROFILE_SELECT)
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(profile);
  },
);

// ============================================================
// GET /v1/admin/profiles
// Returns all profiles.
// System admin → all profiles
// Org-admin    → only members of their own org
// ============================================================
router.get('/admin/profiles', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser!;

  if (!authUser.isSystemAdmin && !authUser.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (authUser.isSystemAdmin) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('name');

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data ?? []);
    return;
  }

  // Org-admin: fetch members of their own org
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('organisation_id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (!callerProfile?.organisation_id) { res.json([]); return; }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('organisation_id', callerProfile.organisation_id)
    .order('name');

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data ?? []);
});

// ============================================================
// POST /v1/profile/setup
// Called after signup to save the user's name + organisation.
// Any authenticated user can call this for their own profile.
// Body: { name: string, organisation_id: string }
// ============================================================
router.post('/profile/setup', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser!;
  const name: string = (req.body?.name ?? '').trim();
  const organisation_id: string | null = req.body?.organisation_id ?? null;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  // Validate email against the org's email_patterns if an org was provided
  if (organisation_id) {
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('email_patterns')
      .eq('id', organisation_id)
      .maybeSingle();

    if (orgError) { res.status(500).json({ error: orgError.message }); return; }
    if (!org) { res.status(404).json({ error: 'Organisation not found' }); return; }

    const patterns: string[] = (org.email_patterns as string[]) ?? [];
    const email = authUser.email ?? '';

    if (patterns.length > 0) {
      const allowed = patterns.some((p) => email.toLowerCase().includes(p.toLowerCase()));
      if (!allowed) {
        res.status(403).json({
          error: 'Your email address is not eligible for this organisation',
        });
        return;
      }
    }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert(
      { auth_user_id: authUser.id, name, organisation_id },
      { onConflict: 'auth_user_id' },
    )
    .select(PROFILE_SELECT)
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(profile);
});

export default router;
