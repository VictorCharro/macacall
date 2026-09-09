import {
  AudioPresets,
  ScreenSharePresets,
  VideoPresets,
  type RoomOptions,
} from "livekit-client";

export type VideoQuality = "data-saver" | "auto" | "high";

export const VIDEO_QUALITY_LABELS: Record<VideoQuality, string> = {
  "data-saver": "Economia de dados",
  auto: "Automática (recomendado)",
  high: "Alta qualidade",
};

export const VIDEO_QUALITY_ORDER: VideoQuality[] = ["data-saver", "auto", "high"];

const VIDEO_QUALITY_KEY = "macacall-video-quality";

export function loadVideoQuality(): VideoQuality {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(VIDEO_QUALITY_KEY);
  return stored === "data-saver" || stored === "auto" || stored === "high"
    ? stored
    : "auto";
}

export function saveVideoQuality(quality: VideoQuality) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIDEO_QUALITY_KEY, quality);
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// Camera/screen-share/audio presets per (device class, quality choice). Kept
// modest even on "high" -- this isn't meant to blow past what a home upload
// speed can sustain, just to stop leaving LiveKit's defaults (which target
// large public rooms, not a handful of friends) on the table. "auto" is the
// recommended default: desktop gets 720p/simulcast, mobile gets a lighter
// 540p to protect battery and mobile data since VP9/AV1 hardware encoding
// isn't available on most phones and software-encoding a full 720p stream
// drains the battery fast.
const PRESETS: Record<"mobile" | "desktop", Record<VideoQuality, {
  camera: typeof VideoPresets.h360;
  screenShare: typeof ScreenSharePresets.h720fps15;
  audio: typeof AudioPresets.music;
}>> = {
  desktop: {
    "data-saver": {
      camera: VideoPresets.h360,
      screenShare: ScreenSharePresets.h720fps5,
      audio: AudioPresets.speech,
    },
    auto: {
      camera: VideoPresets.h720,
      screenShare: ScreenSharePresets.h1080fps15,
      audio: AudioPresets.music,
    },
    high: {
      camera: VideoPresets.h1080,
      screenShare: ScreenSharePresets.h1080fps30,
      audio: AudioPresets.musicHighQuality,
    },
  },
  mobile: {
    "data-saver": {
      camera: VideoPresets.h180,
      screenShare: ScreenSharePresets.h360fps15,
      audio: AudioPresets.speech,
    },
    auto: {
      camera: VideoPresets.h540,
      screenShare: ScreenSharePresets.h720fps15,
      audio: AudioPresets.music,
    },
    high: {
      camera: VideoPresets.h720,
      screenShare: ScreenSharePresets.h1080fps15,
      audio: AudioPresets.musicHighQuality,
    },
  },
};

/**
 * Builds the LiveKit `RoomOptions` for a chosen quality level.
 *
 * Deliberately leaves `videoCodec` unset (SDK default is VP8) instead of
 * forcing VP9/AV1: those compress better but have no hardware encoder on
 * iOS/most Android devices, so forcing them would mean software-encoding
 * video on phones -- worse battery life and dropped frames on exactly the
 * devices that can least afford it. VP8 has broad hardware encode support
 * and LiveKit still negotiates simulcast fine with it.
 */
export function buildRoomOptions(quality: VideoQuality): RoomOptions {
  const preset = PRESETS[isMobileDevice() ? "mobile" : "desktop"][quality];
  return {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: preset.camera.resolution,
    },
    publishDefaults: {
      simulcast: true,
      videoEncoding: preset.camera.encoding,
      screenShareEncoding: preset.screenShare.encoding,
      audioPreset: preset.audio,
    },
  };
}
