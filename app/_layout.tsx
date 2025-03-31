// app/_layout.tsx
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SettingsProvider } from '../contexts/SettingsContext';
import RootLayoutNav from './RootLayoutNav';
import { useSettings } from '../contexts/SettingsContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <ThemeWrapper>
        <RootLayoutNav />
      </ThemeWrapper>
    </SettingsProvider>
  );
}

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useSettings();
  const navigationTheme = theme === 'dark' ? DarkTheme : DefaultTheme;
  
  return (
    <ThemeProvider value={navigationTheme}>
      {children}
    </ThemeProvider>
  );
}