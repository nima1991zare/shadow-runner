import * as THREE from "three";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import "./styles.css";
import { generateLevel, getDistrict, getDistrictName, LEVELS_PER_DISTRICT, TOTAL_LEVELS } from "./levels.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const isTouch = matchMedia("(pointer: coarse)").matches;

const CHARACTERS = [
  { id: "nomad", name: "The Nomad", fa: "کوچ‌نشین", cloth: 0x11181c, accent: 0xb35f3b, skin: 0x8c6247, trim: 0xd49a58, shape: "scarf" },
  { id: "dune", name: "Dune Walker", fa: "رهرو شن", cloth: 0x8b6748, accent: 0x315d68, skin: 0xa87552, trim: 0xd8b477, shape: "hood" },
  { id: "night", name: "Night Courier", fa: "پیک شب", cloth: 0x18202f, accent: 0x765878, skin: 0x6e4938, trim: 0x9d82a0, shape: "mask" },
  { id: "ember", name: "Ember Scout", fa: "دیده‌بان آتش", cloth: 0x512c27, accent: 0xd06a3d, skin: 0x936246, trim: 0xe3aa60, shape: "cape" },
  { id: "jade", name: "Jade Sentinel", fa: "نگهبان یشم", cloth: 0x173a37, accent: 0x64a68d, skin: 0x80543e, trim: 0xb7c789, shape: "hood" },
  { id: "falcon", name: "White Falcon", fa: "شاهین سفید", cloth: 0xc8c3b3, accent: 0x397987, skin: 0xa47050, trim: 0xf0d49c, shape: "cape" }
];

const ui = {
  world: $("#game-world"), loading: $("#loading-screen"), loadingBar: $("#loading-bar"), loadingText: $("#loading-text"),
  menu: $("#menu-screen"), levels: $("#levels-screen"), characters: $("#characters-screen"), settings: $("#settings-screen"), hud: $("#hud"), touch: $("#touch-controls"),
  continueLevel: $("#continue-level"), totalStars: $("#total-stars"), levelGrid: $("#level-grid"), districtHeading: $("#district-heading"),
  districtName: $("#district-name"), districtRange: $("#district-range"), districtStars: $("#district-stars"), hudLevel: $("#hud-level"),
  relicCount: $("#relic-count"), sunProgress: $("#sun-progress"), shadeStatus: $("#shade-status"), shadeLabel: $("#shade-label"),
  exposureBar: $("#exposure-bar"), tutorial: $("#tutorial-dialog"), pause: $("#pause-dialog"), result: $("#result-dialog"),
  resultEyebrow: $("#result-eyebrow"), resultTitle: $("#result-title"), resultRelics: $("#result-relics"), resultTime: $("#result-time"),
  resultStars: $$("#result-stars span"), nextButton: $("#next-level-button"), retryButton: $("#retry-button"), toast: $("#toast"),
  sound: $("#sound-setting"), vibration: $("#vibration-setting"), quality: $("#quality-setting"), joystick: $("#joystick"),
  joystickKnob: $("#joystick-knob"), dash: $("#dash-button"), cameraButton: $("#camera-button"),
  characterGrid: $("#character-grid"), selectedCharacterName: $("#selected-character-name")
};

