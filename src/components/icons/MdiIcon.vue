<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  path: string
  size?: number | string
  viewBox?: string
}>(), {
  size: 1,
  viewBox: '0 0 24 24',
})

const iconSize = computed(() => {
  return typeof props.size === 'number' ? `${props.size}em` : props.size
})
</script>

<template>
  <svg
    class="mdi-icon"
    :width="iconSize"
    :height="iconSize"
    :viewBox="viewBox"
    fill="currentColor"
    aria-hidden="true"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.mdi-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>

