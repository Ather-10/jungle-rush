"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Coins,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  Trophy,
  X,
} from "lucide-react";

type GameObject = {
  mesh: THREE.Mesh;
  lane: number;
  type: "obstacle" | "coin";
  active: boolean;
  obstacleKind?: "low" | "block" | "overhead";
};

type ControlMode = "buttons" | "swipe" | "both";

const BEST_KEY = "jungle-rush-best-score-v1";
const SETTINGS_KEY = "jungle-rush-settings-v1";
const TOTAL_COINS_KEY = "jungle-rush-total-coins-v1";

type SavedSettings = {
  music: boolean;
  sfx: boolean;
  musicVolume: number;
  sfxVolume: number;
  controlMode: ControlMode;
  leftHanded: boolean;
};

const DEFAULT_SETTINGS: SavedSettings = {
  music: true,
  sfx: true,
  musicVolume: 65,
  sfxVolume: 80,
  controlMode: "both",
  leftHanded: false,
};

export default function JungleRush() {
  const mountRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<{ music: HTMLAudioElement | null; coin: HTMLAudioElement | null; jump: HTMLAudioElement | null; slide: HTMLAudioElement | null; gameOver: HTMLAudioElement | null; start: HTMLAudioElement | null; tap: HTMLAudioElement | null }>({ music: null, coin: null, jump: null, slide: null, gameOver: null, start: null, tap: null });
  const settingsRef = useRef<SavedSettings>(DEFAULT_SETTINGS);
  const playSfx = useCallback((key: "coin" | "jump" | "slide" | "gameOver" | "start" | "tap") => {
    const audio = audioRef.current[key];
    const currentSettings = settingsRef.current;
    if (!audio || !currentSettings.sfx || currentSettings.sfxVolume <= 0) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, currentSettings.sfxVolume / 100));
      void audio.play().catch(() => {});
    } catch {}
  }, []);
  const apiRef = useRef<{
    start: () => void;
    move: (direction: number) => void;
    jump: () => void;
    slide: () => void;
    restart: () => void;
    pause: () => void;
    resume: () => void;
  } | null>(null);

  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [settings, setSettings] = useState<SavedSettings>(DEFAULT_SETTINGS);
  settingsRef.current = settings;
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  const updateSettings = useCallback((patch: Partial<SavedSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const restart = useCallback(() => {
    setSettingsOpen(false);
    apiRef.current?.restart();
  }, []);

  const pauseGame = useCallback(() => {
    apiRef.current?.pause();
  }, []);

  const resumeGame = useCallback(() => {
    setSettingsOpen(false);
    apiRef.current?.resume();
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fullscreen may be unavailable in some mobile browsers.
    }
  }, []);

  useEffect(() => {
    try {
      const savedBest = Number(window.localStorage.getItem(BEST_KEY) || 0);
      setBestScore(Number.isFinite(savedBest) ? savedBest : 0);
      const savedCoins = Number(
  window.localStorage.getItem(TOTAL_COINS_KEY) || 0
);

setTotalCoins(
  Number.isFinite(savedCoins) ? savedCoins : 0
);
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedSettings>;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {}
    setFullscreenSupported(Boolean(document.documentElement.requestFullscreen));
  }, []);

  useEffect(() => {
    const makeAudio = (file: string, loop = false) => {
      const audio = new Audio(`/audio/${file}.wav`);
      audio.preload = "auto";
      audio.loop = loop;
      return audio;
    };
    const audio = {
      music: makeAudio("music-loop", true),
      coin: makeAudio("coin"),
      jump: makeAudio("jump"),
      slide: makeAudio("slide"),
      gameOver: makeAudio("game-over"),
      start: makeAudio("start"),
      tap: makeAudio("tap"),
    };
    audioRef.current = audio;
    return () => {
      Object.values(audio).forEach((item) => {
        if (item) { item.pause(); item.src = ""; }
      });
      audioRef.current = { music: null, coin: null, jump: null, slide: null, gameOver: null, start: null, tap: null };
    };
  }, []);

  useEffect(() => {
    const music = audioRef.current.music;
    if (!music) return;
    music.volume = Math.max(0, Math.min(1, settings.musicVolume / 100));
    if (settings.music && settings.musicVolume > 0 && playing && !paused && !gameOver) {
      void music.play().catch(() => {});
    } else {
      music.pause();
    }
  }, [settings.music, settings.musicVolume, playing, paused, gameOver]);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      try {
        window.localStorage.setItem(BEST_KEY, String(score));
      } catch {}
    }
  }, [score, bestScore]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07160f");
    scene.fog = new THREE.Fog("#07160f", 22, 100);

    const camera = new THREE.PerspectiveCamera(
      60,
      Math.max(1, mount.clientWidth) / Math.max(1, mount.clientHeight),
      0.1,
      150
    );
    camera.position.set(0, 6, 10);
    camera.lookAt(0, 1, -8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.domElement.setAttribute("aria-label", "Jungle Rush 3D gameplay");
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#c4f7d0", "#17251a", 2));

    const sun = new THREE.DirectionalLight("#ffe6a0", 3);
    sun.position.set(-8, 14, 5);
    sun.castShadow = true;
    scene.add(sun);

    const roadMat = new THREE.MeshStandardMaterial({
      color: "#303b31",
      roughness: 0.92,
    });
    const grassMat = new THREE.MeshStandardMaterial({
      color: "#183b24",
      roughness: 1,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: "#b8d8a1",
      emissive: "#28462b",
    });

    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 150), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -55);
    road.receiveShadow = true;
    scene.add(road);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 180), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, -45);
    scene.add(ground);

    const laneMarkers: THREE.Mesh[] = [];
    for (const x of [-1.3, 1.3]) {
      for (let i = 0; i < 20; i++) {
        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, 0.025, 2),
          lineMat
        );
        marker.position.set(x, 0.02, -i * 5);
        scene.add(marker);
        laneMarkers.push(marker);
      }
    }

    const treeTrunk = new THREE.MeshStandardMaterial({ color: "#69452a" });
    const leaves = [
      new THREE.MeshStandardMaterial({ color: "#205b34" }),
      new THREE.MeshStandardMaterial({ color: "#347444" }),
      new THREE.MeshStandardMaterial({ color: "#153d29" }),
    ];

    for (const side of [-1, 1]) {
      for (let i = 0; i < 26; i++) {
        const z = -i * 4 - 3;
        const x = side * (6 + Math.random() * 9);
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.23, 2.4, 6),
          treeTrunk
        );
        trunk.position.set(x, 1.1, z);
        trunk.castShadow = true;
        scene.add(trunk);

        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(1.4 + Math.random(), 3.2, 6),
          leaves[i % leaves.length]
        );
        crown.position.set(x, 3.2, z);
        crown.rotation.y = Math.random() * 2;
        crown.castShadow = true;
        scene.add(crown);
      }
    }