const translations = {
  fa: {
    tagline: "خورشید هر قدم را به خاطر می‌سپارد", story: "از شهر فراموش‌شده عبور کن. سایه را دنبال کن. نگذار نور تو را پیدا کند.",
    continue: "ادامه سفر", districts: "انتخاب منطقه", characters: "شخصیت‌ها", chooseRunner: "دونده خود را انتخاب کن", characterHint: "توانایی همه دوندگان یکسان است. شخصیتی را انتخاب کن که برای تو ساخته شده.", version: "نخستین گرفتگی", choosePath: "مسیرت را انتخاب کن", levelNote: "هر منطقه نور را به شکلی تازه می‌شکند.",
    preferences: "تجربه شما", settings: "تنظیمات", sound: "صدا", soundHint: "موسیقی و افکت‌ها", vibration: "لرزش", vibrationHint: "هشدار لمسی",
    quality: "گرافیک", qualityHint: "کیفیت تصویر", reset: "پاک کردن تمام پیشرفت", level: "مرحله", sunShift: "حرکت خورشید", shade: "سایه",
    firstRule: "قانون اول", stayShadow: "در سایه بمان", tutorialText: "خورشید هنگام دویدن حرکت می‌کند. سایه را ببین، بین ساختمان‌ها حرکت کن و به دروازه درخشان برس.",
    move: "حرکت", dash: "جهش", camera: "دوربین", understood: "فهمیدم", journeyPaused: "سفر متوقف شد", pause: "توقف", resume: "ادامه", restart: "شروع دوباره",
    quit: "بازگشت به شهر", relics: "یادگارها", time: "زمان", nextPath: "مسیر بعدی", tryAgain: "دوباره تلاش کن", levelSelect: "انتخاب مرحله"
  }
};

const defaultSave = { unlocked: 1, stars: {}, language: "en", tutorialSeen: false, sound: true, vibration: true, quality: "auto", character: "nomad", cameraView: 0 };
let save;
try { save = { ...defaultSave, ...JSON.parse(localStorage.getItem("shadow-runner-save") || "{}") }; } catch { save = { ...defaultSave }; }

const persist = () => localStorage.setItem("shadow-runner-save", JSON.stringify(save));
const padLevel = (level) => String(level).padStart(3, "0");
const totalStars = () => Object.values(save.stars).reduce((sum, value) => sum + value, 0);

let renderer, scene, camera, sunLight, sunOrb, worldGroup, player, goal, levelData;
let currentLevel = save.unlocked;
let selectedDistrict = getDistrict(currentLevel);
let occluders = [];
let colliders = [];
let relics = [];
let gameState = "menu";
let exposure = 100;
let collected = 0;
let elapsed = 0;
let sunAngle = 0;
let lastTime = performance.now();
let dashCooldown = 0;
let dashTime = 0;
let currentMove = new THREE.Vector2();
const keys = new Set();
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
let audioContext;
let toastTimer;

function selectedCharacter() {
  return CHARACTERS.find((character) => character.id === save.character) || CHARACTERS[0];
}

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.035) {
  if (!save.sound) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function vibrate(pattern) {
  if (!save.vibration) return;
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: Array.isArray(pattern) ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
  } else if (navigator.vibrate) navigator.vibrate(pattern);
}

function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("active");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("active"), 1800);
}

function setScreen(screen) {
  $$(".screen").forEach((element) => element.classList.toggle("active", element === screen));
  ui.hud.classList.remove("active");
  ui.touch.classList.remove("active");
}

function updateMenu() {
  ui.continueLevel.textContent = `${save.language === "fa" ? "مرحله" : "LEVEL"} ${padLevel(save.unlocked)}`;
  ui.totalStars.textContent = `${totalStars()} / 3000 ${save.language === "fa" ? "ستاره" : "STARS"}`;
}

function applyLanguage() {
  const persian = save.language === "fa";
  document.documentElement.lang = persian ? "fa" : "en";
  document.documentElement.dir = persian ? "rtl" : "ltr";
  $("#language-button").textContent = persian ? "EN" : "فا";
  $$('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (!element.dataset.en) element.dataset.en = element.textContent;
    element.textContent = persian ? translations.fa[key] || element.dataset.en : element.dataset.en;
  });
  updateMenu();
  renderDistrict();
  renderCharacters();
}

function configureRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(getPixelRatio());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  ui.world.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9b7656);
  scene.fog = new THREE.FogExp2(0x9b7656, 0.014);
  camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 180);
  camera.position.set(-28, 28, 34);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xc8d5d3, 0x4a3525, 1.25));
  sunLight = new THREE.DirectionalLight(0xffd39a, 3.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -32;
  sunLight.shadow.camera.right = 32;
  sunLight.shadow.camera.top = 32;
  sunLight.shadow.camera.bottom = -32;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 100;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight, sunLight.target);

  sunOrb = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc574, fog: false }));
  scene.add(sunOrb);
}

