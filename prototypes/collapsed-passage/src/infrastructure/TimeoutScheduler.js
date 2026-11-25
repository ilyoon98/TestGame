// setTimeout/clearTimeout을 Scheduler 계약으로 감싼다.
// 테스트와 브라우저가 각자의 타이머 함수를 넘긴다.
export class TimeoutScheduler {
  #set;
  #clear;

  constructor(setTimer, clearTimer){
    this.#set = setTimer;
    this.#clear = clearTimer;
  }

  after(ms, callback){ return this.#set(callback, ms); }
  cancel(handle){ this.#clear(handle); }
}
