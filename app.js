const flightTimeEl = document.getElementById("flightTime");
const batteryLevelEl = document.getElementById("batteryLevel");
const batteryFillEl = document.getElementById("batteryFill");
const voltageEl = document.getElementById("voltage");
const gpsCountEl = document.getElementById("gpsCount");
const linkQualityEl = document.getElementById("linkQuality");
const altitudeEl = document.getElementById("altitude");
const groundSpeedEl = document.getElementById("groundSpeed");
const flightModeEl = document.getElementById("flightMode");
const cameraClockEl = document.getElementById("cameraClock");
const cameraCompassEl = document.getElementById("cameraCompass");
const compassHeadingEl = document.getElementById("compassHeading");
const attitudeModeEl = document.getElementById("attitudeMode");
const rollValueEl = document.getElementById("rollValue");
const pitchValueEl = document.getElementById("pitchValue");
const yawValueEl = document.getElementById("yawValue");
const vtolModel = document.getElementById("vtolModel");
const horizonLine = document.getElementById("horizonLine");
const checklist = document.getElementById("missionChecklist");
const plannedRoute = document.getElementById("plannedRoute");
const outboundProgressRoute = document.getElementById("completedRoute");
const returnProgressRoute = document.getElementById("returnRoute");
const movingMissionDot = document.getElementById("movingMissionDot");
const waypointNodes = [...document.querySelectorAll(".waypoint-node")];
const checklistInputs = [...document.querySelectorAll("#missionChecklist input")];

const cameraVideo = document.getElementById("cameraVideo");
const plotCanvas = document.getElementById("plotCanvas");
const plotCtx = plotCanvas.getContext("2d");

const routePoints = [
  { id: "start", x: 118, y: 304 },
  { id: "wp1-out", node: "wp1", phase: "outbound", x: 118, y: 240 },
  { id: "wp2-out", node: "wp2", phase: "outbound", x: 300, y: 118 },
  { id: "wp3-out", node: "wp3", phase: "outbound", x: 532, y: 54 },
  { id: "wp4-out", node: "wp4", phase: "outbound", x: 80, y: 56 },
  { id: "wp5-out", node: "wp5", phase: "outbound", x: 204, y: 114 },
  { id: "rep", node: "rep", phase: "outbound", x: 332, y: 292 },
  { id: "wp5-return", node: "wp5", phase: "return", x: 204, y: 114 },
  { id: "wp4-return", node: "wp4", phase: "return", x: 80, y: 56 },
  { id: "wp3-return", node: "wp3", phase: "return", x: 532, y: 54 },
  { id: "wp2-return", node: "wp2", phase: "return", x: 300, y: 118 },
  { id: "wp1-return", node: "wp1", phase: "return", x: 118, y: 240 },
  { id: "land", x: 118, y: 304 }
];

let missionIndex = 0;
let missionStartedAt = performance.now();
let routeTotalLength = 1;
let outboundRouteLength = 1;
let returnRouteLength = 1;
let missionStopLengths = [];
let flightSeconds = (12 * 60) + 38;
let battery = 82;
let voltage = 22.6;
let tick = 0;
let plotSamples = Array.from({ length: 120 }, (_, i) => ({
  roll: Math.sin(i / 7) * 5.2 + Math.sin(i / 2.3) * 0.5,
  pitch: Math.cos(i / 9) * 3.8 + Math.sin(i / 3.1) * 0.4,
  yaw: 48 + Math.sin(i / 18) * 6.5
}));

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function keepCameraVideoPlaying() {
  if (cameraVideo && cameraVideo.paused) {
    cameraVideo.play().catch(() => {});
  }
}

