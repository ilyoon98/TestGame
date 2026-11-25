// 도메인 이벤트를 판 상태에 쌓는다. 화면은 state.feedback을 연출하고, state.log는 행동 기록으로 보여 준다.
// 도메인 규칙은 이 계약(emit, log)만 알고, 누가 이벤트를 소비하는지 모른다.
export class StateEventSink {
  static LOG_LIMIT = 24;

  // 연출에 필요한 당시의 적 행동 예고와 대상의 가드도 함께 남긴다.
  emit(event, state){
    state.feedback.push({...event, intent: state.enemyAction, guards: state[event.side].guardParts()});
  }

  log(message, state){
    state.log.unshift(message);
    if(state.log.length > StateEventSink.LOG_LIMIT) state.log.pop();
  }
}
