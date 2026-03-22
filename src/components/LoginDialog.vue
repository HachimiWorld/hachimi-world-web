<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="登录"
    width="400px"
    class="login-dialog"
    :close-on-click-modal="true"
  >
    <div class="login-placeholder">
      <p>登录功能开发中...</p>
    </div>
    <template #footer>
      <el-button @click="close">取消</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.login-placeholder {
  padding: 2rem 0;
  text-align: center;
  color: var(--hw-text-secondary);
}
</style>

