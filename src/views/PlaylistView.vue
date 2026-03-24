<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Tickets, Star, Lock, Unlock, Delete, Edit } from '@element-plus/icons-vue'
import { ApiError } from '@/api/request'
import {
  getMyPlaylists,
  createPlaylist,
  deletePlaylist,
  pageFavoritePlaylists,
  removeFavoritePlaylist,
  type PlaylistItem,
  type PlaylistMetadata,
} from '@/api/playlist'
import { useUserStore } from '@/stores/user'
import LoginDialog from '@/components/LoginDialog.vue'

const router = useRouter()
const userStore = useUserStore()

// ─── tab ───
type Tab = 'mine' | 'favorites'
const activeTab = ref<Tab>('mine')

// ─── 登录弹窗 ───
const loginDialogOpen = ref(false)

// ─── 我的歌单 ───
const myLoading = ref(false)
const myPlaylists = ref<PlaylistItem[]>([])

async function loadMyPlaylists() {
  myLoading.value = true
  try {
    const resp = await getMyPlaylists()
    myPlaylists.value = resp.playlists
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载歌单失败')
  } finally {
    myLoading.value = false
  }
}

// ─── 收藏歌单 ───
const favLoading = ref(false)
const favPlaylists = ref<PlaylistMetadata[]>([])
const favTotal = ref(0)
const favPage = ref(0)
const FAV_PAGE_SIZE = 20

async function loadFavorites(page = 0) {
  favLoading.value = true
  try {
    const resp = await pageFavoritePlaylists(page, FAV_PAGE_SIZE)
    favPlaylists.value = resp.data.map(item => item.metadata)
    favTotal.value = resp.total
    favPage.value = page
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载收藏失败')
  } finally {
    favLoading.value = false
  }
}

// ─── 新建歌单 ───
const createDialogOpen = ref(false)
const createName = ref('')
const createDesc = ref('')
const createIsPublic = ref(false)
const createLoading = ref(false)

function openCreateDialog() {
  if (!userStore.isLoggedIn) { loginDialogOpen.value = true; return }
  createName.value = ''
  createDesc.value = ''
  createIsPublic.value = false
  createDialogOpen.value = true
}

async function submitCreate() {
  if (!createName.value.trim()) { ElMessage.error('歌单名称不能为空'); return }
  createLoading.value = true
  try {
    const resp = await createPlaylist({
      name: createName.value.trim(),
      description: createDesc.value.trim() || null,
      is_public: createIsPublic.value,
    })
    ElMessage.success('歌单已创建')
    createDialogOpen.value = false
    await loadMyPlaylists()
    router.push(`/playlist/${resp.id}`)
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '创建失败')
  } finally {
    createLoading.value = false
  }
}

// ─── 删除我的歌单 ───
async function handleDeletePlaylist(pl: PlaylistItem, e: MouseEvent) {
  e.stopPropagation()
  try {
    await ElMessageBox.confirm(`确定要删除《${pl.name}》吗？此操作不可恢复。`, '删除歌单', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  try {
    await deletePlaylist(pl.id)
    ElMessage.success('已删除')
    myPlaylists.value = myPlaylists.value.filter(x => x.id !== pl.id)
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '删除失败')
  }
}

// ─── 取消收藏 ───
async function handleUnfavorite(pl: PlaylistMetadata, e: MouseEvent) {
  e.stopPropagation()
  try {
    await removeFavoritePlaylist(pl.id)
    ElMessage.success('已取消收藏')
    favPlaylists.value = favPlaylists.value.filter(x => x.id !== pl.id)
    favTotal.value = Math.max(0, favTotal.value - 1)
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '操作失败')
  }
}

