"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

type GameObject = {
  mesh: THREE.Group | THREE.Mesh;
  lane: number;
  type: "obstacle" | "coin";
  active: boolean;
  obstacleKind?: "block" | "low" | "overhead";
};

type ControlMode = "buttons" | "swipe" | "both";

const BEST_KEY = "jungle-rush-best-score-v5";
const SETTINGS_KEY = "jungle-rush-settings-v5";

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
  const audioRef = useRef<{
    music: HTMLAudioElement | null;
    coin: HTMLAudioElement | null;
    jump: HTMLAudioElement | null;
    slide: HTMLAudioElement | null;
    gameOver: HTMLAudioElement | null;
    start: HTMLAudioElement | null;
    tap: HTMLAudioElement | null;
  }>({
    music: null,
    coin: null,
    jump: null,
    slide: null,
    gameOver: null,
    start: null,
    tap: null,
  });

  const settingsRef = useRef<SavedSettings>(DEFAULT_SETTINGS);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [settings, setSettings] = useState<SavedSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const playSfx = useCallback((key: keyof typeof audioRef.current) => {
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
    move: (dir: number) => void;
    jump: () => void;
    slide: () => void;
    restart: () => void;
    pause: () => void;
    resume: () => void;
  } | null>(null);

  const updateSettings = useCallback((patch: Partial<SavedSettings>) => {
    setSettings((curr) => {
      const next = { ...curr, ...patch };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Audio setup
  useEffect(() => {
    const makeAudio = (file: string, loop = false) => {
      const audio = new Audio(`/audio/${file}.wav`);
      audio.preload = "auto";
      audio.loop = loop;
      return audio;
    };

    audioRef.current = {
      music: makeAudio("music-loop", true),
      coin: makeAudio("coin"),
      jump: makeAudio("jump"),
      slide: makeAudio("slide"),
      gameOver: makeAudio("game-over"),
      start: makeAudio("start"),
      tap: makeAudio("tap"),
    };

    return () => {
      Object.values(audioRef.current).forEach((item) => {
        if (item) {
          item.pause();
          item.src = "";
        }
      });
    };
  }, []);

  // Background Music loop controller
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
    try {
      const savedBest = Number(window.localStorage.getItem(BEST_KEY) || 0);
      if (Number.isFinite(savedBest)) setBestScore(savedBest);

      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#163824");
    scene.fog = new THREE.FogExp2("#163824", 0.015);

    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 150);
    camera.position.set(0, 4.2, 7.2);
    camera.lookAt(0, 1.2, -10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight("#ffffff", 1.5));
    const sun = new THREE.DirectionalLight("#ffe29a", 2.2);
    sun.position.set(5, 15, 8);
    sun.castShadow = true;
    scene.add(sun);

    // Track setup
    const roadMat = new THREE.MeshStandardMaterial({ color: "#2d3e32", roughness: 0.8 });
    const grassMat = new THREE.MeshStandardMaterial({ color: "#194d2a", roughness: 0.9 });

    const road = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 200), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -80);
    scene.add(road);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -80);
    scene.add(ground);

    // Stylized Anime Chibi Adventurer Boy
    const player = new THREE.Group();
    scene.add(player);
    player.position.set(0, 0, 0);

    const skinMat = new THREE.MeshStandardMaterial({ color: "#e3a87c", roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: "#382923", roughness: 0.4 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: "#bd532b" });
    const tunicMat = new THREE.MeshStandardMaterial({ color: "#54524f" });
    const beltMat = new THREE.MeshStandardMaterial({ color: "#8a4f27" });
    const bootMat = new THREE.MeshStandardMaterial({ color: "#9e532d" });

    // Head & Headband
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.65;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skinMat);
    headGroup.add(head);

    const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.1, 16), scarfMat);
    headband.position.y = 0.12;
    headGroup.add(headband);

    for (let i = -3; i <= 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), hairMat);
      spike.rotation.x = -Math.PI / 3;
      spike.rotation.z = i * 0.2;
      spike.position.set(i * 0.09, 0.25, -0.05);
      headGroup.add(spike);
    }
    player.add(headGroup);

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 8, 16), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.25;
    player.add(scarf);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.38), tunicMat);
    torso.position.y = 0.9;
    player.add(torso);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.42), beltMat);
    belt.position.y = 0.62;
    player.add(belt);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), skinMat);
    armL.position.set(-0.42, 0.9, 0);
    player.add(armL);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), skinMat);
    armR.position.set(0.42, 0.9, 0);
    player.add(armR);

    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), tunicMat);
    legL.position.set(-0.18, 0.3, 0);
    player.add(legL);

    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.22), tunicMat);
    legR.position.set(0.18, 0.3, 0);
    player.add(legR);

    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.35), bootMat);
    bootL.position.set(-0.18, 0.08, 0.03);
    player.add(bootL);

    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.35), bootMat);
    bootR.position.set(0.18, 0.08, 0.03);
    player.add(bootR);

    // Game Objects
    const objects: GameObject[] = [];
    const obstacleMat = new THREE.MeshStandardMaterial({ color: "#8a4f27" });
    const coinMat = new THREE.MeshStandardMaterial({ color: "#ffc107", metalness: 0.8 });

    function spawnObstacle(laneIdx: number, z: number) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1), obstacleMat);
      mesh.position.set(laneIdx * 2.3, 0.5, z);
      scene.add(mesh);
      objects.push({ mesh, lane: laneIdx, type: "obstacle", active: true });
    }

    function spawnCoin(laneIdx: number, z: number) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 16), coinMat);
      mesh.position.set(laneIdx * 2.3, 1, z);
      scene.add(mesh);
      objects.push({ mesh, lane: laneIdx, type: "coin", active: true });
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
    let speed = 18;
    let distance = 0;
    let coinCount = 0;
    let spawnTimer = 0;
    let animId = 0;

    function resetGame() {
      for (const o of objects) scene.remove(o.mesh);
      objects.length = 0;
      lane = 0;
      targetX = 0;
      player.position.set(0, 0, 0);
      player.scale.set(1, 1, 1);
      jumping = false;
      sliding = false;
      speed = 18;
      distance = 0;
      coinCount = 0;
      spawnTimer = 0.5;
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

    function move(dir: number) {
      if (!running || dead || isPaused) return;
      lane = THREE.MathUtils.clamp(lane + dir, -1, 1);
      targetX = lane * 2.3;
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
      player.scale.y = 0.5;
      playSfx("slide");
    }

    apiRef.current = {
      start: resetGame,
      move,
      jump,
      slide,
      restart: resetGame,
      pause: () => {
        if (running && !dead) {
          isPaused = true;
          setPaused(true);
        }
      },
      resume: () => {
        if (running && !dead) {
          isPaused = false;
          setPaused(false);
        }
      },
    };

    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);

      if (running && !dead && !isPaused) {
        distance += speed * dt;
        speed = Math.min(36, 18 + distance * 0.003);
        setScore(Math.floor(distance * 2.5) + coinCount * 30);

        player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 14, dt);

        const legAngle = Math.sin(distance * 2) * 0.6;
        legL.rotation.x = legAngle;
        legR.rotation.x = -legAngle;
        armL.rotation.x = -legAngle;
        armR.rotation.x = legAngle;

        if (jumping) {
          jumpTime += dt;
          const t = jumpTime / 0.7;
          player.position.y = t >= 1 ? 0 : Math.sin(Math.PI * t) * 2.2;
          if (t >= 1) {
            jumping = false;
            player.position.y = 0;
          }
        }

        if (sliding) {
          slideTime += dt;
          if (slideTime >= 0.6) {
            sliding = false;
            player.scale.y = 1;
          }
        }

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          const obsLane = Math.floor(Math.random() * 3) - 1;
          spawnObstacle(obsLane, -60);
          let cLane = Math.floor(Math.random() * 3) - 1;
          if (cLane === obsLane) cLane = cLane === 1 ? -1 : cLane + 1;
          for (let i = 0; i < 3; i++) spawnCoin(cLane, -62 - i * 1.8);
          spawnTimer = Math.max(0.42, 0.95 - distance * 0.0003);
        }

        for (const obj of objects) {
          if (!obj.active) continue;
          obj.mesh.position.z += speed * dt;
          if (obj.type === "coin") obj.mesh.rotation.y += dt * 4;

          const dz = Math.abs(obj.mesh.position.z - player.position.z);
          const dx = Math.abs(obj.mesh.position.x - player.position.x);

          if (dz < 0.8 && dx < 0.7) {
            if (obj.type === "coin") {
              obj.active = false;
              scene.remove(obj.mesh);
              coinCount += 1;
              setCoins(coinCount);
              playSfx("coin");
            } else if (dz < 0.65) {
              if (!jumping && !sliding) {
                dead = true;
                running = false;
                setPlaying(false);
                setGameOver(true);
                playSfx("gameOver");
              }
            }
          }

          if (obj.mesh.position.z > 10) {
            obj.active = false;
            scene.remove(obj.mesh);
          }
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [playSfx]);

  const showArrowControls =
    playing &&
    !paused &&
    (settings.controlMode === "buttons" || settings.controlMode === "both");

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="game-logo">
          <span className="game-logo-eyebrow">Jungle Adventure</span>
          <div className="game-logo-title">
            JUNGLE <span>RUSH</span>
          </div>
        </div>
        <div className="game-header-actions">
          <div className="game-stat">
            <span className="game-stat-label">
              <Trophy size={10} className="mr-1 inline" /> Score
            </span>
            <span className="game-stat-value">{score.toLocaleString()}</span>
          </div>
          <div className="game-stat">
            <span className="game-stat-label text-amber-400">
              <Coins size={10} className="mr-1 inline" /> Coins
            </span>
            <span className="game-stat-value text-amber-400">{coins}</span>
          </div>
          <button
            className="game-icon-button"
            onClick={() => {
              playSfx("tap");
              setSettingsOpen(true);
            }}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <section className="game-viewport">
        <div ref={mountRef} className="absolute inset-0" />

        {(!playing || paused) && (
          <div className="game-overlay">
            <div className="game-panel">
              <div className="game-panel-eyebrow">
                {paused ? "Game Paused" : "Jungle Adventure"}
              </div>
              <h1 className="game-panel-title">
                {paused ? "PAUSED" : gameOver ? "GAME OVER" : "JUNGLE RUSH"}
              </h1>
              <p className="game-panel-description">
                {gameOver
                  ? `Collected ${coins} coins with score ${score.toLocaleString()}!`
                  : "Run, dodge obstacles & collect golden coins!"}
              </p>
              <div className="game-button-stack">
                <button
                  className="game-primary-button"
                  onClick={() => apiRef.current?.start()}
                >
                  {paused ? <Play size={18} fill="currentColor" /> : <RotateCcw size={18} />}
                  {paused ? "Resume Run" : gameOver ? "Play Again" : "PLAY"}
                </button>
                <button
                  className="game-secondary-button"
                  onClick={() => {
                    playSfx("tap");
                    setSettingsOpen(true);
                  }}
                >
                  <Settings size={18} /> Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {showArrowControls && (
          <div className="mobile-controls">
            <button onClick={() => apiRef.current?.move(-1)}>
              <ArrowLeft size={22} />
              <small>LEFT</small>
            </button>
            <button onClick={() => apiRef.current?.jump()}>
              <ArrowUp size={22} />
              <small>JUMP</small>
            </button>
            <button onClick={() => apiRef.current?.slide()}>
              <ArrowDown size={22} />
              <small>SLIDE</small>
            </button>
            <button onClick={() => apiRef.current?.move(1)}>
              <ArrowRight size={22} />
              <small>RIGHT</small>
            </button>
          </div>
        )}
      </section>

      {settingsOpen && (
        <div className="game-overlay">
          <div className="game-panel">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">GAME SETTINGS</h2>
              <button
                className="game-icon-button"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="game-settings-list">
              <div className="game-settings-row">
                <div className="flex items-center gap-2">
                  {settings.music ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  <span className="game-settings-label">Background Music</span>
                </div>
                <button
                  className="game-toggle"
                  data-enabled={settings.music}
                  onClick={() => {
                    playSfx("tap");
                    updateSettings({ music: !settings.music });
                  }}
                >
                  <span className="game-toggle-knob" />
                </button>
              </div>

              <div className="game-settings-row">
                <span className="game-settings-label">Sound FX</span>
                <button
                  className="game-toggle"
                  data-enabled={settings.sfx}
                  onClick={() => {
                    playSfx("tap");
                    updateSettings({ sfx: !settings.sfx });
                  }}
                >
                  <span className="game-toggle-knob" />
                </button>
              </div>
            </div>

            <div className="game-section-label mt-4">Mobile Controls Mode</div>
            <div className="game-segmented">
              <button
                aria-pressed={settings.controlMode === "buttons"}
                onClick={() => {
                  playSfx("tap");
                  updateSettings({ controlMode: "buttons" });
                }}
              >
                Buttons
              </button>
              <button
                aria-pressed={settings.controlMode === "swipe"}
                onClick={() => {
                  playSfx("tap");
                  updateSettings({ controlMode: "swipe" });
                }}
              >
                Swipe
              </button>
              <button
                aria-pressed={settings.controlMode === "both"}
                onClick={() => {
                  playSfx("tap");
                  updateSettings({ controlMode: "both" });
                }}
              >
                Both
              </button>
            </div>

            <button
              className="game-primary-button mt-6"
              onClick={() => setSettingsOpen(false)}
            >
              Save & Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}