function getPixelRatio() {
  const low = save.quality === "low" || (save.quality === "auto" && (isTouch || navigator.hardwareConcurrency < 6));
  return Math.min(devicePixelRatio, low ? 1.25 : 2);
}

function material(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function disposeWorld() {
  if (!worldGroup) return;
  worldGroup.traverse((object) => {
    object.geometry?.dispose();
    if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
    else object.material?.dispose();
  });
  scene.remove(worldGroup);
}

function addMesh(geometry, meshMaterial, x, y, z, cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  worldGroup.add(mesh);
  return mesh;
}

function buildCity(data) {
  disposeWorld();
  occluders = [];
  colliders = [];
  relics = [];
  worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const palettes = [
    [0xa56f45, 0x72503b, 0xd09b62], [0x8d765c, 0x5d625d, 0xb38a5e],
    [0x9a684f, 0x524f4b, 0xc08b6a], [0x877056, 0x4b5959, 0xb29a75]
  ];
  const palette = palettes[data.palette];
  scene.background.set(palette[1]);
  scene.fog.color.set(palette[1]);

  const floor = addMesh(new THREE.PlaneGeometry(52, 52), material(palette[0]), 0, -0.08, 0, false, true);
  floor.rotation.x = -Math.PI / 2;
  const lines = new THREE.GridHelper(52, 26, 0x4b3529, 0x8c6548);
  lines.position.y = -0.045;
  lines.material.opacity = 0.16;
  lines.material.transparent = true;
  worldGroup.add(lines);

  for (const building of data.buildings) {
    const box = addMesh(new THREE.BoxGeometry(building.width, building.height, building.depth), material(building.hue > .72 ? palette[2] : palette[1]), building.x, building.height / 2, building.z);
    occluders.push(box);
    colliders.push({ x: building.x, z: building.z, halfX: building.width / 2 + .48, halfZ: building.depth / 2 + .48 });

    if (building.height > 6) {
      const crown = addMesh(new THREE.BoxGeometry(building.width + .28, .22, building.depth + .28), material(0xc69a67), building.x, building.height + .11, building.z);
      occluders.push(crown);
    }
    const door = addMesh(new THREE.PlaneGeometry(.9, 1.65), material(0x302b28), building.x, .84, building.z + building.depth / 2 + .006, false, false);
    door.rotation.y = 0;
  }

  for (const canopy of data.canopies) {
    const roof = addMesh(new THREE.BoxGeometry(canopy.width, .28, canopy.depth), material(0x4a3730), canopy.x, canopy.height, canopy.z);
    occluders.push(roof);
    for (const [dx, dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      addMesh(new THREE.CylinderGeometry(.1, .13, canopy.height, 8), material(0x47352e), canopy.x + dx * (canopy.width / 2 - .25), canopy.height / 2, canopy.z + dz * (canopy.depth / 2 - .25));
    }
  }

  createPlayer();
  createGoal();
  data.relics.forEach(createRelic);
  addDecorations(data);
  updateSun(0);
}

function createPlayer() {
  player = new THREE.Group();
  player.position.set(-19, 0, 18);
  const character = selectedCharacter();
  const cloth = material(character.cloth);
  const skin = material(character.skin);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.34, .48, 1.08, 8), cloth);
  body.position.y = 1.12;
  body.castShadow = true;
  player.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), skin);
  head.position.y = 1.88;
  head.castShadow = true;
  player.add(head);
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(.13, .1, character.shape === "cape" ? 1.05 : .8), material(character.accent));
  scarf.position.set(0, 1.62, .45);
  scarf.rotation.x = .16;
  scarf.castShadow = true;
  player.add(scarf);
  if (character.shape === "hood") {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(.32, .11, 7, 12), material(character.accent));
    hood.position.y = 1.86;
    hood.rotation.x = Math.PI / 2;
    hood.castShadow = true;
    player.add(hood);
  } else if (character.shape === "mask") {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(.42, .15, .18), material(character.accent));
    mask.position.set(0, 1.82, .22);
    mask.castShadow = true;
    player.add(mask);
  }
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(.39, .39, .09, 8), material(character.trim));
  belt.position.y = .88;
  belt.castShadow = true;
  player.add(belt);
  player.userData.body = body;
  player.userData.scarf = scarf;
  player.userData.velocity = new THREE.Vector3();
  worldGroup.add(player);
}

