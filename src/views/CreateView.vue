<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import {
  uploadAudioFile, uploadCoverImage, publishSong,
  getSongsByUser, getNextJmid, getMyJmidPrefix,
  searchTags, createTag, checkJmidPrefix, checkJmid,
  type UploadAudioResp, type Song,
} from '@/api/song'
import { ApiError } from '@/api/request'
import LoginDialog from '@/components/LoginDialog.vue'
import ManageSongCard from '@/components/ManageSongCard.vue'

const authStore = useAuthStore()
const showLogin = ref(false)

type Tab = 'publish' | 'reviews'
const activeTab = ref<Tab>('publish')
function switchTab(t: Tab) {
  activeTab.value = t
  if (t === 'reviews') loadMySongs(0)
}

// --- 我的作品管理 ---
const mySongs = ref<Song[]>([])
const mySongsLoading = ref(false)
const mySongsTotal = ref(0)
const mySongsPage = ref(0)
const MY_SONGS_PAGE_SIZE = 8

async function loadMySongs(page = 0) {
  if (!authStore.isLoggedIn) return
  const userStore = useUserStore()
  const uid = userStore.userInfo?.uid
  if (!uid) return
  mySongsLoading.value = true
  try {
    const resp = await getSongsByUser({ uid, page, pageSize: MY_SONGS_PAGE_SIZE })
    mySongs.value = resp.songs
    mySongsTotal.value = resp.total
    mySongsPage.value = page
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '加载作品失败')
  } finally {
    mySongsLoading.value = false
  }
}

async function onMySongsPageChange(page: number) {
  await loadMySongs(page - 1)
}

const audioUploadResp = ref<UploadAudioResp | null>(null)
const audioUploading = ref(false)
const audioInputRef = ref<HTMLInputElement | null>(null)

async function onAudioChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  audioUploading.value = true
  audioUploadResp.value = null
  try {
    const resp = await uploadAudioFile(file)
    audioUploadResp.value = resp
    if (resp.title && !title.value) title.value = resp.title
    if (resp.artist && crew.value.length === 1 && !crew.value[0].name)
      crew.value[0].name = resp.artist
    ElMessage.success('音频上传成功')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '音频上传失败')
  } finally {
    audioUploading.value = false
  }
}

const coverPreview = ref<string | null>(null)
const coverTempId = ref<string | null>(null)
const coverUploading = ref(false)
const coverInputRef = ref<HTMLInputElement | null>(null)

async function onCoverChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  coverPreview.value = URL.createObjectURL(file)
  coverUploading.value = true
  coverTempId.value = null
  try {
    const resp = await uploadCoverImage(file)
    coverTempId.value = resp.temp_id
    ElMessage.success('封面上传成功')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '封面上传失败')
    coverPreview.value = null
  } finally {
    coverUploading.value = false
  }
}

const title = ref('')
const subtitle = ref('')
const description = ref('')
const lyrics = ref('')
const explicit = ref(false)
const creationType = ref(0)
const originTitle = ref('')
const originArtist = ref('')
const originUrl = ref('')

interface CrewItem { role: string; name: string }
const crew = ref<CrewItem[]>([{ role: '主唱', name: '' }])
function addCrew() { crew.value.push({ role: '', name: '' }) }
function removeCrew(i: number) { crew.value.splice(i, 1) }

interface LinkItem { platform: string; url: string }
const PLATFORMS = ['bilibili', 'youtube', 'netease', 'qq_music', 'spotify', 'soundcloud', 'other']
const links = ref<LinkItem[]>([])
function addLink() { links.value.push({ platform: 'bilibili', url: '' }) }
function removeLink(i: number) { links.value.splice(i, 1) }

const allTags = ref<{ id: number; name: string }[]>([])
const tagQuery = ref('')
const selectedTags = ref<{ id: number; name: string }[]>([])
const tagDropdown = ref(false)
const tagResults = ref<{ id: number; name: string }[]>([])
const tagSearching = ref(false)
const tagNoResult = ref(false)
let tagSearchTimer: ReturnType<typeof setTimeout> | null = null

function onTagInput() {
  if (tagSearchTimer) clearTimeout(tagSearchTimer)
  tagSearchTimer = setTimeout(doTagSearch, 250)
}

async function doTagSearch() {
  const q = tagQuery.value.trim()
  if (!q) {
    tagResults.value = []
    tagDropdown.value = false
    tagNoResult.value = false
    return
  }
  tagSearching.value = true
  tagDropdown.value = true
  try {
    const resp = await searchTags(q)
    tagResults.value = resp.result.filter(t => !selectedTags.value.find(s => s.id === t.id))
    tagNoResult.value = tagResults.value.length === 0
  } catch {
    tagResults.value = []
    tagNoResult.value = true
  } finally {
    tagSearching.value = false
  }
}

