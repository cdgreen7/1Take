import * as Linking from 'expo-linking';

export const getAuthRedirectUrl = (path: string) =>
  Linking.createURL(path, {
    scheme: 'vidjournal',
  });
