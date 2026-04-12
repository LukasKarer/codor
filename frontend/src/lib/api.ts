// Backend API integration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Types matching the API responses
export interface Exercise {
  sub: string
  creation_time: number
  content?: string
}

export interface ExerciseInfo extends Exercise {
  content: string
}

export interface ExamSettings {
  timeLimitMinutes?: number | null
  submitAndLock?: boolean
  aiChatMode?: 'enabled' | 'restricted' | 'disabled'
}

export interface User {
  sub: string
  exercise_sub: string
  creation_time: number
  is_test: boolean
  /** Previously saved code for this enrollment, null on first visit */
  saved_content: string | null
  /** Unix timestamp (seconds) when the student submitted; null if not yet submitted */
  submitted_at: number | null
}

export interface UserInfo {
  sub: string
  exercise_id: number
  creation_time: number
  note?: number | null
  auth_user_id: string | null
  is_test: boolean
  content: string | null
}

export interface Participant {
  sub: string
  name?: string | null
  content?: string | null
  is_test: boolean
  note?: number | null
  teacher_feedback?: string | null
  test_label?: string | null
  ai_interactions_count?: number
  snapshot_count?: number
  time_spent_minutes?: number
  has_report?: boolean
  report_score?: number | null
  report?: StudentReport | null
}

export interface AiConversation {
  id: string
  creation_time: number
  prompt_type: string
  user_message: string | null
  assistant_message: string
}

export interface ScoreDeduction {
  reason: string
  points: number
}

export interface StudentReport {
  id?: string
  score?: number
  creation_time?: number
  summary: string
  ai_interactions: string[]
  score_deductions: ScoreDeduction[]
  strengths: string[]
  improvements: string[]
  total_points_lost?: number
}

export interface ParticipantDetail extends Participant {
  ai_interactions_count: number
  snapshot_count: number
  time_spent_minutes: number
  conversations: AiConversation[]
  report: (StudentReport & { score: number; creation_time: number }) | null
}

export interface ExerciseReport {
  id?: string
  creation_time?: number
  overview: string
  class_strengths: string[]
  class_improvements: string[]
  common_ai_topics: string[]
  score_distribution: {
    avg: number
    min: number
    max: number
  }
  per_student_highlights: Array<{
    student_sub: string
    score: number
    highlight: string
  }>
}

export interface AppConfig {
  pushIntervalMs: number
}

export interface UserProfile {
  auth_user_id: string
  name: string
  is_teacher: boolean
  /** Org-level admin: can edit their own organisation */
  is_admin: boolean
  /** System-level super-admin: can edit everything */
  is_system_admin: boolean
  organisation_id: string | null
}

export interface Organisation {
  id: string
  name: string
  /** Array of auth.users UUIDs that have org-level admin access */
  admins: string[]
  /** Array of email substrings; at least one must match on signup */
  email_patterns: string[]
  /** Arbitrary JSON data stored for the organisation */
  data: Record<string, unknown>
}

/** Minimal shape returned by the public /organisations/public endpoint */
export interface PublicOrganisation {
  id: string
  name: string
  email_patterns: string[]
}

// ============================================
// INTERNAL HELPERS
// ============================================

/** Retrieve the current Supabase session token. Imported lazily to avoid circular deps. */
async function getAuthToken(): Promise<string | null> {
  const { supabase } = await import('./supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
  useFormData: boolean = false,
  requireAuth: boolean = true,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  console.log(`[API] ${method} ${url}`, body ? { body } : '')

  const headers: Record<string, string> = {}

  if (requireAuth) {
    const token = await getAuthToken()
    if (!token) throw new Error('Not authenticated')
    headers['Authorization'] = `Bearer ${token}`
  }

  const options: RequestInit = {
    method,
    mode: 'cors',
    headers,
  }

  if (body) {
    if (useFormData) {
      const formBody = new URLSearchParams()
      Object.keys(body).forEach((key) => {
        formBody.append(key, String(body[key]))
      })
      options.body = formBody
      ;(options.headers as Record<string, string>)['Content-Type'] =
        'application/x-www-form-urlencoded'
    } else {
      options.body = JSON.stringify(body)
      ;(options.headers as Record<string, string>)['Content-Type'] = 'application/json'
    }
  }

  try {
    const response = await fetch(url, options)
    console.log(`[API] Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[API] Error response:`, errorText)
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`[API] Response data:`, data)
    return data as T
  } catch (error) {
    console.error(`[API] Request failed:`, error)
    throw error
  }
}

