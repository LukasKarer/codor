<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Building2,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  ChevronRight,
  Shield,
  ShieldCheck,
  LogOut,
  Copy,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ThemeToggle from '@/components/ThemeToggle.vue'
import LanguageToggle from '@/components/LanguageToggle.vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { L } from '@/locales/keys'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Organisation, UserProfile } from '@/lib/api'
import {
  getOrganisations,
  createOrganisation,
  updateOrganisation,
  deleteOrganisation,
  getProfiles,
  updateProfile,
} from '@/lib/api'

const { t } = useI18n()

// ─── Types ──────────────────────────────────────────────────
type Tab = 'organisations' | 'profiles'

// ─── State ──────────────────────────────────────────────────
const router = useRouter()
const authStore = useAuthStore()

/** Whether the current user is a full system admin (not just org admin) */
const isSystemAdmin = computed(() => authStore.isSystemAdmin)

/** Label for the second tab */
const secondTabLabel = computed(() => isSystemAdmin.value ? t(L.admin.profiles) : t(L.admin.members))

const activeTab = ref<Tab>('organisations')
const loadingOrgs = ref(false)
const loadingProfiles = ref(false)

// Organisations
const organisations = ref<Organisation[]>([])
const selectedOrg = ref<Organisation | null>(null)

// Profiles / Members
const profiles = ref<UserProfile[]>([])

// ─── Modals ─────────────────────────────────────────────────
const showOrgModal = ref(false)
const orgModalMode = ref<'create' | 'edit'>('create')
const orgForm = ref({
  name: '',
  admins: '',
  email_patterns: '',
  data: '{}',
})
const orgFormError = ref('')

const showProfileModal = ref(false)
const profileEditTarget = ref<UserProfile | null>(null)
const profileForm = ref({
  name: '',
  is_teacher: false,
  is_admin: false,
  is_system_admin: false,
  organisation_id: '',
})

