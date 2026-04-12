<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import type { Snippet } from 'svelte';
  import { store } from '$lib/state.svelte';
  import { settings, TERMINAL_COLOR_PRESETS } from '$lib/settings.svelte';
  import { nodeExists } from '$lib/layout';
  import '@xterm/xterm/css/xterm.css';

  let { config, nodeId, pillControls }: { config: Record<string, unknown>; nodeId: string; pillControls?: Snippet } = $props();

  let container: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let terminalReady = $state(false);
  let ptyId: string | null = $state(null);
  let exited = $state(false);
  let error = $state<string | null>(null);

  let unlistenData: (() => void) | null = null;
  let unlistenExit: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let fgPollTimer: ReturnType<typeof setInterval> | null = null;
  let mounted = true;

  // Applique les settings terminal en temps réel après le montage
  $effect(() => {
    const fontSize = settings.terminal.fontSize;
    const cursorBlink = settings.terminal.cursorBlink;
    const cursorStyle = settings.terminal.cursorStyle;
    const colorPreset = settings.terminal.colorPreset;
    if (!terminalReady) return;
    terminal.options.fontSize = fontSize;
    terminal.options.cursorBlink = cursorBlink;
    terminal.options.cursorStyle = cursorStyle;
    terminal.options.theme = TERMINAL_COLOR_PRESETS[colorPreset];
    fitAddon.fit();
    terminal.refresh(0, terminal.rows - 1);
    if (ptyId) {
      invoke('pty_resize', { id: ptyId, cols: terminal.cols, rows: terminal.rows }).catch(() => {});
    }
  });

  async function startPty(targetId: string) {
    const cwd = store.activeWorkspace?.path ?? '/';

    try {
      ptyId = await invoke<string>('pty_create', { id: targetId, cwd });
    } catch (err) {
      error = String(err);
      return;
    }

    if (!mounted) {
      // Composant détruit pendant l'await — nettoyer le PTY et sortir
      invoke('pty_kill', { id: ptyId }).catch(() => {});
      ptyId = null;
      return;
    }

    unlistenData = await listen<string>(`pty_data:${ptyId}`, (event) => {
      terminal.write(event.payload);
    });

    unlistenExit = await listen(`pty_exit:${ptyId}`, () => {
      exited = true;
      if (fgPollTimer !== null) { clearInterval(fgPollTimer); fgPollTimer = null; }
    });

    const currentPtyId = ptyId;
    fgPollTimer = setInterval(async () => {
      if (!mounted || !currentPtyId) return;
      try {
        const name = await invoke<string>('pty_fg_process', { id: currentPtyId });
        store.setAutoLabel(nodeId, name);
      } catch { /* PTY disparu ou pas de PID */ }
    }, 1500);
  }

  onMount(async () => {
    const t = settings.terminal;
    terminal = new Terminal({
      theme: TERMINAL_COLOR_PRESETS[t.colorPreset],
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
      fontSize: t.fontSize,
      cursorBlink: t.cursorBlink,
      cursorStyle: t.cursorStyle,
      allowTransparency: false,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    terminal.onData((data) => {
      if (!ptyId) return;
      invoke('pty_write', { id: ptyId, data }).catch(() => {});
    });

    await startPty(nodeId);

    // Restaurer le scrollback : live (remount après split) > persisté (redémarrage app)
    const liveScrollback = await invoke<string>('pty_get_scrollback', { id: ptyId }).catch(() => '');
    const scrollbackSrc = liveScrollback || (config.scrollback as string | undefined) || '';
    if (scrollbackSrc) {
      const binary = atob(scrollbackSrc);
      terminal.write(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    }

    resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ptyId) {
        invoke('pty_resize', { id: ptyId, cols: terminal.cols, rows: terminal.rows }).catch(() => {});
      }
    });
    resizeObserver.observe(container);
    terminalReady = true;
  });

  onDestroy(async () => {
    mounted = false;
    resizeObserver?.disconnect();
    unlistenData?.();
    unlistenExit?.();
    if (fgPollTimer !== null) { clearInterval(fgPollTimer); fgPollTimer = null; }
    if (ptyId) {
      // Si le nœud est encore dans le layout, c'est un remount (split) — ne pas tuer le PTY
      const layout = store.activeLayout;
      const isRemount = layout ? nodeExists(layout.root, nodeId) : false;
      if (!isRemount) {
        try {
          const scrollback = await invoke<string>('pty_kill', { id: ptyId });
          if (scrollback) {
            store.updateWidgetConfig(nodeId, { scrollback });
          }
        } catch {
          // ignorer les erreurs à la fermeture
        }
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

<div class="flex h-full w-full flex-col overflow-hidden">
  {#if pillControls}
    <div class="flex h-8 shrink-0 items-center justify-end border-b border-border bg-muted/40 px-2">
      {@render pillControls()}
    </div>
  {/if}

  <div class="relative min-h-0 flex-1 overflow-hidden bg-[#0f0f0f]">
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
</div>
