/**
 * 新手三步任务：走路、放方块、靠近小动物。
 * 这里只保存任务进度，界面和提示由 main.js 交给 ui.js 显示。
 */

const WALK_TARGET = 10;
const ANIMAL_DISTANCE = 3.6;
const TELEPORT_GUARD = 1.5;

const STEP_MESSAGES = Object.freeze({
  walk: '太棒啦，你学会走路了！',
  place: '好厉害，你放好第一块方块啦！',
  animal: '你找到小动物啦，它好像很喜欢你！',
});

const ALL_COMPLETE_MESSAGE = '新手任务全部完成！你真是方块小达人！';

export class NewbieQuests {
  constructor({ onStepComplete = () => {}, onAllComplete = () => {} } = {}) {
    this.onStepComplete = onStepComplete;
    this.onAllComplete = onAllComplete;

    this.steps = {
      walk: { id: 'walk', complete: false, current: 0, target: WALK_TARGET },
      place: { id: 'place', complete: false, current: 0, target: 1 },
      animal: { id: 'animal', complete: false, current: 0, target: 1 },
    };

    this.walkDistance = 0;
    this.lastPosition = null;
    this.completedCount = 0;
    this.allComplete = false;
  }

  update(playerPosition, nearestAnimalDistance = Infinity) {
    if (this.allComplete) return this.getState();

    if (!this.lastPosition) {
      this.lastPosition = { x: playerPosition.x, z: playerPosition.z };
    } else {
      const dx = playerPosition.x - this.lastPosition.x;
      const dz = playerPosition.z - this.lastPosition.z;
      const stepDistance = Math.hypot(dx, dz);
      this.lastPosition = { x: playerPosition.x, z: playerPosition.z };

      // 调试传送或区块修正不应该被当成走路。
      if (stepDistance < TELEPORT_GUARD && !this.steps.walk.complete) {
        this.walkDistance = Math.min(WALK_TARGET, this.walkDistance + stepDistance);
        this.steps.walk.current = Math.min(WALK_TARGET, Math.floor(this.walkDistance));
        if (this.walkDistance >= WALK_TARGET) {
          this._completeStep('walk');
        }
      }
    }

    if (!this.steps.animal.complete && nearestAnimalDistance <= ANIMAL_DISTANCE) {
      this.steps.animal.current = 1;
      this._completeStep('animal');
    }

    return this.getState();
  }

  markBlockPlaced() {
    if (this.steps.place.complete) return false;
    this.steps.place.current = 1;
    this._completeStep('place');
    return true;
  }

  _completeStep(stepId) {
    const step = this.steps[stepId];
    if (!step || step.complete) return;

    step.complete = true;
    step.current = step.target;
    this.completedCount += 1;

    const allComplete = Object.values(this.steps).every((item) => item.complete);
    this.allComplete = allComplete;
    this.onStepComplete({
      stepId,
      message: STEP_MESSAGES[stepId] || '完成啦！',
      state: this.getState(),
      allComplete,
    });

    if (allComplete) {
      this.onAllComplete({
        message: ALL_COMPLETE_MESSAGE,
        state: this.getState(),
      });
    }
  }

  getSaveData() {
    return {
      walkDistance: this.walkDistance,
      placed: this.steps.place.complete,
      animalFound: this.steps.animal.complete,
    };
  }

  restore(data) {
    if (!data) return;
    this.walkDistance = Math.max(0, Math.min(WALK_TARGET, Number(data.walkDistance) || 0));
    this.steps.walk.current = Math.min(WALK_TARGET, Math.floor(this.walkDistance));
    this.steps.walk.complete = this.walkDistance >= WALK_TARGET;
    this.steps.place.complete = Boolean(data.placed);
    this.steps.place.current = this.steps.place.complete ? 1 : 0;
    this.steps.animal.complete = Boolean(data.animalFound);
    this.steps.animal.current = this.steps.animal.complete ? 1 : 0;
    this.completedCount = Object.values(this.steps).filter((step) => step.complete).length;
    this.allComplete = this.completedCount === 3;
    this.lastPosition = null;
  }

  getState() {
    return {
      steps: [
        {
          id: 'walk',
          label: '走 10 步',
          icon: '🚶',
          current: this.steps.walk.current,
          target: WALK_TARGET,
          complete: this.steps.walk.complete,
          detail: `${this.steps.walk.current}/${WALK_TARGET}`,
        },
        {
          id: 'place',
          label: '放置 1 个方块',
          icon: '🧱',
          current: this.steps.place.current,
          target: 1,
          complete: this.steps.place.complete,
          detail: this.steps.place.complete ? '完成' : '0/1',
        },
        {
          id: 'animal',
          label: '靠近一只小动物',
          icon: '🐰',
          current: this.steps.animal.current,
          target: 1,
          complete: this.steps.animal.complete,
          detail: this.steps.animal.complete ? '找到啦' : '0/1',
        },
      ],
      completedCount: this.completedCount,
      allComplete: this.allComplete,
      walkDistance: this.walkDistance,
    };
  }
}

export { WALK_TARGET, ANIMAL_DISTANCE };
