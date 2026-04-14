import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { strRandom } from '../lib/utils';
import { requireAuth, requireTeacher } from '../middleware/auth';
import { openRouterChatCompletion } from '../lib/openrouter';

const router = Router();

interface ScoreDeduction {
  reason: string;
  points: number;
  [key: string]: string | number;
}

interface StudentReportPayload {
  summary: string;
  ai_interactions: string[];
  score_deductions: ScoreDeduction[];
  strengths: string[];
  improvements: string[];
}

async function generateJsonWithAI<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const result = await openRouterChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const choices = result.choices as Array<Record<string, unknown>> | undefined;
    const first = choices?.[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    const text = (typeof message?.content === 'string' ? message.content : '').trim();

    if (!text) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function resolveExercise(exerciseSub: string): Promise<{ id: number; sub: string; content: string | null } | null> {
  const { data } = await supabase
    .from('exercises')
    .select('id, sub, content')
    .eq('sub', exerciseSub)
    .maybeSingle();
  return data ?? null;
}

async function resolveEntry(exerciseId: number, userSub: string) {
  let { data, error } = await supabase
    .from('entries')
    .select('id, sub, content, note, is_test, auth_user_id, creation_time, teacher_feedback')
    .eq('exercise_id', exerciseId)
    .eq('sub', userSub)
    .maybeSingle();

  if (error && (error.code === 'PGRST200' || error.code === '42703' || error.message.includes('teacher_feedback'))) {
    const fallback = await supabase
      .from('entries')
      .select('id, sub, content, note, is_test, auth_user_id, creation_time')
      .eq('exercise_id', exerciseId)
      .eq('sub', userSub)
      .maybeSingle();
    data = fallback?.data as any;
  }

  return data ?? null;
}

async function getEntryStats(entryId: string, entryCreationTime: number): Promise<{
  aiInteractionsCount: number;
  snapshotCount: number;
  timeSpentMinutes: number;
}> {
  const [{ count: aiInteractionsCount }, { data: snapshots, count: snapshotCount }] = await Promise.all([
    supabase
      .from('ai_conversations')
      .select('id', { count: 'exact', head: true })
      .eq('entry_id', entryId),
    supabase
      .from('entry_snapshots')
      .select('creation_time', { count: 'exact' })
      .eq('entry_id', entryId)
      .order('creation_time', { ascending: true }),
  ]);

  const list = snapshots ?? [];
  const firstTime = list.length > 0 ? list[0]!.creation_time : entryCreationTime;
  const lastTime = list.length > 0 ? list[list.length - 1]!.creation_time : entryCreationTime;
  const timeSpentMinutes = Math.max(0, Math.round((lastTime - firstTime) / 60));

  return {
    aiInteractionsCount: aiInteractionsCount ?? 0,
    snapshotCount: snapshotCount ?? 0,
    timeSpentMinutes,
  };
}

function normalizeStudentReport(raw: StudentReportPayload): StudentReportPayload {
  const scoreDeductions = (raw.score_deductions ?? [])
    .filter((d) => typeof d.reason === 'string')
    .map((d) => ({
      reason: d.reason,
      points: Math.max(0, Math.min(100, Math.round(Number(d.points) || 0))),
    }));

  return {
    summary: raw.summary ?? 'No summary generated.',
    ai_interactions: Array.isArray(raw.ai_interactions) ? raw.ai_interactions : [],
    score_deductions: scoreDeductions,
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
  };
}

/**
 * POST /v1/exercises/new
 * Creates a new exercise. Requires teacher role.
 */
router.post('/exercises/new', requireTeacher, async (req: Request, res: Response) => {
  const content: string = req.body?.content ?? '';

  let sub: string;
  do {
    sub = strRandom(16);
    const { data } = await supabase.from('exercises').select('id').eq('sub', sub).maybeSingle();
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
  const exercise = await resolveExercise(req.params.exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data, error } = await supabase
    .from('exercises')
    .select('sub, creation_time, content')
    .eq('id', exercise.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data);
});

/**
 * POST /v1/exercise/:exercise_sub/update
 * Updates exercise content. Requires teacher role.
 */
router.post('/exercise/:exercise_sub/update', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;
  const content: string = req.body?.content ?? '';

  const { error } = await supabase.from('exercises').update({ content }).eq('sub', exercise_sub);

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

  const { error } = await supabase.from('exercises').delete().eq('sub', exercise_sub);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: `Exercise ${exercise_sub} deleted` });
});