function createGoal() {
  goal = new THREE.Group();
  goal.position.set(19, 0, -18);
  const stone = material(0x29383a);
  const glow = new THREE.MeshStandardMaterial({ color: 0x70c9b2, emissive: 0x2b8c7c, emissiveIntensity: 2.4, roughness: .35 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(.65, 4.5, .65), stone);
  const right = left.clone();
  left.position.set(-1.5, 2.25, 0); right.position.set(1.5, 2.25, 0);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.65, .65, .65), stone); top.position.y = 4.3;
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 3.45), glow); portal.position.y = 2.05;
  goal.add(left, right, top, portal);
  goal.traverse((object) => { object.castShadow = true; });
  worldGroup.add(goal);
}

function createRelic(data) {
  const group = new THREE.Group();
  group.position.set(data.x, 1, data.z);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.38, 0), new THREE.MeshStandardMaterial({ color: 0xf2c47d, emissive: 0xb56a26, emissiveIntensity: 1.4, roughness: .25, metalness: .2 }));
  crystal.castShadow = true;
  group.add(crystal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .028, 8, 24), new THREE.MeshBasicMaterial({ color: 0xf3d39f, transparent: true, opacity: .6 }));
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData.id = data.id;
  group.userData.baseY = 1;
  relics.push(group);
  worldGroup.add(group);
}

function addDecorations(data) {
  const random = (index) => ((Math.sin(index * 291 + data.level * 17) + 1) / 2);
  for (let index = 0; index < 34; index += 1) {
    const x = -24 + random(index) * 48;
    const z = -24 + random(index + 50) * 48;
    const stone = addMesh(new THREE.DodecahedronGeometry(.1 + random(index + 90) * .22, 0), material(0x5c4939), x, .1, z, true, true);
    stone.rotation.set(random(index + 10), random(index + 20), random(index + 30));
  }
  const wallMaterial = material(0x50443a);
  [[0, 2, -26, 52, 4, 1], [0, 2, 26, 52, 4, 1], [-26, 2, 0, 1, 4, 52], [26, 2, 0, 1, 4, 52]].forEach(([x,y,z,w,h,d]) => {
    const wall = addMesh(new THREE.BoxGeometry(w,h,d), wallMaterial, x,y,z);
    occluders.push(wall);
  });
}

function updateSun(delta) {
  if (gameState === "playing") sunAngle += delta * levelData.sunSpeed;
  const radius = 42;
  const x = Math.cos(sunAngle) * radius;
  const z = Math.sin(sunAngle) * radius;
  const y = 16 + Math.sin(sunAngle * .47) * 4;
  sunLight.position.set(x, y, z);
  sunLight.target.position.set(0, 0, 0);
  sunOrb.position.set(x, y, z);
  ui.sunProgress.style.height = `${((sunAngle % (Math.PI * 2)) / (Math.PI * 2)) * 100}%`;
}

function isPlayerInShadow() {
  if (!player) return true;
  const origin = player.position.clone();
  origin.y = 1.25;
  const direction = sunLight.position.clone().sub(origin).normalize();
  raycaster.set(origin, direction);
  raycaster.far = 90;
  return raycaster.intersectObjects(occluders, false).length > 0;
}