const player = new THREE.Group();
scene.add(player);
player.position.set(0, 0, 1);

// Procedural jungle runner — no GLB file needed
const skinMat = new THREE.MeshStandardMaterial({ color: "#e8ad78" });
const shirtMat = new THREE.MeshStandardMaterial({ color: "#ff8a24" });
const pantsMat = new THREE.MeshStandardMaterial({ color: "#263c66" });
const shoeMat = new THREE.MeshStandardMaterial({ color: "#f5f1df" });
const hairMat = new THREE.MeshStandardMaterial({ color: "#38251b" });

const body = new THREE.Group();
player.add(body);

function addPart(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  body.add(mesh);
  return mesh;
}

// Torso
addPart(
  new THREE.BoxGeometry(0.72, 0.85, 0.42),
  shirtMat,
  [0, 1.25, 0],
);

// Head
addPart(
  new THREE.SphereGeometry(0.29, 16, 12),
  skinMat,
  [0, 1.95, 0],
);

// Hair
addPart(
  new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  hairMat,
  [0, 2.05, 0],
);

// Arms and legs
const leftArm = addPart(
  new THREE.BoxGeometry(0.2, 0.72, 0.22),
  skinMat,
  [-0.48, 1.3, 0],
);
leftArm.rotation.z = -0.18;

const rightArm = addPart(
  new THREE.BoxGeometry(0.2, 0.72, 0.22),
  skinMat,
  [0.48, 1.3, 0],
);
rightArm.rotation.z = 0.18;

const leftLeg = addPart(
  new THREE.BoxGeometry(0.25, 0.65, 0.28),
  pantsMat,
  [-0.2, 0.48, 0],
);

const rightLeg = addPart(
  new THREE.BoxGeometry(0.25, 0.65, 0.28),
  pantsMat,
  [0.2, 0.48, 0],
);

