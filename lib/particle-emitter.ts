import * as PIXI from 'pixi.js'

interface Particle {
  sprite: PIXI.Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
  rotation: number
  rotationSpeed: number
}

export class SimpleParticleEmitter {
  private container: PIXI.Container
  private particles: Particle[] = []
  private elapsed: number = 0
  private texture: PIXI.Texture
  public frequency: number
  public maxParticles: number
  public particleLifetime: number
  public speedMultiplier: number = 1
  public destroyed: boolean = false
  private type: 'sparkles' | 'confetti'

  constructor(
    container: PIXI.Container,
    type: 'sparkles' | 'confetti',
    texture: PIXI.Texture
  ) {
    this.container = container
    this.type = type
    this.texture = texture
    
    if (type === 'sparkles') {
      this.frequency = 0.008
      this.maxParticles = 100
      this.particleLifetime = 1
    } else {
      this.frequency = 0.05
      this.maxParticles = 50
      this.particleLifetime = 3
    }
  }

  updateOwnerPos(x: number, y: number) {
    this.container.position.set(x, y)
  }

  update(dt: number) {
    if (this.destroyed) return

    this.elapsed += dt

    // Spawn new particles
    const spawnCount = Math.floor(this.elapsed / this.frequency)
    if (spawnCount > 0) {
      this.elapsed = this.elapsed % this.frequency
      for (let i = 0; i < spawnCount; i++) {
        if (this.particles.length < this.maxParticles) {
          this.spawnParticle()
        }
      }
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt

      if (p.life >= p.maxLife) {
        this.container.removeChild(p.sprite)
        p.sprite.destroy()
        this.particles.splice(i, 1)
        continue
      }

      // Update position
      p.sprite.x += p.vx * dt * this.speedMultiplier
      p.sprite.y += p.vy * dt * this.speedMultiplier
      p.sprite.rotation += p.rotationSpeed * dt

      // Update alpha (fade out)
      const lifeRatio = p.life / p.maxLife
      if (this.type === 'sparkles') {
        p.sprite.alpha = 1 - lifeRatio
        p.sprite.scale.set(0.5 * (1 - lifeRatio))
      } else {
        p.sprite.alpha = lifeRatio < 0.8 ? 1 : (1 - lifeRatio) / 0.2
      }
    }
  }

  private spawnParticle() {
    const sprite = new PIXI.Sprite(this.texture)
    sprite.anchor.set(0.5)
    
    if (this.type === 'sparkles') {
      sprite.tint = Math.random() > 0.5 ? 0xffffff : 0xffff00
      sprite.scale.set(0.5)
      const angle = Math.random() * Math.PI * 2
      const speed = 100 + Math.random() * 100
      
      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: this.particleLifetime,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 4
      })
    } else {
      // Confetti
      const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]
      sprite.tint = colors[Math.floor(Math.random() * colors.length)]
      sprite.scale.set(0.4)
      const angle = Math.random() * Math.PI * 2
      const speed = 200 + Math.random() * 100
      
      this.particles.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 50, // Slight downward bias
        life: 0,
        maxLife: this.particleLifetime,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 6
      })
    }

    this.container.addChild(sprite)
  }

  destroy() {
    this.destroyed = true
    this.particles.forEach(p => {
      this.container.removeChild(p.sprite)
      p.sprite.destroy()
    })
    this.particles = []
  }
}
