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

type Journal = {
  journal_id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
};

type Profile = {
  display_name: string;
  username: string;
};

const UserHomePage = () => {
  const [loading, setLoading] = React.useState(true);
  const [journals, setJournals] = React.useState<Journal[]>([]);
  const [profile, setProfile] = React.useState<Profile | null>(null);

  const loadHome = React.useCallback(async () => {
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
      setProfile({
        display_name: profileRecord.display_name,
        username: profileRecord.username,
      });

      const { data: journalData, error: journalError } = await supabase
        .from('journals')
        .select('journal_id, title, description, visibility, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (journalError) {
        throw journalError;
      }

      setJournals(journalData ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load your journals.';
      Alert.alert('Load failed', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadHome();
    }, [loadHome])
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
      <Text style={styles.eyebrow}>Your space</Text>
      <Text style={styles.title}>
        {profile ? `Hi, ${profile.display_name}` : 'Your journals'}
      </Text>
      <Text style={styles.subtitle}>
        Create a journal, save a short entry, and keep everything simple.
      </Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.primaryAction}
          onPress={() => router.push('/createjournal')}
        >
          <Text style={styles.primaryActionText}>Create Journal</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryAction}
          onPress={() => router.push('/userprofile')}
        >
          <Text style={styles.secondaryActionText}>Profile</Text>
        </Pressable>
      </View>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My journals</Text>
        <Pressable onPress={() => void loadHome()}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0F172A" />
        </View>
      ) : journals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No journals yet</Text>
          <Text style={styles.emptyText}>
            Start with one private journal and your first 60-second entry.
          </Text>
        </View>
      ) : (
        journals.map((journal) => (
          <View key={journal.journal_id} style={styles.journalCard}>
            <Text style={styles.journalTitle}>{journal.title}</Text>
            <Text style={styles.journalMeta}>
              {journal.visibility} •{' '}
              {new Date(journal.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.journalDescription}>
              {journal.description?.trim() || 'No description yet.'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
};

export default UserHomePage;

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
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  signOutText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  refreshText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  journalCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  journalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  journalMeta: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'capitalize',
  },
  journalDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
  },
});