// Shoes
addPart(
  new THREE.BoxGeometry(0.29, 0.16, 0.42),
  shoeMat,
  [-0.2, 0.12, -0.07],
);

addPart(
  new THREE.BoxGeometry(0.29, 0.16, 0.42),
  shoeMat,
  [0.2, 0.12, -0.07],
);

    const objects: GameObject[] = [];
    const obstacleMaterials = [
      new THREE.MeshStandardMaterial({ color: "#95623d" }),
      new THREE.MeshStandardMaterial({ color: "#67736b" }),
      new THREE.MeshStandardMaterial({ color: "#a74332" }),
    ];
    const coinMat = new THREE.MeshStandardMaterial({
      color: "#ffd34d",
      metalness: 0.65,
      roughness: 0.25,
      emissive: "#805000",
      emissiveIntensity: 0.5,
    });

    function addObstacle(lane: number, z: number) {
      const roll = Math.random();
      let mesh: THREE.Mesh;
      let obstacleKind: GameObject["obstacleKind"];

      if (roll < 0.55) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.05, 1.1, 0.9),
          obstacleMaterials[0]
        );
        mesh.position.y = 0.55;
        obstacleKind = "block";
      } else if (roll < 0.8) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 0.7, 0.9),
          obstacleMaterials[1]
        );
        mesh.position.y = 0.35;
        obstacleKind = "low";
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.15, 0.35, 0.7),
          obstacleMaterials[2]
        );
        mesh.position.y = 1.65;
        obstacleKind = "overhead";
      }

      mesh.position.x = lane * 2.4;
      mesh.position.z = z;
      mesh.castShadow = true;
      scene.add(mesh);
      objects.push({
        mesh,
        lane,
        type: "obstacle",
        active: true,
        obstacleKind,
      });
    }

    function addCoin(lane: number, z: number) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.09, 8, 16),
        coinMat
      );
      mesh.position.set(lane * 2.4, 1.15, z);
      mesh.castShadow = true;
      scene.add(mesh);
      objects.push({ mesh, lane, type: "coin", active: true });
    }

    let running = false;
    let dead = false;
    let isPaused = false;
    let lane = 0;
    let targetX = 0;
    let jumping = false;
    let sliding = false;
    let jumpTime = 0;
    let slideTime = 0;
    let speed = 17;
    let distance = 0;
    let coinCount = 0;
    let spawnTimer = 0;
    let scoreTimer = 0;
    let animationId = 0;
    let disposed = false;

    function clearObjects() {
      for (const obj of objects) {
        scene.remove(obj.mesh);
      }
      objects.length = 0;
    }

    function resetGame() {
      clearObjects();
      lane = 0;
      targetX = 0;
      player.position.set(0, 0, 1);
      player.rotation.set(0, 0, 0);
      body.scale.set(1, 1, 1);
      body.position.y = 1.05;
      jumping = false;
      sliding = false;
      jumpTime = 0;
      slideTime = 0;
      speed = 17;
      distance = 0;
      coinCount = 0;
      spawnTimer = 0.6;
      scoreTimer = 0;
      dead = false;
      isPaused = false;
      running = true;
      setScore(0);
      setCoins(0);
      setGameOver(false);
      setPaused(false);
      setPlaying(true);
      playSfx("start");
    }

    function move(direction: number) {
      if (!running || dead || isPaused) return;
      lane = THREE.MathUtils.clamp(lane + direction, -1, 1);
      targetX = lane * 2.4;
    }

    function jump() {
      if (!running || dead || isPaused || jumping || sliding) return;
      jumping = true;
      jumpTime = 0;
      playSfx("jump");
    }

    function slide() {
      if (!running || dead || isPaused || sliding || jumping) return;
      sliding = true;
      slideTime = 0;
      playSfx("slide");
      body.scale.y = 0.45;
      body.position.y = 0.52;
    }

    function finishGame() {
      dead = true;
      running = false;
      isPaused = false;
      setPlaying(false);
      setPaused(false);
      setGameOver(true);
      playSfx("gameOver");
    }

    function pause() {
      if (!running || dead || isPaused) return;
      isPaused = true;
      setPaused(true);
    }

    function resume() {
      if (!running || dead || !isPaused) return;
      isPaused = false;
      setPaused(false);
    }

    apiRef.current = {
      start: resetGame,
      move,
      jump,
      slide,
      restart: resetGame,
      pause,
      resume,
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(
          event.key
        )
      ) {
        event.preventDefault();
      }
      if (event.repeat) return;

      if (event.key === "Escape" || event.key.toLowerCase() === "p") {
        if (running && !dead) {
          if (isPaused) resume();
          else pause();
        }
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") move(-1);
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") move(1);
      if (event.key === "ArrowUp" || event.key === " ") jump();
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") slide();
      if (event.key === "Enter" && (!running || dead)) resetGame();
    };
    window.addEventListener("keydown", onKeyDown);

    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchStartX = event.changedTouches[0]?.clientX ?? 0;
      touchStartY = event.changedTouches[0]?.clientY ?? 0;
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!running || dead || isPaused) return;
      const dx = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      const dy = (event.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
      else if (dy < 0) jump();
      else slide();
    };
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchend", onTouchEnd, { passive: true });

    const clock = new THREE.Clock();

    function animate() {
      if (disposed) return;
      animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);

      if (running && !dead && !isPaused) {
        distance += speed * dt;
        speed = Math.min(32, 17 + distance * 0.003);
        scoreTimer += dt;

        if (scoreTimer >= 0.15) {
          setScore(Math.floor(distance * 2) + coinCount * 25);
          setCoins(coinCount);
          scoreTimer = 0;
        }

        player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 12, dt);
   
