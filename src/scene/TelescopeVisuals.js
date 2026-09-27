class TelescopeVisuals {
  constructor() {
    this.planetPhotoUrls = {
      mercury: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mercury_in_true_color.jpg',
      venus: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Venus-real_color.jpg',
      earth: 'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg',
      mars: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg',
      jupiter: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg',
      saturn: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg',
      uranus: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg',
      neptune: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Neptune_-_Voyager_2_%2829347980845%29_%28cropped%29.jpg'
    };

    // Preloaded HTML Image Elements
    this.loadedImages = {};
    this.preloadPhotos();
  }

  preloadPhotos() {
    Object.keys(this.planetPhotoUrls).forEach(id => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = this.planetPhotoUrls[id];
      this.loadedImages[id] = img;
    });
  }

  // Draw realistic 2D planet picture canvas with given horizontal surface shift (-0.5 to 0.5)
  drawPlanetCanvas(planetId, shiftX = 0, size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const radius = size * 0.42;

    const pid = planetId.toLowerCase();
    const img = this.loadedImages[pid];

    ctx.clearRect(0, 0, size, size);

    // Create planetary circular disk clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    if (img && img.complete && img.naturalWidth > 0) {
      // Draw real NASA photo with horizontal panning shift for observation phase
      const cropW = img.naturalWidth * 0.7;
      const cropH = img.naturalHeight;
      const panOffset = (shiftX + 0.5) * (img.naturalWidth - cropW);

      ctx.drawImage(
        img,
        panOffset, 0, cropW, cropH,
        center - radius, center - radius, radius * 2, radius * 2
      );
    } else {
      // Fallback photo drawing using photographic colors and features
      this.drawFallbackPhoto(ctx, pid, center, radius, shiftX, size);
    }

    // Realistic 3D Spherical Shading & Rim Glow Overlay
    const shadeGrad = ctx.createRadialGradient(
      center - radius * 0.35,
      center - radius * 0.35,
      radius * 0.1,
      center,
      center,
      radius
    );
    shadeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    shadeGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    shadeGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.4)');
    shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');

    ctx.fillStyle = shadeGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  drawFallbackPhoto(ctx, pid, center, radius, shiftX, size) {
    const colors = {
      mercury: ['#8c8275', '#4a453e'],
      venus: ['#fef08a', '#ca8a04'],
      earth: ['#1d4ed8', '#15803d'],
      mars: ['#c2410c', '#6c2e14'],
      jupiter: ['#fde047', '#b45309'],
      saturn: ['#fef9c3', '#ca8a04'],
      uranus: ['#a5f3fc', '#0891b2'],
      neptune: ['#2563eb', '#1e40af']
    };

    const c = colors[pid] || ['#64748b', '#334155'];
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, c[0]);
    grad.addColorStop(1, c[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Surface landmark feature shifting East to West
    const offsetX = shiftX * radius * 1.5;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.ellipse(center + offsetX, center, radius * 0.4, radius * 0.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Get photo Data URL for selection card thumbnail
  getPlanetThumbnail(planetId) {
    return this.drawPlanetCanvas(planetId, 0, 256);
  }

  // Generate 5 sequential observation phase Data URLs (East to West shift)
  generatePhaseImages(planetId) {
    const shifts = [-0.5, -0.25, 0.0, 0.25, 0.5];
    return shifts.map(shiftX => this.drawPlanetCanvas(planetId, shiftX, 512));
  }
}

export const TelescopeVisualsInstance = new TelescopeVisuals();
export { TelescopeVisuals };
