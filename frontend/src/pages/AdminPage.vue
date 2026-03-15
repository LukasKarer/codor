<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Building2,
  Users,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  ChevronRight,
  ArrowLeft,
  Shield,
  LogOut,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { toast } from 'vue-sonner'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/stores/app'
import type { Organisation, UserProfile } from '@/lib/api'
import {
  getOrganisations,
  createOrganisation,
  updateOrganisation,
  deleteOrganisation,
  getOrganisationMembers,
  getProfiles,
  updateProfile,
} from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────
type Tab = 'organisations' | 'profiles'

// ─── State ──────────────────────────────────────────────────
const router = useRouter()
const store = useAppStore()

const activeTab = ref<Tab>('organisations')
const loading = ref(false)

// Organisations
const organisations = ref<Organisation[]>([])
const selectedOrg = ref<Organisation | null>(null)
const orgMembers = ref<UserProfile[]>([])

// Profiles
const profiles = ref<UserProfile[]>([])

// ─── Modals ─────────────────────────────────────────────────
const showOrgModal = ref(false)
const orgModalMode = ref<'create' | 'edit'>('create')
const orgForm = ref<{ admins: string; data: string }>({ admins: '', data: '{}' })
const orgFormError = ref('')

const showProfileModal = ref(false)
const profileEditTarget = ref<UserProfile | null>(null)
const profileForm = ref<{
  is_teacher: boolean
  is_admin: boolean
  organisation_id: string
}>({ is_teacher: false, is_admin: false, organisation_id: '' })

