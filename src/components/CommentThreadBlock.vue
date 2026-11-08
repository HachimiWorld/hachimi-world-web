<script setup lang="ts">
import {
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiFlagOutline,
  mdiThumbUp,
  mdiThumbUpOutline,
} from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import type { CommentItem, CommentThread } from '@/api/comment'

defineProps<{
  thread: CommentThread
  canDelete: (item: CommentItem) => boolean
  isMine: (item: CommentItem) => boolean
  showMore: (item: CommentItem) => boolean
  formatTime: (iso: string) => string
}>()

const emit = defineEmits<{
  like: [item: CommentItem]
  reply: [item: CommentItem]
  delete: [item: CommentItem]
  report: [item: CommentItem]
  user: [uid: number]
  'open-replies': [thread: CommentThread]
}>()
</script>

<template>
  <div class="thread-block">
    <div v-if="thread.comment.removed" class="comment-removed">该评论已删除</div>
    <div v-else-if="thread.comment.author" class="comment-row">
      <button type="button" class="avatar avatar-lg" @click="emit('user', thread.comment.author.uid)">
        <img
          v-if="thread.comment.author.avatar_url"
          :src="thread.comment.author.avatar_url"
          :alt="thread.comment.author.username"
        >
        <span v-else class="avatar-fallback">{{ thread.comment.author.username.slice(0, 1) }}</span>
      </button>
      <div class="comment-main">
        <div class="comment-meta">
          <button type="button" class="username" @click="emit('user', thread.comment.author.uid)">
            {{ thread.comment.author.username }}
          </button>
          <span class="time">{{ formatTime(thread.comment.create_time) }}</span>
        </div>
        <p class="comment-content">{{ thread.comment.content }}</p>
        <div class="comment-actions">
          <button type="button" class="reply-text-btn" @click="emit('reply', thread.comment)">回复</button>
          <div class="actions-right">
            <button
              type="button"
              class="like-btn"
              :class="{ liked: thread.comment.liked }"
              :aria-label="thread.comment.liked ? '取消点赞' : '点赞'"
              @click="emit('like', thread.comment)"
            >
              <MdiIcon :path="thread.comment.liked ? mdiThumbUp : mdiThumbUpOutline" size="16px" />
              <span v-if="thread.comment.like_count > 0">{{ thread.comment.like_count }}</span>
            </button>
            <el-dropdown
              v-if="showMore(thread.comment)"
              trigger="click"
              @command="(cmd: string) => cmd === 'delete' ? emit('delete', thread.comment) : emit('report', thread.comment)"
            >
              <button type="button" class="more-btn" aria-label="更多">
                <MdiIcon :path="mdiDotsVertical" size="16px" />
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="canDelete(thread.comment)" command="delete">
                    <MdiIcon :path="mdiDeleteOutline" size="16px" />
                    <span>删除</span>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="!isMine(thread.comment)" command="report">
                    <MdiIcon :path="mdiFlagOutline" size="16px" />
                    <span>举报</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="thread.replies.length || thread.reply_count > 0"
      class="replies-preview"
    >
      <div
        v-for="reply in thread.replies"
        :key="reply.id"
        class="preview-reply"
      >
        <div v-if="reply.removed" class="comment-removed compact">该评论已删除</div>
        <div v-else-if="reply.author" class="comment-row compact">
          <button type="button" class="avatar avatar-sm" @click="emit('user', reply.author.uid)">
            <img
              v-if="reply.author.avatar_url"
              :src="reply.author.avatar_url"
              :alt="reply.author.username"
            >
            <span v-else class="avatar-fallback">{{ reply.author.username.slice(0, 1) }}</span>
          </button>
          <div class="comment-main">
            <div class="comment-meta">
              <button type="button" class="username" @click="emit('user', reply.author.uid)">
                {{ reply.author.username }}
              </button>
              <span class="time">{{ formatTime(reply.create_time) }}</span>
            </div>
            <p class="comment-content">
              <template v-if="reply.reply_to_user">
                <span class="reply-inline">回复 {{ reply.reply_to_user.username }}：</span>
              </template>{{ reply.content }}
            </p>
            <div class="comment-actions">
              <button type="button" class="reply-text-btn" @click="emit('reply', reply)">回复</button>
              <div class="actions-right">
                <button
                  type="button"
                  class="like-btn"
                  :class="{ liked: reply.liked }"
                  :aria-label="reply.liked ? '取消点赞' : '点赞'"
                  @click="emit('like', reply)"
                >
                  <MdiIcon :path="reply.liked ? mdiThumbUp : mdiThumbUpOutline" size="16px" />
                  <span v-if="reply.like_count > 0">{{ reply.like_count }}</span>
                </button>
                <el-dropdown
                  v-if="showMore(reply)"
                  trigger="click"
                  @command="(cmd: string) => cmd === 'delete' ? emit('delete', reply) : emit('report', reply)"
                >
                  <button type="button" class="more-btn" aria-label="更多">
                    <MdiIcon :path="mdiDotsVertical" size="16px" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-if="canDelete(reply)" command="delete">
                        <MdiIcon :path="mdiDeleteOutline" size="16px" />
                        <span>删除</span>
                      </el-dropdown-item>
                      <el-dropdown-item v-if="!isMine(reply)" command="report">
                        <MdiIcon :path="mdiFlagOutline" size="16px" />
                        <span>举报</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        v-if="thread.reply_count > thread.replies.length"
        type="button"
        class="view-all-replies"
        @click="emit('open-replies', thread)"
      >查看全部 {{ thread.reply_count }} 条回复</button>
    </div>
  </div>
</template>

<style scoped>
.comment-removed {
  font-size: 14px;
  color: var(--hw-text-secondary);
  padding: 4px 0;
}

.comment-removed.compact {
  font-size: 13px;
}

.comment-row {
  display: flex;
  width: 100%;
}

.avatar {
  flex-shrink: 0;
  border: none;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: var(--hw-bg-hover);
  color: var(--hw-text-secondary);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 12px;
  font-weight: 500;
}

.avatar-lg { width: 36px; height: 36px; }
.avatar-sm { width: 22px; height: 22px; }

.comment-main {
  flex: 1;
  min-width: 0;
  padding-left: 10px;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--hw-text-secondary);
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.username:hover {
  color: var(--hw-text-primary);
}

.time {
  font-size: 12px;
  color: var(--hw-text-tertiary);
  flex-shrink: 0;
}

.comment-content {
  margin-top: 3px;
  font-size: 15px;
  line-height: 22px;
  color: var(--hw-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.reply-inline {
  color: var(--hw-text-secondary);
}

.comment-actions {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.reply-text-btn {
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 12px;
  padding: 4px;
  margin-left: -4px;
  border-radius: 4px;
  cursor: pointer;
}

.reply-text-btn:hover {
  background: var(--hw-bg-hover);
}

.actions-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}

.like-btn,
.more-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 999px;
  cursor: pointer;
}

.like-btn:hover,
.more-btn:hover {
  background: var(--hw-bg-hover);
}

.like-btn.liked {
  color: var(--theme-color);
}

.replies-preview {
  margin: 6px 0 0 46px;
  padding: 6px 4px 4px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--hw-text-primary) 4%, transparent);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.view-all-replies {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--theme-color);
  font-size: 13px;
  padding: 4px 0;
  border-radius: 4px;
  cursor: pointer;
}

.view-all-replies:hover {
  text-decoration: underline;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 720px) {
  .replies-preview {
    margin-left: 0;
  }
}
</style>
