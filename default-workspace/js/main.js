/**
 * 游戏启动与整体状态。
 *
 * 首页和角色选择不依赖 Three.js；只有真正点“开始冒险”时才动态加载
 * 3D 引擎。这样即使资源加载失败，也能给小朋友显示中文提示。
 */

import { GameUI } from './ui.js';
import { DEFAULT_CHARACTER_ID, getCharacter } from './characters.js';
import { GAME_CONFIG } from './config.js';
import { getBlock, isSolidBlock } from './blocks.js';
import { Inventory, MAGNET_SLOT_INDEX } from './inventory.js';
import { GameAudio } from './audio.js';
import { SaveManager } from './save.js';
import { GalleryManager } from './gallery.js';

const state = {
  selectedCharacter: null,
  game: null,
  starting: false,
  paused: true,
  pausedReason: 'none',
  lastWheelAt: 0,
  lastSaveAt: null,
  saveErrorShown: false,
  techCitySeen: false,
};

const audio = new GameAudio();
const saveManager = new SaveManager();
const gallery = new GalleryManager();

const ui = new GameUI({
  onCharacterSelected: (character) => {
    state.selectedCharacter = character;
  },
  onStart: (character) => {
    audio.unlock();
    startAdventure(character);
  },
  onBackHome: () => {
    if (!state.game) {
      state.paused = true;
    }
    refreshHomeSaveUI();
  },
  onResume: () => {
    resumeGame();
  },
  onPauseHome: () => {
    returnHome();
  },
  onTutorialClose: () => {
    resumeFromTutorial();
  },
  onRetry: () => {
    const character = state.selectedCharacter || getCharacter(DEFAULT_CHARACTER_ID);
    if (state.retryMode === 'reload') {
      // 模块加载失败会被浏览器记住，原地重试不会重新请求文件。
      // 刷新页面再自动继续，才能真正恢复。
      try {
        window.sessionStorage.setItem('meiwei-retry-character', character.id);
      } catch (error) {
        // 无痕模式等情况下忽略存储错误，刷新后仍可重新选择角色。
      }
      window.location.reload();
      return;
    }
    ui.selectCharacter(character.id);
    startAdventure(character);
  },
  onErrorHome: () => {
    cleanupGame();
    state.paused = true;
    state.pausedReason = 'none';
    state.retryMode = null;
    refreshHomeSaveUI();
    ui.showScreen('home');
  },
  onHotbarSelect: (index) => {
    selectHotbar(index);
  },
  onHotbarClear: (index) => {
    clearHotbar(index);
  },
  onInventoryAssign: (index, blockId) => {
    return assignHotbar(index, blockId);
  },
  onInventoryClose: () => {
    closeInventory();
  },
  onContinueSave: () => {
    continueSavedGame();
  },
  onExportSave: () => {
    exportSavedGame();
  },
  onImportSave: (file) => {
    importSavedGame(file);
  },
  onGalleryClose: () => {
    closeGallery();
  },
  onDeletePhoto: (photoId) => {
    deletePhoto(photoId);
  },
  onWorldMapClose: () => {
    closeWorldMap();
  },
});

const isTouchDevice =
  (navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches) &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1180);
if (isTouchDevice) document.body.classList.add('touch-mode');

document.body.dataset.screen = 'home';
window.__gameBooted = true;

document.getElementById('btn-mobile-fly')?.addEventListener('click', () => toggleFlight());
document.getElementById('btn-mobile-view')?.addEventListener('click', () => toggleCameraView());
document.getElementById('btn-mobile-map')?.addEventListener('click', () => openWorldMap());
restoreRetryAfterReload();
refreshHomeSaveUI();
window.setInterval(autoSaveGame, 12000);

window.addEventListener('resize', resizeGame);
window.addEventListener('keydown', handleGlobalKeyDown);
window.addEventListener('wheel', handleWheel, { passive: false });
window.addEventListener('contextmenu', handleGlobalContextMenu);
window.addEventListener('beforeunload', handleBeforeUnload);
document.addEventListener('visibilitychange', handleVisibilityChange);

