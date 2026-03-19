import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/profile';
import { getVideoBucket, uploadJournalVideo } from '../lib/videoUpload';

const CreateJournal = () => {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [entryCaption, setEntryCaption] = React.useState('');
  const [facing, setFacing] = React.useState<CameraType>('back');
  const [cameraReady, setCameraReady] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordedVideoUri, setRecordedVideoUri] = React.useState('');
  const [durationSeconds, setDurationSeconds] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const cameraRef = React.useRef<CameraView | null>(null);
  const recordingStartedAtRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error && 'message' in error) {
      const maybeMessage = (error as { message?: unknown }).message;

      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }
    }

    return 'Something went wrong.';
  };

  const resetTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const updateRecordedDuration = React.useCallback(() => {
    const startedAt = recordingStartedAtRef.current;

    if (!startedAt) {
      return 0;
    }

    const elapsed = Math.min(
      60,
      Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    );

    setDurationSeconds(elapsed);
    return elapsed;
  }, []);

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Unsupported on web', 'Video recording is only enabled on iOS and Android devices.');
      return;
    }

    if (!cameraPermission?.granted || !microphonePermission?.granted) {
      Alert.alert('Permissions needed', 'Allow camera and microphone access to record.');
      return;
    }

    if (!cameraReady || !cameraRef.current || isRecording) {
      return;
    }

    setRecordedVideoUri('');
    setDurationSeconds(0);
    setIsRecording(true);
    recordingStartedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      updateRecordedDuration();
    }, 1000);

    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      const finalDuration = updateRecordedDuration();

      if (result?.uri) {
        setRecordedVideoUri(result.uri);
        setDurationSeconds(finalDuration);
      }
    } catch (error) {
      Alert.alert('Recording failed', getErrorMessage(error));
    } finally {
      resetTimer();
      recordingStartedAtRef.current = null;
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !isRecording) {
      return;
    }

    cameraRef.current.stopRecording();
  };

  const handleCreateJournal = async () => {
    const trimmedTitle = title.trim();
    const trimmedCaption = entryCaption.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      Alert.alert('Missing info', 'Add a journal title before saving.');
      return;
    }

    if (!recordedVideoUri || durationSeconds <= 0) {
      Alert.alert('No recording', 'Record a journal entry before saving.');
      return;
    }

    if (durationSeconds > 60) {
      Alert.alert('Too long', 'Journal entries must be 60 seconds or less.');
      return;
    }

    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      Alert.alert('Not signed in', 'Please sign in again to create a journal.');
      router.replace('/login');
      return;
    }

    try {
      await ensureProfile(user);

      const { data: insertedJournal, error: journalError } = await supabase
        .from('journals')
        .insert({
          owner_id: user.id,
          title: trimmedTitle,
          description: trimmedDescription || null,
          visibility: 'private',
        })
        .select('journal_id')
        .single();

      if (journalError || !insertedJournal) {
        throw journalError ?? new Error('Journal creation failed.');
      }

      const journalId = insertedJournal.journal_id;

      const uploadedVideo = await uploadJournalVideo({
        uri: recordedVideoUri,
        userId: user.id,
        journalId,
      });

      const { error: entryError } = await supabase.from('entries').insert({
        journal_id: journalId,
        author_id: user.id,
        video_path: uploadedVideo.storagePath,
        entry_caption: trimmedCaption || null,
        entry_day: today,
      });

      if (entryError) {
        throw entryError;
      }

      Alert.alert(
        'Journal created',
        `Your journal and first entry were saved to the "${getVideoBucket()}" bucket.`
      );
      router.replace('/userhomepage');
    } catch (error) {
      const message = getErrorMessage(error);
      const extraHint =
        message.includes('Storage upload failed') ||
        message.toLowerCase().includes('row-level security') ||
        message.toLowerCase().includes('bucket')
          ? '\n\nCheck that the "video-journals" bucket exists and that authenticated users can upload to journal_id/user_id/file.mp4 paths.'
          : '';

      Alert.alert('Unable to save', `${message}${extraHint}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Journal</Text>
        <Text style={styles.subtitle}>
          Record one journal entry up to 60 seconds, upload it, and save it to
          Supabase.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Journal title</Text>
          <TextInput
            style={styles.input}
            placeholder="Daily reflections"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Optional journal description"
            placeholderTextColor="#9CA3AF"
            multiline
            value={description}
            onChangeText={setDescription}
          />

          <Text style={styles.label}>Entry caption</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Optional note for today"
            placeholderTextColor="#9CA3AF"
            multiline
            value={entryCaption}
            onChangeText={setEntryCaption}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Video entry</Text>

          {Platform.OS === 'web' ? (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Recording not available</Text>
              <Text style={styles.helperText}>
                Expo camera recording needs a native iOS or Android build.
              </Text>
            </View>
          ) : !cameraPermission || !microphonePermission ? (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Loading permissions...</Text>
            </View>
          ) : !cameraPermission.granted || !microphonePermission.granted ? (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Camera access required</Text>
              <Text style={styles.helperText}>
                Allow camera and microphone access so you can record your entry.
              </Text>
              <Pressable
                style={styles.permissionButton}
                onPress={async () => {
                  await requestCameraPermission();
                  await requestMicrophonePermission();
                }}
              >
                <Text style={styles.permissionButtonText}>Grant Access</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.cameraFrame}>
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing={facing}
                  mode="video"
                  mute={false}
                  videoQuality="480p"
                  onCameraReady={() => setCameraReady(true)}
                />
              </View>

              <View style={styles.cameraControlsRow}>
                <Pressable
                  style={styles.flipButton}
                  onPress={() =>
                    setFacing((current) => (current === 'back' ? 'front' : 'back'))
                  }
                  disabled={isRecording}
                >
                  <Text style={styles.flipButtonText}>Flip</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.recordButton,
                    isRecording && styles.stopButton,
                    (!cameraReady || loading) && styles.buttonDisabled,
                  ]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={!cameraReady || loading}
                >
                  <Text style={styles.recordButtonText}>
                    {isRecording ? 'Stop' : 'Record'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={styles.helperText}>
            Limit: 60 seconds max. Bucket: {getVideoBucket()}
          </Text>
          <Text style={styles.helperText}>
            Duration: {durationSeconds}s {isRecording ? '• recording now' : ''}
          </Text>
          <Text style={styles.helperText}>
            {recordedVideoUri
              ? 'Video captured and ready to upload.'
              : 'No video recorded yet.'}
          </Text>
        </View>

        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleCreateJournal}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Saving...' : 'Create Journal'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default CreateJournal;

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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 4,
  },
  permissionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  permissionButton: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cameraFrame: {
    height: 360,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#0F172A',
    marginBottom: 14,
  },
  camera: {
    flex: 1,
  },
  cameraControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  flipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  flipButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },
  recordButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#0F172A',
  },
  recordButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
