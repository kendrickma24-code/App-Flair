import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { UserProfile } from '../App';
import ProfileScreen from './ProfileScreen';
import DestinationDetailScreen from './DestinationDetailScreen';
import { navStore } from './navStore';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  DestinationDetail: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

interface Props {
  theme: Theme;
  isDark: boolean;
  userProfile: UserProfile;
  flights: Flight[];
  deletedFlights: Flight[];
  onUpdateProfile: (profile: UserProfile) => void;
  onDeleteFlight: (id: string) => void;
  onChangeFlightPrivacy: (id: string, privacy: 'public' | 'followers' | 'private') => void;
  onEditFlight: (id: string, updates: import('../components/EditFlightModal').FlightEditUpdates) => void;
  onRestoreFlight: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onSignOut: () => void;
  onLikeChange?: (flightId: string, liked: boolean) => void;
  onAddReturnFlight?: (flight: import('../data/mockData').Flight) => void;
  onAddFlight?: () => void;
}

export default function ProfileNavigator(props: Props) {
  const { theme, isDark, userProfile, flights, deletedFlights,
    onUpdateProfile, onDeleteFlight, onChangeFlightPrivacy, onEditFlight,
    onRestoreFlight, onPermanentDelete, onSignOut, onLikeChange, onAddReturnFlight, onAddFlight } = props;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain">
        {(navProps) => (
          <ProfileScreen
            {...navProps}
            theme={theme}
            isDark={isDark}
            userProfile={userProfile}
            flights={flights}
            deletedFlights={deletedFlights}
            onUpdateProfile={onUpdateProfile}
            onDeleteFlight={onDeleteFlight}
            onChangeFlightPrivacy={onChangeFlightPrivacy}
            onEditFlight={onEditFlight}
            onRestoreFlight={onRestoreFlight}
            onPermanentDelete={onPermanentDelete}
            onSignOut={onSignOut}
            onLikeChange={onLikeChange}
            onAddReturnFlight={onAddReturnFlight}
            onAddFlight={onAddFlight}
          />
        )}
      </Stack.Screen>

      <Stack.Screen
        name="DestinationDetail"
        options={{ animation: 'slide_from_right', gestureEnabled: true }}
      >
        {(navProps) => {
          const { toCode, toCity, flights: groupFlights } = navStore.get();
          return (
            <DestinationDetailScreen
              toCode={toCode}
              toCity={toCity}
              flights={groupFlights}
              theme={theme}
              isDark={isDark}
              currentUserName={userProfile.name || userProfile.username || 'You'}
              currentUserInitials={(userProfile.name || userProfile.username || '?')[0]?.toUpperCase() ?? '?'}
              isOwn
              onClose={() => navProps.navigation.goBack()}
              onDeleteFlight={(id) => {
                onDeleteFlight(id);
                navProps.navigation.goBack();
              }}
              onEditFlight={onEditFlight}
            />
          );
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