window.__MEIWEI_DEBUG__ = {
  teleportPlayer(x, y, z, yaw) {
    if (!state.game) return false;
    state.game.player.teleport(x, y, z);
    if (Number.isFinite(yaw)) state.game.player.yaw = yaw;
    return true;
  },
  getBlockAt(x, y, z) {
    return state.game ? state.game.world.getBlock(x, y, z) : null;
  },
  getHeightAt(x, z) {
    return state.game ? state.game.world.heightAt(x, z) : null;
  },
  getBiomeAt(x, z) {
    return state.game ? state.game.world.biomeAt(x, z) : null;
  },
  getLoadedChunks() {
    return state.game ? state.game.world.getLoadedChunkCount() : 0;
  },
  setLook(yaw, pitch) {
    if (!state.game) return false;
    state.game.player.setLook(yaw, pitch);
    return true;
  },
  getTargetInfo() {
    return state.game?.interaction?.getTargetInfo() || null;
  },
  getHotbar() {
    return state.game?.inventory?.getState() || null;
  },
  getParticleCount() {
    return state.game?.interaction?.particles?.length || 0;
  },
  saveNow() {
    return persistGame('debug', { silent: true });
  },
  getSaveData() {
    return state.game ? createSaveData() : saveManager.readSave();
  },
  getGalleryCount() {
    return gallery.count();
  },
  getState() {
    return {
      screen: document.body.dataset.screen,
      selectedCharacterId: state.selectedCharacter?.id || null,
      starting: state.starting,
      paused: state.paused,
      pausedReason: state.pausedReason,
      game: state.game
        ? {
            seed: state.game.world.seed,
            spawn: { ...state.game.world.spawn },
            landmarkSpot: { ...state.game.world.landmarkSpot },
            player: (() => {
              const player = state.game.player;
              return {
                ...player.getDebugState(),
                position: {
                  x: player.position.x,
                  y: player.position.y,
                  z: player.position.z,
                },
                yaw: player.yaw,
                pitch: player.pitch,
              };
            })(),
            chunks: state.game.world.getLoadedChunkCount(),
            renderDistance: state.game.world.renderDistance,
            village: state.game.world.villageSpots?.[0] || null,
            mineshafts: (state.game.world.mineshafts || []).slice(0, 16),
            waterfalls: (state.game.world.waterfalls || []).slice(0, 8),
            techCity: state.game.world.techCity || null,
            inTechCity: state.game.world.isInTechCity(
              state.game.player.position.x,
              state.game.player.position.z,
            ),
            caveEntrance: state.game.world.caveEntrance || null,
            biomeAtPlayer: state.game.world.biomeAt(
              state.game.player.position.x,
              state.game.player.position.z,
            ),
            seaLevel: state.game.world.seaLevel,
            modifiedCount: state.game.world.getModifiedCount(),
            time: state.game.environment.getTimeString(),
            weather: state.game.environment.weather,
            minimapVisible: !!state.game.minimap?.visible,
            worldMapOpen: ui.isWorldMapOpen(),
            worldMapStats: state.game.worldMap?.lastStats || null,
            cameraPosition: {
              x: state.game.camera.position.x,
              y: state.game.camera.position.y,
              z: state.game.camera.position.z,
            },
            fps: state.game.fps,
            inventory: state.game.inventory?.getState() || null,
            target: state.game.interaction?.getTargetInfo() || null,
            animals: state.game.animals?.getDebugState() || null,
            quests: state.game.quests?.getState() || null,
            renderer: {
              width: state.game.renderer.domElement.width,
              height: state.game.renderer.domElement.height,
            },
          }
        : null,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 启动流程                                                            */
/* ------------------------------------------------------------------ */

async function startAdventure(character, options = {}) {
  if (!character || state.starting) return;
  const saveData = options.saveData || null;
  state.starting = true;
  state.retryMode = null;
  state.saveErrorShown = false;
  if (state.game) {
    cleanupGame();
  }
  state.selectedCharacter = character;
  state.techCitySeen = false;
  document.activeElement?.blur?.();
  ui.setCharacter(character);
  ui.hideAllOverlays();
  ui.startLoading();
  ui.setPointerHint(false);
  ui.hideToast();

  await nextFrame();
  await nextFrame();

  let renderer = null;
  let scene = null;
  let camera = null;
  let world = null;
  let environment = null;
  let player = null;
  let interaction = null;
  let animals = null;
  let quests = null;
  let contextLostHandler = null;
  let World = null;
  let Player = null;
  let Environment = null;
  let InteractionController = null;
  let AnimalManager = null;
  let NewbieQuests = null;
  let Minimap = null;
  let minimap = null;
  let WorldMap = null;
  let worldMap = null;
  let MobileControls = null;
  let mobileControls = null;

  try {
    const webgl = checkWebGLSupport();
    if (!webgl.ok) {
      throw new FriendlyError(
        '这个浏览器画不出 3D 世界',
        '请换用新版的 Chrome、Edge、Safari 或 Firefox，并在设置里打开硬件加速，然后再试一次。',
        webgl.detail,
      );
    }

    ui.setLoading(5, '正在叫醒 3D 引擎……');
    let THREE;
    try {
      const [
        threeModule,
        worldModule,
        playerModule,
        environmentModule,
        interactionModule,
        animalsModule,
        questsModule,
        minimapModule,
        mobileControlsModule,
        worldMapModule,
      ] = await Promise.all([
        import('three'),
        import('./world.js'),
        import('./player.js'),
        import('./environment.js'),
        import('./interaction.js'),
        import('./animals.js'),
        import('./quests.js'),
        import('./minimap.js'),
        import('./mobile-controls.js'),
        import('./world-map.js'),
      ]);
      THREE = threeModule;
      World = worldModule.World;
      Player = playerModule.Player;
      Environment = environmentModule.Environment;
      InteractionController = interactionModule.InteractionController;
      AnimalManager = animalsModule.AnimalManager;
      NewbieQuests = questsModule.NewbieQuests;
      Minimap = minimapModule.Minimap;
      WorldMap = worldMapModule.WorldMap;
      MobileControls = mobileControlsModule.MobileControls;
    } catch (error) {
      throw new FriendlyError(
        '游戏资源没有加载成功',
        '可能是网络断开了一下，或者部署时少了文件。检查网络后点“重新尝试”吧。',
        formatError(error),
        true,
      );
    }

    ui.setLoading(11, '正在铺好第一块草地……');
    await nextFrame();

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      throw new FriendlyError('找不到游戏画布', '页面好像少了一部分，请刷新页面再试一次。');
    }

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch (error) {
      throw new FriendlyError(
        '3D 画布没有打开',
        '浏览器可能禁用了 WebGL。打开硬件加速，或者换一个浏览器再试一次。',
        formatError(error),
      );
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GAME_CONFIG.maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor('#8cd9ff', 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      72,
      Math.max(0.1, window.innerWidth / Math.max(1, window.innerHeight)),
      0.1,
      GAME_CONFIG.cameraFar,
    );

    const seedParam = Number(new URLSearchParams(window.location.search).get('seed'));
    let seed = GAME_CONFIG.worldSeed;
    if (saveData) {
      seed = saveData.seed;
    } else if (Number.isFinite(seedParam) && seedParam > 0) {
      seed = seedParam;
    } else if (saveManager.hasSave()) {
      // 从首页点“开新世界”时，换一颗新种子，避免又是同一张地图。
      seed = Math.floor(Math.random() * 2000000000) + 1;
    }

    world = new World({
      scene,
      seed,
      renderDistance: GAME_CONFIG.renderDistance,
    });
    if (saveData) {
      world.loadModifications(saveData.world.modifications);
    }
    environment = new Environment({
      scene,
      spawn: world.spawn,
      seed: world.seed,
    });
    if (saveData?.environment) {
      environment.setTimeMinutes(saveData.environment.timeMinutes);
      environment.setWeather(saveData.environment.weather);
    }

    const loadCenter =
      saveData?.player &&
      Number.isFinite(saveData.player.x) &&
      Number.isFinite(saveData.player.z)
        ? saveData.player
        : world.spawn;

    await world.loadInitial((progress) => {
      const percent = 14 + progress * 74;
      ui.setLoading(percent, getLoadingMessage(progress));
    }, loadCenter);

    ui.setLoading(91, '风车正在转第一圈……');
    await nextFrame();

    const targetX = world.landmarkSpot.x - world.spawn.x;
    const targetZ = world.landmarkSpot.z - world.spawn.z;
    const startYaw = Math.atan2(-targetX, -targetZ) + 0.18;

    const restoredPlayer = saveData
      ? resolveSavedPlayerPosition(world, saveData.player)
      : null;
    player = new Player({
      camera,
      world,
      scene,
      character,
      domElement: renderer.domElement,
      spawn: world.spawn,
      yaw: restoredPlayer?.yaw ?? startYaw,
      pitch: restoredPlayer?.pitch ?? -0.06,
      onPointerLockChange: handlePointerLockChange,
      onPointerLockError: handlePointerLockError,
      onFatalFall: () => {
        ui.toastMessage('别担心，我把你送回出生点啦！', 'warn', 2600);
      },
      onBlockAction: (button) => {
        state.game?.interaction?.handleAction(button);
      },
    });

    if (restoredPlayer) {
      player.teleport(restoredPlayer.x, restoredPlayer.y, restoredPlayer.z);
      player.setLook(restoredPlayer.yaw, restoredPlayer.pitch);
    }

    const inventory = new Inventory();
    if (saveData?.inventory) {
      inventory.loadState(saveData.inventory);
    }
    let activeQuestInstance = null;
    quests = new NewbieQuests({
      onStepComplete: ({ message, state: questState }) => {
        audio.playSuccess();
        ui.toastMessage(message, 'good', 3200);
        ui.updateQuests(questState);
      },
      onAllComplete: ({ message, state: questState }) => {
        ui.updateQuests(questState);
        window.setTimeout(() => {
          if (!state.game || state.game.quests !== activeQuestInstance) return;
          audio.playSuccess();
          ui.toastMessage(message, 'good', 4600);
        }, 1900);
      },
    });
    activeQuestInstance = quests;
    if (saveData?.quests) {
      quests.restore(saveData.quests);
    }
    animals = new AnimalManager({
      scene,
      world,
      player,
      seed: world.seed,
      savedAnimals: saveData?.animals || null,
    });
    interaction = new InteractionController({
      scene,
      camera,
      world,
      player,
      inventory,
      audio,
      ui,
      isBlocked: () => state.paused || document.body.dataset.screen !== 'game',
      onBlockPlaced: () => {
        activeQuestInstance?.markBlockPlaced();
      },
    });

    minimap = new Minimap({
      canvas: document.getElementById('minimap-canvas'),
      world,
      player,
    });
    worldMap = new WorldMap({
      canvas: document.getElementById('worldmap-canvas'),
      world,
      player,
    });

    if (isTouchDevice) {
      player.setTouchMode(true);
      mobileControls = new MobileControls({
        player,
        interaction,
        isBlocked: () => state.paused || document.body.dataset.screen !== 'game',
      });
      mobileControls.setEnabled(false);
    }

    ui.setHotbarState(inventory.getState());
    ui.updateQuests(quests.getState());
    ui.setMinimapVisible(false);

    environment.update(0.016, camera);
    player.update(0);
    world.update(0, player.position);
    renderer.render(scene, camera);

    ui.setLoading(97, '正在叫醒小兔子和小羊……');
    await nextFrame();
    ui.setLoading(100, '世界准备好啦！');
    await delay(260);

    const game = {
      renderer,
      scene,
      camera,
      world,
      environment,
      player,
      inventory,
      interaction,
      animals,
      quests,
      minimap,
      worldMap,
      mobileControls,
      audio,
      character,
      mobileHintShown: false,
      lowFpsTime: 0,
      performanceReduced: false,
      magnetHintShown: false,
      rafId: 0,
      lastFrame: performance.now(),
      fps: 60,
      fpsFrames: 0,
      fpsElapsed: 0,
      hudElapsed: 0,
    };

    contextLostHandler = (event) => {
      event.preventDefault();
      if (!state.game) return;
      state.paused = true;
      setPlayerInputEnabled(false);
      state.game.player?.exitPointerLock();
      stopGameLoop();
      ui.showError({
        title: '3D 画面暂时走神了',
        message: '显卡刚刚休息了一下。点“重新尝试”就能重新进入方块世界。',
        detail: 'WebGL context lost',
      });
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLostHandler);

    game.contextLostHandler = contextLostHandler;
    state.game = game;
    state.paused = true;
    state.pausedReason = 'tutorial';

    ui.showScreen('game');
    resizeGame();
    updateHUD(game);
    updateModeIndicator();
    ui.setPointerHint(false);
    renderer.render(scene, camera);
    startGameLoop(game);
    ui.showTutorial(character);
    window.setTimeout(() => {
      if (state.game === game) persistGame('start', { silent: true });
    }, 1200);
  } catch (error) {
    console.error('[美味特工队] 启动失败：', error);
    stopGameLoop();
    cleanupPartial({
      renderer,
      scene,
      world,
      environment,
      player,
      interaction,
      animals,
      minimap,
      worldMap,
      mobileControls,
      contextLostHandler,
    });
    state.game = null;
    state.paused = true;
    state.pausedReason = 'none';

    const isFriendly = error instanceof FriendlyError;
    state.retryMode = isFriendly && error.retryWithReload ? 'reload' : 'retry';
    ui.showError({
      title: isFriendly ? error.title : '世界没有打开成功',
      message: isFriendly
        ? error.userMessage
        : '加载的时候出了点小问题。点“重新尝试”再试一次，如果还是不行，可以换一个浏览器。',
      detail: isFriendly ? error.detail : formatError(error),
    });
  } finally {
    state.starting = false;
  }
}

function getLoadingMessage(progress) {
  if (progress < 0.2) return '正在铺软软的草地……';
  if (progress < 0.45) return '种下小树和会摇头的花……';
  if (progress < 0.7) return '把沙子、海水和雪地排整齐……';
  if (progress < 0.92) return '给风车装上小翅膀……';
  return '把云朵和太阳挂到天上……';
}

function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const options = { alpha: false, antialias: true, failIfMajorPerformanceCaveat: false };
    const gl2 = canvas.getContext('webgl2', options);
    const gl = gl2 || canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl');
    if (!gl) {
      return { ok: false, detail: '浏览器没有提供 WebGL 1 或 WebGL 2 上下文。' };
    }
    return { ok: true, detail: gl2 ? 'WebGL 2' : 'WebGL 1' };
  } catch (error) {
    return { ok: false, detail: formatError(error) };
  }
}

/* ------------------------------------------------------------------ */
/* 游戏循环                                                            */
/* ------------------------------------------------------------------ */

function startGameLoop(game) {
  game.lastFrame = performance.now();
  game.fpsFrames = 0;
  game.fpsElapsed = 0;
  game.hudElapsed = 0;
  game.rafId = requestAnimationFrame(tick);
}

function stopGameLoop() {
  if (state.game?.rafId) {
    cancelAnimationFrame(state.game.rafId);
    state.game.rafId = 0;
  }
}

function tick(now) {
  const game = state.game;
  if (!game) return;

  game.rafId = requestAnimationFrame(tick);
  const rawDelta = Math.max(0, (now - game.lastFrame) / 1000);
  game.lastFrame = now;
  const delta = Math.min(rawDelta, 0.05);

  if (!state.paused) {
    game.player.update(delta);
    game.environment.update(delta, game.camera);
    game.world.update(delta, game.player.position);
    game.interaction.update(delta);
    const animalState = game.animals.update(delta, game.player.position);
    game.quests.update(game.player.position, animalState.nearestDistance);
    game.minimap.update(delta, game.animals.animals);
    ui.setUnderwater(game.player.headInWater);
    updateAdaptiveQuality(game, rawDelta);
  } else {
    game.interaction.hideTarget();
    ui.setUnderwater(false);
  }

  game.fpsElapsed += rawDelta;
  game.fpsFrames += 1;
  if (game.fpsElapsed >= 0.5) {
    game.fps = game.fpsFrames / game.fpsElapsed;
    game.fpsFrames = 0;
    game.fpsElapsed = 0;
  }

  game.hudElapsed += rawDelta;
  if (game.hudElapsed >= 0.25) {
    game.hudElapsed = 0;
    updateHUD(game);
  }

  game.renderer.render(game.scene, game.camera);
}

function updateModeIndicator() {
  if (!state.game) return;
  const { player } = state.game;
  ui.setModeIndicator({
    flying: player.flying,
    thirdPerson: player.cameraMode === 'third',
  });
  ui.setMobileToolActive('fly', player.flying);
  ui.setMobileToolActive('view', player.cameraMode === 'third');
}

function toggleFlight() {
  if (!state.game || state.paused) return;
  const flying = state.game.player.toggleFlying();
  updateModeIndicator();
  ui.toastMessage(
    flying ? '🕊️ 飞起来啦！空格上升，Shift 下降，再按 F 落地。' : '🪂 飞行关闭，慢慢回到地面吧。',
    flying ? 'good' : 'info',
    2800,
  );
}

function toggleCameraView() {
  if (!state.game || state.paused) return;
  const mode = state.game.player.toggleCameraMode();
  updateModeIndicator();
  ui.toastMessage(mode === 'third' ? '👁️ 第三视角：可以看到自己的小特工。' : '👀 第一视角：看得更清楚。', 'info', 2200);
}

function updateHUD(game) {
  const position = game.player.position;
  const surfaceY = game.world.heightAt(position.x, position.z);
  const underground = position.y < surfaceY - 3;
  const inTechCity = !underground && game.world.isInTechCity(position.x, position.z);
  const biome = underground
    ? { emoji: '🪨', name: '地下洞穴' }
    : inTechCity
      ? { emoji: '🍔', name: '美味科技城' }
      : game.world.getBiomeAt(position.x, position.z);
  if (inTechCity && !state.techCitySeen) {
    state.techCitySeen = true;
    ui.toastMessage('欢迎来到美味科技城！这里有梯田花园、铜色高塔和四道瀑布。', 'good', 4600);
  }
  const timeState = game.environment.getTimeState();
  ui.updateHUD({
    fps: game.fps,
    position,
    biome: `${biome.emoji} ${biome.name}`,
    time: timeState.time,
    weather: timeState.weather,
    weatherEmoji: timeState.weatherEmoji,
    chunks: game.world.getLoadedChunkCount(),
    character: game.character,
  });
  ui.updateQuests(game.quests.getState());
}

/* ------------------------------------------------------------------ */
/* 暂停、继续和弹窗                                                    */
/* ------------------------------------------------------------------ */

function setPlayerInputEnabled(enabled) {
  if (!state.game) return;
  state.game.player.setEnabled(enabled);
  state.game.mobileControls?.setEnabled(enabled);
}

function pauseGame(reason = 'pause') {
  if (!state.game || state.paused) return;
  state.paused = true;
  state.pausedReason = reason;
  setPlayerInputEnabled(false);
  state.game.player.exitPointerLock();
  state.game.interaction.hideTarget();
  ui.setPointerHint(false);
  ui.showPause();
  persistGame('pause', { silent: true });
}

function resumeGame() {
  if (!state.game) return;
  state.paused = false;
  state.pausedReason = 'none';
  ui.hidePause();
  ui.hideControls();
  document.activeElement?.blur?.();
  setPlayerInputEnabled(true);
  const requested = state.game.player.requestPointerLock();
  ui.setPointerHint(
    !requested || document.pointerLockElement !== state.game.player.domElement,
    '点击画面锁定鼠标，移动鼠标看看四周',
  );
}

function resumeFromTutorial() {
  if (!state.game) return;
  state.paused = false;
  state.pausedReason = 'none';
  ui.hideAllOverlays();
  document.activeElement?.blur?.();
  setPlayerInputEnabled(true);
  const requested = state.game.player.requestPointerLock();
  ui.setPointerHint(
    !requested || document.pointerLockElement !== state.game.player.domElement,
    '点击画面锁定鼠标，移动鼠标看看四周',
  );
  if (isTouchDevice && !state.game.mobileHintShown) {
    state.game.mobileHintShown = true;
    window.setTimeout(() => {
      if (!state.game || state.paused) return;
      ui.toastMessage('👈 左边摇杆走路 · 拖动画面看四周 · 右下角挖方块和放方块', 'info', 4400);
    }, 600);
  }
}

function handlePointerLockChange({ locked, wasLocked }) {
  if (!state.game) return;
  if (locked) {
    ui.setPointerHint(false);
    return;
  }

  if (!ui.isInventoryOpen() && !ui.isGalleryOpen()) {
    ui.setPointerHint(true, '点击画面锁定鼠标，移动鼠标看看四周');
  }
  if (wasLocked && !state.paused) {
    pauseGame('pointerlock');
  }
}

function handlePointerLockError({ message }) {
  if (state.game && !state.paused) {
    ui.setPointerHint(
      true,
      message || '鼠标没有锁定，可以按住左键拖动视角继续玩',
    );
  }
}

function handleGlobalKeyDown(event) {
  if (isTypingTarget(event.target)) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.code === 'Escape') {
    if (ui.isWorldMapOpen()) {
      closeWorldMap();
      event.preventDefault();
      return;
    }
    if (ui.isGalleryOpen()) {
      closeGallery();
      event.preventDefault();
      return;
    }
    if (ui.isInventoryOpen()) {
      closeInventory();
      event.preventDefault();
      return;
    }
    const controlsVisible = !ui.controlsOverlay?.classList.contains('is-hidden');
    if (controlsVisible) {
      ui.hideControls();
      return;
    }
    if (!state.game || document.body.dataset.screen !== 'game') return;
    const tutorialVisible = !ui.tutorialOverlay?.classList.contains('is-hidden');
    if (tutorialVisible) return;
    if (!state.paused) {
      pauseGame('escape');
    }
    return;
  }

  if (event.code === 'KeyE') {
    if (event.repeat) return;
    if (!state.game || document.body.dataset.screen !== 'game') return;
    if (ui.controlsOverlay && !ui.controlsOverlay.classList.contains('is-hidden')) return;
    if (ui.isInventoryOpen()) {
      closeInventory();
      event.preventDefault();
      return;
    }
    if (state.paused) return;
    openInventory();
    event.preventDefault();
    return;
  }

  if (!state.game || document.body.dataset.screen !== 'game') return;

  if (event.code === 'KeyP') {
    if (event.repeat) return;
    if (ui.isGalleryOpen()) {
      closeGallery();
      event.preventDefault();
      return;
    }
    if (state.paused) return;
    openGallery();
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyC') {
    if (event.repeat) return;
    if (state.paused) return;
    capturePhoto();
    event.preventDefault();
    return;
  }

  const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (digitMatch && !state.paused && !ui.isInventoryOpen()) {
    selectHotbar(Number(digitMatch[1]) - 1);
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyF') {
    if (event.repeat) return;
    if (state.paused) return;
    toggleFlight();
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyV') {
    if (event.repeat) return;
    if (state.paused) return;
    toggleCameraView();
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyT') {
    if (event.repeat) return;
    if (state.paused) return;
    const weather = state.game.environment.cycleWeather();
    ui.toastMessage(`${weather.emoji} 天气变成${weather.label}啦！`, 'info', 2200);
    updateHUD(state.game);
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyM') {
    if (event.repeat) return;
    if (ui.isWorldMapOpen()) {
      closeWorldMap();
      event.preventDefault();
      return;
    }
    if (state.paused) return;
    openWorldMap();
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyN') {
    if (event.repeat) return;
    if (state.paused) return;
    const visible = state.game.minimap.toggle(state.game.animals.animals);
    ui.setMinimapVisible(visible);
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyR') {
    if (event.repeat) return;
    if (state.paused) return;
    state.game.player.respawn();
    state.game.interaction.hideTarget();
    updateModeIndicator();
    ui.toastMessage('回到出生点啦！', 'good', 1800);
    updateHUD(state.game);
    event.preventDefault();
    return;
  }

  if (event.code !== 'KeyH') return;
  if (event.repeat) return;
  if (!ui.controlsOverlay?.classList.contains('is-hidden')) return;
  if (ui.isInventoryOpen()) return;

  const tutorialVisible = !ui.tutorialOverlay?.classList.contains('is-hidden');
  if (tutorialVisible) {
    ui.closeTutorial();
    return;
  }

  if (state.paused) {
    if (!ui.pauseOverlay?.classList.contains('is-hidden')) {
      ui.toastMessage('先点“继续冒险”，再打开新手提示吧。', 'info', 2200);
    }
    return;
  }

  state.paused = true;
  state.pausedReason = 'tutorial';
  setPlayerInputEnabled(false);
  state.game.player.exitPointerLock();
  ui.setPointerHint(false);
  ui.showTutorial(state.selectedCharacter);
}

