<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { mdiArrowLeft, mdiDeleteOutline, mdiNewspaperVariantOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import MomentCard from '@/components/MomentCard.vue'
import SongCommentsSection from '@/components/SongCommentsSection.vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { ApiError } from '@/api/request'
import { TARGET_MOMENT } from '@/api/comment'
import {
  deleteMoment,
  getMomentDetail,
  likeMoment,
  momentErrorMessage,
  unlikeMoment,
  type MomentItem,
} from '@/api/moment'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const userStore = useUserStore()

const item = ref<MomentItem | null>(null)
const loading = ref(false)
const errorText = ref('')
const loginDialogOpen = ref(false)
const actionBusy = ref(false)

const momentId = computed(() => Number(route.params.id))
const isOwner = computed(() =>
  !!item.value && !!userStore.userInfo && item.value.author.uid === userStore.userInfo.uid,
)

function apiMessage(e: unknown, fallback: string) {
  if (e instanceof ApiError) return momentErrorMessage(e.code) || e.msg || fallback
  return fallback
}

async function load() {
  if (!Number.isFinite(momentId.value)) {
    errorText.value = '动态不存在'
    return
  }
  loading.value = true
  errorText.value = ''
  try {
    item.value = await getMomentDetail(momentId.value)
  } catch (e) {
    item.value = null
    errorText.value = apiMessage(e, '暂时无法加载动态')
  } finally {
    loading.value = false
  }
}

async function toggleLike() {
  if (!item.value) return
  if (!authStore.isLoggedIn) {
    loginDialogOpen.value = true
    return
  }
  if (actionBusy.value) return
  actionBusy.value = true
  const liked = item.value.liked
  item.value.liked = !liked
  item.value.like_count += liked ? -1 : 1
  try {
    if (liked) await unlikeMoment(item.value.id)
    else await likeMoment(item.value.id)
  } catch (e) {
    item.value.liked = liked
    item.value.like_count += liked ? 1 : -1
    ElMessage.error(apiMessage(e, '操作失败'))
  } finally {
    actionBusy.value = false
  }
}

async function onDelete() {
  if (!item.value) return
  try {
    await ElMessageBox.confirm('删除后不可恢复', '删除这条动态？', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteMoment(item.value.id)
    ElMessage.success('已删除')
    router.replace('/square')
  } catch (e) {
    ElMessage.error(apiMessage(e, '删除失败'))
  }
}

function onLoginDialogChange(open: boolean) {
  loginDialogOpen.value = open
  if (!open && authStore.isLoggedIn) void load()
}

watch(momentId, () => {
  void load()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="moment-page">
    <div class="moment-shell">
      <div class="moment-hero">
        <button type="button" class="back-btn" aria-label="返回" @click="router.push('/square')">
          <MdiIcon :path="mdiArrowLeft" size="20px" />
        </button>
        <h1 class="hero-title">动态</h1>
        <button
          v-if="isOwner"
          type="button"
          class="delete-btn"
          aria-label="删除"
          @click="onDelete"
        >
          <MdiIcon :path="mdiDeleteOutline" size="20px" />
        </button>
      </div>

      <div v-if="loading" class="state-card">
        <div class="loading-dot" />
      </div>

      <div v-else-if="errorText" class="state-card">
        <MdiIcon :path="mdiNewspaperVariantOutline" size="22px" />
        <p>{{ errorText }}</p>
        <button type="button" class="retry-btn" @click="load">重试</button>
      </div>

      <template v-else-if="item">
        <MomentCard
          :moment="item"
          @open="() => {}"
          @like="toggleLike"
          @unlike="toggleLike"
          @require-login="loginDialogOpen = true"
        />
        <div class="comments-wrap">
          <SongCommentsSection
            :target-id="item.id"
            :owner-uid="item.author.uid"
            :target-type="TARGET_MOMENT"
            hide-header
            @require-login="loginDialogOpen = true"
          />
        </div>
      </template>
    </div>

    <LoginDialog :model-value="loginDialogOpen" @update:model-value="onLoginDialogChange" />
  </div>
</template>

<style scoped>
.moment-page {
  min-height: calc(100vh - var(--hw-header-height));
  background: var(--hw-bg-primary);
  padding: 0 0 80px;
}

.moment-shell {
  max-width: 720px;
  margin: 0 auto;
}

.moment-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 20px;
}

.back-btn,
.delete-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--hw-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.back-btn:hover,
.delete-btn:hover {
  background: var(--hw-bg-hover);
}

.delete-btn {
  margin-left: auto;
  color: var(--hw-text-secondary);
}

.hero-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--hw-text-primary);
}

.comments-wrap {
  margin-top: 20px;
}

.state-card {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--hw-text-secondary);
  text-align: center;
}

.loading-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--theme-color-light);
  border-top-color: var(--theme-color);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  border: none;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  background: transparent;
  color: var(--theme-color);
}
</style>