// ─── Load data ───────────────────────────────────────────────
async function loadOrganisations() {
  loadingOrgs.value = true
  try {
    organisations.value = await getOrganisations()
  } catch (e: unknown) {
    toast.error('Failed to load organisations: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loadingOrgs.value = false
  }
}

async function loadProfiles() {
  loadingProfiles.value = true
  try {
    profiles.value = await getProfiles()
  } catch (e: unknown) {
    toast.error('Failed to load profiles: ' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loadingProfiles.value = false
  }
}

function selectOrg(org: Organisation) {
  selectedOrg.value = org
}

onMounted(() => {
  loadOrganisations()
  loadProfiles()
})

// ─── Org helpers ────────────────────────────────────────────
function openCreateOrg() {
  orgModalMode.value = 'create'
  orgForm.value = { name: '', admins: '', email_patterns: '', data: '{}' }
  orgFormError.value = ''
  showOrgModal.value = true
}

function openEditOrg(org: Organisation) {
  orgModalMode.value = 'edit'
  orgForm.value = {
    name: org.name,
    admins: org.admins.join(', '),
    email_patterns: org.email_patterns.join(', '),
    data: JSON.stringify(org.data, null, 2),
  }
  orgFormError.value = ''
  selectedOrg.value = org
  showOrgModal.value = true
}

async function submitOrgForm() {
  orgFormError.value = ''
  let parsedData: Record<string, unknown>
  try {
    parsedData = JSON.parse(orgForm.value.data || '{}')
  } catch {
    orgFormError.value = t(L.admin.dataInvalid)
    return
  }
  const parsedAdmins = orgForm.value.admins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const parsedPatterns = orgForm.value.email_patterns
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    if (orgModalMode.value === 'create') {
      const created = await createOrganisation({
        name: orgForm.value.name.trim(),
        admins: parsedAdmins,
        email_patterns: parsedPatterns,
        data: parsedData,
      })
      organisations.value.push(created)
      toast.success(t(L.admin.orgCreated))
    } else if (selectedOrg.value) {
      const payload: Parameters<typeof updateOrganisation>[1] = {
        name: orgForm.value.name.trim(),
        email_patterns: parsedPatterns,
        data: parsedData,
      }
      // Only system admins can change the org admins list
      if (isSystemAdmin.value) {
        payload.admins = parsedAdmins
      }
      const updated = await updateOrganisation(selectedOrg.value.id, payload)
      const idx = organisations.value.findIndex((o) => o.id === updated.id)
      if (idx !== -1) organisations.value[idx] = updated
      if (selectedOrg.value.id === updated.id) selectedOrg.value = updated
      toast.success(t(L.admin.orgUpdated))
    }
    showOrgModal.value = false
  } catch (e: unknown) {
    toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
  }
}

async function handleDeleteOrg(org: Organisation) {
  if (!confirm(t(L.admin.deleteConfirm, { name: org.name }))) return
  try {
    await deleteOrganisation(org.id)
    organisations.value = organisations.value.filter((o) => o.id !== org.id)
    if (selectedOrg.value?.id === org.id) selectedOrg.value = null
    toast.success(t(L.admin.orgDeleted))
  } catch (e: unknown) {
    toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ─── Profile helpers ─────────────────────────────────────────
function openEditProfile(profile: UserProfile) {
  profileEditTarget.value = profile
  profileForm.value = {
    name: profile.name,
    is_teacher: profile.is_teacher,
    is_admin: profile.is_admin,
    is_system_admin: profile.is_system_admin,
    organisation_id: profile.organisation_id ?? '',
  }
  showProfileModal.value = true
}

async function submitProfileForm() {
  if (!profileEditTarget.value) return
  try {
    const payload: Parameters<typeof updateProfile>[1] = {
      name: profileForm.value.name,
      is_teacher: profileForm.value.is_teacher,
      // Both org admins and system admins can promote/demote org-admin status
      is_admin: profileForm.value.is_admin,
    }
    if (isSystemAdmin.value) {
      payload.is_system_admin = profileForm.value.is_system_admin
      payload.organisation_id = profileForm.value.organisation_id.trim() || null
    }
    const updated = await updateProfile(profileEditTarget.value.auth_user_id, payload)
    const idx = profiles.value.findIndex((p) => p.auth_user_id === updated.auth_user_id)
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
  authStore.logout()
  router.push('/login')
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Failed to copy'),
  )
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <!-- Header -->
    <header class="border-b border-border px-6 py-4 shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-lg"
            :class="isSystemAdmin ? 'bg-gradient-to-br from-red-600 to-orange-500' : 'bg-gradient-to-br from-blue-600 to-indigo-500'"
          >
            <ShieldCheck v-if="isSystemAdmin" class="h-5 w-5 text-white" />
            <Shield v-else class="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-foreground">{{ t(L.admin.title) }}</h1>
            <p class="text-xs text-muted-foreground">
              {{ isSystemAdmin ? t(L.admin.systemAdmin) : t(L.admin.orgAdmin) }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span v-if="authStore.user?.email" class="text-xs text-muted-foreground hidden sm:block">
            {{ authStore.user.email }}
          </span>
          <LanguageToggle />
          <ThemeToggle />
          <Button variant="ghost" size="icon" class="h-8 w-8" title="Sign out" @click="handleSignOut">
            <LogOut class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>

    <!-- Tab bar -->
    <div class="border-b border-border px-6 shrink-0">
      <nav class="flex gap-0">
        <button
          class="px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors"
          :class="activeTab === 'organisations' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'organisations'"
        >
          {{ t(L.admin.organisations) }}
        </button>
        <button
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === 'profiles' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'profiles'"
        >
          {{ secondTabLabel }}
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
            <h2 class="text-base font-semibold">{{ t(L.admin.organisations) }}</h2>
            <Button v-if="isSystemAdmin" size="sm" @click="openCreateOrg">
              <Plus class="h-4 w-4 mr-1" /> {{ t(L.admin.new) }}
            </Button>
          </div>

          <div v-if="loadingOrgs" class="text-sm text-muted-foreground">{{ t(L.admin.loading) }}</div>
          <div v-else-if="organisations.length === 0" class="text-sm text-muted-foreground">
            {{ t(L.admin.noOrganisations) }}
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
              <p class="text-sm font-medium truncate text-foreground">{{ org.name || '(unnamed)' }}</p>
              <p class="text-xs text-muted-foreground font-mono truncate">{{ org.id }}</p>
            </div>
            <button
              class="shrink-0 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all"
              title="Copy org ID"
              @click.stop="copyToClipboard(org.id, 'Org ID')"
            >
              <Copy class="h-3.5 w-3.5" />
            </button>
            <ChevronRight class="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <!-- Right: detail -->
        <div class="flex-1 min-w-0">
          <div
            v-if="!selectedOrg"
            class="flex h-full items-center justify-center text-muted-foreground text-sm"
          >
            {{ t(L.admin.selectOrganisation) }}
          </div>

          <div v-else class="space-y-6">
            <!-- Org header -->
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold">{{ selectedOrg.name || '(unnamed)' }}</h2>
                <p class="text-xs text-muted-foreground font-mono mt-0.5">{{ selectedOrg.id }}</p>
              </div>
              <div class="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" @click="openEditOrg(selectedOrg)">
                  <Pencil class="h-4 w-4 mr-1" /> {{ t(L.admin.edit) }}
                </Button>
                <Button
                  v-if="isSystemAdmin"
                  size="sm"
                  variant="destructive"
                  @click="handleDeleteOrg(selectedOrg)"
                >
                  <Trash2 class="h-4 w-4 mr-1" /> {{ t(L.admin.delete) }}
                </Button>
              </div>
            </div>

            <!-- Email patterns -->
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">{{ t(L.admin.emailPatterns) }}</CardTitle>
                <CardDescription class="text-xs">
                  {{ t(L.admin.emailPatternsDescription) }}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div v-if="selectedOrg.email_patterns.length === 0" class="text-xs text-muted-foreground">
                  {{ t(L.admin.noRestrictions) }}
                </div>
                <div v-else class="flex flex-wrap gap-1.5">
                  <span
                    v-for="p in selectedOrg.email_patterns"
                    :key="p"
                    class="inline-flex items-center rounded-full bg-blue-500/10 text-blue-600 text-xs px-2 py-0.5 font-mono"
                  >
                    {{ p }}
                  </span>
                </div>
              </CardContent>
            </Card>

            <!-- Admins (system admin sees the list; org-admin just sees their own role) -->
            <!-- Card v-if="isSystemAdmin"-->
            <Card>
              <CardHeader class="pb-2">
                <CardTitle class="text-sm">{{ t(L.admin.orgAdminUsers) }}</CardTitle>
                <CardDescription class="text-xs">{{ t(L.admin.orgAdminUsersDescription) }}</CardDescription>
              </CardHeader>
              <CardContent>
                <div v-if="selectedOrg.admins.length === 0" class="text-xs text-muted-foreground">
                  {{ t(L.admin.noAdmins) }}
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
                <CardTitle class="text-sm">{{ t(L.admin.dataJson) }}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre class="text-xs bg-muted rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">{{ JSON.stringify(selectedOrg.data, null, 2) }}</pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <!-- ── PROFILES / MEMBERS TAB ── -->
      <div v-if="activeTab === 'profiles'" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">{{ secondTabLabel }}</h2>
          <Button size="sm" variant="outline" @click="loadProfiles">{{ t(L.admin.refresh) }}</Button>
        </div>

        <div v-if="loadingProfiles" class="text-sm text-muted-foreground">{{ t(L.admin.loading) }}</div>
        <div v-else-if="profiles.length === 0" class="text-sm text-muted-foreground">
          {{ t(L.admin.noProfiles) }}
        </div>

        <div v-else class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-muted/50 text-left text-xs text-muted-foreground">
                <th class="px-4 py-2 font-medium">{{ t(L.admin.nameColumn) }}</th>
                <th class="px-4 py-2 font-medium">{{ t(L.admin.teacherColumn) }}</th>
                <th class="px-4 py-2 font-medium">{{ t(L.admin.orgAdminColumn) }}</th>
                <th v-if="isSystemAdmin" class="px-4 py-2 font-medium">{{ t(L.admin.sysAdminColumn) }}</th>
                <th v-if="isSystemAdmin" class="px-4 py-2 font-medium">{{ t(L.admin.organisationColumn) }}</th>
                <th class="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="profile in profiles"
                :key="profile.auth_user_id"
                class="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td class="px-4 py-2">
                  <p class="font-medium">{{ profile.name || '—' }}</p>
                  <div class="flex items-center gap-1 mt-0.5">
                    <p class="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                      {{ profile.auth_user_id }}
                    </p>
                    <button
                      class="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Copy user ID"
                      @click="copyToClipboard(profile.auth_user_id, 'User ID')"
                    >
                      <Copy class="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="profile.is_teacher ? 'bg-blue-500/15 text-blue-600' : 'bg-muted text-muted-foreground'"
                  >{{ profile.is_teacher ? 'Yes' : 'No' }}</span>
                </td>
                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="profile.is_admin ? 'bg-indigo-500/15 text-indigo-600' : 'bg-muted text-muted-foreground'"
                  >{{ profile.is_admin ? 'Yes' : 'No' }}</span>
                </td>
                <td v-if="isSystemAdmin" class="px-4 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="profile.is_system_admin ? 'bg-red-500/15 text-red-600' : 'bg-muted text-muted-foreground'"
                  >{{ profile.is_system_admin ? 'Yes' : 'No' }}</span>
                </td>
                <td v-if="isSystemAdmin" class="px-4 py-2 text-xs text-muted-foreground max-w-[180px] truncate">
                  <span v-if="profile.organisation_id && orgById[profile.organisation_id]">
                    {{ orgById[profile.organisation_id]?.name || profile.organisation_id }}
                  </span>
                  <span v-else-if="profile.organisation_id" class="font-mono">
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
      <Card class="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>
              {{ orgModalMode === 'create' ? t(L.admin.newOrganisation) : t(L.admin.editOrganisation) }}
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
          <!-- Name -->
          <div class="space-y-1.5">
            <Label for="org-name">{{ t(L.admin.name) }}</Label>
            <Input id="org-name" v-model="orgForm.name" :placeholder="t(L.admin.namePlaceholder)" />
          </div>

          <!-- Email patterns -->
          <div class="space-y-1.5">
            <Label for="org-patterns">{{ t(L.admin.emailPatterns) }}</Label>
            <Input
              id="org-patterns"
              v-model="orgForm.email_patterns"
              placeholder="@acme.com, @students.acme.com"
            />
            <p class="text-xs text-muted-foreground">
              {{ t(L.admin.emailPatternsNote) }}
            </p>
          </div>

          <!-- Admin user IDs (system admin only) -->
          <!-- div v-if="isSystemAdmin" class="space-y-1.5" -->
          <div class="space-y-1.5">
            <Label for="org-admins">{{ t(L.admin.orgAdminIds) }}</Label>
            <Input id="org-admins" v-model="orgForm.admins" :placeholder="t(L.admin.orgAdminIdsPlaceholder)" />
            <p class="text-xs text-muted-foreground">{{ t(L.admin.orgAdminIdsNote) }}</p>
          </div>

          <!-- Data JSON -->
          <div class="space-y-1.5">
            <Label for="org-data">{{ t(L.admin.dataJson) }}</Label>
            <textarea
              id="org-data"
              v-model="orgForm.data"
              rows="5"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
              placeholder="{}"
            />
          </div>

          <p v-if="orgFormError" class="text-xs text-destructive">{{ orgFormError }}</p>
          <Button class="w-full" @click="submitOrgForm">
            <Check class="h-4 w-4 mr-2" />
            {{ orgModalMode === 'create' ? t(L.admin.new) : t(L.admin.saveChanges) }}
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
            <CardTitle>{{ t(L.admin.editProfile) }}</CardTitle>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="showProfileModal = false">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <CardDescription class="font-mono text-xs break-all">
            {{ profileEditTarget?.auth_user_id }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- Name -->
          <div class="space-y-1.5">
            <Label for="edit-name">{{ t(L.admin.name) }}</Label>
            <Input id="edit-name" v-model="profileForm.name" :placeholder="t(L.admin.name)" />
          </div>

          <!-- Is Teacher -->
          <div class="flex items-center gap-3">
            <input
              id="edit-is-teacher"
              type="checkbox"
              v-model="profileForm.is_teacher"
              class="h-4 w-4 rounded border-input"
            />
            <Label for="edit-is-teacher">{{ t(L.admin.isTeacher) }}</Label>
          </div>

          <!-- Is Org Admin (both org admins and system admins can toggle this) -->
          <div class="flex items-center gap-3">
            <input
              id="edit-is-admin"
              type="checkbox"
              v-model="profileForm.is_admin"
              class="h-4 w-4 rounded border-input"
            />
            <Label for="edit-is-admin">{{ t(L.admin.isOrgAdmin) }}</Label>
          </div>

          <!-- Is System Admin (system admin only) -->
          <div v-if="isSystemAdmin" class="flex items-center gap-3">
            <input
              id="edit-is-system-admin"
              type="checkbox"
              v-model="profileForm.is_system_admin"
              class="h-4 w-4 rounded border-input"
            />
            <Label for="edit-is-system-admin" class="text-red-600">{{ t(L.admin.isSysAdmin) }}</Label>
          </div>

          <!-- Organisation (system admin only) -->
          <div v-if="isSystemAdmin" class="space-y-1.5">
            <Label for="edit-org-id">{{ t(L.admin.organisationColumn) }}</Label>
            <select
              id="edit-org-id"
              v-model="profileForm.organisation_id"
              class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
            >
              <option value="">{{ t(L.admin.noOrg) }}</option>
              <option v-for="org in organisations" :key="org.id" :value="org.id">
                {{ org.name || org.id }}
              </option>
            </select>
          </div>

          <Button class="w-full" @click="submitProfileForm">
            <Check class="h-4 w-4 mr-2" />
            {{ t(L.admin.saveChanges) }}
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