function handleWheel(event) {
  if (!state.game || document.body.dataset.screen !== 'game') return;
  if (state.paused || ui.isInventoryOpen()) return;
  if (!event.deltaY) return;

  event.preventDefault();
  const now = performance.now();
  if (now - state.lastWheelAt < 80) return;
  state.lastWheelAt = now;
  state.game.inventory.cycle(event.deltaY > 0 ? 1 : -1);
  syncHotbarState();
  audio.playSelect();
  showMagnetHintIfNeeded();
}

function openInventory() {
  if (!state.game || state.paused || ui.isInventoryOpen()) return;
  state.paused = true;
  state.pausedReason = 'inventory';
  setPlayerInputEnabled(false);
  state.game.player.exitPointerLock();
  state.game.interaction.hideTarget();
  ui.setPointerHint(false);
  ui.showInventory();
  syncHotbarState();
  audio.playInventory();
}

function closeInventory() {
  if (!state.game || !ui.isInventoryOpen()) return;
  ui.hideInventory();
  state.paused = false;
  state.pausedReason = 'none';
  setPlayerInputEnabled(true);
  const requested = state.game.player.requestPointerLock();
  ui.setPointerHint(
    !requested || document.pointerLockElement !== state.game.player.domElement,
    '点击画面锁定鼠标，移动鼠标看看四周',
  );
}

