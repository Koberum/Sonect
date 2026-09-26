import { createContext, useCallback, useContext, useState } from "react";
import {
  clearSelectedProfile,
  getSelectedProfile,
  setSelectedProfile,
  type SelectedProfile,
} from "@/lib/selectedProfile";

type ProfileContextType = {
  profile: SelectedProfile | null;
  selectProfile: (profile: SelectedProfile) => void;
  clearProfile: () => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<SelectedProfile | null>(() =>
    getSelectedProfile(),
  );

  const selectProfile = useCallback((next: SelectedProfile): void => {
    setSelectedProfile(next);
    setProfile(next);
  }, []);

  const clearProfile = useCallback((): void => {
    clearSelectedProfile();
    setProfile(null);
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, selectProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context)
    throw new Error("useProfile must be used within ProfileProvider");
  return context;
}