body.position.y = sliding
  ? 0.52
  : Math.abs(Math.sin(distance * 1.3)) * 0.035;

body.rotation.z = (targetX - player.position.x) * -0.08;

        body.rotation.z = (targetX - player.position.x) * -0.08;

        if (jumping) {
          jumpTime += dt;
          const t = jumpTime / 0.85;
          player.position.y = t >= 1 ? 0 : Math.sin(Math.PI * t) * 2.2;
          if (t >= 1) {
            jumping = false;
            player.position.y = 0;
          }
        }

        if (sliding) {
          slideTime += dt;
          if (slideTime >= 0.75) {
            sliding = false;
            body.scale.y = 1;
            body.position.y = 0;
          }
        }

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          const obstacleLane = Math.floor(Math.random() * 3) - 1;
          addObstacle(obstacleLane, -55);

          if (Math.random() > 0.2) {
            let coinLane = Math.floor(Math.random() * 3) - 1;
            if (coinLane === obstacleLane) {
              coinLane = coinLane === 1 ? -1 : coinLane + 1;
            }
            for (let i = 0; i < 4; i++) addCoin(coinLane, -58 - i * 1.5);
          }
          spawnTimer = Math.max(0.48, 1.05 - distance * 0.00025);
        }

        for (const obj of objects) {
          if (!obj.active) continue;
          obj.mesh.position.z += speed * dt;

          if (obj.type === "coin") obj.mesh.rotation.y += dt * 3;

          const dz = Math.abs(obj.mesh.position.z - player.position.z);
          const dx = Math.abs(obj.mesh.position.x - player.position.x);

          if (dz < 0.85 && dx < 0.8) {
            if (obj.type === "coin") {
              obj.active = false;
              scene.remove(obj.mesh);
              coinCount += 1;
setCoins(coinCount);

setTotalCoins((previous) => {
  const next = previous + 1;

  try {
    window.localStorage.setItem(
      TOTAL_COINS_KEY,
      String(next)
    );
  } catch {}

  return next;
});

playSfx("coin");
            } else if (dz < 0.65) {
              const safe =
                obj.obstacleKind === "overhead" ? sliding :
                obj.obstacleKind === "low" ? jumping :
                jumping;
              if (!safe) finishGame();
            }
          }

          if (obj.mesh.position.z > 12) {
            obj.active = false;
            scene.remove(obj.mesh);
          }
        }

        for (let i = objects.length - 1; i >= 0; i--) {
          if (!objects[i].active) objects.splice(i, 1);
        }

        for (const marker of laneMarkers) {
          marker.position.z += speed * dt;
          if (marker.position.z > 4) marker.position.z -= 100;
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!mount || disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("keydown", onKeyDown);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      resizeObserver.disconnect();
      apiRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material: THREE.Material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const showControls =
    playing && !paused && settings.controlMode !== "swipe";

  const moveLeft = () => apiRef.current?.move(settings.leftHanded ? 1 : -1);
  const moveRight = () => apiRef.current?.move(settings.leftHanded ? -1 : 1);
  const leftIcon = settings.leftHanded ? ArrowRight : ArrowLeft;
  const rightIcon = settings.leftHanded ? ArrowLeft : ArrowRight;

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="game-logo" aria-label="Jungle Rush">
          <span className="game-logo-eyebrow">Endless adventure</span>
          <div className="game-logo-title">
            JUNGLE <span>RUSH</span>
          </div>
        </div>

        <div className="game-header-actions">
          <div className="game-stat">
            <span className="game-stat-label">
              <Trophy size={10} style={{ display: "inline", marginRight: 4 }} />
              Score
            </span>
            <span className="game-stat-value">{score.toLocaleString()}</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-label" style={{ color: "#f6c453" }}>
              <Coins size={10} style={{ display: "inline", marginRight: 4 }} />
              Coins
            </span>
            <span className="game-stat-value" style={{ color: "#f6c453" }}>
              {coins}
            </span>
          </div>
          <div className="game-stat">
  <span className="game-stat-label">Total Coins</span>
  <span className="game-stat-value">
    {totalCoins.toLocaleString()}
  </span>
</div>
          <button
            className="game-icon-button"
            aria-label="Open settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={19} />
          </button>
        </div>
      </header>

      <section className="game-viewport">
        <div ref={mountRef} className="absolute inset-0" />

        <div className="game-hud">
          <div className="game-hud-card">
            <div className="game-hud-label">Best run</div>
            <div className="game-hud-value">{bestScore.toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            {playing && !paused && (
              <button
                className="game-icon-button"
                aria-label="Pause game"
                onClick={pauseGame}
              >
                <Pause size={18} />
              </button>
            )}
            {fullscreenSupported && (
              <button
                className="game-icon-button"
                aria-label="Toggle fullscreen"
                onClick={toggleFullscreen}
              >
                <Maximize size={17} />
              </button>
            )}
          </div>
        </div>

        {playing && !paused && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[4] flex justify-between gap-2 sm:bottom-5 sm:left-5 sm:right-5">
            <span className="game-badge game-badge-green">SPEED INCREASING</span>
            <span className="game-badge">DODGE · JUMP · SLIDE</span>
          </div>
        )}

        {(!playing || paused) && (
          <div className="game-overlay">
            <div className="game-panel">
              <div className="game-panel-eyebrow">
                {paused ? "Take a breath" : gameOver ? "Run complete" : "The wild is calling"}
              </div>
              <h1 className="game-panel-title">
                {paused ? "PAUSED" : gameOver ? "GAME OVER" : "JUNGLE RUSH"}
              </h1>
              <p className="game-panel-description">
                {paused
                  ? "Your adventure is paused. Ready to get back on the trail?"
                  : gameOver
                    ? `Score ${score.toLocaleString()} · ${coins} coins collected. Ready for another run?`
                    : "Run through the wild, dodge obstacles, jump over logs and collect golden coins."}
              </p>

              {!paused && (
                <div className="mb-5 grid grid-cols-2 gap-2">
                  <div className="game-stat">
                    <span className="game-stat-label">Current score</span>
                    <span className="game-stat-value">{score.toLocaleString()}</span>
                  </div>
                  <div className="game-stat">
                    <span className="game-stat-label">Personal best</span>
                    <span className="game-stat-value" style={{ color: "#f6c453" }}>
                      {bestScore.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="game-button-stack">
                <button
                  className="game-primary-button"
                  onClick={paused ? resumeGame : restart}
                >
                  {paused ? <Play size={17} fill="currentColor" /> :
                    gameOver ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}
                  {paused ? "Resume run" : gameOver ? "Run again" : "Start running"}
                </button>
                {paused && (
                  <button className="game-secondary-button" onClick={restart}>
                    <RotateCcw size={16} /> Restart run
                  </button>
                )}
                <button
                  className="game-secondary-button"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings size={16} /> Game settings
                </button>
              </div>
              <p className="mt-4 text-center text-[10px] leading-5 text-white/45">
                Arrow keys / WASD · Swipe on mobile · P or Esc to pause
              </p>
            </div>
          </div>
        )}

        {showControls && (
          <div className="mobile-controls" data-hidden="false">
            <button aria-label="Move left" onClick={moveLeft}>
              {(() => {
                const Icon = leftIcon;
                return <Icon size={23} />;
              })()}
              <small>LEFT</small>
            </button>
            <button aria-label="Jump" onClick={() => apiRef.current?.jump()}>
              <ArrowUp size={23} />
              <small>JUMP</small>
            </button>
            <button aria-label="Slide" onClick={() => apiRef.current?.slide()}>
              <ArrowDown size={23} />
              <small>SLIDE</small>
            </button>
            <button aria-label="Move right" onClick={moveRight}>
              {(() => {
                const Icon = rightIcon;
                return <Icon size={23} />;
              })()}
              <small>RIGHT</small>
            </button>
          </div>
        )}
      </section>

      {settingsOpen && (
        <div
          className="game-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="game-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="game-panel-eyebrow" style={{ textAlign: "left" }}>
                  Customize your run
                </div>
                <h2 id="settings-title" className="mt-2 text-2xl font-black">
                  SETTINGS
                </h2>
              </div>
              <button
                className="game-icon-button"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="game-settings-list">
              <div className="game-settings-row">
                <div className="flex items-center gap-3">
                  {settings.music ? <Volume2 size={19} /> : <VolumeX size={19} />}
                  <div>
                    <div className="game-settings-label">Background music</div>
                    <div className="game-settings-hint">Looping game background music</div>
                  </div>
                </div>
                <button
                  className="game-toggle"
                  data-enabled={settings.music}
                  aria-pressed={settings.music}
                  aria-label="Toggle background music"
                  onClick={() => { playSfx("tap"); updateSettings({ music: !settings.music }); }}
                >
                  <span className="game-toggle-knob" />
                </button>
              </div>

              <div className="game-settings-row">
                <div>
                  <div className="game-settings-label">Music volume</div>
                  <div className="game-settings-hint">{settings.musicVolume}%</div>
                </div>
                <input
                  className="game-range"
                  aria-label="Music volume"
                  type="range"
                  min="0"
                  max="100"
                  value={settings.musicVolume}
                  onChange={(event) => updateSettings({ musicVolume: Number(event.target.value) })}
                />
              </div>

              <div className="game-settings-row">
                <div>
                  <div className="game-settings-label">Sound effects</div>
                  <div className="game-settings-hint">Jump, slide, coin and game-over sounds</div>
                </div>
                <button
                  className="game-toggle"
                  data-enabled={settings.sfx}
                  aria-pressed={settings.sfx}
                  aria-label="Toggle sound effects"
                  onClick={() => { playSfx("tap"); updateSettings({ sfx: !settings.sfx }); }}
                >
                  <span className="game-toggle-knob" />
                </button>
              </div>

              <div className="game-settings-row">
                <div>
                  <div className="game-settings-label">Effects volume</div>
                  <div className="game-settings-hint">{settings.sfxVolume}%</div>
                </div>
                <input
                  className="game-range"
                  aria-label="Effects volume"
                  type="range"
                  min="0"
                  max="100"
                  value={settings.sfxVolume}
                  onChange={(event) => updateSettings({ sfxVolume: Number(event.target.value) })}
                />
              </div>
            </div>

            <div className="game-section-label">Control style</div>
            <div className="game-segmented">
              {([
                ["buttons", "Buttons"],
                ["swipe", "Swipe"],
                ["both", "Both"],
              ] as [ControlMode, string][]).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={settings.controlMode === value}
                  onClick={() => updateSettings({ controlMode: value })}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="game-settings-row mt-3">
              <div>
                <div className="game-settings-label">Left-handed layout</div>
                <div className="game-settings-hint">Swap left/right button positions</div>
              </div>
              <button
                className="game-toggle"
                data-enabled={settings.leftHanded}
                aria-pressed={settings.leftHanded}
                aria-label="Toggle left-handed layout"
                onClick={() => updateSettings({ leftHanded: !settings.leftHanded })}
              >
                <span className="game-toggle-knob" />
              </button>
            </div>

            <div className="mt-5 game-button-stack">
              <button
                className="game-primary-button"
                onClick={() => {
                  setSettingsOpen(false);
                  if (playing && !paused) return;
                  if (paused) resumeGame();
                }}
              >
                <Play size={16} fill="currentColor" /> Done
              </button>
              <button
                className="game-secondary-button"
                onClick={() => {
                  updateSettings(DEFAULT_SETTINGS);
                }}
              >
                Reset settings
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
