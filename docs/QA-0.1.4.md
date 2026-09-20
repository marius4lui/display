# Display 0.1.4 verification

Verified on 2026-09-20 against an Echo Show 5 (`checkers`) running LineageOS 18.1 at 960 × 480.

## Automated

- `lintDebug`, `testDebugUnitTest`, and `assembleDebug` complete successfully with JDK 17.
- Power-state tests cover normal → requested AOD → AOD → off/doze → normal.
- Spatial-navigation tests cover both return directions from Apps and Home Assistant.

## Device

- The main face fills the complete 960 × 480 surface; no clipped Settings control, `DISPLAY` label, or `Berlin` label remains.
- Swipe right from Clock opens Apps; either direction from Apps returns to an identical Clock capture.
- Swipe left from Clock opens Home Assistant; either direction from Home Assistant returns to an identical Clock capture.
- With **Power button AOD** enabled, the first injected power-key event shows Display's dim black AOD and leaves Android awake.
- The second event reaches LineageOS doze; the following wake event restores Display's full Clock activity.
- No fatal exception was present in the focused device log during the power sequence.

## Platform boundary

Android delivers `ACTION_SCREEN_OFF` after the hardware policy has begun turning the panel off, so a brief blank is possible. Eliminating that transition entirely would require a LineageOS framework/`PhoneWindowManager` change or privileged system signing; overlay and accessibility permissions cannot provide equivalent power-key interception.