/**
 * POST /v1/exercise/:exercise_sub/push
 * Stores the current code and appends a snapshot entry (autosave history).
 */
router.post('/exercise/:exercise_sub/push', requireAuth, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;
  const authUser = req.authUser!;
  const content: string = req.body?.content ?? '';

  const exercise = await resolveExercise(exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data: userRecord, error: userError } = await supabase
    .from('entries')
    .select('id, sub, submitted_at')
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

  if (userRecord.submitted_at !== null) {
    res.status(423).json({ error: 'Exercise is locked after submission' });
    return;
  }

  const creationTime = Math.floor(Date.now() / 1000);
  const [{ error: updateError }, { error: snapshotError }] = await Promise.all([
    supabase.from('entries').update({ content }).eq('id', userRecord.id),
    supabase.from('entry_snapshots').insert({
      entry_id: userRecord.id,
      creation_time: creationTime,
      content,
    }),
  ]);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  if (snapshotError) {
    res.status(500).json({ error: snapshotError.message });
    return;
  }

  res.json({ message: `Content pushed for user ${userRecord.sub}` });
});

/**
 * POST /v1/exercise/:exercise_sub/submit
 * Marks the student's exercise as finished (manual finish), but does not lock
 * editing yet. Locking happens later when teacher grading is applied.
 */
router.post('/exercise/:exercise_sub/submit', requireAuth, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;
  const authUser = req.authUser!;

  const exercise = await resolveExercise(exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data: userRecord, error: userError } = await supabase
    .from('entries')
    .select('id, sub, submitted_at, submitted_content, content')
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
    res.status(404).json({ error: 'No enrollment found for this user and exercise.' });
    return;
  }

  if (userRecord.submitted_at !== null) {
    res.status(423).json({ error: 'Exercise is locked after grading' });
    return;
  }

  if (userRecord.submitted_content !== null) {
    res.json({ submitted_at: null, is_finished: true });
    return;
  }

  const finalCode: string = req.body?.content ?? userRecord.content ?? '';

  const { error: updateError } = await supabase
    .from('entries')
    .update({ submitted_content: finalCode })
    .eq('id', userRecord.id);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  res.json({ submitted_at: null, is_finished: true });
});

/**
 * POST /v1/exercise/:exercise_sub/ai-interaction
 * Persists one AI interaction for the authenticated participant.
 */
router.post('/exercise/:exercise_sub/ai-interaction', requireAuth, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise_sub = req.params.exercise_sub;
  const authUser = req.authUser!;
  const promptType = String(req.body?.promptType ?? 'chat');
  const userMessage = req.body?.userMessage == null ? null : String(req.body.userMessage);
  const assistantMessage = String(req.body?.assistantMessage ?? '');

  if (!assistantMessage.trim()) {
    res.status(400).json({ error: 'assistantMessage is required' });
    return;
  }

  const exercise = await resolveExercise(exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data: userRecord, error: userError } = await supabase
    .from('entries')
    .select('id, submitted_at')
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
    res.status(404).json({ error: 'No enrollment found for this user and exercise.' });
    return;
  }

  if (userRecord.submitted_at !== null) {
    res.status(423).json({ error: 'Exercise is locked after submission' });
    return;
  }

  const { error } = await supabase.from('ai_conversations').insert({
    entry_id: userRecord.id,
    creation_time: Math.floor(Date.now() / 1000),
    prompt_type: promptType,
    user_message: userMessage,
    assistant_message: assistantMessage,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: 'AI interaction saved' });
});

/**
 * GET /v1/exercise/:exercise_sub/participants
 * Returns list of participant user subs. Requires teacher role.
 */
router.get('/exercise/:exercise_sub/participants', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise = await resolveExercise(req.params.exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data: users, error } = await supabase.from('entries').select('sub').eq('exercise_id', exercise.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json((users ?? []).map((u) => u.sub));
});

