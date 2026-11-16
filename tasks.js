/* DOMに依存しない保存・タスク操作。外部通信は行いません。 */
(function (root) {
  'use strict';
  const validate = value => {
    if (!Array.isArray(value) || !value.every(t => t && typeof t.id === 'string' &&
      t.id.length > 0 && typeof t.text === 'string' && t.text.trim().length > 0 &&
      t.text.length <= 200 && typeof t.done === 'boolean') ||
      new Set(value.map(t => t.id)).size !== value.length) throw new Error('保存データの形式が不正です');
    return value;
  };
  function createStore(storage, key) {
    let tasks = [];
    let writable = true;
    let loadError = false;
    try {
      const saved = storage.getItem(key);
      if (saved !== null) tasks = validate(JSON.parse(saved));
    } catch { writable = false; loadError = true; }
    function commit(next) {
      if (!writable) throw new Error('保存データを読み込めないため変更できません');
      validate(next);
      storage.setItem(key, JSON.stringify(next));
      tasks = next;
    }
    return {
      get tasks() { return tasks.map(t => ({...t})); },
      get loadError() { return loadError; },
      add(text, id) {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length > 200) throw new Error('1〜200文字で入力してください');
        commit([...tasks, {id, text: trimmed, done: false}]);
      },
      toggle(id) { commit(tasks.map(t => t.id === id ? {...t, done: !t.done} : t)); },
      remove(id) { commit(tasks.filter(t => t.id !== id)); }
    };
  }
  root.MyTask = {createStore};
  if (typeof module !== 'undefined' && module.exports) module.exports = {createStore};
})(typeof globalThis !== 'undefined' ? globalThis : this);
