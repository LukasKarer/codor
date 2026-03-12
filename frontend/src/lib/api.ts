// Backend API integration for https://gdg-api.callec.net/
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
  academic_id: number
  creation_time: number
}

export interface UserInfo extends User {
  exercise_id: string
  note?: number
}

export interface Participant {
  sub: string
  academic_id: number
  content?: string
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: any,
  useFormData: boolean = false,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  console.log(`[API] ${method} ${url}`, body ? { body } : '')

  const options: RequestInit = {
    method,
    mode: 'cors',
  }

  if (body) {
    if (useFormData) {
      const formBody = new URLSearchParams()
      Object.keys(body).forEach((key) => {
        formBody.append(key, body[key])
      })
      options.body = formBody
      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    } else {
      options.body = JSON.stringify(body)
      options.headers = {
        'Content-Type': 'application/json',
      }
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
    return data
  } catch (error) {
    console.error(`[API] Request failed:`, error)
    throw error
  }
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

// ============================================
// USER ENDPOINTS
// ============================================

export async function createUser(exerciseId: string, academicId: number): Promise<User> {
  return apiCall<User>(
    '/v1/users/new',
    'POST',
    { exercise_id: exerciseId, academic_id: academicId },
    true,
  )
}

export async function getUserInfo(userId: string): Promise<UserInfo> {
  return apiCall<UserInfo>(`/v1/user/${userId}/info`)
}

export async function pushUserContent(userId: string, content: string): Promise<void> {
  await apiCall(`/v1/user/${userId}/push`, 'POST', { content }, true)
}

export async function deleteUser(userId: string): Promise<void> {
  await apiCall(`/v1/user/${userId}/delete`, 'DELETE')
}

export async function assignUserNote(userId: string, note: number): Promise<void> {
  if (note < 0 || note > 100) {
    throw new Error('Note must be between 0 and 100')
  }
  await apiCall(`/v1/user/${userId}/note`, 'POST', { note }, true)
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