function selectTag(tag: { id: number; name: string }) {
  if (!selectedTags.value.find(t => t.id === tag.id)) selectedTags.value.push(tag)
  tagQuery.value = ''
  tagResults.value = []
  tagDropdown.value = false
  tagNoResult.value = false
}

function removeTag(id: number) {
  selectedTags.value = selectedTags.value.filter(t => t.id !== id)
}

async function onTagEnter() {
  const name = tagQuery.value.trim()
  if (!name) return
  const exact = tagResults.value.find(t => t.name.toLowerCase() === name.toLowerCase())
  if (exact) { selectTag(exact); return }
  tagSearching.value = true
  try {
    const resp = await createTag(name)
    selectTag({ id: resp.id, name })
    ElMessage.success(`标签「${name}」创建成功`)
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '创建标签失败')
  } finally {
    tagSearching.value = false
  }
}

// --- JM-ID ---
// jmidMode: 'locked' = 已绑定前缀，自动递增; 'free' = 未绑定，用户自由选择; 'none' = 不填
type JmidMode = 'locked' | 'free' | 'none'
const myJmidPrefix = ref<string | null>(null)
const jmidMode = ref<JmidMode>('none')
const jmid = ref('')                  // 最终完整 ID，locked 模式自动填充
const jmidInputPrefix = ref('')       // free 模式：用户输入的前缀（3~4位大写字母）
const jmidInputNumber = ref('')       // free 模式：用户输入的数字（1~999，可留空随机）
const jmidLoading = ref(false)
const jmidPrefixStatus = ref<'idle' | 'checking' | 'ok' | 'taken'>('idle')
const jmidFullStatus = ref<'idle' | 'checking' | 'ok' | 'taken'>('idle')
let jmidPrefixTimer: ReturnType<typeof setTimeout> | null = null
let jmidFullTimer: ReturnType<typeof setTimeout> | null = null

async function fetchNextJmid() {
  jmidLoading.value = true
  try {
    const r = await getNextJmid()
    jmid.value = r.jmid
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '获取 JM-ID 失败')
  } finally {
    jmidLoading.value = false
  }
}

// 用户修改前缀时触发
function onJmidPrefixInput() {
  jmidPrefixStatus.value = 'idle'
  jmidFullStatus.value = 'idle'
  if (jmidPrefixTimer) clearTimeout(jmidPrefixTimer)
  const prefix = jmidInputPrefix.value.trim().toUpperCase()
  if (!/^[A-Z]{3,4}$/.test(prefix)) return
  jmidPrefixTimer = setTimeout(async () => {
    jmidPrefixStatus.value = 'checking'
    try {
      const r = await checkJmidPrefix(prefix)
      jmidPrefixStatus.value = r.result ? 'ok' : 'taken'
    } catch {
      jmidPrefixStatus.value = 'idle'
    }
    // 前缀 ok 后如果数字也填了，顺带检查完整 ID
    if (jmidPrefixStatus.value === 'ok') checkFullJmid()
  }, 400)
}

// 用户修改数字时触发
function onJmidNumberInput() {
  jmidFullStatus.value = 'idle'
  if (jmidFullTimer) clearTimeout(jmidFullTimer)
  jmidFullTimer = setTimeout(() => checkFullJmid(), 400)
}

async function checkFullJmid() {
  const prefix = jmidInputPrefix.value.trim().toUpperCase()
  const numStr = jmidInputNumber.value.trim()
  if (!/^[A-Z]{3,4}$/.test(prefix)) return
  if (jmidPrefixStatus.value !== 'ok') return
  if (!numStr) return  // 空数字留到提交时随机
  const num = parseInt(numStr)
  if (isNaN(num) || num < 1 || num > 999) return
  const full = `JM-${prefix}-${String(num).padStart(3, '0')}`
  jmidFullStatus.value = 'checking'
  try {
    const r = await checkJmid(full)
    jmidFullStatus.value = r.result ? 'ok' : 'taken'
  } catch {
    jmidFullStatus.value = 'idle'
  }
}

