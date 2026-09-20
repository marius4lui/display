# Display / White modules

## Direction

The reference is the modular, monochrome widget language of [Nothing OS](https://intl.nothing.tech/nothing-os), not a reproduction of its launcher or proprietary fonts. All dotted lettering, clock glyphs, icons and layouts are original code-native assets.

The main screen uses one dominant time card, a calendar and a smaller analog/environment module. It stays white-only, including dialogs, setup and settings. An app drawer uses grayscale app icons on circular white backplates; the original icons still come from the installed applications.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | `#EEEEEB` |
| Cards | `#FFFFFF` |
| Primary text | `#111111` |
| Secondary text | `#666666` |
| Inactive dots | `#D8D8D2` |
| Accent | `#D92D20` |
| Card radius | 24 dp; clock cards 30 design pixels |
| Touch controls | 48 dp or larger |

The time uses a fixed-width 7 × 11 dot grid. Header lettering uses a separate 5 × 7 alphabet. Labels use Android's sans-serif and monospace fonts without extra font files. Red is reserved for current time markers, active controls and a few status accents.

## Layout and interaction

- Clock: use the complete 960 × 421 safe drawing area, or the full 960 × 480 panel when the ambient launcher surface hides system bars. No permanent navigation dock.
- Date enabled: calendar with weekday, day, month, year and seven day markers. Date disabled: an analog module replaces it.
- Lower-right module: weather when enabled, otherwise a Home Assistant summary when enabled, otherwise an analog dial. Network values are not fabricated.
- Setup: chapter rail plus independently scrollable content; Back and Next remain outside the scroll area. Android resizes for the keyboard.
- Settings: four categories, scrollable cards and immediate persistence. Brightness sliders respect the saved minimum/maximum bounds.
- Navigation: Apps sits left of the clock and Home Assistant sits right. A reverse swipe returns to the clock, outer edges do not wrap, vertical scrolling does not change pages, and Android Back returns to the clock. Settings remains a deliberate gear/back flow. The system Home action returns to the clock.

## Rendering constraints

There is no animation loop, WebView, bitmap wallpaper, blur or shadow. The clock redraw is aligned to the next minute unless seconds are explicitly enabled. Ticks are removed when detached or hidden. The clock face is redrawn as one Canvas view; it is not a dirty-rectangle renderer. Ambient brightness does not switch the palette to dark mode.

Automated width tests cover all 1,440 times of day. Real-device screenshots and scroll checks are required in addition to the build; unit tests alone do not establish visual correctness.
