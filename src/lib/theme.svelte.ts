const STORAGE_KEY = 'workspace-manager-theme';

function createThemeStore() {
  let dark = $state(false);

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    dark = saved !== null
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  }

  function toggle() {
    dark = !dark;
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }

  return {
    get dark() { return dark; },
    init,
    toggle,
  };
}

export const theme = createThemeStore();