function selectHotbar(index) {
  if (!state.game) return false;
  const inventory = state.game.inventory;
  const changed = inventory.selectedIndex !== index;
  if (!inventory.select(index)) return false;
  syncHotbarState();
  if (changed) {
    audio.playSelect();
    showMagnetHintIfNeeded();
  }
  return true;
}

function clearHotbar(index) {
  if (!state.game) return false;
  if (index === MAGNET_SLOT_INDEX) {
    audio.playError();
    ui.toastMessage('第 9 格是磁铁收集模式，不能清空。', 'info', 2200);
    return false;
  }
  if (!state.game.inventory.clearSlot(index)) return false;
  syncHotbarState();
  audio.playSelect();
  ui.toastMessage(`第 ${index + 1} 格已经清空啦。`, 'info', 1500);
  return true;
}

function assignHotbar(index, blockId) {
  if (!state.game) return false;
  if (index === MAGNET_SLOT_INDEX) {
    audio.playError();
    ui.toastMessage('第 9 格是磁铁，不能放方块哦。', 'warn', 2200);
    return false;
  }
  const block = getBlock(blockId);
  if (!block) return false;
  if (!state.game.inventory.setSlot(index, blockId)) return false;
  syncHotbarState();
  audio.playPlace();
  ui.toastMessage(`把${block.name}放进第 ${index + 1} 格啦！`, 'good', 1700);
  return true;
}

