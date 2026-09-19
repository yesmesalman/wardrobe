import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {LibraryScreen} from './src/screens/LibraryScreen';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <LibraryScreen />
    </SafeAreaProvider>
  );
}

export default App;
