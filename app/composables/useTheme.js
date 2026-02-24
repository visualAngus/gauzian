/**
 * Composable useTheme
 * Gère le thème clair/sombre globalement via une classe sur <html>
 * Persistance dans localStorage sous la clé "gauzian-theme"
 */
export const useTheme = () => {
  const isDark = useState('theme-dark', () => false);

  const applyClass = (dark) => {
    if (!import.meta.client) return;
    document.documentElement.classList.toggle('dark', dark);
  };

  const initTheme = () => {
    if (!import.meta.client) return;
    const saved = localStorage.getItem('gauzian-theme');
    const dark = saved
      ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark.value = dark;
    applyClass(dark);
  };

  const toggleTheme = () => {
    isDark.value = !isDark.value;
    localStorage.setItem('gauzian-theme', isDark.value ? 'dark' : 'light');
    applyClass(isDark.value);
  };

  return { isDark, initTheme, toggleTheme };
};
