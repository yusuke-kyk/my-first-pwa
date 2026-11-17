(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  // 既存アプリと同一の保存キー。バージョン番号を変更しないこと。
  const key = 'my-task:v1:' + location.pathname.replace(/index\.html$/, '');
  let storage;
  try { storage = window.localStorage; }
  catch { storage = {getItem(){throw new Error('保存を利用できません');}}; }
  const store = MyTask.createStore(storage,key);
  let activeType = 'short', editingId = null, pendingRestore = null;
  let editOpener;
  let currentScreen = 'home', shortSort = 'created';
  const screenTitles = {home:'My Task',add:'タスクを追加',settings:'設定'};
  const screenCaptions = {home:'毎日を、ひとつずつ。',add:'やることを、ひとつずつ。',settings:'自分のペースで、使いやすく。'};
  function showScreen(name,keepMessage=false) {
    if (!screenTitles[name]) return;
    currentScreen=name;
    for(const screen of document.querySelectorAll('.screen'))screen.hidden=screen.id!=='screen-'+name;
    for(const button of document.querySelectorAll('[data-screen]')){
      if(button.dataset.screen===name)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    }
    $('#screen-heading').textContent=screenTitles[name];
    $('#screen-caption').textContent=screenCaptions[name];
    if(!keepMessage && !store.loadError)announce('');
    if(name==='home')render();
    window.scrollTo(0,0);
    $('#screen-heading').focus({preventScroll:true});
  }
  for(const button of document.querySelectorAll('[data-screen],[data-go]')){
    button.addEventListener('click',()=>showScreen(button.dataset.screen || button.dataset.go));
  }

  // 固定ナビの実寸（セーフエリアを含む）をスクロール余白に反映します。
  const nav = $('.bottom-nav');
  function measureNavigation() {
    if(nav.getClientRects().length)document.documentElement.style.setProperty('--nav-height',nav.getBoundingClientRect().height+'px');
  }
  if('ResizeObserver' in window)new ResizeObserver(measureNavigation).observe(nav);
  window.addEventListener('resize',measureNavigation);
  measureNavigation();
  const viewport = window.visualViewport;
  if(viewport) {
    let fullHeight = Math.max(window.innerHeight,viewport.height);
    function updateViewport(reveal=false) {
      const focused=document.activeElement;
      const editing=focused?.matches('input:not([type=file]),textarea,[contenteditable=true]');
      if(!editing)fullHeight=Math.max(window.innerHeight,viewport.height);
      const keyboardOpen=!!editing && viewport.scale<=1.05 && fullHeight-viewport.height>150;
      document.documentElement.classList.toggle('keyboard-open',keyboardOpen);
      document.documentElement.style.setProperty('--visible-height',viewport.height+'px');
      if(!keyboardOpen)measureNavigation();
      if(keyboardOpen && reveal)requestAnimationFrame(()=>{
        const rect=focused.getBoundingClientRect();
        const bottom=viewport.offsetTop+viewport.height-20;
        if(rect.bottom>bottom)window.scrollBy(0,rect.bottom-bottom);
      });
    }
    viewport.addEventListener('resize',()=>updateViewport(true));
    viewport.addEventListener('scroll',()=>updateViewport());
    document.addEventListener('focusin',()=>updateViewport(true));
    document.addEventListener('focusout',()=>requestAnimationFrame(()=>updateViewport()));
    window.addEventListener('orientationchange',()=>{fullHeight=window.innerHeight;});
    updateViewport();
  }
  function announce(text,error=false) {
    $('#message').textContent = text;
    $('#message').classList.toggle('error',error);
  }
  function change(action,success) {
    try { action();render();announce(success);return true; }
    catch(error) { announce('変更は反映していません。' + error.message + '。保存設定や空き容量もご確認ください。',true);return false; }
  }
  function badge(text,kind='') {
    const span = document.createElement('span');
    span.className = 'badge ' + kind;span.textContent=text;return span;
  }
  const dueLabels = {overdue:'期限切れ',today:'今日が締切',soon:'3日以内に締切'};
  const priorityLabels = {high:'高',medium:'中',low:'低'};
  function openEdit(task,opener) {
    editingId=task.id;editOpener=opener;$('#edit-text').setCustomValidity('');
    $('#edit-text').value=task.text;$('#edit-type').value=task.type;
    $('#edit-due').value=task.dueDate;$('#edit-priority').value=task.priority || 'medium';
    syncPriority('edit');$('#edit-dialog').showModal();
  }
  function render() {
    const tasks=store.tasks;
    const visible=MyTask.sortTasks(tasks.filter(t=>t.type===activeType),activeType==='short' ? shortSort : 'created');
    $('#task-list').replaceChildren();
    $('#completed-list').replaceChildren();
    for(const task of visible) {
      const row=document.createElement('li');row.dataset.id=task.id;
      row.classList.add('task-row');
      row.classList.toggle('done',task.done);
      const content=document.createElement('div');content.className='task-content';
      const toggle=document.createElement('button');toggle.type='button';toggle.className='toggle';
      toggle.setAttribute('aria-pressed',String(task.done));
      toggle.setAttribute('aria-label',task.text+'を'+(task.done?'未完了':'完了')+'にする');
      const check=document.createElement('span');check.className='check';check.textContent=task.done?'✓':'';
      check.setAttribute('aria-hidden','true');
      const title=document.createElement('span');title.className='task-text';title.textContent=task.text;
      toggle.append(check,title);
      toggle.addEventListener('click',()=>{
        if(change(()=>store.toggle(task.id),task.done?'未完了に戻しました。':'タスクを完了しました。')) {
          if(!task.done)$('#completed-summary').focus();
          else [...$('#task-list').children].find(el=>el.dataset.id===task.id)?.querySelector('.toggle').focus();
        }
      });
      const metadata=document.createElement('div');metadata.className='metadata';
      if(task.type==='short') metadata.append(badge('優先度 '+priorityLabels[task.priority],'priority-'+task.priority));
      if(task.dueDate) {
        const state=MyTask.deadline(task);
        metadata.append(badge('締切 '+task.dueDate));
        if(state) metadata.append(badge(dueLabels[state],state));
      }
      const actions=document.createElement('div');actions.className='task-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='secondary edit';edit.textContent='編集';
      edit.setAttribute('aria-label',task.text+'を編集');edit.addEventListener('click',()=>openEdit(task,edit));
      const remove=document.createElement('button');remove.type='button';remove.className='delete';remove.textContent='削除';
      remove.setAttribute('aria-label',task.text+'を削除');
      remove.addEventListener('click',()=>{
        if(!confirm('「'+task.text+'」を削除しますか？'))return;
        if(change(()=>store.remove(task.id),'タスクを削除しました。'))$('#screen-heading').focus();
      });
      content.append(toggle,metadata);actions.append(edit,remove);row.append(content,actions);
      $(task.done?'#completed-list':'#task-list').append(row);
    }
    const done=tasks.filter(t=>t.done).length;
    $('#remaining').textContent=tasks.length-done;
    const pendingCount=visible.filter(t=>!t.done).length;
    const completedCount=visible.length-pendingCount;
    $('#total').textContent=pendingCount+'件';
    $('#completed-summary').textContent='完了済み '+completedCount+'件';
    $('#completed-empty').hidden=completedCount>0;
    $('#progress').textContent=tasks.length ? tasks.length+'件中 '+done+'件完了。'+(done===tasks.length?'おつかれさまでした！':'ひとつずつ進めましょう。') : '今日も自分のペースで。';
    $('#progress-fill').style.width=(tasks.length?done/tasks.length*100:0)+'%';
    $('#progress-percent').textContent=(tasks.length?Math.round(done/tasks.length*100):0)+'%';
    $('#progress-bar').setAttribute('aria-valuenow',String(tasks.length?Math.round(done/tasks.length*100):0));
    $('#empty').hidden=pendingCount>0;
    $('#empty h3').textContent=(activeType==='short'?'短期':'長期')+'の未完了タスクはありません';
    $('#sort').disabled=activeType==='long';
    $('#sort').value=activeType==='short'?shortSort:'created';
    for(const button of document.querySelectorAll('[role="tab"]')) {
      const selected=button.dataset.type===activeType;
      button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    }
    $('#task-panel').setAttribute('aria-labelledby','tab-'+activeType);
    const upcoming=tasks.filter(t=>MyTask.deadline(t)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    $('#upcoming').hidden=upcoming.length===0;
    $('#upcoming-list').replaceChildren();
    $('#upcoming-extra').replaceChildren();
    $('#upcoming-more').hidden=upcoming.length<=2;
    $('#upcoming-more-summary').textContent='ほか '+Math.max(0,upcoming.length-2)+'件を表示';
    $('#upcoming-count').textContent=upcoming.length+'件';
    $('#upcoming-empty').hidden=upcoming.length>0;
    for(const [index,task] of upcoming.entries()) {
      const item=document.createElement('li');
      const button=document.createElement('button');button.type='button';button.className='upcoming-task';
      button.textContent=task.text+'（'+(task.type==='short'?'短期':'長期')+'）';
      button.addEventListener('click',()=>openEdit(task,button));
      const status=MyTask.deadline(task);
      const label=status==='overdue'?'期限切れ':status==='today'?'今日':task.dueDate.slice(5).replace('-','/');
      item.append(button,badge(label,status));
      item.title='締切 '+task.dueDate;
      $(index<2?'#upcoming-list':'#upcoming-extra').append(item);
    }
  }
  function syncPriority(prefix) {
    const long=$('#'+prefix+'-type').value==='long';
    $('#'+prefix+'-priority').disabled=long;
    $('#'+prefix+'-priority-field').hidden=long;
  }
  function fields(prefix) {
    const type=$('#'+prefix+'-type').value;
    return {type,dueDate:$('#'+prefix+'-due').value,priority:type==='short'?$('#'+prefix+'-priority').value:null};
  }
  for(const prefix of ['new','edit']) $('#'+prefix+'-type').addEventListener('change',()=>syncPriority(prefix));
  $('#task-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!$('#task-input').value.trim()){announce('タスクの内容を入力してください。',true);return;}
    const id=globalThis.crypto?.randomUUID?.() || Date.now()+'-'+Math.random().toString(36).slice(2);
    const options=fields('new');
    const before=activeType;activeType=options.type;
    if(change(()=>store.add($('#task-input').value,id,options),'追加して保存しました。')) {
      $('#task-input').value='';$('#new-due').value='';
      if(event.submitter?.value==='continue')$('#task-input').focus();
      else showScreen('home',true);
    } else {activeType=before;}
  });
  $('#edit-form').addEventListener('submit',event=>{
    event.preventDefault();
    const text=$('#edit-text').value.trim();
    if(!text){$('#edit-text').setCustomValidity('内容を入力してください');$('#edit-text').reportValidity();return;}
    const options=fields('edit');
    if(change(()=>store.edit(editingId,{text,...options}),'変更して保存しました。')) {
      activeType=options.type;render();$('#edit-dialog').close();
    } else {$('#edit-error').textContent=$('#message').textContent;}
  });
  $('#edit-text').addEventListener('input',()=>$('#edit-text').setCustomValidity(''));
  $('#edit-cancel').addEventListener('click',()=>$('#edit-dialog').close());
  $('#edit-dialog').addEventListener('close',()=>{
    $('#edit-error').textContent='';
    if(editOpener?.isConnected && editOpener.getClientRects().length)editOpener.focus();else $('#screen-heading').focus();
  });
  const tabs=[...document.querySelectorAll('[role="tab"]')];
  for(const tab of tabs) {
    tab.addEventListener('click',()=>{activeType=tab.dataset.type;render();});
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const index=event.key==='Home'?0:event.key==='End'?1:1-tabs.indexOf(tab);
      tabs[index].click();tabs[index].focus();
    });
  }
  $('#sort').addEventListener('change',()=>{shortSort=$('#sort').value;render();});
  $('#export').addEventListener('click',()=>{
    try {
      const blob=new Blob([store.exportJSON()],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='my-task-'+MyTask.todayString()+'.json';
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      announce('バックアップを作成しました。ダウンロード先をご確認ください。');
    }catch(error){announce(error.message,true);}
  });
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error('5MB以下のJSONファイルを選んでください');
      const tasks=MyTask.parseBackup(await file.text());
      pendingRestore=tasks;
      const short=tasks.filter(t=>t.type==='short').length;
      $('#restore-summary').textContent='読み込み：'+tasks.length+'件（短期 '+short+'件・長期 '+(tasks.length-short)+'件）。現在の'+store.tasks.length+'件を置き換えます。';
      $('#restore-preview').replaceChildren();
      for(const task of tasks.slice(0,20)){
        const item=document.createElement('li');item.textContent=(task.done?'✓ ':'')+task.text;$('#restore-preview').append(item);
      }
      $('#restore-more').textContent=tasks.length>20?'ほか '+(tasks.length-20)+'件':'';
      $('#restore-dialog').showModal();
    }catch(error){pendingRestore=null;announce('復元できません。現在のデータは変更していません。'+error.message,true);}
  });
  $('#restore-confirm').addEventListener('click',()=>{
    if(pendingRestore && change(()=>store.restore(pendingRestore),'バックアップから復元しました。'))$('#restore-dialog').close();
    else $('#restore-error').textContent=$('#message').textContent;
  });
  $('#restore-cancel').addEventListener('click',()=>$('#restore-dialog').close());
  $('#restore-dialog').addEventListener('close',()=>{if(!$('#restore-dialog').open){pendingRestore=null;$('#restore-error').textContent='';}});
  // 日付をまたいだ場合や、ホーム画面から戻った場合も締切表示を更新します。
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
  window.addEventListener('focus',render);
  setInterval(()=>{if(!document.hidden)render();},60000);
  syncPriority('new');render();
  if(store.loadError) {
    announce('保存データを読み込めませんでした。元データを保護するため変更を停止しています。サイトデータは削除せず、保存設定をご確認ください。',true);
    for(const el of document.querySelectorAll('#task-form input,#task-form select,#task-form button,#export,#import-file'))el.disabled=true;
  }
  const offline=$('#offline-status');
  if('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load',async()=>{
      try {
        const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
        function showUpdate() {
          if(registration.waiting && navigator.serviceWorker.controller)$('#update-bar').hidden=false;
        }
        showUpdate();
        registration.addEventListener('updatefound',()=>{
          const worker=registration.installing;
          worker?.addEventListener('statechange',()=>{if(worker.state==='installed')showUpdate();});
        });
        $('#update-now').addEventListener('click',()=>{
          const unsaved=$('#task-input').value.trim() || $('#edit-dialog').open || $('#restore-dialog').open;
          if(unsaved && !confirm('入力中の内容や確認画面を閉じて更新しますか？ 保存済みタスクは残ります。'))return;
          registration.waiting?.postMessage({type:'SKIP_WAITING'});
        });
        // 別画面で更新を選んだ場合も古いコードのまま編集しません。
        let controlled=!!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange',()=>{
          if(controlled)location.reload();controlled=true;
        });
        await navigator.serviceWorker.ready;offline.textContent='✓ オフラインでも使えます';
        registration.update().catch(()=>{});
      }catch{offline.textContent='オフライン準備に失敗しました。接続して再読み込みしてください。';}
    });
  }else offline.textContent='オフライン機能にはHTTPSまたはlocalhostで開いてください。';
})();