/**
 * GET /v1/exercise/:exercise_sub/participant/:user_sub
 * Returns lightweight participant summary. Requires teacher role.
 */
router.get(
  '/exercise/:exercise_sub/participant/:user_sub',
  requireTeacher,
  async (req: Request<{ exercise_sub: string; user_sub: string }>, res: Response) => {
    const { exercise_sub, user_sub } = req.params;
    const exercise = await resolveExercise(exercise_sub);

    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    const user = await resolveEntry(exercise.id, user_sub);
    if (!user) {
      res.status(404).json({ error: 'Participant not found' });
      return;
    }

    const stats = await getEntryStats(user.id, user.creation_time);
    const { data: report } = await supabase
      .from('student_reports')
      .select('score, report_json')
      .eq('entry_id', user.id)
      .maybeSingle();

    let displayLabel: string | null = null;
    if (user.is_test && user.auth_user_id) {
      const { data: authData } = await supabase.auth.admin.getUserById(user.auth_user_id);
      displayLabel = authData?.user?.email ?? user.auth_user_id;
    }

    let name: string | null = null;
    if (user.auth_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('auth_user_id', user.auth_user_id)
        .maybeSingle();
      name = profile?.name?.trim() ? profile.name : null;
    }

    res.json({
      sub: user.sub,
      name,
      content: user.content ?? null,
      is_test: user.is_test,
      note: user.note ?? null,
      teacher_feedback: user.teacher_feedback ?? null,
      test_label: displayLabel,
      ai_interactions_count: stats.aiInteractionsCount,
      snapshot_count: stats.snapshotCount,
      time_spent_minutes: stats.timeSpentMinutes,
      has_report: !!report,
      report_score: report?.score ?? null,
      report: report?.report_json ?? null,
    });
  },
);

/**
 * GET /v1/exercise/:exercise_sub/participant/:user_sub/detail
 * Returns full participant detail, including saved AI conversations and report.
 */
router.get(
  '/exercise/:exercise_sub/participant/:user_sub/detail',
  requireTeacher,
  async (req: Request<{ exercise_sub: string; user_sub: string }>, res: Response) => {
    const { exercise_sub, user_sub } = req.params;
    const exercise = await resolveExercise(exercise_sub);

    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    const user = await resolveEntry(exercise.id, user_sub);
    if (!user) {
      res.status(404).json({ error: 'Participant not found' });
      return;
    }

    const [stats, conversationsResult, reportResult] = await Promise.all([
      getEntryStats(user.id, user.creation_time),
      supabase
        .from('ai_conversations')
        .select('id, creation_time, prompt_type, user_message, assistant_message')
        .eq('entry_id', user.id)
        .order('creation_time', { ascending: true }),
      supabase
        .from('student_reports')
        .select('id, score, creation_time, ai_interactions_count, time_spent_minutes, report_json')
        .eq('entry_id', user.id)
        .maybeSingle(),
    ]);

    if (conversationsResult.error) {
      res.status(500).json({ error: conversationsResult.error.message });
      return;
    }

    if (reportResult.error) {
      res.status(500).json({ error: reportResult.error.message });
      return;
    }

    let displayLabel: string | null = null;
    if (user.is_test && user.auth_user_id) {
      const { data: authData } = await supabase.auth.admin.getUserById(user.auth_user_id);
      displayLabel = authData?.user?.email ?? user.auth_user_id;
    }

    let name: string | null = null;
    if (user.auth_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('auth_user_id', user.auth_user_id)
        .maybeSingle();
      name = profile?.name?.trim() ? profile.name : null;
    }

    res.json({
      sub: user.sub,
      name,
      content: user.content ?? null,
      is_test: user.is_test,
      note: user.note ?? null,
      teacher_feedback: user.teacher_feedback ?? null,
      test_label: displayLabel,
      ai_interactions_count: stats.aiInteractionsCount,
      snapshot_count: stats.snapshotCount,
      time_spent_minutes: reportResult.data?.time_spent_minutes ?? stats.timeSpentMinutes,
      conversations: conversationsResult.data ?? [],
      report: reportResult.data
        ? {
            id: reportResult.data.id,
            score: reportResult.data.score,
            creation_time: reportResult.data.creation_time,
            ai_interactions_count: reportResult.data.ai_interactions_count,
            time_spent_minutes: reportResult.data.time_spent_minutes,
            ...reportResult.data.report_json,
          }
        : null,
    });
  },
);

