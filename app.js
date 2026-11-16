(() => {
  'use strict';
  // 同じドメインの別サブディレクトリとは保存先を分けます。
  const key = 'my-task:v1:' + location.pathname.replace(/index\.html$/, '');
  let storage;
  try { storage = window.localStorage; }
  catch { storage = {getItem() { throw new Error('保存を利用できません'); }}; }
  const store = MyTask.createStore(storage, key);
  const list = document.querySelector('#task-list');
  const input = document.querySelector('#task-input');
  const message = document.querySelector('#message');
  function announce(text, error = false) {
    message.textContent = text;
    message.classList.toggle('error', error);
  }
  function change(action, success) {
    try { action(); render(); announce(success); return true; }
    catch { announce('保存できませんでした。変更は反映していません。空き容量とブラウザの保存設定をご確認ください。', true); return false; }
  }
  function render() {
    list.replaceChildren();
    const tasks = store.tasks;
    for (const task of tasks) {
      const row = document.createElement('li');
      row.classList.toggle('done', task.done);
      row.dataset.id = task.id;
      const toggle = document.createElement('button');
      toggle.type = 'button'; toggle.className = 'toggle';
      toggle.setAttribute('aria-pressed', String(task.done));
      toggle.setAttribute('aria-label', task.text + 'を' + (task.done ? '未完了' : '完了') + 'にする');
      const check = document.createElement('span');
      check.className = 'check'; check.textContent = task.done ? '✓' : ''; check.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span');
      title.className = 'task-text'; title.textContent = task.text;
      toggle.append(check, title);
      toggle.addEventListener('click', () => {
        if (change(() => store.toggle(task.id), task.done ? '未完了に戻しました。' : 'タスクを完了しました。')) {
          [...list.children].find(el => el.dataset.id === task.id)?.querySelector('.toggle').focus();
        }
      });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'delete'; remove.textContent = '削除';
      remove.setAttribute('aria-label', task.text + 'を削除');
      remove.addEventListener('click', () => {
        if (!window.confirm('「' + task.text + '」を削除しますか？')) return;
        if (change(() => store.remove(task.id), 'タスクを削除しました。')) input.focus();
      });
      row.append(toggle, remove); list.append(row);
    }
    const done = tasks.filter(t => t.done).length;
    document.querySelector('#remaining').textContent = tasks.length - done;
    document.querySelector('#total').textContent = tasks.length + '件';
    document.querySelector('#progress').textContent = tasks.length ?
      tasks.length + '件中 ' + done + '件完了。' + (done === tasks.length ? 'おつかれさまでした！' : 'ひとつずつ進めましょう。') :
      '今日も自分のペースで。';
    document.querySelector('#progress-fill').style.width = (tasks.length ? done / tasks.length * 100 : 0) + '%';
    document.querySelector('#empty').hidden = tasks.length > 0;
  }
  document.querySelector('#task-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!input.value.trim()) { announce('タスクの内容を入力してください。', true); input.focus(); return; }
    const id = globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
    if (change(() => store.add(input.value, id), '追加して保存しました。')) { input.value = ''; input.focus(); }
  });
  render();
  if (store.loadError) {
    announce('保存データを読み込めませんでした。データ保護のため変更を停止しています。ブラウザの保存設定をご確認ください。', true);
    input.disabled = true;
    document.querySelector('button[type="submit"]').disabled = true;
  }
  const offline = document.querySelector('#offline-status');
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', async () => {
      try {
        await navigator.serviceWorker.register('./sw.js');
        await navigator.serviceWorker.ready;
        offline.textContent = '✓ オフラインでも使えます';
      } catch { offline.textContent = 'オフライン準備に失敗しました。接続して再読み込みしてください。'; }
    });
  } else { offline.textContent = 'オフライン機能にはHTTPSまたはlocalhostで開いてください。'; }
})();
