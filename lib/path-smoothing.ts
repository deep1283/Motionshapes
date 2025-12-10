/**
 * Path Smoothing Utilities
 * Uses Chaikin's corner-cutting algorithm for smooth curves
 */

export interface Vec2 {
  x: number
  y: number
}

/**
 * Chaikin's corner-cutting algorithm
 * Creates smoother curves by cutting corners iteratively
 * 
 * @param points - Array of path points
 * @param iterations - Number of smoothing iterations (default: 2)
 * @param tension - How much to cut corners (0.25 = standard Chaikin's)
 * @returns Smoothed points array
 */
export function chaikinSmooth(
  points: Vec2[],
  iterations: number = 2,
  tension: number = 0.25
): Vec2[] {
  if (points.length < 3) return points

  let result = [...points]

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Vec2[] = []
    
    // Keep first point
    smoothed.push(result[0])

    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i]
      const p1 = result[i + 1]

      // Q point: 75% of the way from p0 to p1 (or 1-tension)
      const q: Vec2 = {
        x: p0.x + (1 - tension) * (p1.x - p0.x),
        y: p0.y + (1 - tension) * (p1.y - p0.y),
      }

      // R point: 25% of the way from p0 to p1 (or tension)
      const r: Vec2 = {
        x: p0.x + tension * (p1.x - p0.x),
        y: p0.y + tension * (p1.y - p0.y),
      }

      // For first segment, skip R (we already have the start point)
      if (i > 0) {
        smoothed.push(r)
      }
      smoothed.push(q)
    }

    // Keep last point
    smoothed.push(result[result.length - 1])

    result = smoothed
  }

  return result
}

/**
 * Calculate the total length of a path
 */
export function calculatePathLength(points: Vec2[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    )
  }
  return length
}
