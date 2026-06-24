import { useEffect, useRef } from 'react';
import type { ParticleConfig } from '../types';

/**
 * 粒子类
 */
class Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  maxSize: number;
  minSize: number;
  speed: number;
  color: string;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    maxSize: number,
    minSize: number,
    speed: number,
    color: string
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.maxSize = maxSize;
    this.minSize = minSize;
    this.speed = speed;
    this.color = color;
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * (maxSize - minSize) + minSize;
    this.speedX = Math.random() * speed * 2 - speed;
    this.speedY = Math.random() * speed * 2 - speed;
    this.opacity = Math.random() * 0.5 + 0.3;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x > this.canvas.width) this.x = 0;
    if (this.x < 0) this.x = this.canvas.width;
    if (this.y > this.canvas.height) this.y = 0;
    if (this.y < 0) this.y = this.canvas.height;
  }

  draw() {
    this.ctx.fillStyle = `${this.color}${this.opacity})`;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

/**
 * 粒子动画 Hook
 * 负责管理 Canvas 粒子动画效果
 */
export function useParticleAnimation(config: ParticleConfig = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const {
      count = 100,
      color = 'rgba(59, 130, 246, ',
      minSize = 0.5,
      maxSize = 2.5,
      speed = 0.25,
    } = config;

    // 设置画布尺寸
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle(canvas, ctx, maxSize, minSize, speed, color));
    }

    let animationId: number;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [config]);

  return canvasRef;
}
