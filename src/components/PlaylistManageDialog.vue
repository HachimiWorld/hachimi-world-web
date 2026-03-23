<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderAdd, Check, Plus, Lock, Link } from '@element-plus/icons-vue'
import { ApiError } from '@/api/request'
import {
  addSongToPlaylist,
  createPlaylist,
  getMyPlaylists,
  getPlaylistsContainingSong,
  type PlaylistItem,
} from '@/api/playlist'
import { useUserStore } from '@/stores/user'
import LoginDialog from './LoginDialog.vue'

const props = defineProps<{
  modelValue: boolean
  songId: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const userStore = useUserStore()

const loading = ref(false)
const creating = ref(false)
const playlists = ref<PlaylistItem[]>([])
const containingIds = ref<number[]>([])
const createName = ref('')
const createDescription = ref('')
const createIsPublic = ref(false)
const loginDialogOpen = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

async function loadData() {
  if (!visible.value || !userStore.isLoggedIn) return

  loading.value = true
  try {
    const [listResp, containingResp] = await Promise.all([
      getMyPlaylists(),
      getPlaylistsContainingSong(props.songId),
    ])
    playlists.value = listResp.playlists
    containingIds.value = containingResp.playlist_ids
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载歌单失败')
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  const name = createName.value.trim()
  if (!name) {
    ElMessage.warning('请输入歌单名称')
    return
  }

  creating.value = true
  try {
    const resp = await createPlaylist({
      name,
      description: createDescription.value.trim() || null,
      is_public: createIsPublic.value,
    })

    await addSongToPlaylist(resp.id, props.songId)
    ElMessage.success('已创建歌单并加入歌曲')
    createName.value = ''
    createDescription.value = ''
    createIsPublic.value = false
    await loadData()
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '创建歌单失败')
  } finally {
    creating.value = false
  }
}

async function handleAddToPlaylist(playlist: PlaylistItem) {
  if (containingIds.value.includes(playlist.id)) {
    ElMessage.info('这首歌已经在该歌单里了')
    return
  }

  try {
    await addSongToPlaylist(playlist.id, props.songId)
    containingIds.value = [...containingIds.value, playlist.id]
    ElMessage.success(`已加入《${playlist.name}》`)
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加入歌单失败')
  }
}

watch(
  () => visible.value,
  async (value) => {
    if (!value) return
    if (!userStore.isLoggedIn) {
      visible.value = false
      loginDialogOpen.value = true
      return
    }
    await loadData()
  },
)
</script>

<template>
  <el-dialog
      v-model="visible"
      title="加入歌单"
      width="min(720px, calc(100vw - 24px))"
      class="playlist-manage-dialog"
    >
      <div class="playlist-manage-shell">
        <section class="create-panel">
          <div class="panel-title-row">
            <el-icon><FolderAdd /></el-icon>
            <span>新建歌单</span>
          </div>

          <div class="create-grid">
            <el-input v-model="createName" placeholder="给新歌单起个名字" maxlength="32" show-word-limit />
            <el-input
              v-model="createDescription"
              type="textarea"
              :rows="3"
              maxlength="300"
              show-word-limit
              placeholder="写一点描述也不错（可选）"
            />
            <label class="public-toggle">
              <input v-model="createIsPublic" type="checkbox">
              <span class="toggle-icon">
                <el-icon v-if="createIsPublic"><Link /></el-icon>
                <el-icon v-else><Lock /></el-icon>
              </span>
              <span>{{ createIsPublic ? '公开歌单' : '私密歌单' }}</span>
            </label>
            <button class="create-btn" :disabled="creating" @click="handleCreate">
              <el-icon><Plus /></el-icon>
              {{ creating ? '创建中…' : '创建并加入' }}
            </button>
          </div>
        </section>

        <section class="list-panel">
          <div class="panel-title-row">
            <span>已有歌单</span>
            <span class="panel-subtitle">点击即可把当前歌曲加入其中</span>
          </div>

          <div v-if="loading" class="playlist-state">正在加载歌单…</div>
          <div v-else-if="!playlists.length" class="playlist-state">你还没有创建歌单，先新建一个吧</div>
          <div v-else class="playlist-list">
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="playlist-item"
              :class="{ added: containingIds.includes(playlist.id) }"
              @click="handleAddToPlaylist(playlist)"
            >
              <div class="playlist-item-main">
                <strong class="playlist-name">{{ playlist.name }}</strong>
                <span class="playlist-meta">
                  {{ playlist.songs_count }} 首
                  <span class="dot">·</span>
                  {{ playlist.is_public ? '公开' : '私密' }}
                </span>
              </div>
              <span class="playlist-action">
                <el-icon v-if="containingIds.includes(playlist.id)"><Check /></el-icon>
                <el-icon v-else><Plus /></el-icon>
              </span>
            </button>
          </div>
        </section>
      </div>
    </el-dialog>

    <LoginDialog v-model="loginDialogOpen" />
</template>

<style scoped>
.playlist-manage-shell {
  display: grid;
  grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
  gap: 18px;
}

.create-panel,
.list-panel {
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  border-radius: 18px;
  padding: 16px;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--hw-text-primary);
  margin-bottom: 14px;
}

.panel-subtitle {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: var(--hw-text-tertiary);
}

.create-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.public-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--hw-text-secondary);
  font-size: 13px;
}

.public-toggle input {
  display: none;
}

.toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: var(--hw-bg-primary);
  border: 1px solid var(--hw-border);
}

.create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: var(--theme-color);
  color: #fff;
  cursor: pointer;
  font-weight: 700;
}

.create-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 360px;
  overflow: auto;
}

.playlist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border: 1px solid var(--hw-border);
  border-radius: 14px;
  background: var(--hw-bg-primary);
  color: var(--hw-text-primary);
  cursor: pointer;
}

.playlist-item:hover {
  border-color: color-mix(in srgb, var(--theme-color) 32%, var(--hw-border));
}

.playlist-item.added {
  background: var(--theme-color-light);
  border-color: color-mix(in srgb, var(--theme-color) 45%, var(--hw-border));
}

.playlist-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playlist-name {
  font-size: 14px;
}

.playlist-meta,
.playlist-state {
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.playlist-action {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--hw-bg-secondary);
}

.dot {
  margin: 0 4px;
}

:deep(.playlist-manage-dialog .el-dialog) {
  border-radius: 22px;
  background: var(--hw-bg-primary);
}

:deep(.playlist-manage-dialog .el-dialog__title) {
  color: var(--hw-text-primary);
  font-weight: 700;
}

@media (max-width: 768px) {
  .playlist-manage-shell {
    grid-template-columns: 1fr;
  }

  .panel-subtitle {
    display: none;
  }
}
</style>