function movementInput() {
  const x = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + currentMove.x;
  const z = (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) - (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) + currentMove.y;
  const vector = new THREE.Vector2(x, z);
  if (vector.lengthSq() > 1) vector.normalize();
  return vector;
}

function canMoveTo(x, z) {
  if (Math.abs(x) > 24.8 || Math.abs(z) > 24.8) return false;
  return !colliders.some((box) => Math.abs(x - box.x) < box.halfX && Math.abs(z - box.z) < box.halfZ);
}

function updatePlayer(delta) {
  const input = movementInput();
  dashCooldown = Math.max(0, dashCooldown - delta);
  dashTime = Math.max(0, dashTime - delta);
  ui.dash.classList.toggle("cooldown", dashCooldown > 0);
  const speed = dashTime > 0 ? 12 : 5.2;
  const velocity = player.userData.velocity;
  velocity.x = THREE.MathUtils.damp(velocity.x, input.x * speed, input.lengthSq() ? 15 : 9, delta);
  velocity.z = THREE.MathUtils.damp(velocity.z, input.y * speed, input.lengthSq() ? 15 : 9, delta);

  const nextX = player.position.x + velocity.x * delta;
  const nextZ = player.position.z + velocity.z * delta;
  if (canMoveTo(nextX, player.position.z)) player.position.x = nextX; else velocity.x = 0;
  if (canMoveTo(player.position.x, nextZ)) player.position.z = nextZ; else velocity.z = 0;

  if (input.lengthSq() > .03) {
    player.rotation.y = THREE.MathUtils.damp(player.rotation.y, Math.atan2(input.x, input.y), 12, delta);
    const stride = elapsed * (dashTime > 0 ? 16 : 10);
    player.userData.body.position.y = 1.12 + Math.abs(Math.sin(stride)) * .08;
    player.userData.scarf.rotation.x = .15 + Math.sin(stride) * .12;
  }

  const offset = save.cameraView === 1 ? new THREE.Vector3(-23, 18, 8) : new THREE.Vector3(-15, 18, 20);
  const cameraTarget = player.position.clone().add(offset);
  camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * 2.5));
  const lookAt = player.position.clone(); lookAt.y = 1;
  camera.lookAt(lookAt);
}

function updateRelics(delta) {
  relics.forEach((relic, index) => {
    relic.rotation.y += delta * 1.4;
    relic.position.y = relic.userData.baseY + Math.sin(elapsed * 2.4 + index) * .14;
    if (relic.visible && player.position.distanceTo(relic.position) < 1.2) {
      relic.visible = false;
      collected += 1;
      ui.relicCount.textContent = collected;
      playTone(640 + collected * 100, .18, "triangle", .06);
      vibrate(30);
      showToast(save.language === "fa" ? `یادگار ${collected} از ۳` : `RELIC ${collected} OF 3`);
    }
  });
}

function updateExposure(delta) {
  const safe = isPlayerInShadow();
  if (safe) exposure = Math.min(100, exposure + delta * 10);
  else exposure = Math.max(0, exposure - delta * levelData.exposureRate);
  ui.exposureBar.style.width = `${exposure}%`;
  ui.shadeStatus.classList.toggle("safe", safe);
  ui.shadeStatus.classList.toggle("danger", !safe);
  ui.shadeLabel.textContent = safe ? (save.language === "fa" ? "محافظت شده" : "PROTECTED") : (save.language === "fa" ? "در معرض نور" : "EXPOSED");
  if (!safe && exposure < 35 && Math.floor(elapsed * 3) % 3 === 0) vibrate(12);
  if (exposure <= 0) finishLevel(false);
}

function triggerDash() {
  if (gameState !== "playing" || dashCooldown > 0) return;
  dashTime = .28;
  dashCooldown = 1.6;
  playTone(180, .15, "sawtooth", .025);
  vibrate(18);
}