// 提交前解析最终 jmid 值
async function resolveJmid(): Promise<string | null> {
  if (jmidMode.value === 'none') return null
  if (jmidMode.value === 'locked') return jmid.value || null

  // free 模式
  const prefix = jmidInputPrefix.value.trim().toUpperCase()
  if (!/^[A-Z]{3,4}$/.test(prefix)) {
    ElMessage.warning('请填写 3~4 位大写字母的 JM-ID 前缀')
    return undefined as any  // 返回 undefined 触发调用方中止
  }
  if (jmidPrefixStatus.value === 'taken') {
    ElMessage.warning('该前缀已被占用，请换一个')
    return undefined as any
  }

  let numStr = jmidInputNumber.value.trim()
  if (!numStr) {
    // 随机数字，循环直到找到未占用的
    jmidLoading.value = true
    try {
      for (let attempt = 0; attempt < 20; attempt++) {
        const n = Math.floor(Math.random() * 999) + 1
        const full = `JM-${prefix}-${String(n).padStart(3, '0')}`
        const r = await checkJmid(full)
        if (r.result) return full
      }
      ElMessage.error('随机 JM-ID 生成失败，请手动填写数字')
      return undefined as any
    } finally {
      jmidLoading.value = false
    }
  }

  const num = parseInt(numStr)
  if (isNaN(num) || num < 1 || num > 999) {
    ElMessage.warning('数字须在 1~999 之间')
    return undefined as any
  }
  const full = `JM-${prefix}-${String(num).padStart(3, '0')}`
  if (jmidFullStatus.value === 'taken') {
    ElMessage.warning(`${full} 已被占用，请换一个数字`)
    return undefined as any
  }
  // 提交前再检查一次
  const r = await checkJmid(full)
  if (!r.result) {
    ElMessage.warning(`${full} 已被占用，请换一个数字`)
    return undefined as any
  }
  return full
}

const publishing = ref(false)
async function handlePublish() {
  if (!authStore.isLoggedIn) { showLogin.value = true; return }
  if (!audioUploadResp.value) { ElMessage.warning('请先上传音频文件'); return }
  if (!coverTempId.value) { ElMessage.warning('请先上传封面图片'); return }
  if (!title.value.trim()) { ElMessage.warning('请填写标题'); return }
  if (crew.value.some(c => !c.name.trim())) { ElMessage.warning('请填写完整制作组信息'); return }
  publishing.value = true
  try {
    const resolvedJmid = await resolveJmid()
    if (resolvedJmid === undefined) { publishing.value = false; return }
    await publishSong({
      song_temp_id: audioUploadResp.value.temp_id,
      cover_temp_id: coverTempId.value,
      title: title.value.trim(),
      subtitle: subtitle.value.trim(),
      description: description.value.trim(),
      lyrics: lyrics.value,
      tag_ids: selectedTags.value.map(t => t.id),
      creation_info: {
        creation_type: creationType.value,
        origin_info: creationType.value >= 1
          ? { title: originTitle.value || null, artist: originArtist.value || null, url: originUrl.value || null, origin_type: creationType.value, song_display_id: null }
          : null,
        derivative_info: null,
      },
      production_crew: crew.value.map(c => ({ role: c.role, uid: null, name: c.name })),
      external_links: links.value.filter(l => l.url.trim()),
      explicit: explicit.value,
      jmid: resolvedJmid,
      comment: null,
    })
    ElMessage.success('投稿成功！等待审核中')
    resetForm()
    switchTab('reviews')
  } catch (e) {
    ElMessage.error(e instanceof ApiError ? e.msg : '投稿失败')
  } finally {
    publishing.value = false
  }
}

function resetForm() {
  audioUploadResp.value = null; coverPreview.value = null; coverTempId.value = null
  title.value = ''; subtitle.value = ''; description.value = ''; lyrics.value = ''
  explicit.value = false; creationType.value = 0
  originTitle.value = ''; originArtist.value = ''; originUrl.value = ''
  crew.value = [{ role: '主唱', name: '' }]; links.value = []
  selectedTags.value = []; jmid.value = ''
  jmidInputPrefix.value = ''; jmidInputNumber.value = ''
  jmidPrefixStatus.value = 'idle'; jmidFullStatus.value = 'idle'
  jmidMode.value = myJmidPrefix.value ? 'locked' : 'none'
  if (audioInputRef.value) audioInputRef.value.value = ''
  if (coverInputRef.value) coverInputRef.value.value = ''
}

onMounted(async () => {
  if (authStore.isLoggedIn) {
    try {
      const r = await getMyJmidPrefix()
      myJmidPrefix.value = r.jmid_prefix
      if (myJmidPrefix.value) {
        jmidMode.value = 'locked'
        await fetchNextJmid()
      } else {
        jmidMode.value = 'none'
      }
    } catch {}
  }
})
</script>

