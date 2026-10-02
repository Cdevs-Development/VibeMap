/**
 * gpsSmoothing.js
 *
 * Advanced Multi-Sensor Fusion & Kalman Filter for High-Precision Tracking.
 * Specially calibrated for devices with or WITHOUT dedicated GPS chips:
 * - High-precision GPS chips (±3m to ±15m).
 * - Cellular Tower / Wi-Fi Triangulation (±30m to ±300m).
 * - IP & Coarse Fallbacks (±500m to ±5000m).
 */

/**
 * 1D Kalman Filter with dynamic variance scaling.
 */
export class KalmanFilter {
  constructor(processNoise = 0.00001, measurementNoise = 0.001, initialValue = null) {
    this.q = processNoise; // Process noise covariance
    this.r = measurementNoise; // Measurement noise covariance
    this.x = initialValue; // Estimated state
    this.p = 1.0; // Estimation error covariance
  }

  update(measurement, accuracy = 20) {
    // Dynamic measurement noise R:
    // Convert accuracy (m) to degree variance. For higher accuracy (low m), R is small.
    // For coarse devices without GPS chips (e.g. 150m-1000m), scale R to dampen erratic jumps.
    const safeAccuracy = Math.max(accuracy || 20, 3);
    const r = Math.pow(safeAccuracy / 111000, 2);

    if (this.x === null) {
      this.x = measurement;
      this.p = r;
      return this.x;
    }

    // Prediction step
    this.p = this.p + this.q;

    // Measurement update (Kalman Gain)
    const k = this.p / (this.p + r);
    this.x = this.x + k * (measurement - this.x);
    this.p = (1.0 - k) * this.p;

    return this.x;
  }

  reset(value = null) {
    this.x = value;
    this.p = 1.0;
  }
}

/**
 * Adaptive Multi-Tier Sensor Fusion GPS Smoother.
 */
export class GPSSmoother {
  constructor(options = {}) {
    // Adaptive thresholds
    this.minMoveThresholdMeters = options.minMoveThresholdMeters || 2.5; // meters
    this.maxSpeedKmh = options.maxSpeedKmh || 180; // realistic maximum urban travel speed
    this.minTimeIntervalMs = options.minTimeIntervalMs || 800; // ms

    // Dynamic process noise (~1.8m movement per second)
    const processNoiseDegrees = 1.8 / 111000;
    const q = Math.pow(processNoiseDegrees, 2);

    this.latFilter = new KalmanFilter(q, 0.0001);
    this.lngFilter = new KalmanFilter(q, 0.0001);

    this.lastRaw = null;
    this.lastSmoothed = null;
    this.lastEmitted = null;
    this.lastEmittedTime = 0;
  }

  /**
   * Great Circle Haversine Distance in meters
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Process a raw or coarse GPS coordinate.
   * @param {object} coords { latitude, longitude, accuracy, speed, heading }
   * @returns {object|null} Smoothed coordinate or null if throttled
   */
  process(coords) {
    if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
      return null;
    }

    const { latitude, longitude, speed = null, heading = null } = coords;
    const accuracy = typeof coords.accuracy === 'number' ? coords.accuracy : 35;
    const now = Date.now();

    // 1. Boundary Validation (Nigeria bounding box with buffer)
    const isOutOfBounds =
      latitude < 4.0 || latitude > 14.2 || longitude < 2.4 || longitude > 15.0;

    if (isOutOfBounds) {
      console.warn(`[GPSSmoother] Coordinate out of region bounds (${longitude}, ${latitude})`);
      return null;
    }

    this.lastRaw = { latitude, longitude, accuracy, speed, heading };

    // 2. Teleport & Outlier Velocity Check
    if (this.lastSmoothed && this.lastEmittedTime > 0) {
      const timeDeltaSec = (now - this.lastEmittedTime) / 1000;
      const distanceMoved = GPSSmoother.calculateDistance(
        this.lastSmoothed.latitude,
        this.lastSmoothed.longitude,
        latitude,
        longitude
      );

      // If time delta is reasonable, check calculated speed
      if (timeDeltaSec > 0.5) {
        const calculatedSpeedKmh = (distanceMoved / timeDeltaSec) * 3.6;

        // If jump implies impossible speed (> 200 km/h) with low accuracy, dampen it
        if (calculatedSpeedKmh > this.maxSpeedKmh && accuracy > 60) {
          console.warn(
            `[GPSSmoother] Ignored outlier jump: ${distanceMoved.toFixed(0)}m in ${timeDeltaSec.toFixed(1)}s (${calculatedSpeedKmh.toFixed(0)} km/h)`
          );
          return null;
        }

        // If large legitimate jump (e.g. user opened app after 20km drive), reset filters
        if (distanceMoved > 2500 && timeDeltaSec > 30) {
          console.log('[GPSSmoother] Large displacement detected after idle. Re-centering filters.');
          this.latFilter.reset(latitude);
          this.lngFilter.reset(longitude);
        }
      }
    }

    // 3. Update Kalman Filters with Dynamic Weighting
    const smoothedLat = this.latFilter.update(latitude, accuracy);
    const smoothedLng = this.lngFilter.update(longitude, accuracy);

    this.lastSmoothed = {
      latitude: smoothedLat,
      longitude: smoothedLng,
      accuracy: Math.round(accuracy),
      speed,
      heading,
    };

    // 4. First Fix Immediate Emission
    if (!this.lastEmitted) {
      this.lastEmitted = { ...this.lastSmoothed };
      this.lastEmittedTime = now;
      return { smoothed: this.lastSmoothed, raw: this.lastRaw };
    }

    // 5. Throttling and Micro-Movement Filtering
    const timeSinceLastEmit = now - this.lastEmittedTime;
    const distanceMoved = GPSSmoother.calculateDistance(
      this.lastEmitted.latitude,
      this.lastEmitted.longitude,
      smoothedLat,
      smoothedLng
    );

    const hasTimeElapsed = timeSinceLastEmit >= this.minTimeIntervalMs;
    const hasMoved = distanceMoved >= this.minMoveThresholdMeters;
    const forceHeartbeat = timeSinceLastEmit >= 6000; // Heartbeat update every 6s

    if ((hasTimeElapsed && hasMoved) || forceHeartbeat) {
      this.lastEmitted = { ...this.lastSmoothed };
      this.lastEmittedTime = now;
      return { smoothed: this.lastSmoothed, raw: this.lastRaw };
    }

    return null; // Throttled
  }
}
