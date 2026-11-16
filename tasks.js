/* 保存キーと配列形式はVer.1.0と共通。読み込み時には保存しません。 */
(function (root) {
  'use strict';
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  function validDate(value) {
    return value === '' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      value.slice(0,4) !== '0000' && Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0,10) === value);
  }
  function normalize(value) {
    if (!Array.isArray(value)) throw new Error('タスク配列ではありません');
    const result = value.map(t => {
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !t.id ||
        typeof t.text !== 'string' || !t.text.trim() || t.text.length > 200 ||
        typeof t.done !== 'boolean') throw new Error('タスクの形式が不正です');
      const type = own(t,'type') ? t.type : 'short';
      const priority = own(t,'priority') ? t.priority : type === 'short' ? 'medium' : null;
      const dueDate = own(t,'dueDate') ? t.dueDate : '';
      if (!['short','long'].includes(type) || !validDate(dueDate) ||
        (type === 'short' ? !['high','medium','low'].includes(priority) : priority !== null)) {
        throw new Error('分類・優先度・締切日の形式が不正です');
      }
      // 未知の既存フィールドも消さずに保持します。
      return {...t,type,priority,dueDate};
    });
    if (new Set(result.map(t => t.id)).size !== result.length) throw new Error('IDが重複しています');
    return result;
  }
  function todayString(now = new Date()) {
    return String(now.getFullYear()).padStart(4,'0') + '-' +
      String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  }
  function deadline(task, today = todayString()) {
    if (task.done || !task.dueDate) return '';
    const days = Math.round((Date.parse(task.dueDate) - Date.parse(today)) / 86400000);
    return days < 0 ? 'overdue' : days === 0 ? 'today' : days <= 3 ? 'soon' : '';
  }
  function sortTasks(tasks, mode) {
    const rank = {high:0,medium:1,low:2};
    return tasks.map((task,index)=>({task,index})).sort((a,b) => {
      const delta = mode === 'high' ? rank[a.task.priority]-rank[b.task.priority] :
        mode === 'low' ? rank[b.task.priority]-rank[a.task.priority] : 0;
      return delta || a.index-b.index;
    }).map(item=>item.task);
  }
  function parseBackup(text) {
    const value = JSON.parse(text.replace(/^\uFEFF/,''));
    if (Array.isArray(value)) return normalize(value);
    if (!value || value.app !== 'My Task' || value.version !== '1.1') throw new Error('対応していないバックアップです');
    return normalize(value.tasks);
  }
  function createStore(storage, key) {
    let tasks = [], raw = null, loadError = false;
    try {
      raw = storage.getItem(key);
      if (raw !== null) tasks = normalize(JSON.parse(raw));
    } catch { loadError = true; }
    function commit(next, restoring = false) {
      if (loadError) throw new Error('保存データを読み込めないため変更できません');
      const checked = normalize(next);
      const nextRaw = JSON.stringify(checked);
      // 別画面での編集を検知し、古いデータで上書きしません。
      if (storage.getItem(key) !== raw) throw new Error('別の画面でデータが更新されました。再読み込みしてください');
      const backupKey = key + ':backup-before-v1.1';
      if (raw !== null && storage.getItem(backupKey) === null) storage.setItem(backupKey,raw);
      if (restoring) storage.setItem(key + ':before-restore',raw === null ? '[]' : raw);
      storage.setItem(key,nextRaw);
      tasks = checked; raw = nextRaw;
    }
    return {
      get tasks() { return tasks.map(t=>({...t})); },
      get loadError() { return loadError; },
      add(text,id,options={}) {
        commit([...tasks,{id,text:text.trim(),done:false,...options}]);
      },
      edit(id,changes) {
        if (!tasks.some(t=>t.id===id)) throw new Error('タスクが見つかりません');
        commit(tasks.map(t=>t.id===id ? {...t,...changes,id:t.id,done:t.done} : t));
      },
      toggle(id) { commit(tasks.map(t=>t.id===id ? {...t,done:!t.done} : t)); },
      remove(id) { commit(tasks.filter(t=>t.id!==id)); },
      restore(value) { commit(value,true); },
      exportJSON() {
        if (loadError) throw new Error('保存データを読み込めません');
        return JSON.stringify({app:'My Task',version:'1.1',exportedAt:new Date().toISOString(),tasks},null,2);
      }
    };
  }
  const api = {createStore,normalize,validDate,deadline,todayString,sortTasks,parseBackup};
  root.MyTask = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
