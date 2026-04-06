<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { store } from '$lib/state.svelte';
  import '@xterm/xterm/css/xterm.css';

  let { config, nodeId }: { config: Record<string, unknown>; nodeId: string } = $props();

  let container: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let ptyId: string | null = $state(null);
  let exited = $state(false);
  let error = $state<string | null>(null);

  let unlistenData: (() => void) | null = null;
  let unlistenExit: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  async function startPty(targetId: string) {
    const cwd = store.activeWorkspace?.path ?? '/';

    try {
      ptyId = await invoke<string>('pty_create', { id: targetId, cwd });
    } catch (err) {
      error = String(err);
      return;
    }

    unlistenData = await listen<string>(`pty_data:${ptyId}`, (event) => {
      terminal.write(event.payload);
    });

    unlistenExit = await listen(`pty_exit:${ptyId}`, () => {
      exited = true;
    });
  }

  onMount(async () => {
    terminal = new Terminal({
      theme: {
        background: '#0f0f0f',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#3a3a3a',
      },
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      cursorBlink: true,
      allowTransparency: false,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    // Restaurer le scrollback persisté
    if (config.scrollback && typeof config.scrollback === 'string') {
      const binary = atob(config.scrollback as string);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      terminal.write(bytes);
    }

    await startPty(nodeId);

    terminal.onData((data) => {
      if (!ptyId) return;
      invoke('pty_write', { id: ptyId, data }).catch(() => {});
    });

    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ptyId) {
        invoke('pty_resize', { id: ptyId, cols: terminal.cols, rows: terminal.rows }).catch(() => {});
      }
    });
    resizeObserver.observe(container);
  });

  onDestroy(async () => {
    resizeObserver?.disconnect();
    unlistenData?.();
    unlistenExit?.();
    if (ptyId) {
      try {
        const scrollback = await invoke<string>('pty_kill', { id: ptyId });
        if (scrollback) {
          store.updateWidgetConfig(nodeId, { scrollback });
        }
      } catch {
        // ignorer les erreurs à la fermeture
      }
    }
    terminal?.dispose();
  });

  async function restart() {
    exited = false;
    error = null;
    unlistenData?.();
    unlistenExit?.();
    unlistenData = null;
    unlistenExit = null;
    terminal.clear();
    await startPty(nodeId + '_' + Date.now());
    if (ptyId) {
      invoke('pty_resize', { id: ptyId, cols: terminal.cols, rows: terminal.rows }).catch(() => {});
    }
  }
</script>

<div class="relative h-full w-full overflow-hidden bg-[#0f0f0f]">
  <div bind:this={container} class="h-full w-full p-1"></div>

  {#if error}
    <div class="absolute inset-0 flex items-center justify-center bg-black/70">
      <div class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/50 bg-card p-6">
        <p class="text-center text-sm text-destructive">Impossible de démarrer le shell :</p>
        <code class="text-center text-xs text-muted-foreground">{error}</code>
        <button
          class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onclick={restart}
        >
          Réessayer
        </button>
      </div>
    </div>
  {:else if exited}
    <div class="absolute inset-0 flex items-center justify-center bg-black/60">
      <div class="flex flex-col items-center gap-3">
        <span class="text-sm text-muted-foreground">Processus terminé.</span>
        <button
          class="rounded px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          onclick={restart}
        >
          Relancer
        </button>
      </div>
    </div>
  {/if}
</div>
