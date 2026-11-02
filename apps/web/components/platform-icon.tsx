import type { Platform } from "@infulancer/core/enums";
import { InstagramIcon, TiktokIcon, YoutubeIcon, type IconProps } from "@/components/icons";

const map = { INSTAGRAM: InstagramIcon, TIKTOK: TiktokIcon, YOUTUBE: YoutubeIcon } as const;

export function PlatformIcon({ platform, ...rest }: { platform: Platform } & IconProps) {
  const Icon = map[platform];
  return <Icon {...rest} />;
}