function syncHotbarState() {
  if (!state.game) return;
  ui.setHotbarState(state.game.inventory.getState());
}

function showMagnetHintIfNeeded() {
  if (!state.game) return;
  if (state.game.inventory.isMagnetSelected()) {
    if (!state.game.magnetHintShown) {
      state.game.magnetHintShown = true;
      ui.toastMessage('磁铁收集模式：打碎的方块会飞向你！', 'info', 2400);
    }
  } else {
    state.game.magnetHintShown = false;
  }
}

function createSaveData() {
  const game = state.game;
  if (!game) return null;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    characterId: game.character.id,
    seed: game.world.seed,
    player: {
      x: game.player.position.x,
      y: game.player.position.y,
      z: game.player.position.z,
      yaw: game.player.yaw,
      pitch: game.player.pitch,
    },
    inventory: {
      slots: [...game.inventory.slots],
      selectedIndex: game.inventory.selectedIndex,
    },
    quests: game.quests.getSaveData(),
    world: {
      modifications: game.world.getModifiedBlocks(),
    },
    animals: game.animals.getSaveData(),
    environment: {
      timeMinutes: game.environment.timeMinutes,
      weather: game.environment.weather,
    },
  };
}

function getSaveSummary(data) {
  if (!data) return null;
  const character = getCharacter(data.characterId);
  let questsCompleted = 0;
  if (data.quests?.walkDistance >= 10) questsCompleted += 1;
  if (data.quests?.placed) questsCompleted += 1;
  if (data.quests?.animalFound) questsCompleted += 1;
  return {
    characterName: character.name,
    characterEmoji: character.emoji,
    savedAt: data.savedAt,
    modificationCount: data.world?.modifications?.length || 0,
    questsCompleted,
  };
}

