import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { RomanBackground } from './components/RomanBackground'; 
import { LoginScreen } from './components/LoginScreen';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  iosClientId: '290144994186-eonod5dhlslcslt2l69ie2j8lu7l0ojm.apps.googleusercontent.com', 
});

const handleGoogleLogin = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    console.log("Success! User Info:", userInfo);
    alert("Welcome, " + userInfo.data.user.name + "!");
  } catch (error) {
    console.log("Google Login Error:", error);
  }
};

export default function App() {
  return (
    <LoginScreen onGoogleLogin={handleGoogleLogin} />
  );
}