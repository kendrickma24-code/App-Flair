import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { SearchUser } from '../services/db';
import FeedScreen from './FeedScreen';
import UserProfileScreen from './UserProfileScreen';
import { userProfileStore } from './userProfileStore';

export type FeedStackParamList = {
  FeedMain: undefined;
  UserProfile: undefined;
};

const Stack = createNativeStackNavigator<FeedStackParamList>();

interface Props {
  theme: Theme;
  isDark: boolean;
  flights: Flight[];
  currentUserId: string;
  currentUserName: string;
  currentUserInitials: string;
  currentUserAvatarUri?: string | null;
  onEditFlight: (id: string, updates: import('../components/EditFlightModal').FlightEditUpdates) => void;
  onDeleteFlight: (id: string) => void;
  onRefresh: () => Promise<void>;
}

export default function FeedNavigator(props: Props) {
  const { theme, isDark, currentUserId } = props;

  function handleUserPress(navigation: any, user: SearchUser) {
    userProfileStore.set(user);
    navigation.navigate('UserProfile');
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain">
        {(navProps) => (
          <FeedScreen
            {...props}
            onUserPress={(user) => handleUserPress(navProps.navigation, user)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen
        name="UserProfile"
        options={{ animation: 'slide_from_right', gestureEnabled: true }}
      >
        {() => (
          <UserProfileScreen
            theme={theme}
            isDark={isDark}
            currentUserId={currentUserId}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
