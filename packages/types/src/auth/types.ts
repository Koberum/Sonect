export type ProfileRole = "admin" | "user";

export type AuthProfile = {
  id: string;
  name: string;
  avatarColor: string;
  role: ProfileRole;
};

export type PublicProfile = {
  id: string;
  name: string;
  avatarColor: string;
};

export type AuthState = {
  bootstrapRequired: boolean;
  authenticated: boolean;
  profile: AuthProfile | null;
};