// ─── Load data ───────────────────────────────────────────────
async function loadOrganisations() {
  loading.value = true
  try {
    organisations.value = await getOrganisations()
  } catch (e: unknown) {
    toast.error('Failed to load organisations: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

async function loadProfiles() {
  loading.value = true
  try {
    profiles.value = await getProfiles()
  } catch (e: unknown) {
    toast.error('Failed to load profiles: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

async function selectOrg(org: Organisation) {
  selectedOrg.value = org
  try {
    orgMembers.value = await getOrganisationMembers(org.id)
  } catch {
    orgMembers.value = []
  }
}

onMounted(() => {
  loadOrganisations()
  loadProfiles()
})

// ─── Org helpers ────────────────────────────────────────────
function openCreateOrg() {
  orgModalMode.value = 'create'
  orgForm.value = { admins: '', data: '{}' }
  orgFormError.value = ''
  showOrgModal.value = true
}

function openEditOrg(org: Organisation) {
  orgModalMode.value = 'edit'
  orgForm.value = {
    admins: org.admins.join(', '),
    data: JSON.stringify(org.data, null, 2),
  }
  orgFormError.value = ''
  selectedOrg.value = org
  showOrgModal.value = true
}

async function submitOrgForm() {
  orgFormError.value = ''
  let parsedData: Record<string, unknown>
  let parsedAdmins: string[]
  try {
    parsedData = JSON.parse(orgForm.value.data || '{}')
  } catch {
    orgFormError.value = 'Data field must be valid JSON'
    return
  }
  parsedAdmins = orgForm.value.admins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    if (orgModalMode.value === 'create') {
      const created = await createOrganisation(parsedAdmins, parsedData)
      organisations.value.push(created)
      toast.success('Organisation created')
    } else if (selectedOrg.value) {
      const updated = await updateOrganisation(selectedOrg.value.id, {
        admins: parsedAdmins,
        data: parsedData,
      })
      const idx = organisations.value.findIndex((o) => o.id === updated.id)
      if (idx !== -1) organisations.value[idx] = updated
      if (selectedOrg.value.id === updated.id) selectedOrg.value = updated
      toast.success('Organisation updated')
    }
    showOrgModal.value = false
  } catch (e: unknown) {
    toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleDeleteOrg(org: Organisation) {
  if (!confirm(`Delete organisation ${org.id}? This cannot be undone.`)) return
  try {
    await deleteOrganisation(org.id)
    organisations.value = organisations.value.filter((o) => o.id !== org.id)
    if (selectedOrg.value?.id === org.id) selectedOrg.value = null
    toast.success('Organisation deleted')
  } catch (e: unknown) {
    toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ─── Profile helpers ─────────────────────────────────────────
function openEditProfile(profile: UserProfile) {
  profileEditTarget.value = profile
  profileForm.value = {
    is_teacher: profile.is_teacher,
    is_admin: profile.is_admin,
    organisation_id: profile.organisation_id ?? '',
  }
  showProfileModal.value = true
}

async function submitProfileForm() {
  if (!profileEditTarget.value) return
  try {
    const updated = await updateProfile(profileEditTarget.value.auth_user_id, {
      is_teacher: profileForm.value.is_teacher,
      is_admin: profileForm.value.is_admin,
      organisation_id: profileForm.value.organisation_id.trim() || null,
    })
    const idx = profiles.value.findIndex(
      (p) => p.auth_user_id === updated.auth_user_id,
    )
    if (idx !== -1) profiles.value[idx] = updated
    showProfileModal.value = false
    toast.success('Profile updated')
  } catch (e: unknown) {
    toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ─── Misc ────────────────────────────────────────────────────
const orgById = computed(() => {
  const map: Record<string, Organisation> = {}
  organisations.value.forEach((o) => (map[o.id] = o))
  return map
})

async function handleSignOut() {
  await supabase.auth.signOut()
  store.user = null
  store.session = null
  router.push('/login')
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <!-- Header -->
    <header class="border-b border-border px-6 py-4 shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-orange-500"
          >
            <Shield class="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">Admin Panel</h1>
            <p class="text-xs text-muted-foreground">Organisations &amp; Users</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="store.user?.email" class="text-xs text-muted-foreground hidden sm:block">
            {{ store.user.email }}
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            title="Sign out"
            @click="handleSignOut"
          >
            <LogOut class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>

    <!-- Tab bar -->
    <div class="border-b border-border px-6 shrink-0">
      <nav class="flex gap-0">
        <button
          v-for="tab in (['organisations', 'profiles'] as const)"
          :key="tab"
          class="px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors"
          :class="
            activeTab === tab
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </nav>
    </div>

    <!-- Content -->
    <main class="flex-1 overflow-auto p-6">

      <!-- ── ORGANISATIONS TAB ── -->
      <div v-if="activeTab === 'organisations'" class="h-full flex gap-6">

        <!-- Left: list -->
        <div class="w-80 shrink-0 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">Organisations</h2>
            <Button size="sm" @click="openCreateOrg">
              <Plus class="h-4 w-4 mr-1" /> New
            </Button>
          </div>

          <div v-if="loading" class="text-sm text-muted-foreground">Loading…</div>
          <div v-else-if="organisations.length === 0" class="text-sm text-muted-foreground">
            No organisations yet.
          </div>

          <div
            v-for="org in organisations"
            :key="org.id"
            class="group flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/50"
            :class="selectedOrg?.id === org.id ? 'bg-muted' : ''"
            @click="selectOrg(org)"
          >
            <Building2 class="h-4 w-4 shrink-0 text-muted-foreground" />
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono truncate text-foreground">{{ org.id }}</p>
              <p class="text-xs text-muted-foreground">{{ org.admins.length }} admin(s)</p>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <!-- Right: detail -->
        <div class="flex-1 min-w-0">
          <div v-if="!selectedOrg" class="flex h-full items-center justify-center text-muted-foreground text-sm">
            Select an organisation to view details
          </div>

          <div v-else class="space-y-6">
            <!-- Org header -->
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs text-muted-foreground mb-1">Organisation ID</p>
                <p class="font-mono text-sm break-all">{{ selectedOrg.id }}</p>
              </div>
              <div class="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" @click="openEditOrg(selectedOrg)">
                  <Pencil class="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  @click="handleDeleteOrg(selectedOrg)"
                >
                  <Trash2 class="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>

            <!-- Admins -->
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">Admin Users</CardTitle>
                <CardDescription class="text-xs">auth.users UUIDs with admin access</CardDescription>
              </CardHeader>
              <CardContent>
                <div v-if="selectedOrg.admins.length === 0" class="text-xs text-muted-foreground">
                  No admins assigned
                </div>
                <ul v-else class="space-y-1">
                  <li
                    v-for="uid in selectedOrg.admins"
                    :key="uid"
                    class="font-mono text-xs bg-muted rounded px-2 py-1"
                  >
                    {{ uid }}
                  </li>
                </ul>
              </CardContent>
            </Card>

            <!-- Data -->
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">Data (JSON)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre class="text-xs bg-muted rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">{{ JSON.stringify(selectedOrg.data, null, 2) }}</pre>
              </CardContent>
            </Card>

            <!-- Members -->
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">Members</CardTitle>
                <CardDescription class="text-xs">Profiles with this organisation_id</CardDescription>
              </CardHeader>
              <CardContent>
                <div v-if="orgMembers.length === 0" class="text-xs text-muted-foreground">
                  No members found
                </div>
                <table v-else class="w-full text-xs">
                  <thead>
                    <tr class="text-left text-muted-foreground border-b border-border">
                      <th class="pb-1 pr-4 font-medium">User ID</th>
                      <th class="pb-1 pr-4 font-medium">Teacher</th>
                      <th class="pb-1 font-medium">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="m in orgMembers"
                      :key="m.auth_user_id"
                      class="border-b border-border/50 last:border-0"
                    >
                      <td class="py-1.5 pr-4 font-mono truncate max-w-[200px]">{{ m.auth_user_id }}</td>
                      <td class="py-1.5 pr-4">
                        <Check v-if="m.is_teacher" class="h-3.5 w-3.5 text-green-500" />
                        <X v-else class="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                      <td class="py-1.5">
                        <Check v-if="m.is_admin" class="h-3.5 w-3.5 text-green-500" />
                        <X v-else class="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <!-- ── PROFILES TAB ── -->
      <div v-if="activeTab === 'profiles'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">User Profiles</h2>
          <Button size="sm" variant="outline" @click="loadProfiles">Refresh</Button>
        </div>

        <div v-if="loading" class="text-sm text-muted-foreground">Loading…</div>
        <div v-else-if="profiles.length === 0" class="text-sm text-muted-foreground">
          No profiles found.
        </div>

        <div v-else class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted/50 text-left text-xs text-muted-foreground">
                <th class="px-4 py-2 font-medium">User ID</th>
                <th class="px-4 py-2 font-medium">Teacher</th>
                <th class="px-4 py-2 font-medium">Admin</th>
                <th class="px-4 py-2 font-medium">Organisation</th>
                <th class="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="profile in profiles"
                :key="profile.auth_user_id"
                class="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td class="px-4 py-2 font-mono text-xs max-w-[220px] truncate">
                  {{ profile.auth_user_id }}
                </td>
                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="profile.is_teacher ? 'bg-blue-500/15 text-blue-600' : 'bg-muted text-muted-foreground'"
                  >
                    {{ profile.is_teacher ? 'Yes' : 'No' }}
                  </span>
                </td>
                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="profile.is_admin ? 'bg-red-500/15 text-red-600' : 'bg-muted text-muted-foreground'"
                  >
                    {{ profile.is_admin ? 'Yes' : 'No' }}
                  </span>
                </td>
                <td class="px-4 py-2 text-xs font-mono text-muted-foreground max-w-[180px] truncate">
                  <span v-if="profile.organisation_id">
                    {{ profile.organisation_id }}
                  </span>
                  <span v-else class="italic">—</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" @click="openEditProfile(profile)">
                    <Pencil class="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>

  <!-- ── ORG MODAL ── -->
  <Transition name="fade">
    <div
      v-if="showOrgModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showOrgModal = false"
    >
      <Card class="w-full max-w-lg mx-4">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>
              {{ orgModalMode === 'create' ? 'New Organisation' : 'Edit Organisation' }}
            </CardTitle>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="showOrgModal = false">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <CardDescription v-if="orgModalMode === 'edit'" class="font-mono text-xs break-all">
            {{ selectedOrg?.id }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-1.5">
            <Label for="org-admins">Admin User IDs</Label>
            <Input
              id="org-admins"
              v-model="orgForm.admins"
              placeholder="uuid1, uuid2, …"
            />
            <p class="text-xs text-muted-foreground">Comma-separated auth.users UUIDs</p>
          </div>
          <div class="space-y-1.5">
            <Label for="org-data">Data (JSON)</Label>
            <textarea
              id="org-data"
              v-model="orgForm.data"
              rows="6"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              placeholder="{}"
            />
          </div>
          <p v-if="orgFormError" class="text-xs text-destructive">{{ orgFormError }}</p>
          <Button class="w-full" @click="submitOrgForm">
            <Check class="h-4 w-4 mr-2" />
            {{ orgModalMode === 'create' ? 'Create' : 'Save Changes' }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </Transition>

  <!-- ── PROFILE EDIT MODAL ── -->
  <Transition name="fade">
    <div
      v-if="showProfileModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="showProfileModal = false"
    >
      <Card class="w-full max-w-md mx-4">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>Edit Profile</CardTitle>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="showProfileModal = false">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <CardDescription class="font-mono text-xs break-all">
            {{ profileEditTarget?.auth_user_id }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex items-center gap-3">
            <input
              id="edit-is-teacher"
              type="checkbox"
              v-model="profileForm.is_teacher"
              class="h-4 w-4 rounded border-input"
            />
            <Label for="edit-is-teacher">Is Teacher</Label>
          </div>
          <div class="flex items-center gap-3">
            <input
              id="edit-is-admin"
              type="checkbox"
              v-model="profileForm.is_admin"
              class="h-4 w-4 rounded border-input"
            />
            <Label for="edit-is-admin">Is Admin</Label>
          </div>
          <div class="space-y-1.5">
            <Label for="edit-org-id">Organisation ID</Label>
            <Input
              id="edit-org-id"
              v-model="profileForm.organisation_id"
              placeholder="Leave blank to unset"
              list="org-datalist"
            />
            <datalist id="org-datalist">
              <option v-for="org in organisations" :key="org.id" :value="org.id" />
            </datalist>
            <p class="text-xs text-muted-foreground">UUID of the organisation, or blank to unset</p>
          </div>
          <Button class="w-full" @click="submitProfileForm">
            <Check class="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