function drawPlot() {
  const width = plotCanvas.width;
  const height = plotCanvas.height;
  const left = 44;
  const right = 44;
  const top = 22;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const minDeg = -20;
  const maxDeg = 20;
  const latest = plotSamples[plotSamples.length - 1];

  plotCtx.clearRect(0, 0, width, height);
  const bg = plotCtx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#070c12");
  bg.addColorStop(1, "#0b1118");
  plotCtx.fillStyle = bg;
  plotCtx.fillRect(0, 0, width, height);

  plotCtx.fillStyle = "rgba(255,255,255,0.035)";
  plotCtx.fillRect(left, top, plotWidth, plotHeight);

  plotCtx.lineWidth = 1;
  plotCtx.font = "11px Segoe UI, Arial, sans-serif";
  plotCtx.textBaseline = "middle";

  for (let value = minDeg; value <= maxDeg; value += 10) {
    const y = mapValue(value, minDeg, maxDeg, top + plotHeight, top);
    plotCtx.strokeStyle = value === 0 ? "rgba(237,242,247,0.24)" : "rgba(255,255,255,0.08)";
    plotCtx.beginPath();
    plotCtx.moveTo(left, y);
    plotCtx.lineTo(left + plotWidth, y);
    plotCtx.stroke();
    plotCtx.fillStyle = "rgba(169,179,194,0.78)";
    plotCtx.textAlign = "right";
    plotCtx.fillText(`${value}`, left - 8, y);
  }

  for (let i = 0; i <= 8; i += 1) {
    const x = left + (plotWidth / 8) * i;
    plotCtx.strokeStyle = "rgba(255,255,255,0.07)";
    plotCtx.beginPath();
    plotCtx.moveTo(x, top);
    plotCtx.lineTo(x, top + plotHeight);
    plotCtx.stroke();
    plotCtx.fillStyle = "rgba(169,179,194,0.66)";
    plotCtx.textAlign = "center";
    plotCtx.fillText(`${20 - i * 2.5}s`, x, top + plotHeight + 17);
  }

  plotCtx.strokeStyle = "rgba(237,242,247,0.25)";
  plotCtx.strokeRect(left, top, plotWidth, plotHeight);

  drawTelemetrySeries(sample => sample.roll, "#52d2c8", minDeg, maxDeg, left, top, plotWidth, plotHeight, 2.2);
  drawTelemetrySeries(sample => sample.pitch, "#f4d06f", minDeg, maxDeg, left, top, plotWidth, plotHeight, 2.2);
  drawTelemetrySeries(sample => sample.yaw - 48, "#ef7d5b", minDeg, maxDeg, left, top, plotWidth, plotHeight, 1.8);

  const x = left + plotWidth - 2;
  const y = mapValue(latest.roll, minDeg, maxDeg, top + plotHeight, top);
  plotCtx.fillStyle = "#52d2c8";
  plotCtx.beginPath();
  plotCtx.arc(x, y, 3.5, 0, Math.PI * 2);
  plotCtx.fill();

  plotCtx.fillStyle = "rgba(169,179,194,0.82)";
  plotCtx.textAlign = "left";
  plotCtx.fillText("deg", 10, top - 8);
  plotCtx.textAlign = "right";
  plotCtx.fillText("last 20s", width - 10, top - 8);
}

function mapValue(value, min, max, outMin, outMax) {
  return outMin + ((value - min) / (max - min)) * (outMax - outMin);
}

function drawTelemetrySeries(getValue, color, min, max, left, top, plotWidth, plotHeight, lineWidth, dashed = false) {
  plotCtx.strokeStyle = color;
  plotCtx.lineWidth = lineWidth;
  plotCtx.setLineDash(dashed ? [5, 5] : []);
  plotCtx.beginPath();
  plotSamples.forEach((sample, index) => {
    const x = left + (plotWidth / (plotSamples.length - 1)) * index;
    const value = Math.max(min, Math.min(max, getValue(sample)));
    const y = mapValue(value, min, max, top + plotHeight, top);
    if (index === 0) {
      plotCtx.moveTo(x, y);
    } else {
      plotCtx.lineTo(x, y);
    }
  });
  plotCtx.stroke();
  plotCtx.setLineDash([]);
}

function setupMissionRoute() {
  routeTotalLength = plannedRoute.getTotalLength();
  outboundRouteLength = outboundProgressRoute.getTotalLength();
  returnRouteLength = returnProgressRoute.getTotalLength();
  outboundProgressRoute.style.strokeDasharray = `${outboundRouteLength} ${outboundRouteLength}`;
  outboundProgressRoute.style.strokeDashoffset = `${outboundRouteLength}`;
  returnProgressRoute.style.strokeDasharray = `${returnRouteLength} ${returnRouteLength}`;
  returnProgressRoute.style.strokeDashoffset = `${returnRouteLength}`;

  let cumulativeLength = 0;
  missionStopLengths = routePoints.map((point, index) => {
    if (index > 0) {
      const previous = routePoints[index - 1];
      cumulativeLength += Math.hypot(point.x - previous.x, point.y - previous.y);
    }
    return { ...point, length: cumulativeLength };
  }).filter(point => !["start", "land"].includes(point.id));
}

