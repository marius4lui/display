/*
 * Based on Keep Silk Open by DaGammla:
 * https://gitlab.com/DaGammla/keep-silk-open
 * Distributed under the MIT license. The license and original silent audio
 * are stored in public/vendor/keep-silk-open.
 */

const MEDIA_URL = "/vendor/keep-silk-open/media.mp3";

export function isSilkUserAgent(userAgent: string) {
  return /\bSilk\b/i.test(userAgent);
}

export type SilkKeepAwake = {
  activate: () => Promise<boolean>;
  resume: () => void;
  destroy: () => void;
};

export function createSilkKeepAwake(): SilkKeepAwake | null {
  if (typeof navigator === "undefined" || !isSilkUserAgent(navigator.userAgent)) return null;

  const audio = document.createElement("audio");
  audio.setAttribute("aria-hidden", "true");
  audio.style.display = "none";
  audio.preload = "auto";
  audio.muted = true;
  audio.src = MEDIA_URL;
  document.body.appendChild(audio);

  let destroyed = false;
  let unlocked = false;

  const reload = () => {
    if (destroyed) return;
    audio.src = `${MEDIA_URL}?keep-awake=${Date.now()}`;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // A later user interaction or visibility change retries playback.
    });
  };

  const activate = async () => {
    if (destroyed) return false;
    unlocked = true;
    audio.muted = false;
    reload();
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    }
  };

  const resume = () => {
    if (!destroyed && unlocked && audio.paused) reload();
  };

  audio.addEventListener("ended", reload);

  return {
    activate,
    resume,
    destroy: () => {
      destroyed = true;
      audio.removeEventListener("ended", reload);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio.remove();
    },
  };
}
