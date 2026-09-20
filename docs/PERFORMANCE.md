# Performance targets

Acceptance targets for Echo Show 5 `checkers` (not claims of completed measurements):

- warm start below 500 ms and cold start near one second;
- steady clock view below 60 MB PSS;
- release APK below 10 MB;
- less than 1% average idle CPU;
- no continuous rendering; clock-view invalidation only on the scheduled tick or a data change;
- no ANR, crash, or continuously growing memory during a 24-hour soak.

The UI uses Android Views and Canvas rather than Compose, Flutter, or WebView. The launcher requests icons on demand through Android's package APIs and does not persist icon bitmaps.

The signed v0.1.3 APK is 573,480 bytes, comfortably below the 10 MB artifact target. Startup time, steady PSS, averaged idle CPU, and the 24-hour soak remain performance targets rather than completed measurements.
