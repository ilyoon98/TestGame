const testButton = document.querySelector('#test-button');
const testStatus = document.querySelector('#status');

testButton.addEventListener('click', () => {
  testStatus.textContent = '버튼 동작을 확인했습니다.';
});
