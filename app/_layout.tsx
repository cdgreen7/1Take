import React from 'react';
import { Stack } from 'expo-router';

const RootLayout = () => {
  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false }} />
  );
};

export default RootLayout;
