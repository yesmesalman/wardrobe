import {StatusBar} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  LibraryIcon,
  OutfitIcon,
  SettingsIcon,
  TrendingIcon,
} from './src/components/icons';
import {AddTabButton} from './src/components/AddTabButton';
import {theme} from './src/constants';
import {LibraryScreen} from './src/screens/LibraryScreen';
import {OutfitScreen} from './src/screens/OutfitScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {TrendingScreen} from './src/screens/TrendingScreen';
import {navigationRef} from './src/navigationRef';
import {WardrobeProvider} from './src/state/WardrobeContext';

const Tab = createBottomTabNavigator();

interface TabIconProps {
  color: string;
  size: number;
}
const outfitIcon = ({color, size}: TabIconProps) => (
  <OutfitIcon color={color} size={size} />
);
const libraryIcon = ({color, size}: TabIconProps) => (
  <LibraryIcon color={color} size={size} />
);
const trendingIcon = ({color, size}: TabIconProps) => (
  <TrendingIcon color={color} size={size} />
);
const settingsIcon = ({color, size}: TabIconProps) => (
  <SettingsIcon color={color} size={size} />
);

const EmptyScreen = () => null;

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.background,
    card: theme.surface,
    border: theme.line,
    primary: theme.accent,
    text: theme.ink,
  },
};

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <WardrobeProvider>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <Tab.Navigator
            initialRouteName="Library"
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: theme.accent,
              tabBarInactiveTintColor: theme.muted,
              tabBarStyle: {paddingHorizontal: 28},
              tabBarLabelStyle: {fontSize: 12, fontWeight: '600'},
            }}>
            <Tab.Screen
              name="Library"
              component={LibraryScreen}
              options={{tabBarIcon: libraryIcon}}
            />
            <Tab.Screen
              name="Outfit"
              component={OutfitScreen}
              options={{tabBarIcon: outfitIcon}}
            />
            <Tab.Screen
              name="Add"
              component={EmptyScreen}
              options={{tabBarButton: () => <AddTabButton />}}
            />
            <Tab.Screen
              name="Trending"
              component={TrendingScreen}
              options={{tabBarIcon: trendingIcon}}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{tabBarIcon: settingsIcon}}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </WardrobeProvider>
    </SafeAreaProvider>
  );
}

export default App;
