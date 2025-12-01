export const sparklesConfig = {
  lifetime: { min: 0.5, max: 1 },
  frequency: 0.008,
  spawnChance: 1,
  particlesPerWave: 1,
  emitterLifetime: -1,
  maxParticles: 1000,
  pos: { x: 0, y: 0 },
  addAtBack: false,
  behaviors: [
    {
      type: 'alpha',
      config: {
        alpha: {
          list: [
            { value: 0.8, time: 0 },
            { value: 0.1, time: 1 }
          ],
        },
      }
    },
    {
      type: 'scale',
      config: {
        scale: {
          list: [
            { value: 0.5, time: 0 },
            { value: 0.1, time: 1 }
          ],
        },
      }
    },
    {
      type: 'color',
      config: {
        color: {
          list: [
            { value: "ffffff", time: 0 },
            { value: "ffff00", time: 1 }
          ],
        },
      }
    },
    {
      type: 'moveSpeed',
      config: {
        speed: {
          list: [
            { value: 200, time: 0 },
            { value: 100, time: 1 }
          ],
          isStepped: false
        },
      }
    },
    {
      type: 'rotation',
      config: {
        accel: 0,
        minSpeed: 0,
        maxSpeed: 200,
        minStart: 0,
        maxStart: 360
      }
    },
    {
      type: 'textureSingle',
      config: {
        texture: 'particle' // Will be replaced with actual texture
      }
    }
  ],
};

export const confettiConfig = {
  lifetime: { min: 2, max: 4 },
  frequency: 0.05,
  spawnChance: 1,
  particlesPerWave: 3,
  emitterLifetime: -1,
  maxParticles: 500,
  pos: { x: 0, y: 0 },
  addAtBack: false,
  behaviors: [
    {
      type: 'alpha',
      config: {
        alpha: {
          list: [
            { value: 1, time: 0 },
            { value: 1, time: 0.8 },
            { value: 0, time: 1 }
          ],
        },
      }
    },
    {
      type: 'scale',
      config: {
        scale: {
          list: [
            { value: 0.4, time: 0 },
            { value: 0.4, time: 1 }
          ],
        },
      }
    },
    {
      type: 'color',
      config: {
        color: {
          list: [
            { value: "ff0000", time: 0 },
            { value: "00ff00", time: 0.33 },
            { value: "0000ff", time: 0.66 },
            { value: "ffff00", time: 1 }
          ],
        },
      }
    },
    {
      type: 'moveSpeed',
      config: {
        speed: {
          list: [
            { value: 300, time: 0 },
            { value: 50, time: 1 }
          ],
          isStepped: false
        },
      }
    },
    {
      type: 'rotation',
      config: {
        accel: 0,
        minSpeed: 50,
        maxSpeed: 200,
        minStart: 0,
        maxStart: 360
      }
    },
    {
      type: 'textureSingle',
      config: {
        texture: 'particle' // Will be replaced
      }
    }
  ],
};
