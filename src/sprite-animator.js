export class SpriteAnimator {
  constructor(image, atlas, animations) {
    this.image = image;
    this.atlas = atlas && atlas.frames ? atlas.frames : {};
    this.animations = new Map();

    if (Array.isArray(animations)) {
      animations.forEach((animDef) => {
        const frames = (animDef.frames || []).map((frameDef) => {
          const frameData = this.atlas[frameDef.name];
          if (!frameData) {
            console.warn(`Missing frame entry: ${frameDef.name}`);
          }

          return {
            name: frameDef.name,
            duration: Number(frameDef.duration) || 0,
            frame: frameData ? frameData.frame : null,
          };
        }).filter((frame) => frame.frame);

        this.animations.set(animDef.key, {
          key: animDef.key,
          repeat: animDef.repeat,
          frames,
        });
      });
    }

    this.currentAnim = null;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.onComplete = null;
    this.completed = false;
  }

  play(animName) {
    const anim = this.animations.get(animName);
    if (!anim) {
      throw new Error(`Unknown animation: ${animName}`);
    }

    this.currentAnim = anim;
    this.frameIndex = 0;
    this.elapsedMs = 0;
    this.completed = false;
  }

  update(dtMs) {
    if (!this.currentAnim || !this.currentAnim.frames.length) {
      return;
    }

    const anim = this.currentAnim;
    const duration = anim.frames[this.frameIndex].duration;

    this.elapsedMs += dtMs;

    while (this.elapsedMs >= duration) {
      this.elapsedMs -= duration;
      this.advanceFrame();
      if (this.completed) {
        return;
      }
    }
  }

  advanceFrame() {
    const anim = this.currentAnim;
    if (!anim) return;

    const lastIndex = anim.frames.length - 1;

    if (this.frameIndex < lastIndex) {
      this.frameIndex += 1;
      return;
    }

    if (anim.repeat === -1) {
      this.frameIndex = 0;
      return;
    }

    this.frameIndex = lastIndex;
    this.completed = true;

    if (typeof this.onComplete === 'function') {
      this.onComplete(anim.key);
    }
  }

  draw(ctx, x, y, scale = 1) {
    if (!ctx || !this.currentAnim || !this.currentAnim.frames.length) {
      return;
    }

    const frame = this.currentAnim.frames[this.frameIndex];
    if (!frame || !frame.frame) {
      return;
    }

    const { x: sx, y: sy, w, h } = frame.frame;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.drawImage(this.image, sx, sy, w, h, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
