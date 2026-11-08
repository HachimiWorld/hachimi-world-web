<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { mdiClose, mdiImageOutline, mdiSend } from '@mdi/js'
import MdiIcon from '@/components/icons/MdiIcon.vue'
import { ApiError } from '@/api/request'
import {
  CONTENT_MAX_CHARS,
  MAX_IMAGES,
  createMoment,
  momentErrorMessage,
  uploadMomentImage,
  type MomentItem,
  type UploadMomentImageResp,
} from '@/api/moment'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [moment: MomentItem | null]
}>()

const content = ref('')
const images = ref<UploadMomentImageResp[]>([])
const uploading = ref(false)
const submitting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const canSubmit = computed(() => {
  const hasText = content.value.trim().length > 0
  const hasImages = images.value.length > 0
  return (hasText || hasImages) && !uploading.value && !submitting.value
})

const remain = computed(() => CONTENT_MAX_CHARS - [...content.value].length)

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    content.value = ''
    images.value = []
    uploading.value = false
    submitting.value = false
  },
)

function pickImages() {
  fileInput.value?.click()
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  const room = MAX_IMAGES - images.value.length
  if (room <= 0) {
    ElMessage.warning(`最多 ${MAX_IMAGES} 张图片`)
    return
  }
  const batch = files.slice(0, room)
  uploading.value = true
  try {
    for (const file of batch) {
      if (file.size > 8 * 1024 * 1024) {
        ElMessage.error(`${file.name} 超过 8MB`)
        continue
      }
      try {
        const uploaded = await uploadMomentImage(file)
        images.value.push(uploaded)
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? momentErrorMessage(err.code) || err.msg
            : '图片上传失败'
        ElMessage.error(msg)
      }
    }
  } finally {
    uploading.value = false
  }
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

async function submit() {
  if (!canSubmit.value) return
  if ([...content.value].length > CONTENT_MAX_CHARS) {
    ElMessage.error('文字过长')
    return
  }
  submitting.value = true
  try {
    const resp = await createMoment({
      content: content.value.trim(),
      image_ids: images.value.map((x) => x.image_id),
    })
    if (resp.moment) {
      ElMessage.success('已发布')
      emit('created', resp.moment)
    } else {
      ElMessage.success('已提交，审核通过后将显示')
      emit('created', null)
    }
    open.value = false
  } catch (err) {
    const msg =
      err instanceof ApiError
        ? momentErrorMessage(err.code) || err.msg
        : '发布失败'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="open"
    title="发布动态"
    width="520px"
    align-center
    destroy-on-close
    class="moment-composer-dialog"
  >
    <textarea
      v-model="content"
      class="composer-input"
      rows="5"
      maxlength="2000"
      placeholder="分享你的想法…"
    />
    <div class="composer-meta">
      <span :class="{ over: remain < 0 }">{{ remain }}</span>
    </div>

    <div v-if="images.length" class="preview-grid">
      <div v-for="(img, i) in images" :key="img.image_id" class="preview-item">
        <img :src="img.thumb_url || img.url" alt="">
        <button type="button" class="rm" aria-label="移除" @click="removeImage(i)">
          <MdiIcon :path="mdiClose" size="14px" />
        </button>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
      multiple
      hidden
      @change="onFiles"
    >

    <template #footer>
      <div class="footer-row">
        <button
          type="button"
          class="icon-btn"
          :disabled="uploading || images.length >= MAX_IMAGES"
          @click="pickImages"
        >
          <MdiIcon :path="mdiImageOutline" size="20px" />
          <span>{{ uploading ? '上传中…' : '图片' }}</span>
        </button>
        <button type="button" class="send-btn" :disabled="!canSubmit" @click="submit">
          <MdiIcon :path="mdiSend" size="18px" />
          {{ submitting ? '发布中…' : '发布' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.composer-input {
  width: 100%;
  resize: vertical;
  min-height: 120px;
  border: 1px solid var(--hw-border);
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
  font-size: 15px;
  line-height: 1.55;
  background: var(--hw-bg-primary);
  color: var(--hw-text-primary);
  outline: none;
}

.composer-input:focus {
  border-color: var(--theme-color);
}

.composer-meta {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  font-size: 12px;
  color: var(--hw-text-tertiary);
}

.composer-meta .over {
  color: #e35;
}

.preview-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--hw-bg-hover);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rm {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--hw-bg-hover);
  color: var(--theme-color);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.send-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 12px;
  padding: 9px 16px;
  background: var(--theme-color);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.send-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