/**
 * POST /v1/exercise/:exercise_sub/participant/:user_sub/report
 * Generates or regenerates an AI student report and score.
 */
router.post(
  '/exercise/:exercise_sub/participant/:user_sub/report',
  requireTeacher,
  async (req: Request<{ exercise_sub: string; user_sub: string }>, res: Response) => {
    const { exercise_sub, user_sub } = req.params;
    const exercise = await resolveExercise(exercise_sub);
    if (!exercise) {
      res.status(404).json({ error: 'Exercise not found' });
      return;
    }

    const user = await resolveEntry(exercise.id, user_sub);
    if (!user) {
      res.status(404).json({ error: 'Participant not found' });
      return;
    }

    const [snapshotsResult, conversationsResult, stats] = await Promise.all([
      supabase
        .from('entry_snapshots')
        .select('creation_time, content')
        .eq('entry_id', user.id)
        .order('creation_time', { ascending: true }),
      supabase
        .from('ai_conversations')
        .select('prompt_type, user_message, assistant_message, creation_time')
        .eq('entry_id', user.id)
        .order('creation_time', { ascending: true }),
      getEntryStats(user.id, user.creation_time),
    ]);

    if (snapshotsResult.error) {
      res.status(500).json({ error: snapshotsResult.error.message });
      return;
    }

    if (conversationsResult.error) {
      res.status(500).json({ error: conversationsResult.error.message });
      return;
    }

    const latestCode = user.content ?? snapshotsResult.data?.[snapshotsResult.data.length - 1]?.content ?? '';
    const snapshots = (snapshotsResult.data ?? []).map((s) => ({
      creation_time: s.creation_time,
      content_preview: s.content.slice(0, 400),
    }));
    const conversations = (conversationsResult.data ?? []).map((c) => ({
      prompt_type: c.prompt_type,
      user_message: c.user_message,
      assistant_message: c.assistant_message,
      creation_time: c.creation_time,
    }));

    const fallbackReport: StudentReportPayload = {
      summary: 'Automatic report fallback generated because AI output was unavailable.',
      ai_interactions: conversations
        .slice(0, 6)
        .map((c) => c.assistant_message)
        .filter((m) => !!m)
        .map((m) => m.slice(0, 120)),
      score_deductions: [],
      strengths: [],
      improvements: [],
    };

    const prompt = `You are evaluating a student's coding exercise.
Return valid JSON with exactly this shape:
{
  "summary": string,
  "ai_interactions": string[],
  "score_deductions": [{ "reason": string, "points": number }],
  "strengths": string[],
  "improvements": string[]
}

Rules:
- Keep score_deductions points positive integers (0..30 each)
- score_deductions should explain why points were lost
- ai_interactions should summarize key topics/questions from tutor chats
- Do not use markdown

Exercise content:
${exercise.content ?? ''}

Latest student code:
${latestCode}

Autosave history (truncated snapshots):
${JSON.stringify(snapshots)}

Saved AI conversations:
${JSON.stringify(conversations)}
`;

    const rawReport = await generateJsonWithAI<StudentReportPayload>(prompt, fallbackReport);
    const report = normalizeStudentReport(rawReport);
    const totalPointsLost = report.score_deductions.reduce((sum, d) => sum + d.points, 0);
    const score = Math.max(0, 100 - totalPointsLost);
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      entry_id: user.id,
      exercise_id: exercise.id,
      creation_time: now,
      score,
      time_spent_minutes: stats.timeSpentMinutes,
      ai_interactions_count: stats.aiInteractionsCount,
      report_json: {
        summary: report.summary,
        ai_interactions: report.ai_interactions,
        score_deductions: report.score_deductions,
        strengths: report.strengths,
        improvements: report.improvements,
        total_points_lost: totalPointsLost,
      },
    };

    const [{ error: reportError }, { error: noteError }] = await Promise.all([
      supabase.from('student_reports').upsert(payload, { onConflict: 'entry_id' }),
      supabase.from('entries').update({ note: score, submitted_at: now }).eq('id', user.id),
    ]);

    if (reportError) {
      res.status(500).json({ error: reportError.message });
      return;
    }

    if (noteError) {
      res.status(500).json({ error: noteError.message });
      return;
    }

    res.json({
      sub: user.sub,
      score,
      ai_interactions_count: stats.aiInteractionsCount,
      time_spent_minutes: stats.timeSpentMinutes,
      summary: report.summary,
      ai_interactions: report.ai_interactions,
      score_deductions: report.score_deductions,
      strengths: report.strengths,
      improvements: report.improvements,
      total_points_lost: totalPointsLost,
    });
  },
);

