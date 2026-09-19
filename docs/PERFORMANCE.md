# Performance targets

Acceptance targets for Echo Show 5 `checkers` (not claims of completed measurements):

- warm start below 500 ms and cold start near one second;
- steady clock view below 60 MB PSS;
- release APK below 10 MB;
- less than 1% average idle CPU;
- no continuous rendering; clock-view invalidation only on the scheduled tick or a data change;
- no ANR, crash, or continuously growing memory during a 24-hour soak.

The UI uses Android Views and Canvas rather than Compose, Flutter, or WebView. The launcher requests icons on demand through Android's package APIs and does not persist icon bitmaps.
