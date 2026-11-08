<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { mdiEmailLockOutline } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import { ApiError } from '@/api/request'
import { emailChangeErrorMessage, revertEmailChange } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const token = computed(() => {
  const q = route.query.token
  return typeof q === 'string' ? q.trim() : ''
})

const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const done = ref(false)

async function submit() {
  if (!token.value) {
    ElMessage.error('链接无效')
    return
  }
  if (password.value.length < 8) {
    ElMessage.error('密码至少 8 位')
    return
  }
  if (password.value !== confirm.value) {
    ElMessage.error('两次密码不一致')
    return
  }
  submitting.value = true
  try {
    await revertEmailChange(token.value, password.value)
    authStore.clearSession()
    done.value = true
    ElMessage.success('已撤销邮箱变更并登出所有设备')
  } catch (e) {
    ElMessage.error(
      e instanceof ApiError ? (emailChangeErrorMessage(e.code) || e.msg) : '操作失败',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="revert-page">
    <div class="revert-shell">
      <div class="icon-wrap">
        <MdiIcon :path="mdiEmailLockOutline" size="32px" />
      </div>
      <h1 class="title">撤销邮箱变更</h1>
      <p class="desc">设置新密码后将撤销此次邮箱变更，并登出所有已登录设备。</p>

      <div v-if="!token" class="state">链接无效或缺少 token</div>

      <template v-else-if="done">
        <div class="state success">操作成功，请使用原邮箱与新密码重新登录。</div>
        <el-button type="primary" @click="router.push('/settings')">前往设置</el-button>
      </template>

      <template v-else>
        <label class="field-label">新密码</label>
        <el-input v-model="password" type="password" show-password placeholder="至少 8 位" />
        <label class="field-label">确认密码</label>
        <el-input v-model="confirm" type="password" show-password placeholder="再次输入" />
        <el-button
          type="primary"
          class="submit"
          :loading="submitting"
          :disabled="!password || !confirm"
          @click="submit"
        >
          确认撤销
        </el-button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.revert-page {
  min-height: calc(100vh - var(--hw-header-height));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px 80px;
}

.revert-shell {
  width: 100%;
  max-width: 420px;
}

.icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--theme-color-light);
  color: var(--theme-color);
  margin-bottom: 16px;
}

.title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 8px;
}

.desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--hw-text-secondary);
  line-height: 1.55;
}

.field-label {
  display: block;
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--hw-text-secondary);
}

.submit {
  width: 100%;
  margin-top: 20px;
}

.state {
  padding: 16px;
  border-radius: 12px;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  color: var(--hw-text-secondary);
  margin-bottom: 16px;
}

.state.success {
  color: var(--hw-text-primary);
}
</style>
