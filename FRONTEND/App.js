import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import RegistroScreen from './screens/RegistroScreen';
import PrincipalTabs from './navigation/PrincipalTabs';
import ConfigRutaHorarioScreen from './screens/ConfigRutaHorarioScreen';
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Registro" component={RegistroScreen} />
        <Stack.Screen name="Principal" component={PrincipalTabs} />
        <Stack.Screen name="ConfigRutaHorario" component={ConfigRutaHorarioScreen} />
     </Stack.Navigator>
    </NavigationContainer>
  );
}