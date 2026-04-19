<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme.svelte';
  import { settings } from '$lib/settings.svelte';
  import { terminalHistory } from '$lib/terminal_history.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import QuickSwitchPalette from '$lib/components/QuickSwitchPalette.svelte';

  let { children } = $props();

  onMount(async () => {
    theme.init();
    await settings.init().catch((err) => {
      console.error('[Settings] init failed:', err);
    });
    await terminalHistory.init().catch((err) => {
      console.error('[TerminalHistory] init failed:', err);
    });
  });
</script>

<div class="flex h-screen w-screen overflow-hidden bg-background text-foreground
            {settings.general.sidebarPosition === 'right' ? 'flex-row-reverse' : ''}">
  <Sidebar />
  <main class="relative flex-1 overflow-hidden">
    {@render children()}
  </main>
  <QuickSwitchPalette />
</div>