<template>
  <div class="create-page">
    <LoginDialog v-model="showLogin" />

    <div class="create-hero">
      <h1 class="hero-title">创作工坊</h1>
      <p class="hero-sub">分享你的音乐作品，让更多人听见</p>
    </div>

    <div class="create-container">
      <div v-if="!authStore.isLoggedIn" class="unauth-card">
        <p class="unauth-text">登录后即可投稿作品</p>
        <button class="btn-primary" @click="showLogin = true">立即登录</button>
      </div>

      <template v-else>
        <div class="tab-bar">
          <button class="tab-btn" :class="{ active: activeTab === 'publish' }" @click="switchTab('publish')">发布新作品</button>
          <button class="tab-btn" :class="{ active: activeTab === 'reviews' }" @click="switchTab('reviews')">我的投稿记录</button>
        </div>

        <!-- 发布表单 -->
        <div v-show="activeTab === 'publish'" class="publish-layout">
          <!-- 左栏：媒体 -->
          <div class="upload-col">
            <div class="card">
              <div class="card-label">封面图片</div>
              <label class="cover-drop" :class="{ uploading: coverUploading }">
                <input ref="coverInputRef" type="file" accept="image/*" hidden @change="onCoverChange" />
                <img v-if="coverPreview" :src="coverPreview" class="cover-preview" />
                <div v-else class="cover-placeholder">
                  <span>点击上传封面</span>
                  <span class="hint">JPG / PNG / WebP ≤ 8 MB</span>
                  <span class="hint">封面将自动裁剪为正方形，请勿使用透明图片</span>
                </div>
                <div v-if="coverUploading" class="upload-overlay">上传中…</div>
              </label>
            </div>

            <div class="card">
              <div class="card-label">音频文件</div>
              <label class="audio-drop" :class="{ uploaded: !!audioUploadResp, uploading: audioUploading }">
                <input ref="audioInputRef" type="file" accept="audio/*" hidden @change="onAudioChange" />
                <template v-if="audioUploadResp">
                  <span class="up-icon">🎵</span>
                  <div class="audio-info">
                    <span class="audio-dur">{{ Math.floor(audioUploadResp.duration_secs / 60) }}:{{ String(audioUploadResp.duration_secs % 60).padStart(2,'0') }}</span>
                    <span class="hint">点击重新上传</span>
                  </div>
                </template>
                <template v-else-if="audioUploading">
                  <span class="up-icon spin">⏳</span>
                  
                  <span>上传中…</span>
                </template>
                <template v-else>
                  <span>点击上传音频</span>
                  <span class="hint">MP3 / FLAC / WAV / OGG ≤ 20 MB</span>
                </template>
              </label>
            </div>
          </div>

          <!-- 右栏：表单 -->
          <div class="form-col">
            <!-- 基本信息 -->
            <div class="card">
              <div class="card-title">基本信息</div>
              <p class="card-desc">尊重劳动成果，请勿搬运作品。暂不收录时长或结构明显短于 TV Size 的作品。</p>
              <div class="form-row">
                <label class="field-label">标题 <span class="req">*</span></label>
                <input v-model="title" class="field-input" placeholder="作品标题" maxlength="100" />
                <p class="field-hint">填写一个您认为适合永久流传的纯文字标题。如钢铁雄基4这类与原曲标题关联性强的纯文字标题。请不要在标题中添加标签、Emoji等复杂内容。请不要使用标题来引流，后续可能会做专门用于推荐的标题。</p>
              </div>
              <div class="form-row">
                <label class="field-label">副标题</label>
                <input v-model="subtitle" class="field-input" placeholder="作品副标题" maxlength="100" />
                <p class="field-hint">可选。副标题通常是一句简短的描述，或是OST的出处，如《XXX》OP、《XXX》游戏原声带。无需在此处填写原作标题，原作信息请在后方对应的输入框中填写。</p>
              </div>
              <div class="form-row">
                <label class="field-label">简介</label>
                <textarea v-model="description" class="field-textarea" placeholder="作品简介…" rows="3" maxlength="500" />
                <p class="field-hint">介绍一下你的作品，编写一段故事，或是描述一下你的创作历程吧。</p>
              </div>
              <div class="form-row form-inline">
                <label class="field-label">含敏感内容</label>
                <label class="toggle">
                  <input type="checkbox" v-model="explicit" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <p class="explicit-hint">如果作品含有脏话、低俗、暴力等内容，尤其是儿童不宜内容，请务必正确标记。</p>
            </div>

            <!-- 创作类型 -->
            <div class="card">
              <div class="card-title">创作类型</div>
              <p class="card-desc">如果你的作品是对现有作品的再创作（如对《D大调卡农》的改编），请选择二创并填写原作信息。如果你的作品是对哈基米音乐的再创作（如翻唱），请选择三创。</p>
              <div class="type-btns">
                <button class="type-btn" :class="{ active: creationType === 0 }" @click="creationType = 0">原创</button>
                <button class="type-btn" :class="{ active: creationType === 1 }" @click="creationType = 1">二次创作</button>
                <button class="type-btn" :class="{ active: creationType === 2 }" @click="creationType = 2">三次创作</button>
              </div>
              <div v-if="creationType >= 1" class="origin-section">
                <div class="form-row">
                  <label class="field-label">原作标题</label>
                  <input v-model="originTitle" class="field-input" placeholder="原作名称" />
                </div>
                <div class="form-row">
                  <label class="field-label">原作作者</label>
                  <input v-model="originArtist" class="field-input" placeholder="原作作者" />
                </div>
                <div class="form-row">
                  <label class="field-label">原作链接</label>
                  <input v-model="originUrl" class="field-input" placeholder="https://…（可选）" />
                </div>
              </div>
            </div>

            <!-- 制作组 -->
            <div class="card">
              <div class="card-title-row">
                <span class="card-title">制作组成员</span>
                <button class="btn-add" @click="addCrew">+ 添加</button>
              </div>
              <p class="card-desc">如果该作品的制作者不止一人，请在此添加并选择角色（如混音、编曲）。你可以选择站内用户，也可以仅填写他的名字。</p>
              <div v-for="(item, i) in crew" :key="i" class="crew-row">
                <input v-model="item.role" class="field-input crew-role" placeholder="角色（如：主唱）" />
                <input v-model="item.name" class="field-input crew-name" placeholder="名称" />
                <button v-if="crew.length > 1" class="btn-remove" @click="removeCrew(i)">×</button>
              </div>
            </div>

            <!-- 标签 -->
            <div class="card">
              <div class="card-title">标签</div>
              <p class="card-desc">使用标签描述你的曲风类型（如古典、流行、J - Pop、ACG、R&B）、创作类型（如纯净哈基米、原曲不使用）。不建议添加过多的标签。若只有英文请按照每单词首字母大写空格隔开，或使用行业标准写法。请勿使用符号和Emoji。</p>
              <div class="tags-selected">
                <span v-for="tag in selectedTags" :key="tag.id" class="tag-chip">
                  {{ tag.name }}<button class="tag-del" @click="removeTag(tag.id)">×</button>
                </span>
              </div>
              <div class="tag-search-wrap">
                <input
                  v-model="tagQuery"
                  class="field-input"
                  :class="{ loading: tagSearching }"
                  placeholder="搜索已有标签，或输入后按 Enter 新建…"
                  @input="onTagInput"
                  @focus="onTagInput"
                  @keydown.enter.prevent="onTagEnter"
                  @blur="setTimeout(() => { tagDropdown = false }, 200)"
                />
                <div v-if="tagDropdown" class="tag-dropdown">
                  <div v-if="tagSearching" class="tag-option tag-hint">搜索中…</div>
                  <template v-else-if="tagResults.length > 0">
                    <div
                      v-for="tag in tagResults"
                      :key="tag.id"
                      class="tag-option"
                      @mousedown.prevent="selectTag(tag)"
                    >{{ tag.name }}</div>
                  </template>
                  <div v-else-if="tagNoResult" class="tag-option tag-hint">
                    无匹配结果，按 Enter 新建标签「{{ tagQuery.trim() }}」
                  </div>
                </div>
              </div>
            </div>

            <!-- 外链 -->
            <div class="card">
              <div class="card-title-row">
                <span class="card-title">外部链接</span>
                <button class="btn-add" @click="addLink">+ 添加</button>
              </div>
              <p class="card-desc">如果你的作品已发表在其他平台上，请在此添加链接。</p>
              <div v-for="(item, i) in links" :key="i" class="link-row">
                <select v-model="item.platform" class="field-select">
                  <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
                </select>
                <input v-model="item.url" class="field-input" placeholder="https://…" />
                <button class="btn-remove" @click="removeLink(i)">×</button>
              </div>
              <p v-if="links.length === 0" class="empty-hint">暂无外链</p>
            </div>

            <!-- 歌词 -->
            <div class="card">
              <div class="card-title-row">
                <span class="card-title">歌词</span>
                <a href="https://lrc-maker.github.io/" target="_blank" rel="noopener" class="btn-tool">LRC 制作工具</a>
              </div>
              <p class="card-desc">可以留空或使用纯文本歌词，建议使用LRC格式的滚动歌词。</p>
              <textarea v-model="lyrics" class="field-textarea lyrics-area" placeholder="粘贴歌词（LRC 格式或纯文本）…" rows="8" />
            </div>

            <!-- JM-ID -->
            <div class="card">
              <div class="card-title">基米ID</div>
              <p class="card-desc">基米 ID 是作品的唯一标识，格式为JM-ABCD-001前缀由每位创作者独占，一旦设定则不可更改。</p>

              <!-- 已绑定前缀：自动填充模式 -->
              <div v-if="myJmidPrefix" class="jmid-locked">
                <div class="jmid-locked-info">
                  <span class="jmid-prefix-badge">{{ myJmidPrefix }}</span>
                  <span class="hint-text">你的专属前缀已绑定，下一个 ID 将自动生成</span>
                </div>
                <div class="jmid-row">
                  <input :value="jmid" readonly class="field-input jmid-readonly" placeholder="点击右侧按钮获取…" />
                  <button class="btn-outline" :disabled="jmidLoading" @click="fetchNextJmid">
                    {{ jmidLoading ? '获取中…' : '自动填充' }}
                  </button>
                </div>
              </div>

              <!-- 未绑定前缀：自由选择模式 -->
              <div v-else class="jmid-free">
                <div class="jmid-mode-btns">
                  <button class="type-btn" :class="{ active: jmidMode === 'none' }" @click="jmidMode = 'none'">不设置 ID</button>
                  <button class="type-btn" :class="{ active: jmidMode === 'free' }" @click="jmidMode = 'free'">自定义 JM-ID</button>
                </div>

                <div v-if="jmidMode === 'free'" class="jmid-free-inputs">
                  <!-- 前缀输入 -->
                  <div class="form-row">
                    <label class="field-label">
                      前缀<span class="req">*</span>
                      <span class="field-hint" style="margin-left:6px">3~4 位大写英文字母，永久绑定到你的账号</span>
                    </label>
                    <div class="jmid-prefix-wrap">
                      <span class="jmid-static-prefix">JM-</span>
                      <input
                        v-model="jmidInputPrefix"
                        class="field-input jmid-prefix-input"
                        placeholder="XXXX"
                        maxlength="4"
                        @input="jmidInputPrefix = jmidInputPrefix.toUpperCase(); onJmidPrefixInput()"
                      />
                      <span v-if="jmidPrefixStatus === 'checking'" class="jmid-status checking">检查中…</span>
                      <span v-else-if="jmidPrefixStatus === 'ok'" class="jmid-status ok">✓ 可用</span>
                      <span v-else-if="jmidPrefixStatus === 'taken'" class="jmid-status taken">✗ 已占用</span>
                    </div>
                  </div>
                  <!-- 数字输入 -->
                  <div class="form-row">
                    <label class="field-label">
                      序号
                      <span class="field-hint" style="margin-left:6px">1~999，留空则随机分配</span>
                    </label>
                    <div class="jmid-prefix-wrap">
                      <span class="jmid-static-prefix">JM-{{ jmidInputPrefix || 'XXXX' }}-</span>
                      <input
                        v-model="jmidInputNumber"
                        class="field-input jmid-num-input"
                        placeholder="自动"
                        type="number"
                        min="1"
                        max="999"
                        @input="onJmidNumberInput"
                      />
                      <span v-if="jmidInputNumber && jmidFullStatus === 'checking'" class="jmid-status checking">检查中…</span>
                      <span v-else-if="jmidInputNumber && jmidFullStatus === 'ok'" class="jmid-status ok">✓ 可用</span>
                      <span v-else-if="jmidInputNumber && jmidFullStatus === 'taken'" class="jmid-status taken">✗ 已占用</span>
                    </div>
                  </div>
                  <!-- 预览 -->
                  <p v-if="jmidInputPrefix" class="hint-text">
                    预览：<span class="jmid-preview">JM-{{ jmidInputPrefix }}-{{ jmidInputNumber ? String(parseInt(jmidInputNumber)).padStart(3,'0') : '???' }}</span>
                  </p>
                </div>

                <p v-if="jmidMode === 'none'" class="hint-text">不设置 JM-ID，系统将分配随机编号，且无法绑定专属前缀</p>
              </div>
            </div>

            <!-- 提交 -->
            <button class="btn-submit" :disabled="publishing" @click="handlePublish">
              {{ publishing ? '投稿中…' : '提交投稿' }}
            </button>
          </div>
        </div>

        <!-- 我的作品管理 -->
        <div v-show="activeTab === 'reviews'" class="reviews-section">
          <div v-if="mySongsLoading" class="loading-state">加载中…</div>
          <div v-else-if="mySongs.length === 0" class="empty-state">暂无已发布作品</div>
          <div v-else class="manage-list">
            <ManageSongCard
              v-for="song in mySongs"
              :key="song.id"
              :song="song"
            />
          </div>
          <div v-if="mySongsTotal > MY_SONGS_PAGE_SIZE" class="panel-footer">
            <el-pagination
              background
              layout="prev, pager, next"
              :current-page="mySongsPage + 1"
              :page-size="MY_SONGS_PAGE_SIZE"
              :total="mySongsTotal"
              @current-change="onMySongsPageChange"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.create-page {
  min-height: 100vh;
  background: var(--hw-bg-primary);
}

