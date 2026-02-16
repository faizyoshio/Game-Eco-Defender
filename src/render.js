const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const lerp = (a, b, t) => a + (b - a) * t;

const hexToRgb = (hex) => {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const mixHex = (fromHex, toHex, t) => {
  const a = hexToRgb(fromHex);
  const b = hexToRgb(toHex);
  const mix = {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t))
  };
  return `rgb(${mix.r} ${mix.g} ${mix.b})`;
};

const rgbStringToObject = (rgbString) => {
  const values = rgbString.match(/\d+/g) || ["0", "0", "0"];
  return {
    r: Number(values[0]),
    g: Number(values[1]),
    b: Number(values[2])
  };
};

export class RenderEngine {
  constructor(cityCanvas, chartCanvas, gameData) {
    this.cityCanvas = cityCanvas;
    this.chartCanvas = chartCanvas;
    this.cityCtx = cityCanvas.getContext("2d");
    this.chartCtx = chartCanvas.getContext("2d");
    this.data = gameData;

    this.lastChartCycle = -1;
    this.needsChartResize = true;
    this.lastCityWidth = 0;
    this.lastCityHeight = 0;
  }

  resize() {
    this.resizeCanvas(this.cityCanvas);
    this.resizeCanvas(this.chartCanvas);
    this.needsChartResize = true;
  }

  resizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const targetWidth = Math.max(1, Math.round(rect.width * dpr));
    const targetHeight = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }

  renderFrame(snapshot, nowMs) {
    if (!snapshot) {
      return;
    }

    this.drawCity(snapshot, nowMs);

    if (this.needsChartResize || snapshot.cycle !== this.lastChartCycle) {
      this.drawChart(snapshot);
      this.lastChartCycle = snapshot.cycle;
      this.needsChartResize = false;
    }
  }

  drawCity(snapshot, nowMs) {
    const ctx = this.cityCtx;
    const width = this.cityCanvas.width;
    const height = this.cityCanvas.height;

    if (!width || !height) {
      return;
    }

    const indicators = snapshot.indicators;
    const t = nowMs * 0.001;

    const airT = clamp(1 - indicators.air / 100, 0, 1);
    const waterT = clamp(1 - indicators.water / 100, 0, 1);
    const soilT = clamp(1 - indicators.soil / 100, 0, 1);

    const skyTop = mixHex("#9fd2ff", "#777b83", airT);
    const skyBottom = mixHex("#e9f7ff", "#aaa495", clamp(airT * 0.95, 0, 1));
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    skyGradient.addColorStop(0, skyTop);
    skyGradient.addColorStop(1, skyBottom);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);

    const sunX = width * 0.14;
    const sunY = height * 0.16;
    const sunRadius = height * 0.075;
    const sunAlpha = clamp(0.85 - airT * 0.65, 0.2, 0.95);
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 236, 170, ${sunAlpha})`;
    ctx.fill();

    this.drawMountains(ctx, width, height, soilT);

    const groundY = height * 0.66;
    const soilColor = mixHex("#5f8b45", "#876744", soilT);
    const grassColor = mixHex("#7fb860", "#8f7a56", soilT * 0.85);

    ctx.fillStyle = soilColor;
    ctx.fillRect(0, groundY, width, height - groundY);

    for (let i = 0; i < 12; i += 1) {
      const stripeX = (i / 12) * width;
      const wave = Math.sin(t + i * 0.58) * 4;
      ctx.fillStyle = i % 2 === 0 ? grassColor : soilColor;
      ctx.fillRect(stripeX, groundY + wave * 0.25, width / 12 + 1, height * 0.05);
    }

    const waterTop = height * 0.78;
    const waterColor = mixHex("#2a9dd2", "#5f6d65", waterT);
    const waterReflect = mixHex("#9bdff7", "#8d8a82", waterT * 0.9);
    const waterReflectRgb = rgbStringToObject(waterReflect);
    ctx.fillStyle = waterColor;
    ctx.fillRect(0, waterTop, width, height - waterTop);

    for (let i = 0; i < 18; i += 1) {
      const y = waterTop + 4 + i * 5;
      const amplitude = 4 + waterT * 3;
      ctx.strokeStyle = `rgba(${waterReflectRgb.r}, ${waterReflectRgb.g}, ${waterReflectRgb.b}, ${0.2 + i * 0.01})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= width; x += 20) {
        const offset = Math.sin((x + t * 58 + i * 17) * 0.02) * amplitude;
        ctx.lineTo(x, y + offset);
      }
      ctx.stroke();
    }

    this.drawBuildings(ctx, width, height, indicators, t);
    this.drawTrees(ctx, width, height, indicators);

    const smogAlpha = clamp((100 - indicators.air) / 220 + indicators.carbon / 260, 0, 0.58);
    if (smogAlpha > 0.02) {
      ctx.fillStyle = `rgba(92, 87, 82, ${smogAlpha})`;
      ctx.fillRect(0, 0, width, height);

      const hazeLayers = 5;
      for (let i = 0; i < hazeLayers; i += 1) {
        const y = height * (0.18 + i * 0.12);
        const thickness = 20 + i * 9;
        const alpha = smogAlpha * (0.14 + i * 0.05);
        ctx.fillStyle = `rgba(132, 124, 115, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= width; x += 22) {
          const wobble = Math.sin((x + t * 42 + i * 21) * 0.021) * 8;
          ctx.lineTo(x, y + wobble);
        }
        ctx.lineTo(width, y + thickness);
        ctx.lineTo(0, y + thickness);
        ctx.closePath();
        ctx.fill();
      }
    }

    this.lastCityWidth = width;
    this.lastCityHeight = height;
  }

  drawMountains(ctx, width, height, soilT) {
    const ridgeColorA = mixHex("#7ca09f", "#7f7b71", soilT * 0.9);
    const ridgeColorB = mixHex("#6d8f84", "#746c62", soilT * 0.9);

    ctx.fillStyle = ridgeColorA;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.66);
    ctx.lineTo(width * 0.2, height * 0.4);
    ctx.lineTo(width * 0.45, height * 0.66);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(width * 0.2, height * 0.66);
    ctx.lineTo(width * 0.44, height * 0.34);
    ctx.lineTo(width * 0.74, height * 0.66);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = ridgeColorB;
    ctx.beginPath();
    ctx.moveTo(width * 0.56, height * 0.66);
    ctx.lineTo(width * 0.84, height * 0.39);
    ctx.lineTo(width, height * 0.66);
    ctx.closePath();
    ctx.fill();
  }

  drawBuildings(ctx, width, height, indicators, t) {
    const buildingCount = Math.max(8, Math.round(9 + indicators.economy * 0.12 + indicators.population * 0.05));
    const baseY = height * 0.69;
    const maxHeight = height * 0.32;
    const smogFactor = indicators.carbon / 100;

    for (let i = 0; i < buildingCount; i += 1) {
      const ratio = i / buildingCount;
      const x = ratio * width;
      const blockWidth = width / buildingCount;
      const buildingHeight = maxHeight * (0.35 + ((Math.sin(i * 3.7) + 1) / 2) * 0.65);
      const y = baseY - buildingHeight;

      const buildingTone = mixHex("#58706e", "#67615d", smogFactor * 0.75);
      ctx.fillStyle = buildingTone;
      ctx.fillRect(x + 2, y, blockWidth - 4, buildingHeight);

      const windowsX = Math.max(1, Math.floor((blockWidth - 8) / 8));
      const windowsY = Math.max(1, Math.floor((buildingHeight - 10) / 10));
      for (let wx = 0; wx < windowsX; wx += 1) {
        for (let wy = 0; wy < windowsY; wy += 1) {
          const lit = (wx + wy + i) % 3 !== 0;
          if (!lit) {
            continue;
          }
          ctx.fillStyle = `rgba(252, 235, 172, ${0.24 + (Math.sin(t * 2 + wx + wy) + 1) * 0.06})`;
          ctx.fillRect(x + 5 + wx * 8, y + 5 + wy * 10, 4, 6);
        }
      }

      if (i % 3 === 0) {
        const plumeHeight = 8 + smogFactor * 34;
        const drift = Math.sin(t * 2.2 + i) * 6;
        ctx.fillStyle = `rgba(109, 103, 95, ${0.2 + smogFactor * 0.45})`;
        ctx.beginPath();
        ctx.ellipse(x + blockWidth * 0.5 + drift, y - plumeHeight * 0.6, 7 + smogFactor * 6, plumeHeight, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawTrees(ctx, width, height, indicators) {
    const treeCount = Math.max(2, Math.round((indicators.soil + indicators.air) / 11));
    const baseY = height * 0.73;
    const healthFactor = clamp((indicators.soil + indicators.air) / 200, 0.08, 1);

    for (let i = 0; i < treeCount; i += 1) {
      const x = (i / treeCount) * width + 12;
      const trunkH = 10 + healthFactor * 12;
      const crownR = 5 + healthFactor * 8;

      ctx.fillStyle = "#6b4a33";
      ctx.fillRect(x - 1.5, baseY - trunkH, 3, trunkH);

      const foliage = mixHex("#3d984d", "#6d6f45", 1 - healthFactor);
      ctx.fillStyle = foliage;
      ctx.beginPath();
      ctx.arc(x, baseY - trunkH - crownR * 0.4, crownR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawChart(snapshot) {
    const ctx = this.chartCtx;
    const width = this.chartCanvas.width;
    const height = this.chartCanvas.height;

    if (!width || !height) {
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const padding = {
      top: 18,
      right: 12,
      bottom: 24,
      left: 34
    };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.fillStyle = "#fbfdf8";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#dae6d1";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
      const y = padding.top + (i / 5) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#b5c8aa";
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    ctx.fillStyle = "#60745f";
    ctx.font = `${Math.max(10, Math.round(height * 0.045))}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [100, 75, 50, 25, 0].forEach((val) => {
      const y = padding.top + ((100 - val) / 100) * plotHeight;
      ctx.fillText(String(val), padding.left - 6, y);
    });

    const history = snapshot.history;
    if (!history.length) {
      return;
    }

    const maxPoints = history.length;

    for (const indicator of this.data.indicators) {
      ctx.strokeStyle = indicator.color;
      ctx.lineWidth = indicator.key === "carbon" ? 2.2 : 2;
      if (indicator.key === "carbon") {
        ctx.setLineDash([5, 3]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      history.forEach((entry, index) => {
        const x =
          padding.left +
          (maxPoints <= 1 ? 0 : (index / (maxPoints - 1)) * plotWidth);
        const y = padding.top + ((100 - entry[indicator.key]) / 100) * plotHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const latest = history[history.length - 1];
      const lx = width - padding.right;
      const ly = padding.top + ((100 - latest[indicator.key]) / 100) * plotHeight;
      ctx.fillStyle = indicator.color;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#60745f";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${Math.max(10, Math.round(height * 0.042))}px "Trebuchet MS", sans-serif`;
    const yearLabel = `Y${snapshot.year}`;
    ctx.fillText(yearLabel, padding.left + 4, height - padding.bottom + 6);

    ctx.textAlign = "right";
    const cycleLabel = `Cycle ${snapshot.cycle}`;
    ctx.fillText(cycleLabel, width - padding.right, height - padding.bottom + 6);
  }
}
