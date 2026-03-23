<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { UserSearchItem } from '@/api/search'
import { Male, Female, Avatar } from '@element-plus/icons-vue'

const props = defineProps<{
  item: UserSearchItem
}>()

const router = useRouter()

const genderIcon = computed(() => {
  if (props.item.gender === 0) return Male
  if (props.item.gender === 1) return Female
  return Avatar
})

const genderText = computed(() => {
  if (props.item.gender === 0) return '男性'
  if (props.item.gender === 1) return '女性'
  return '神没有性别'
})

function openUser() {
  router.push(`/user/${props.item.uid}`)
}
</script>

<template>
  <article class="search-user-card" @click="openUser">
    <el-avatar :size="72" :src="item.avatar_url ?? undefined" class="user-avatar">
      {{ item.username?.[0] ?? '神' }}
    </el-avatar>

    <div class="user-main">
      <div class="user-topline">
        <h3 class="user-name">{{ item.username }}</h3>
        <div class="user-gender">
          <el-icon><component :is="genderIcon" /></el-icon>
          <span>{{ genderText }}</span>
        </div>
      </div>
      <p class="user-uid">UID {{ item.uid }}</p>
      <p class="user-bio">{{ item.bio || '这个人很神秘，还没有留下个人简介。' }}</p>
    </div>
  </article>
</template>

<style scoped>
.search-user-card {
  display: flex;
  gap: 14px;
  min-width: 0;
  align-items: center;
  padding: 14px;
  border: 1px solid var(--hw-border);
  border-radius: 16px;
  background: var(--hw-bg-secondary);
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.search-user-card:hover {
  background: var(--hw-bg-hover);
  border-color: color-mix(in srgb, var(--theme-color) 30%, var(--hw-border));
}

.user-avatar {
  flex-shrink: 0;
}

.user-main {
  flex: 1;
  min-width: 0;
}

.user-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.user-name {
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--hw-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-gender {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--theme-color);
  flex-shrink: 0;
}

.user-uid {
  margin-top: 4px;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.user-bio {
  margin-top: 8px;
  font-size: 13px;
  color: var(--hw-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

