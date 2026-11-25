// 자동 전투를 시간에 맞춰 한 걸음씩 진행한다. 일시정지·배속·타이머 하나만 관리하고,
// 언제 멈춰야 하는지(탭 숨김, 대화상자, 연출 중)와 한 걸음에 할 일은 host가 정한다.
//
// host: {
//   canRun(): boolean            지금 진행해도 되는지
//   token(): any                 예약 시점의 전투를 나타내는 값
//   isCurrent(token): boolean    예약한 전투가 아직 진행 중인지
//   nextDelay(): number          다음 걸음까지 기다릴 ms(배속 적용 전)
//   step(): void                 한 걸음 진행
// }
// scheduler: {after(ms, callback): handle, cancel(handle)}
export class AutoBattleRunner {
  #scheduler;
  #host;
  #handle = null;
  paused = false;
  speed = 1;

  constructor({scheduler, host}){
    this.#scheduler = scheduler;
    this.#host = host;
  }

  get handle(){ return this.#handle; }

  cancel(){
    if(this.#handle !== null) this.#scheduler.cancel(this.#handle);
    this.#handle = null;
  }

  // 기존 예약을 지우고 다음 걸음을 하나만 예약한다. 반복 렌더로 여러 번 불려도 타이머는 하나다.
  schedule(){
    this.cancel();
    if(this.paused || !this.#host.canRun()) return;
    const token = this.#host.token();
    const handle = this.#scheduler.after(this.#host.nextDelay() / this.speed, () => {
      if(this.#handle !== handle) return;
      this.#handle = null;
      if(!this.#host.isCurrent(token) || this.paused || !this.#host.canRun()) return;
      this.#host.step();
    });
    this.#handle = handle;
  }

  togglePause(){ this.paused = !this.paused; }

  // 1× → 2× → 4× → 1×
  cycleSpeed(){ this.speed = this.speed === 4 ? 1 : this.speed * 2; }
}
