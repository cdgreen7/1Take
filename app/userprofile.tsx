import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/profile';

type Profile = {
  display_name: string;
  username: string;
  created_at: string;
};

const UserProfile = () => {
  const [loading, setLoading] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [profile, setProfile] = React.useState<Profile | null>(null);

  const loadProfile = React.useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    try {
      const profileRecord = await ensureProfile(user);
      setEmail(user.email ?? '');
      setProfile(profileRecord);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load your profile.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Sign out failed', error.message);
      return;
    }

    router.replace('/welcome');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Basic account information from Supabase.</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Display name</Text>
            <Text style={styles.value}>{profile?.display_name ?? 'Not set'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.value}>@{profile?.username ?? 'unknown'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{email || 'No email available'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Joined</Text>
            <Text style={styles.value}>
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : 'Unknown'}
            </Text>
          </View>
        </View>
      )}

      <Pressable style={styles.primaryButton} onPress={() => router.push('/createjournal')}>
        <Text style={styles.primaryButtonText}>Create a Journal</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
};

export default UserProfile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 24,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  signOutText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
});