function startLevel(level) {
  currentLevel = Math.min(TOTAL_LEVELS, Math.max(1, level));
  levelData = generateLevel(currentLevel);
  exposure = 100;
  collected = 0;
  elapsed = 0;
  dashCooldown = 0;
  sunAngle = levelData.startAngle;
  ui.hudLevel.textContent = padLevel(currentLevel);
  ui.relicCount.textContent = "0";
  ui.exposureBar.style.width = "100%";
  ui.cameraButton.classList.toggle("alternate", save.cameraView === 1);
  ui.cameraButton.setAttribute("aria-pressed", String(save.cameraView === 1));
  setScreen(null);
  ui.hud.classList.add("active");
  if (isTouch) ui.touch.classList.add("active");
  buildCity(levelData);
  gameState = "playing";
  clock.getDelta();
  playTone(220, .22, "triangle", .04);
  if (!save.tutorialSeen) {
    gameState = "paused";
    ui.tutorial.showModal();
  }
}

function finishLevel(won) {
  if (gameState !== "playing") return;
  gameState = "result";
  ui.result.classList.toggle("failed", !won);
  ui.resultEyebrow.textContent = won ? (save.language === "fa" ? "مسیر کامل شد" : "PATH COMPLETE") : (save.language === "fa" ? "نور تو را یافت" : "THE LIGHT FOUND YOU");
  ui.resultTitle.textContent = won ? (save.language === "fa" ? "سایه پابرجاست" : "THE SHADOW HOLDS") : (save.language === "fa" ? "دوباره به سایه برگرد" : "RETURN TO THE SHADE");
  ui.resultRelics.textContent = `${collected} / 3`;
  ui.resultTime.textContent = formatTime(elapsed);
  ui.nextButton.classList.toggle("hidden", !won || currentLevel >= TOTAL_LEVELS);
  ui.retryButton.classList.toggle("hidden", won);
  let stars = 0;
  if (won) {
    stars = 1 + (collected === 3 ? 1 : 0) + (elapsed <= levelData.parTime ? 1 : 0);
    save.stars[currentLevel] = Math.max(save.stars[currentLevel] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(TOTAL_LEVELS, currentLevel + 1));
    persist();
    playTone(523, .2, "triangle", .06);
    setTimeout(() => playTone(659, .24, "triangle", .05), 140);
  } else {
    playTone(105, .45, "sawtooth", .045);
    vibrate([80, 60, 120]);
  }
  ui.resultStars.forEach((star, index) => star.classList.toggle("earned", index < stars));
  ui.result.showModal();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function showMenu() {
  gameState = "menu";
  setScreen(ui.menu);
  updateMenu();
  if (!worldGroup) buildCity(generateLevel(save.unlocked));
  camera.position.set(-28, 28, 34);
  camera.lookAt(0, 0, 0);
}

function renderCharacters() {
  if (!ui.characterGrid) return;
  ui.characterGrid.replaceChildren();
  for (const character of CHARACTERS) {
    const selected = character.id === save.character;
    const button = document.createElement("button");
    button.className = `character-card${selected ? " selected" : ""}`;
    button.type = "button";
    button.style.setProperty("--character-cloth", `#${character.cloth.toString(16).padStart(6, "0")}`);
    button.style.setProperty("--character-accent", `#${character.accent.toString(16).padStart(6, "0")}`);
    button.style.setProperty("--character-skin", `#${character.skin.toString(16).padStart(6, "0")}`);
    const name = save.language === "fa" ? character.fa : character.name.toUpperCase();
    button.innerHTML = `<span class="character-portrait" aria-hidden="true"><i></i><b></b><em></em></span><strong>${name}</strong><small>${selected ? (save.language === "fa" ? "انتخاب شده" : "SELECTED") : (save.language === "fa" ? "انتخاب" : "CHOOSE")}</small>`;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => selectCharacter(character.id));
    ui.characterGrid.append(button);
  }
  const character = selectedCharacter();
  ui.selectedCharacterName.textContent = save.language === "fa" ? character.fa : character.name.toUpperCase();
}

