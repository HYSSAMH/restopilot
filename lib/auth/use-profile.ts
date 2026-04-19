// Re-export depuis le provider ; le hook lit désormais le profil
// depuis un Context React + subscription Realtime (mises à jour
// instantanées sans rechargement).
export {
  useProfile,
  profileDisplayName,
  type Profile,
} from "./profile-provider";
