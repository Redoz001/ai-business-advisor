import React from "react";
import { AVATAR_CATALOG, getDefaultAvatar } from "../../avatar/catalog";
import type { AvatarProfile } from "../../avatar/types";

const LazyAvatarMode = React.lazy(() => import("../../avatar/AvatarMode"));

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

  // Set initial profile based on gender without duplicate lazy imports
  React.useEffect(() => {
    if (!isActive) return;

    if (gender === "female") {
      const female = AVATAR_CATALOG.find(
        (entry) => entry.profile.id === "female-human-1"
      );
      setProfile(female?.profile || getDefaultAvatar());
      return;
    }

    setProfile(getDefaultAvatar());
  }, [isActive, gender]);

  if (!isActive) return null;

  return (
    <React.Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-black text-sm text-zinc-400">
          Loading avatar...
        </div>
      }
    >
      <LazyAvatarMode
        onSendMessage={(message) => {
          // Pass to conversation engine
          onSendMessage?.(message);
        }}
        onClose={onClose}
        initialProfile={profile}
        aiResponseText={aiResponseText}
      />
    </React.Suspense>
  );
}