function refreshHomeSaveUI() {
  const data = saveManager.readSave();
  ui.setSaveInfo(data ? getSaveSummary(data) : null);
  ui.updateGallery(gallery.list());
  return data;
}

function persistGame(reason = 'auto', { silent = false } = {}) {
  if (!state.game) return false;
  const data = createSaveData();
  const result = saveManager.writeSave(data);
  if (!result.ok) {
    if (!state.saveErrorShown) {
      state.saveErrorShown = true;
      ui.toastMessage(result.error || '自动保存失败，浏览器空间可能不够。', 'warn', 3600);
    }
    return false;
  }
  state.lastSaveAt = result.data.savedAt;
  ui.setSaveInfo(getSaveSummary(result.data));
  if (!silent && document.body.dataset.screen === 'game') {
    ui.showSaveIndicator(reason === 'auto' ? '已自动保存' : '已保存');
  }
  return true;
}

function autoSaveGame() {
  if (!state.game || state.starting) return;
  persistGame('auto');
}

function handleBeforeUnload() {
  if (state.game) persistGame('beforeunload', { silent: true });
}

function continueSavedGame() {
  if (state.starting) return;
  const data = saveManager.readSave();
  if (!data) {
    ui.toastMessage('没有找到能继续的存档，请开始新世界吧。', 'warn', 2800);
    refreshHomeSaveUI();
    return;
  }
  const character = getCharacter(data.characterId);
  ui.selectCharacter(character.id);
  state.selectedCharacter = character;
  startAdventure(character, { saveData: data });
}