// ============================================
// CONFIG
// ============================================

export async function getConfig(): Promise<AppConfig> {
  return apiCall<AppConfig>('/v1/config', 'GET', undefined, false, false)
}

/**
 * GET /v1/profile/me
 * Returns the current user's profile flags from the DB.
 *
 * Calls are deduplicated within a single page lifetime: concurrent callers
 * (App.vue onMounted + router guard) share one in-flight request. Call
 * invalidateProfileCache() after any mutation that changes profile fields.
 */
let _profileCache: Promise<UserProfile> | null = null

export function invalidateProfileCache(): void {
  _profileCache = null
}

export async function getProfile(): Promise<UserProfile> {
  if (!_profileCache) {
    _profileCache = apiCall<UserProfile>('/v1/profile/me').catch((err) => {
      // Don't cache failures so the next call retries
      _profileCache = null
      throw err
    })
  }
  return _profileCache
}

// ============================================
// EXERCISE ENDPOINTS
// ============================================

export async function createExercise(content: string): Promise<Exercise> {
  return apiCall<Exercise>('/v1/exercises/new', 'POST', { content }, true)
}

export async function getExerciseInfo(exerciseId: string): Promise<ExerciseInfo> {
  return apiCall<ExerciseInfo>(`/v1/exercise/${exerciseId}/info`)
}

export async function updateExercise(exerciseId: string, content: string): Promise<void> {
  await apiCall(`/v1/exercise/${exerciseId}/update`, 'POST', { content }, true)
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await apiCall(`/v1/exercise/${exerciseId}/delete`, 'DELETE')
}

export async function getExerciseParticipants(exerciseId: string): Promise<string[]> {
  return apiCall<string[]>(`/v1/exercise/${exerciseId}/participants`)
}

export async function getExerciseParticipant(
  exerciseId: string,
  userId: string,
): Promise<Participant> {
  return apiCall<Participant>(`/v1/exercise/${exerciseId}/participant/${userId}`)
}

export async function getExerciseParticipantDetail(
  exerciseId: string,
  userId: string,
): Promise<ParticipantDetail> {
  return apiCall<ParticipantDetail>(`/v1/exercise/${exerciseId}/participant/${userId}/detail`)
}

export async function saveAiInteraction(
  exerciseId: string,
  payload: {
    promptType: string
    userMessage?: string | null
    assistantMessage: string
  },
): Promise<void> {
  await apiCall(`/v1/exercise/${exerciseId}/ai-interaction`, 'POST', payload)
}

export async function generateStudentReport(
  exerciseId: string,
  userId: string,
): Promise<StudentReport & { score: number; ai_interactions_count: number; time_spent_minutes: number }> {
  return apiCall(`/v1/exercise/${exerciseId}/participant/${userId}/report`, 'POST')
}

export async function getExerciseReport(exerciseId: string): Promise<ExerciseReport | null> {
  const data = await apiCall<{ report: ExerciseReport | null }>(`/v1/exercise/${exerciseId}/report`)
  return data.report
}

export async function generateExerciseReport(exerciseId: string): Promise<ExerciseReport> {
  const data = await apiCall<{ report: ExerciseReport }>(`/v1/exercise/${exerciseId}/report`, 'POST')
  return data.report
}

/**
 * POST /v1/exercise/:exercise_sub/push
 * Pushes the current code to the backend. Auth token is sent automatically.
 */
export async function pushExerciseContent(exerciseId: string, content: string): Promise<void> {
  await apiCall(`/v1/exercise/${exerciseId}/push`, 'POST', { content })
}

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * Enroll the authenticated user into an exercise.
 * is_test=true marks the session as a teacher test run.
 */
export async function enrollUser(exerciseId: string, isTest: boolean = false): Promise<User> {
  return apiCall<User>(
    '/v1/users/new',
    'POST',
    { exercise_id: exerciseId, is_test: isTest },
    false,
  )
}