function updateMissionProgress(now = performance.now()) {
  const routeDuration = 44000;
  const cycleDuration = 52000;
  const cycleTime = (now - missionStartedAt) % cycleDuration;
  const routeRatio = Math.min(cycleTime / routeDuration, 1);
  const currentLength = routeTotalLength * routeRatio;
  const currentPoint = plannedRoute.getPointAtLength(currentLength);
  const passedSteps = new Set(
    missionStopLengths
      .filter(stop => currentLength + 1 >= stop.length)
      .map(stop => stop.id)
  );
  const passedOutboundNodes = new Set(
    missionStopLengths
      .filter(stop => stop.phase === "outbound" && currentLength + 1 >= stop.length)
      .map(stop => stop.node)
  );
  const passedReturnNodes = new Set(
    missionStopLengths
      .filter(stop => stop.phase === "return" && currentLength + 1 >= stop.length)
      .map(stop => stop.node)
  );
  const outboundLength = Math.min(currentLength, outboundRouteLength);
  const returnLength = Math.min(Math.max(currentLength - outboundRouteLength, 0), returnRouteLength);
  const isReturning = currentLength > outboundRouteLength;

  outboundProgressRoute.style.strokeDashoffset = `${outboundRouteLength - outboundLength}`;
  returnProgressRoute.style.strokeDashoffset = `${returnRouteLength - returnLength}`;
  movingMissionDot.setAttribute("cx", currentPoint.x.toFixed(1));
  movingMissionDot.setAttribute("cy", currentPoint.y.toFixed(1));
  movingMissionDot.classList.toggle("returning", isReturning);

  waypointNodes.forEach(node => {
    const nodeId = node.dataset.node;
    node.classList.toggle("done", passedOutboundNodes.has(nodeId));
    node.classList.toggle("return-done", passedReturnNodes.has(nodeId));
    node.classList.toggle("active", passedOutboundNodes.has(nodeId) || passedReturnNodes.has(nodeId));
  });

  checklistInputs.forEach(input => {
    input.checked = passedSteps.has(input.dataset.step);
  });

  missionIndex = passedSteps.size;
  requestAnimationFrame(updateMissionProgress);
}

function updateStatus() {
  tick += 1;
  flightSeconds += 1;

  const roll = Math.sin(tick / 6) * 6.8;
  const pitch = Math.cos(tick / 8) * 4.6;
  const yaw = 48 + Math.sin(tick / 18) * 8;
  const compassHeading = (300 + Math.sin(tick / 12) * 34 + Math.sin(tick / 5) * 7 + 360) % 360;
  const altitude = 128 + Math.round(Math.sin(tick / 12) * 4);
  const groundSpeed = 16.4 + Math.sin(tick / 7) * 0.8;
  const linkQuality = 97 + Math.round(Math.sin(tick / 11) * 2);

  if (tick % 20 === 0 && battery > 79) {
    battery -= 1;
    voltage = Math.max(21.8, voltage - 0.05);
  }

  flightTimeEl.textContent = formatTime(flightSeconds);
  batteryLevelEl.textContent = battery;
  batteryFillEl.style.width = `${battery}%`;
  batteryFillEl.style.background = battery < 30
    ? "linear-gradient(90deg, #ff5964, #ef7d5b)"
    : battery < 55
      ? "linear-gradient(90deg, #f4d06f, #ef7d5b)"
      : "linear-gradient(90deg, #77dd92, #52d2c8)";
  voltageEl.textContent = voltage.toFixed(1);
  gpsCountEl.textContent = String(14 + (tick % 30 > 22 ? 1 : 0));
  linkQualityEl.textContent = `${linkQuality}%`;
  altitudeEl.textContent = String(altitude);
  groundSpeedEl.textContent = groundSpeed.toFixed(1);
  flightModeEl.textContent = missionIndex >= 6 ? "RTL" : "AUTO";
  attitudeModeEl.textContent = Math.abs(roll) > 5 ? "ADJUST" : "STABLE";
  const now = new Date();
  cameraClockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  rollValueEl.textContent = `${roll >= 0 ? "+" : ""}${roll.toFixed(1)}`;
  pitchValueEl.textContent = `${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)}`;
  yawValueEl.textContent = pad(Math.round(yaw));
  compassHeadingEl.textContent = `${pad(Math.round(compassHeading))}°`;
  cameraCompassEl.style.setProperty("--heading", `${compassHeading.toFixed(1)}deg`);
  cameraCompassEl.setAttribute("aria-label", `방위 ${Math.round(compassHeading)}도`);

  vtolModel.style.setProperty("--roll", `${roll.toFixed(1)}deg`);
  vtolModel.style.setProperty("--pitch", `${pitch.toFixed(1)}deg`);
  vtolModel.style.setProperty("--yaw", `${(yaw - 48).toFixed(1)}deg`);
  horizonLine.style.transform = `translateY(${pitch * 1.2}px) rotate(${(-roll).toFixed(1)}deg)`;

  plotSamples.push({ roll, pitch, yaw });
  plotSamples = plotSamples.slice(-120);

  keepCameraVideoPlaying();
  drawPlot();
}

checklist.addEventListener("change", event => {
  const label = event.target.closest("label")?.innerText.trim() || "mission item";
  const state = event.target.checked ? "checked" : "unchecked";
  console.log(`[GCS Demo] ${label}: ${state}`);
});

setupMissionRoute();
updateMissionProgress();
updateStatus();
setInterval(updateStatus, 1000);
