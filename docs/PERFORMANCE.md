# Performance targets

Measured acceptance targets on Echo Show 5 `checkers`:

- warm start below 500 ms and cold start near one second;
- steady clock view below 60 MB PSS;
- release APK below 10 MB;
- less than 1% average idle CPU;
- no full-screen invalidation except the small scheduled clock render;
- no ANR, crash, or continuously growing memory during a 24-hour soak.

The UI uses Android Views and Canvas rather than Compose, Flutter, or WebView. The launcher requests icons on demand through Android's package APIs and does not persist icon bitmaps.