function formatDate(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function switchTab(tab: Tab) {
  activeTab.value = tab
  if (tab === 'mine' && myPlaylists.value.length === 0 && !myLoading.value) {
    if (userStore.isLoggedIn) loadMyPlaylists()
  }
  if (tab === 'favorites' && favPlaylists.value.length === 0 && !favLoading.value) {
    if (userStore.isLoggedIn) loadFavorites(0)
  }
}

onMounted(() => {
  if (userStore.isLoggedIn) {
    loadMyPlaylists()
  }
})
</script>

<template>
  <div class="playlist-view">
    <div class="pv-shell">

      <!-- 顶栏 -->
      <div class="pv-topbar">
        <div class="pv-tabs">
          <button
            class="pv-tab"
            :class="{ active: activeTab === 'mine' }"
            @click="switchTab('mine')"
          >
            <el-icon><Tickets /></el-icon>
            我的歌单
          </button>
          <button
            class="pv-tab"
            :class="{ active: activeTab === 'favorites' }"
            @click="switchTab('favorites')"
          >
            <el-icon><Star /></el-icon>
            收藏的歌单
          </button>
        </div>
        <button v-if="activeTab === 'mine'" class="pv-create-btn" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新建歌单
        </button>
      </div>

      <!-- 未登录提示 -->
      <div v-if="!userStore.isLoggedIn" class="pv-login-prompt">
        <div class="pv-prompt-inner">
          <span class="pv-prompt-icon">♪</span>
          <p>登录后即可管理和收藏歌单</p>
          <button class="pv-login-btn" @click="loginDialogOpen = true">立即登录</button>
        </div>
      </div>

      <!-- 我的歌单 -->
      <template v-else-if="activeTab === 'mine'">
        <div v-if="myLoading" class="pv-list">
          <div v-for="i in 5" :key="i" class="pv-card-skeleton">
            <div class="pv-skel-inner">
              <div class="pv-skel-cover"></div>
              <div class="pv-skel-info">
                <div class="pv-skel-title-row">
                  <div class="pv-skel-line pv-skel-name"></div>
                  <div class="pv-skel-chip"></div>
                </div>
                <div class="pv-skel-line pv-skel-meta"></div>
                <div class="pv-skel-line pv-skel-desc"></div>
              </div>
              <div class="pv-skel-actions">
                <div class="pv-skel-action"></div>
                <div class="pv-skel-action"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="myPlaylists.length" class="pv-list">
          <div
            v-for="pl in myPlaylists"
            :key="pl.id"
            class="pv-card"
            @click="router.push('/playlist/' + pl.id)"
          >
            <div class="pv-cover-box">
              <img v-if="pl.cover_url" :src="pl.cover_url" :alt="pl.name" class="pv-cover-img" />
              <div v-else class="pv-cover-fallback">♫</div>
            </div>
            <div class="pv-card-info">
              <div class="pv-card-titlerow">
                <span class="pv-card-name">{{ pl.name }}</span>
                <span class="pv-visibility-chip" :class="pl.is_public ? 'public' : 'private'">
                  <el-icon><component :is="pl.is_public ? Unlock : Lock" /></el-icon>
                  {{ pl.is_public ? '公开' : '私密' }}
                </span>
              </div>
              <span class="pv-card-meta">{{ pl.songs_count }} 首 · 更新于 {{ formatDate(pl.update_time) }}</span>
              <p v-if="pl.description" class="pv-card-desc">{{ pl.description }}</p>
            </div>
            <div class="pv-card-actions"  @click.stop>
              <button class="pv-action-btn" title="编辑" @click="router.push('/playlist/' + pl.id)">
                <el-icon><Edit /></el-icon>
              </button>
              <button class="pv-action-btn danger" title="删除" @click="handleDeletePlaylist(pl, $event)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="pv-empty">
          <span class="pv-empty-icon">♫</span>
          <p>还没有歌单，点击右上角新建一个吧</p>
        </div>
      </template>

      <!-- 收藏的歌单 -->
      <template v-else-if="activeTab === 'favorites'">
        <div v-if="favLoading" class="pv-list">
          <div v-for="i in 5" :key="i" class="pv-card-skeleton">
            <div class="pv-skel-inner">
              <div class="pv-skel-cover"></div>
              <div class="pv-skel-info">
                <div class="pv-skel-title-row">
                  <div class="pv-skel-line pv-skel-name"></div>
                  <div class="pv-skel-chip"></div>
                </div>
                <div class="pv-skel-line pv-skel-meta"></div>
                <div class="pv-skel-line pv-skel-desc"></div>
              </div>
              <div class="pv-skel-actions single">
                <div class="pv-skel-action"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="favPlaylists.length" class="pv-list">
          <div
            v-for="pl in favPlaylists"
            :key="pl.id"
            class="pv-card"
            @click="router.push('/playlist/' + pl.id)"
          >
            <div class="pv-cover-box">
              <img v-if="pl.cover_url" :src="pl.cover_url" :alt="pl.name" class="pv-cover-img" />
              <div v-else class="pv-cover-fallback">♫</div>
            </div>
            <div class="pv-card-info">
              <div class="pv-card-titlerow">
                <span class="pv-card-name">{{ pl.name }}</span>
              </div>
              <span class="pv-card-meta">{{ pl.songs_count }} 首 · by {{ pl.user_name }}</span>
              <p v-if="pl.description" class="pv-card-desc">{{ pl.description }}</p>
            </div>
            <div class="pv-card-actions" @click.stop>
              <button class="pv-action-btn danger" title="取消收藏" @click="handleUnfavorite(pl, $event)">
                <el-icon><Star /></el-icon>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="pv-empty">
          <span class="pv-empty-icon">♥</span>
          <p>还没有收藏任何歌单</p>
        </div>
      </template>

    </div>

    <!-- 登录弹窗 -->
    <LoginDialog v-model="loginDialogOpen" />

    <!-- 新建歌单弹窗 -->
    <el-dialog v-model="createDialogOpen" title="新建歌单" width="440px">
      <div class="pv-create-form">
        <div class="pv-form-field">
          <label>歌单名称 <span class="pv-required">*</span></label>
          <el-input v-model="createName" maxlength="32" show-word-limit placeholder="给歌单起个名字" />
        </div>
        <div class="pv-form-field">
          <label>描述</label>
          <el-input v-model="createDesc" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="介绍一下这个歌单（可选）" />
        </div>
        <div class="pv-form-field pv-form-toggle">
          <label>设为公开</label>
          <el-switch v-model="createIsPublic" />
        </div>
      </div>
      <template #footer>
        <button class="pv-dialog-btn" @click="createDialogOpen = false">取消</button>
        <button class="pv-dialog-btn primary" :disabled="createLoading" @click="submitCreate">
          {{ createLoading ? '创建中…' : '创建' }}
        </button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped>
.playlist-view {
  min-height: calc(100vh - var(--hw-header-height));
  padding: 28px 20px 120px;
}

.pv-shell {
  max-width: 780px;
  margin: 0 auto;
}

/* ─── 顶栏 ─── */
.pv-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.pv-tabs {
  display: flex;
  gap: 4px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  border-radius: 14px;
  padding: 4px;
}

.pv-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.pv-tab:hover {
  color: var(--hw-text-primary);
}

.pv-tab.active {
  background: var(--hw-bg-primary);
  color: var(--theme-color);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.pv-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 12px;
  border: none;
  background: var(--theme-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.pv-create-btn:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

/* ─── 未登录 ─── */
.pv-login-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}

.pv-prompt-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: var(--hw-text-secondary);
}

.pv-prompt-icon {
  font-size: 48px;
  opacity: 0.3;
}

.pv-login-btn {
  padding: 9px 28px;
  border-radius: 12px;
  border: none;
  background: var(--theme-color);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.pv-login-btn:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

/* ─── 列表 ─── */
.pv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pv-card,
.pv-card-skeleton {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--hw-border);
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.pv-card:hover {
  background: var(--hw-bg-hover);
  border-color: color-mix(in srgb, var(--theme-color) 25%, var(--hw-border));
}

.pv-card:hover .pv-card-actions {
  opacity: 1;
}

/* 封面 */
.pv-cover-box {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--hw-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hw-text-tertiary);
  font-size: 24px;
}

.pv-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pv-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 信息 */
.pv-card-info {
  flex: 1;
  min-width: 0;
}

.pv-card-titlerow {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pv-card-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--hw-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pv-visibility-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.pv-visibility-chip.public {
  background: var(--theme-color-light);
  color: var(--theme-color);
}

.pv-visibility-chip.private {
  background: var(--hw-bg-primary);
  color: var(--hw-text-tertiary);
  border: 1px solid var(--hw-border);
}

.pv-card-meta {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.pv-card-desc {
  margin-top: 5px;
  font-size: 12px;
  color: var(--hw-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 操作按钮 */
.pv-card-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.pv-action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-primary);
  color: var(--hw-text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.pv-action-btn:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
  background: var(--theme-color-light);
}

.pv-action-btn.danger:hover {
  border-color: #ef4444;
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 10%, transparent);
}

/* 骨架 */
.pv-skel-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.pv-skel-cover {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.pv-skel-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pv-skel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pv-skel-line,
.pv-skel-chip,
.pv-skel-action {
  background: linear-gradient(
    90deg,
    var(--hw-bg-primary) 25%,
    var(--hw-bg-hover) 50%,
    var(--hw-bg-primary) 75%
  );
  background-size: 400% 100%;
  animation: el-skeleton-loading 1.4s ease infinite;
}

.pv-skel-line {
  height: 12px;
  border-radius: 999px;
}

.pv-skel-name {
  width: 42%;
  height: 14px;
}

.pv-skel-chip {
  width: 48px;
  height: 20px;
  border-radius: 999px;
}

.pv-skel-meta {
  width: 36%;
}

.pv-skel-desc {
  width: 68%;
}

.pv-skel-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
}

.pv-skel-actions.single {
  gap: 0;
}

.pv-skel-action {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

/* 空状态 */
.pv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 0;
  color: var(--hw-text-tertiary);
}

.pv-empty-icon {
  font-size: 44px;
  opacity: 0.25;
}

/* 新建表单 */
.pv-create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pv-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pv-form-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-secondary);
}

.pv-required { color: #ef4444; }

.pv-form-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.pv-dialog-btn {
  padding: 8px 20px;
  border-radius: 10px;
  border: 1px solid var(--hw-border);
  background: var(--hw-bg-secondary);
  color: var(--hw-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.pv-dialog-btn:hover {
  border-color: var(--theme-color);
  color: var(--theme-color);
}

.pv-dialog-btn.primary {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
  margin-left: 8px;
}

.pv-dialog-btn.primary:hover {
  background: color-mix(in srgb, var(--theme-color) 85%, #000);
}

.pv-dialog-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