export async function getUserInfo(userId: string): Promise<UserInfo> {
  return apiCall<UserInfo>(`/v1/user/${userId}/info`)
}

export async function deleteUser(userId: string): Promise<void> {
  await apiCall(`/v1/user/${userId}/delete`, 'DELETE')
}

export async function assignUserNote(userId: string, note: number): Promise<void> {
  if (note < 0 || note > 100) {
    throw new Error('Note must be between 0 and 100')
  }
  await apiCall(`/v1/user/${userId}/note`, 'POST', { note }, false)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function serializeExerciseContent(data: {
  title: string
  code: string
  description: string
  steps: Array<{
    description: string
    lineStart: number
    lineEnd: number
  }>
  examSettings?: ExamSettings
}): string {
  return JSON.stringify(data)
}

export function parseExerciseContent(content: string): {
  title: string
  code: string
  description: string
  steps: Array<{
    description: string
    lineStart: number
    lineEnd: number
  }>
  examSettings?: ExamSettings
} {
  return JSON.parse(content)
}

/**
 * POST /v1/exercise/:exercise_sub/submit
 * Submits the student's exercise and locks further edits.
 */
export async function submitExercise(
  exerciseId: string,
  content: string,
): Promise<{ submitted_at: number }> {
  return apiCall<{ submitted_at: number }>(
    `/v1/exercise/${exerciseId}/submit`,
    'POST',
    { content },
  )
}

export async function getAllParticipantsWithDetails(exerciseId: string): Promise<Participant[]> {
  const participantIds = await getExerciseParticipants(exerciseId)
  const participants = await Promise.all(
    participantIds.map((userId) => getExerciseParticipant(exerciseId, userId)),
  )
  return participants
}

// ============================================
// PUBLIC — used on signup, no auth needed
// ============================================

export async function getPublicOrganisations(): Promise<PublicOrganisation[]> {
  return apiCall<PublicOrganisation[]>('/v1/organisations/public', 'GET', undefined, false, false)
}

/**
 * POST /v1/profile/setup
 * Saves the user's display name and organisation after signup.
 */
export async function setupProfile(name: string, organisationId: string | null): Promise<UserProfile> {
  return apiCall<UserProfile>('/v1/profile/setup', 'POST', {
    name,
    organisation_id: organisationId,
  })
}

// ============================================
// ADMIN — ORGANISATIONS
// ============================================

export async function getOrganisations(): Promise<Organisation[]> {
  return apiCall<Organisation[]>('/v1/admin/organisations')
}

export async function createOrganisation(payload: {
  name: string
  admins: string[]
  email_patterns: string[]
  data: Record<string, unknown>
}): Promise<Organisation> {
  return apiCall<Organisation>('/v1/admin/organisations/new', 'POST', payload)
}

export async function getOrganisation(orgId: string): Promise<Organisation> {
  return apiCall<Organisation>(`/v1/admin/organisation/${orgId}`)
}

export async function updateOrganisation(
  orgId: string,
  payload: {
    name?: string
    admins?: string[]
    email_patterns?: string[]
    data?: Record<string, unknown>
  },
): Promise<Organisation> {
  return apiCall<Organisation>(`/v1/admin/organisation/${orgId}/update`, 'POST', payload)
}

export async function deleteOrganisation(orgId: string): Promise<void> {
  await apiCall(`/v1/admin/organisation/${orgId}/delete`, 'DELETE')
}

export async function getOrganisationMembers(orgId: string): Promise<UserProfile[]> {
  return apiCall<UserProfile[]>(`/v1/admin/organisation/${orgId}/members`)
}

// ============================================
// ADMIN — PROFILES
// ============================================

export async function getProfiles(): Promise<UserProfile[]> {
  return apiCall<UserProfile[]>('/v1/admin/profiles')
}

export async function updateProfile(
  authUserId: string,
  payload: {
    name?: string
    is_teacher?: boolean
    is_admin?: boolean
    is_system_admin?: boolean
    organisation_id?: string | null
  },
): Promise<UserProfile> {
  return apiCall<UserProfile>(`/v1/admin/profile/${authUserId}/update`, 'POST', payload)
}

export async function saveTeacherFeedback(userSub: string, feedback: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/v1/user/${userSub}/feedback`, 'POST', { feedback })
}
