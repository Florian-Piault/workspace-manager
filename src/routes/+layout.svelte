<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { theme } from '$lib/theme.svelte';
  import { settings } from '$lib/settings.svelte';
  import { installGlobalKeybindMatcher } from '$lib/keybinds.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import QuickSwitchPalette from '$lib/components/QuickSwitchPalette.svelte';

  let { children } = $props();

  onMount(() => {
    theme.init();
    settings.init().catch((err) => {
      console.error('[Settings] init failed:', err);
    });
    // Un seul listener global pour tous les raccourcis configurables.
    return installGlobalKeybindMatcher();
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
