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

export interface User {
  sub: string
  exercise_sub: string
  creation_time: number
  is_test: boolean
  /** Previously saved code for this enrollment, null on first visit */
  saved_content: string | null
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
  content?: string | null
  is_test: boolean
  note?: number | null
  test_label?: string | null
}

export interface AppConfig {
  pushIntervalMs: number
}

export interface UserProfile {
  auth_user_id: string
  is_teacher: boolean
  is_admin: boolean
  organisation_id: string | null
}

export interface Organisation {
  id: string
  /** Array of auth.users UUIDs that have admin access to this org */
  admins: string[]
  /** Arbitrary JSON data stored for the organisation */
  data: Record<string, unknown>
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
 */
export async function getProfile(): Promise<UserProfile> {
  return apiCall<UserProfile>('/v1/profile/me')
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
} {
  return JSON.parse(content)
}

export async function getAllParticipantsWithDetails(exerciseId: string): Promise<Participant[]> {
  const participantIds = await getExerciseParticipants(exerciseId)
  const participants = await Promise.all(
    participantIds.map((userId) => getExerciseParticipant(exerciseId, userId)),
  )
  return participants
}

// ============================================
// ADMIN — ORGANISATIONS
// ============================================

export async function getOrganisations(): Promise<Organisation[]> {
  return apiCall<Organisation[]>('/v1/admin/organisations')
}

export async function createOrganisation(
  admins: string[],
  data: Record<string, unknown>,
): Promise<Organisation> {
  return apiCall<Organisation>('/v1/admin/organisations/new', 'POST', { admins, data })
}

export async function getOrganisation(orgId: string): Promise<Organisation> {
  return apiCall<Organisation>(`/v1/admin/organisation/${orgId}`)
}

export async function updateOrganisation(
  orgId: string,
  payload: { admins?: string[]; data?: Record<string, unknown> },
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
  payload: { is_teacher?: boolean; is_admin?: boolean; organisation_id?: string | null },
): Promise<UserProfile> {
  return apiCall<UserProfile>(`/v1/admin/profile/${authUserId}/update`, 'POST', payload)
}
