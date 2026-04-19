<script lang="ts">
  let { content, filePath }: { content: string; filePath: string | null } = $props();

  const title = $derived(filePath?.split('/').pop() ?? 'Aperçu HTML');
</script>

<!--
  sandbox="allow-scripts" lets inline JS run but prevents:
  - Access to parent frame (allow-same-origin is intentionally omitted)
  - Form submissions
  - Navigation
  - No access to Tauri APIs (isolated browsing context)
-->
<iframe
  srcdoc={content}
  sandbox="allow-scripts"
  title={title}
  class="h-full w-full border-0 bg-white"
></iframe>