function selectCharacter(id) {
  if (save.character === id) return;
  save.character = id;
  persist();
  renderCharacters();
  buildCity(generateLevel(save.unlocked));
  playTone(480, .14, "triangle", .05);
  vibrate(20);
}

function toggleCamera() {
  if (gameState !== "playing") return;
  save.cameraView = save.cameraView === 1 ? 0 : 1;
  persist();
  ui.cameraButton.classList.toggle("alternate", save.cameraView === 1);
  ui.cameraButton.setAttribute("aria-pressed", String(save.cameraView === 1));
  showToast(save.language === "fa" ? (save.cameraView ? "نمای چپ" : "نمای اصلی") : (save.cameraView ? "LEFT VIEW" : "MAIN VIEW"));
  playTone(300, .08, "triangle", .025);
}

function renderDistrict() {
  if (!ui.levelGrid) return;
  const first = (selectedDistrict - 1) * LEVELS_PER_DISTRICT + 1;
  const last = first + LEVELS_PER_DISTRICT - 1;
  ui.districtHeading.textContent = `${save.language === "fa" ? "منطقه" : "DISTRICT"} ${String(selectedDistrict).padStart(2, "0")}`;
  ui.districtName.textContent = getDistrictName(selectedDistrict).toUpperCase();
  ui.districtRange.textContent = `${save.language === "fa" ? "مراحل" : "LEVELS"} ${padLevel(first)}-${padLevel(last)}`;
  const stars = Array.from({ length: LEVELS_PER_DISTRICT }, (_, index) => save.stars[first + index] || 0).reduce((a, b) => a + b, 0);
  ui.districtStars.textContent = `${stars} / 60`;
  ui.levelGrid.replaceChildren();
  for (let level = first; level <= last; level += 1) {
    const button = document.createElement("button");
    button.className = `level-card${level === save.unlocked ? " current" : ""}`;
    button.disabled = level > save.unlocked;
    button.innerHTML = `<strong>${padLevel(level)}</strong><small>${"★".repeat(save.stars[level] || 0)}</small>`;
    button.setAttribute("aria-label", `Level ${level}`);
    button.addEventListener("click", () => startLevel(level));
    ui.levelGrid.append(button);
  }
  $("#previous-district").disabled = selectedDistrict <= 1;
  $("#next-district").disabled = selectedDistrict >= TOTAL_LEVELS / LEVELS_PER_DISTRICT;
}

function bindUI() {
  $("#continue-button").addEventListener("click", () => startLevel(save.unlocked));
  $("#levels-button").addEventListener("click", () => { selectedDistrict = getDistrict(save.unlocked); renderDistrict(); setScreen(ui.levels); });
  $("#characters-button").addEventListener("click", () => { renderCharacters(); setScreen(ui.characters); });
  $("#settings-button").addEventListener("click", () => setScreen(ui.settings));
  $$('[data-back]').forEach((button) => button.addEventListener("click", showMenu));
  $("#previous-district").addEventListener("click", () => { selectedDistrict = Math.max(1, selectedDistrict - 1); renderDistrict(); });
  $("#next-district").addEventListener("click", () => { selectedDistrict = Math.min(50, selectedDistrict + 1); renderDistrict(); });
  $("#language-button").addEventListener("click", () => { save.language = save.language === "fa" ? "en" : "fa"; persist(); applyLanguage(); });
  $("#pause-button").addEventListener("click", pauseGame);
  ui.cameraButton.addEventListener("click", toggleCamera);
  ui.tutorial.addEventListener("close", () => { save.tutorialSeen = true; persist(); gameState = "playing"; });
  ui.pause.addEventListener("close", () => {
    if (ui.pause.returnValue === "restart") startLevel(currentLevel);
    else if (ui.pause.returnValue === "quit") showMenu();
    else gameState = "playing";
  });
  ui.result.addEventListener("close", () => {
    if (ui.result.returnValue === "next") startLevel(currentLevel + 1);
    else if (ui.result.returnValue === "retry") startLevel(currentLevel);
    else { selectedDistrict = getDistrict(currentLevel); renderDistrict(); setScreen(ui.levels); gameState = "menu"; }
  });
  ui.sound.checked = save.sound;
  ui.vibration.checked = save.vibration;
  ui.quality.value = save.quality;
  ui.sound.addEventListener("change", () => { save.sound = ui.sound.checked; persist(); playTone(440); });
  ui.vibration.addEventListener("change", () => { save.vibration = ui.vibration.checked; persist(); vibrate(30); });
  ui.quality.addEventListener("change", () => { save.quality = ui.quality.value; persist(); renderer.setPixelRatio(getPixelRatio()); });
  $("#reset-progress").addEventListener("click", () => {
    if (!confirm(save.language === "fa" ? "تمام پیشرفت بازی پاک شود؟" : "Reset all game progress?")) return;
    save = { ...defaultSave, language: save.language };
    persist();
    applyLanguage();
    showToast(save.language === "fa" ? "پیشرفت پاک شد" : "PROGRESS RESET");
  });
  ui.dash.addEventListener("pointerdown", (event) => { event.preventDefault(); triggerDash(); });
}