/* Hero */
.create-hero {
  padding: 48px 24px 32px;
  text-align: center;
  background: linear-gradient(135deg, var(--hw-bg-secondary) 0%, var(--hw-bg-primary) 100%);
  border-bottom: 1px solid var(--hw-border);
}
.hero-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--hw-text-primary);
  margin-bottom: 8px;
}
.hero-sub {
  color: var(--hw-text-secondary);
  font-size: 1rem;
}

/* Container */
.create-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 20px 80px;
}

/* Unauth */
.unauth-card {
  text-align: center;
  padding: 80px 24px;
}
.unauth-icon { font-size: 3rem; margin-bottom: 16px; }
.unauth-text { color: var(--hw-text-secondary); margin-bottom: 24px; font-size: 1.1rem; }

/* Tab */
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--hw-border);
  padding-bottom: 0;
}
.tab-btn {
  padding: 10px 24px;
  border: none;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 0.95rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.2s, border-color 0.2s;
}
.tab-btn.active {
  color: var(--hw-accent);
  border-bottom-color: var(--hw-accent);
  font-weight: 600;
}
.tab-btn:hover:not(.active) { color: var(--hw-text-primary); }

/* Publish layout */
.publish-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 768px) {
  .publish-layout { grid-template-columns: 1fr; }
}

