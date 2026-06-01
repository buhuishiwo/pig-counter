<template>
  <footer class="footer">
    <span class="footer-brand">智慧猪群识别系统</span>
    <span class="footer-dot">·</span>
    <span>Powered By 智能数猪大模型</span>
    <span class="footer-dot">·</span>
    <span>© {{ year }}</span>
  </footer>
</template>

<script>
export default {
  name: 'AppFooter',
  computed: {
    year() { return new Date().getFullYear() }
  }
}
</script>

<style scoped>
.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-4);
  margin-top: 12px
}

.footer-brand {
  font-weight: 600;
  color: var(--text-3)
}

.footer-dot {
  color: var(--sep-opaque)
}
</style>