/**
 * GET /v1/exercise/:exercise_sub/report
 * Returns previously generated exercise-level report.
 */
router.get('/exercise/:exercise_sub/report', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise = await resolveExercise(req.params.exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data, error } = await supabase
    .from('exercise_reports')
    .select('id, creation_time, report_json')
    .eq('exercise_id', exercise.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (!data) {
    res.json({ report: null });
    return;
  }

  res.json({
    report: {
      id: data.id,
      creation_time: data.creation_time,
      ...data.report_json,
    },
  });
});

/**
 * POST /v1/exercise/:exercise_sub/report
 * Generates or regenerates exercise-level AI report across student reports.
 */
router.post('/exercise/:exercise_sub/report', requireTeacher, async (req: Request<{ exercise_sub: string }>, res: Response) => {
  const exercise = await resolveExercise(req.params.exercise_sub);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }

  const { data: reports, error: reportsError } = await supabase
    .from('student_reports')
    .select('entry_id, score, time_spent_minutes, ai_interactions_count, report_json')
    .eq('exercise_id', exercise.id);

  if (reportsError) {
    res.status(500).json({ error: reportsError.message });
    return;
  }

  const reportRows = reports ?? [];
  if (reportRows.length === 0) {
    res.status(400).json({ error: 'No student reports found. Generate at least one student report first.' });
    return;
  }

  const entryIds = reportRows.map((r) => r.entry_id);
  const { data: entries } = await supabase
    .from('entries')
    .select('id, sub, is_test')
    .in('id', entryIds);

  const entryMap = new Map((entries ?? []).map((e) => [e.id, e]));
  const dataset = reportRows
    .map((r) => {
      const entry = entryMap.get(r.entry_id);
      if (!entry || entry.is_test) return null;
      return {
        student_sub: entry.sub,
        score: r.score,
        time_spent_minutes: r.time_spent_minutes,
        ai_interactions_count: r.ai_interactions_count,
        report: r.report_json,
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  if (dataset.length === 0) {
    res.status(400).json({ error: 'No non-test student reports available.' });
    return;
  }

  const scores = dataset.map((d) => d.score);
  const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / Math.max(scores.length, 1));
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const fallback = {
    overview: `Generated fallback report for ${dataset.length} students.`,
    class_strengths: [],
    class_improvements: [],
    common_ai_topics: [],
    score_distribution: {
      avg: avgScore,
      min: minScore,
      max: maxScore,
    },
    per_student_highlights: dataset.slice(0, 10).map((d) => ({
      student_sub: d.student_sub,
      score: d.score,
      highlight: 'Report available.',
    })),
  };

  const prompt = `You are a teaching analytics assistant.
Return JSON only with this exact structure:
{
  "overview": string,
  "class_strengths": string[],
  "class_improvements": string[],
  "common_ai_topics": string[],
  "score_distribution": { "avg": number, "min": number, "max": number },
  "per_student_highlights": [{ "student_sub": string, "score": number, "highlight": string }]
}

Use this data:
${JSON.stringify(dataset)}
`;

  const aiReport = await generateJsonWithAI(prompt, fallback);
  const now = Math.floor(Date.now() / 1000);

  const { error: upsertError } = await supabase.from('exercise_reports').upsert(
    {
      exercise_id: exercise.id,
      creation_time: now,
      report_json: aiReport,
    },
    { onConflict: 'exercise_id' },
  );

  if (upsertError) {
    res.status(500).json({ error: upsertError.message });
    return;
  }

  res.json({ report: aiReport });
});

export default router;