/* Card */
.card {
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}
.card-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--hw-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}
.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--hw-text-primary);
  margin-bottom: 16px;
}
.card-subtitle {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--hw-text-secondary);
}
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

/* Cover upload */
.cover-drop {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border: 2px dashed var(--hw-border);
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s;
}
.cover-drop:hover { border-color: var(--hw-accent); }
.cover-drop.uploading { opacity: 0.6; pointer-events: none; }
.cover-preview { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--hw-text-secondary);
  font-size: 0.85rem;
}
.up-icon { font-size: 2rem; }
.upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

/* Audio upload */
.audio-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  min-height: 100px;
  border: 2px dashed var(--hw-border);
  border-radius: 10px;
  cursor: pointer;
  color: var(--hw-text-secondary);
  font-size: 0.85rem;
  transition: border-color 0.2s;
}
.audio-drop:hover { border-color: var(--hw-accent); }
.audio-drop.uploaded { border-color: var(--hw-accent); background: color-mix(in srgb, var(--hw-accent) 8%, transparent); }
.audio-drop.uploading { opacity: 0.6; pointer-events: none; }
.audio-info { text-align: center; }
.audio-dur { font-size: 1.3rem; font-weight: 600; color: var(--hw-text-primary); display: block; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { display: inline-block; animation: spin 1s linear infinite; }

/* Form */
.form-col { }
.form-row { margin-bottom: 14px; }
.form-row.form-inline { display: flex; align-items: center; gap: 12px; }
.field-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--hw-text-secondary);
  margin-bottom: 6px;
}
.req { color: #e85c5c; }
.field-input,
.field-textarea,
.field-select {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--hw-border);
  border-radius: 8px;
  background: var(--hw-bg-primary);
  color: var(--hw-text-primary);
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.field-input:focus,
.field-textarea:focus,
.field-select:focus {
  border-color: var(--hw-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--hw-accent) 15%, transparent);
}
.field-textarea { resize: vertical; }
.lyrics-area { font-family: monospace; font-size: 0.85rem; }
.field-select { cursor: pointer; }