function exportSavedGame() {
  const data = state.game ? createSaveData() : saveManager.readSave();
  if (!data) {
    ui.toastMessage('还没有可以导出的存档，先玩一会儿吧。', 'info', 2600);
    return;
  }
  const result = saveManager.exportSave(data);
  if (result.ok) {
    ui.toastMessage('存档已经下载到电脑或手机里啦。', 'good', 3000);
  } else {
    ui.toastMessage(result.error || '导出失败，请再试一次。', 'warn', 3000);
  }
}

async function importSavedGame(file) {
  const result = await saveManager.importFile(file);
  if (!result.ok) {
    ui.toastMessage(
      result.error === '这不是有效存档'
        ? '这不是有效存档，请选择《美味特工队》的存档文件。'
        : result.error || '这不是有效存档',
      'warn',
      3400,
    );
    return;
  }
  const written = saveManager.writeSave(result.data);
  if (!written.ok) {
    ui.toastMessage(written.error || '存档导入失败。', 'warn', 3200);
    return;
  }
  const character = getCharacter(result.data.characterId);
  state.selectedCharacter = character;
  ui.selectCharacter(character.id);
  ui.setSaveInfo(getSaveSummary(written.data));
  ui.toastMessage('存档导入成功！点“继续上次世界”就能接着玩。', 'good', 4000);
}

function resolveSavedPlayerPosition(world, savedPlayer) {
  if (!savedPlayer) return null;
  const x = savedPlayer.x;
  const y = savedPlayer.y;
  const z = savedPlayer.z;
  if (![x, y, z].every(Number.isFinite)) return null;
  const yaw = Number.isFinite(savedPlayer.yaw) ? savedPlayer.yaw : 0;
  const pitch = Number.isFinite(savedPlayer.pitch)
    ? Math.max(-1.45, Math.min(1.45, savedPlayer.pitch))
    : -0.06;

  if (isPlayerPositionClear(world, x, y, z)) {
    return { x, y, z, yaw, pitch };
  }

  // 存档位置被新方块占住时，在附近找一个有空气的小草地。
  const baseX = Math.floor(x);
  const baseZ = Math.floor(z);
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        const gx = baseX + dx;
        const gz = baseZ + dz;
        const height = world.heightAt(gx, gz);
        const candidate = { x: gx + 0.5, y: height + 1.03, z: gz + 0.5 };
        if (world.getBlock(gx, height, gz) === 0) continue;
        if (world.getBlock(gx, height + 1, gz) !== 0) continue;
        if (world.getBlock(gx, height + 2, gz) !== 0) continue;
        return { ...candidate, yaw, pitch };
      }
    }
  }
  return null;
}

function isPlayerPositionClear(world, x, y, z) {
  if (![x, y, z].every(Number.isFinite)) return false;
  if (y < -2 || y > 45) return false;
  const bx = Math.floor(x);
  const by = Math.floor(y);
  const bz = Math.floor(z);
  if (isSolidBlock(world.getBlock(bx, by, bz))) return false;
  if (isSolidBlock(world.getBlock(bx, by + 1, bz))) return false;
  return true;
}

function capturePhoto() {
  if (!state.game || state.paused || state.starting) return false;
  const game = state.game;
  try {
    game.renderer.render(game.scene, game.camera);
    const biome = game.world.getBiomeAt(game.player.position.x, game.player.position.z);
    const result = gallery.addFromCanvas(game.renderer.domElement, {
      characterName: game.character.name,
      biome: biome.name,
      coords: {
        x: game.player.position.x,
        y: game.player.position.y,
        z: game.player.position.z,
      },
    });
    if (!result.ok) {
      ui.toastMessage(result.error || '拍照失败，再试一次吧。', 'warn', 3200);
      return false;
    }
    ui.flashCamera();
    ui.updateGallery(result.photos);
    audio.playCamera();
    ui.toastMessage('📸 拍照成功！按 P 看作品集。', 'good', 2600);
    return true;
  } catch (error) {
    ui.toastMessage('拍照失败，再试一次吧。', 'warn', 2800);
    return false;
  }
}

function openWorldMap() {
  if (!state.game || state.paused) return;
  state.paused = true;
  state.pausedReason = 'worldmap';
  setPlayerInputEnabled(false);
  state.game.player.exitPointerLock();
  state.game.interaction.hideTarget();
  ui.setPointerHint(false);
  ui.hideToast();
  ui.showWorldMap();
  window.requestAnimationFrame(() => {
    if (!state.game || state.pausedReason !== 'worldmap') return;
    try {
      state.game.worldMap?.render();
    } catch (error) {
      console.warn('[美味特工队] 绘制世界地图失败：', error);
    }
    ui.setWorldMapLoading(false);
  });
}

function closeWorldMap() {
  if (!state.game || state.pausedReason !== 'worldmap') return;
  ui.hideWorldMap();
  state.paused = false;
  state.pausedReason = 'none';
  setPlayerInputEnabled(true);
  const requested = state.game.player.requestPointerLock();
  ui.setPointerHint(
    !requested || document.pointerLockElement !== state.game.player.domElement,
    '点击画面锁定鼠标，移动鼠标看看四周',
  );
}

