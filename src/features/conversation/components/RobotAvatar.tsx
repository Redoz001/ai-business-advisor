import React from "react";
import AvatarMode from "../../avatar/AvatarMode";
import type { AvatarProfile } from "../../avatar/types";

type RobotAvatarProps = {
  isActive: boolean;
  gender: "male" | "female" | "neutral";
  onClose: () => void;
  onGenderChange: (gender: "male" | "female" | "neutral") => void;
  onSendMessage?: (message: string) => void;
  aiResponseText?: string;
};

export default function RobotAvatar({
  isActive,
  gender,
  onClose,
  onGenderChange,
  onSendMessage,
  aiResponseText,
}: RobotAvatarProps) {
  const [profile, setProfile] = React.useState<AvatarProfile | undefined>(
    undefined
  );

  // Set initial profile based on gender
  React.useEffect(() => {
    if (isActive && !profile) {
      // Import catalog lazily to get default avatar
      import("../../avatar/catalog").then(({ getDefaultAvatar, AVATAR_CATALOG }) => {
        if (gender === "female") {
          const female = AVATAR_CATALOG.find(
            (entry) => entry.profile.id === "female-human-1"
          );
          setProfile(female?.profile || getDefaultAvatar());
        } else {
          setProfile(getDefaultAvatar());
        }
      });
    }
  }, [isActive, gender, profile]);

  if (!isActive) return null;

  return (
    <AvatarMode
      onSendMessage={(message) => {
        // Pass to conversation engine
        onSendMessage?.(message);
      }}
      onClose={onClose}
      initialProfile={profile}
      aiResponseText={aiResponseText}
    />
  );
}