/* Type buttons */
.type-btns { display: flex; gap: 8px; margin-bottom: 14px; }
.type-btn {
  padding: 7px 18px;
  border: 1px solid var(--hw-border);
  border-radius: 20px;
  background: transparent;
  color: var(--hw-text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.type-btn.active {
  background: var(--hw-accent);
  border-color: var(--hw-accent);
  color: #fff;
}
.type-btn:hover:not(.active) { border-color: var(--hw-accent); color: var(--hw-accent); }
.origin-section { border-top: 1px solid var(--hw-border); padding-top: 14px; margin-top: 4px; }

/* Crew */
.crew-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.crew-role { flex: 0 0 140px; }
.crew-name { flex: 1; }

/* Links */
.link-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.link-row .field-select { flex: 0 0 120px; width: 120px; }
.link-row .field-input { flex: 1; }
.empty-hint { color: var(--hw-text-secondary); font-size: 0.85rem; }

/* Buttons */
.btn-add {
  padding: 5px 14px;
  border: 1px solid var(--hw-accent);
  border-radius: 6px;
  background: transparent;
  color: var(--hw-accent);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-add:hover { background: var(--hw-accent); color: #fff; }
.btn-remove {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: 1px solid var(--hw-border);
  border-radius: 6px;
  background: transparent;
  color: var(--hw-text-secondary);
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-remove:hover { border-color: #e85c5c; color: #e85c5c; }
.btn-primary {
  padding: 10px 28px;
  background: var(--hw-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.85; }
.btn-outline {
  padding: 8px 16px;
  border: 1px solid var(--hw-accent);
  border-radius: 8px;
  background: transparent;
  color: var(--hw-accent);
  font-size: 0.88rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-outline:hover:not(:disabled) { background: var(--hw-accent); color: #fff; }
.btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-submit {
  width: 100%;
  padding: 13px;
  background: var(--theme-color);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 8px;
}
.btn-submit:hover:not(:disabled) { opacity: 0.85; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* Tags */
.tags-selected { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--hw-accent) 15%, transparent);
  color: var(--hw-accent);
  border-radius: 20px;
  font-size: 0.82rem;
}
.tag-del {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  padding: 0;
}
.tag-search-wrap { position: relative; }
.tag-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--hw-bg-secondary);
  border: 1px solid var(--hw-border);
  border-radius: 8px;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.tag-option {
  padding: 9px 14px;
  cursor: pointer;
  font-size: 0.88rem;
  color: var(--hw-text-primary);
  transition: background 0.15s;
}
.tag-option:hover { background: var(--hw-bg-primary); }
.tag-hint { color: var(--hw-text-secondary); cursor: default; font-style: italic; }
.tag-hint:hover { background: transparent; }

/* JM-ID */
.jmid-row { display: flex; gap: 8px; align-items: center; }
.jmid-row .field-input { flex: 1; }
.jmid-readonly { background: var(--hw-bg-secondary) !important; color: var(--hw-text-secondary); cursor: default; }
.jmid-locked { display: flex; flex-direction: column; gap: 10px; }
.jmid-locked-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.jmid-prefix-badge {
  display: inline-block;
  padding: 3px 12px;
  background: color-mix(in srgb, var(--theme-color) 15%, transparent);
  color: var(--theme-color);
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: monospace;
  letter-spacing: 1px;
}
.jmid-mode-btns { display: flex; gap: 8px; margin-bottom: 14px; }
.jmid-free-inputs { display: flex; flex-direction: column; gap: 0; }
.jmid-prefix-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.jmid-static-prefix {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--hw-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.jmid-prefix-input { width: 80px; flex-shrink: 0; font-family: monospace; }
.jmid-num-input { width: 80px; flex-shrink: 0; font-family: monospace; }
.jmid-status {
  font-size: 0.78rem;
  white-space: nowrap;
  flex-shrink: 0;
}
.jmid-status.checking { color: var(--hw-text-secondary); }
.jmid-status.ok { color: #28a745; font-weight: 600; }
.jmid-status.taken { color: #e85c5c; font-weight: 600; }
.jmid-preview {
  font-family: monospace;
  font-weight: 700;
  color: var(--theme-color);
  font-size: 0.9rem;
}
.hint-text { font-size: 0.8rem; color: var(--hw-text-secondary); margin-top: 6px; }
.hint { font-size: 0.78rem; color: var(--hw-text-secondary); }

/* Toggle */
.toggle { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--hw-border);
  border-radius: 22px;
  transition: background 0.2s;
  cursor: pointer;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle input:checked + .toggle-slider { background: var(--theme-color); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }

/* Reviews / manage */
.reviews-section { }
.loading-state, .empty-state {
  text-align: center;
  padding: 60px;
  color: var(--hw-text-secondary);
}
.manage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel-footer {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
:deep(.el-pagination.is-background .btn-next),
:deep(.el-pagination.is-background .btn-prev),
:deep(.el-pagination.is-background .el-pager li) {
  background: var(--hw-bg-primary);
  border: 1px solid var(--hw-border);
  color: var(--hw-text-secondary);
}
:deep(.el-pagination.is-background .el-pager li.is-active) {
  background: var(--theme-color);
  border-color: var(--theme-color);
  color: #fff;
}

/* Field & card hints */
.card-desc {
  font-size: 0.78rem;
  color: var(--hw-text-secondary);
  margin: -8px 0 14px;
  line-height: 1.5;
}
.field-hint {
  font-size: 0.75rem;
  color: var(--hw-text-secondary);
  margin: 4px 0 0;
  line-height: 1.4;
}
.explicit-hint {
  font-size: 0.75rem;
  color: #e8a000;
  margin: 4px 0 0;
  line-height: 1.5;
  padding: 6px 10px;
  background: color-mix(in srgb, #e8a000 10%, transparent);
  border-radius: 6px;
  border-left: 2px solid #e8a000;
}

/* LRC tool button */
.btn-tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid var(--hw-accent);
  border-radius: 6px;
  color: var(--hw-accent);
  font-size: 0.82rem;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-tool:hover {
  background: var(--hw-accent);
  color: #fff;
}

/* Misc */
@media (max-width: 480px) {
  .type-btns { flex-wrap: wrap; }
  .crew-row { flex-wrap: wrap; }
  .crew-role { flex: 0 0 100%; }
  .link-row { flex-wrap: wrap; }
  .link-row .field-select { flex: 0 0 100%; width: 100%; }
}
</style>