function openGallery() {
  if (!state.game || state.paused || ui.isGalleryOpen()) return;
  ui.hideToast();
  state.paused = true;
  state.pausedReason = 'gallery';
  setPlayerInputEnabled(false);
  state.game.player.exitPointerLock();
  state.game.interaction.hideTarget();
  ui.setPointerHint(false);
  ui.showGallery(gallery.list());
  audio.playInventory();
}

function closeGallery() {
  if (!state.game || !ui.isGalleryOpen()) return;
  ui.hideGallery();
  state.paused = false;
  state.pausedReason = 'none';
  setPlayerInputEnabled(true);
  const requested = state.game.player.requestPointerLock();
  ui.setPointerHint(
    !requested || document.pointerLockElement !== state.game.player.domElement,
    '点击画面锁定鼠标，移动鼠标看看四周',
  );
}

function deletePhoto(photoId) {
  if (!photoId) return;
  const result = gallery.remove(photoId);
  if (!result.ok) {
    ui.toastMessage(result.error || '删除照片失败。', 'warn', 2800);
    return;
  }
  ui.updateGallery(result.photos);
  audio.playSelect();
  ui.toastMessage('这张照片已经删掉啦。', 'info', 2000);
}

function updateAdaptiveQuality(game, rawDelta) {
  if (!isTouchDevice || state.paused || game.performanceReduced) return;
  if (game.fps < 22) {
    game.lowFpsTime += rawDelta;
  } else {
    game.lowFpsTime = Math.max(0, game.lowFpsTime - rawDelta * 2);
  }

  if (game.lowFpsTime < 4.5) return;
  const reduced = game.world.setRenderDistance(Math.max(2, game.world.renderDistance - 1));
  game.performanceReduced = true;
  if (reduced) {
    ui.toastMessage('手机有点辛苦，我把远处调小一点，会更流畅啦。', 'info', 3600);
    updateHUD(game);
  }
}

function handleVisibilityChange() {
  if (document.hidden && state.game && !state.paused) {
    pauseGame('hidden');
  }
}

function handleGlobalContextMenu(event) {
  if (document.body.dataset.screen === 'game') {
    event.preventDefault();
  }
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

/* ------------------------------------------------------------------ */
/* 退出、清理和尺寸                                                    */
/* ------------------------------------------------------------------ */

function returnHome() {
  if (state.game) {
    persistGame('home', { silent: true });
  }
  state.paused = true;
  state.pausedReason = 'none';
  state.retryMode = null;
  state.techCitySeen = false;
  cleanupGame();
  ui.hideAllOverlays();
  ui.setModeIndicator({});
  ui.setPointerHint(false);
  ui.hideToast();
  refreshHomeSaveUI();
  ui.showScreen('home');
}

function cleanupGame() {
  const game = state.game;
  if (!game) return;
  stopGameLoop();
  cleanupPartial(game);
  state.game = null;
}

function cleanupPartial({
  renderer,
  scene,
  world,
  environment,
  player,
  interaction,
  animals,
  minimap,
  worldMap,
  mobileControls,
  contextLostHandler,
}) {
  try {
    worldMap?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理世界地图时出错：', error);
  }
  try {
    mobileControls?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理手机操作时出错：', error);
  }
  try {
    minimap?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理小地图时出错：', error);
  }
  try {
    interaction?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理方块交互时出错：', error);
  }
  try {
    animals?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理小动物时出错：', error);
  }
  try {
    player?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理玩家时出错：', error);
  }
  try {
    world?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理世界时出错：', error);
  }
  try {
    environment?.dispose();
  } catch (error) {
    console.warn('[美味特工队] 清理环境时出错：', error);
  }
  if (renderer) {
    const canvas = renderer.domElement;
    if (canvas && contextLostHandler) {
      canvas.removeEventListener('webglcontextlost', contextLostHandler);
    }
    try {
      renderer.dispose();
      renderer.forceContextLoss?.();
    } catch (error) {
      console.warn('[美味特工队] 关闭画布时出错：', error);
    }
    // 下次开始游戏时用一个干净 canvas，避免旧 WebGL 上下文残留。
    if (canvas && canvas.parentElement) {
      const freshCanvas = canvas.cloneNode(false);
      freshCanvas.removeAttribute('width');
      freshCanvas.removeAttribute('height');
      canvas.replaceWith(freshCanvas);
    }
  }
  if (scene) {
    scene.clear();
  }
}

function resizeGame() {
  if (!state.game) return;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  state.game.renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, GAME_CONFIG.maxPixelRatio),
  );
  state.game.renderer.setSize(width, height, false);
  state.game.camera.aspect = width / height;
  state.game.camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatError(error) {
  if (!error) return '未知错误';
  if (typeof error === 'string') return error.slice(0, 2000);
  const parts = [];
  if (error.name) parts.push(error.name);
  if (error.message) parts.push(error.message);
  if (error.stack) parts.push(error.stack);
  return parts.join('\n').slice(0, 2000);
}

class FriendlyError extends Error {
  constructor(title, userMessage, detail = '', retryWithReload = false) {
    super(detail || userMessage);
    this.name = 'FriendlyError';
    this.title = title;
    this.userMessage = userMessage;
    this.detail = detail;
    this.retryWithReload = retryWithReload;
  }
}

function restoreRetryAfterReload() {
  let characterId = null;
  try {
    characterId = window.sessionStorage.getItem('meiwei-retry-character');
    if (characterId) window.sessionStorage.removeItem('meiwei-retry-character');
  } catch (error) {
    return;
  }
  if (!characterId) return;

  const character = getCharacter(characterId);
  if (!character) return;
  ui.selectCharacter(character.id);
  state.selectedCharacter = character;
  window.setTimeout(() => {
    startAdventure(character);
  }, 120);
}