function pauseGame() {
  if (gameState !== "playing") return;
  gameState = "paused";
  ui.pause.showModal();
}

function bindInput() {
  addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Space") triggerDash();
    if (event.code === "KeyC" && !event.repeat) toggleCamera();
    if (event.code === "Escape") pauseGame();
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => { keys.clear(); if (gameState === "playing") pauseGame(); });

  let pointerId = null;
  function moveJoystick(event) {
    if (event.pointerId !== pointerId) return;
    const rect = ui.joystick.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const max = rect.width * .3;
    const length = Math.hypot(x, y);
    const scale = length > max ? max / length : 1;
    const dx = x * scale;
    const dy = y * scale;
    currentMove.set(dx / max, dy / max);
    ui.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function endJoystick(event) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    currentMove.set(0, 0);
    ui.joystickKnob.style.transform = "translate(0, 0)";
  }
  ui.joystick.addEventListener("pointerdown", (event) => { pointerId = event.pointerId; ui.joystick.setPointerCapture(pointerId); moveJoystick(event); });
  ui.joystick.addEventListener("pointermove", moveJoystick);
  ui.joystick.addEventListener("pointerup", endJoystick);
  ui.joystick.addEventListener("pointercancel", endJoystick);
}

function animate(now) {
  requestAnimationFrame(animate);
  const delta = Math.min(.05, (now - lastTime) / 1000 || .016);
  lastTime = now;
  if (gameState === "playing") {
    elapsed += delta;
    updateSun(delta);
    updatePlayer(delta);
    updateRelics(delta);
    updateExposure(delta);
    if (player.position.distanceTo(goal.position) < 2.1) finishLevel(true);
  } else if (gameState === "menu" && worldGroup) {
    camera.position.x = -28 + Math.sin(now * .00008) * 4;
    camera.lookAt(0, 1, 0);
    sunAngle += delta * .012;
    updateSun(0);
    relics.forEach((relic, index) => { relic.rotation.y += delta * .4; relic.position.y = 1 + Math.sin(now * .0015 + index) * .1; });
  }
  renderer.render(scene, camera);
}

async function boot() {
  configureRenderer();
  bindUI();
  bindInput();
  applyLanguage();
  const messages = ["Mapping the sun...", "Raising the old city...", "Finding the shadows..."];
  for (let index = 0; index < messages.length; index += 1) {
    ui.loadingText.textContent = messages[index];
    ui.loadingBar.style.width = `${(index + 1) * 33.4}%`;
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  buildCity(generateLevel(save.unlocked));
  showMenu();
  requestAnimationFrame(animate);
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
  }
}

addEventListener("resize", () => {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(getPixelRatio());
});

boot();
