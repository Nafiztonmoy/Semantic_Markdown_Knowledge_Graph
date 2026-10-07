// Platform-independent regression runner. Uses the project's existing React,
// TypeScript, jsdom, and Testing Library packages, without native bundlers.
const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const Module=require('node:module');
const ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000'});
global.window=dom.window;global.location=dom.window.location;global.document=dom.window.document;Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.HTMLElement=dom.window.HTMLElement;global.HTMLDialogElement=dom.window.HTMLDialogElement;global.IS_REACT_ACT_ENVIRONMENT=true;
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
const React=require('react');const {render,screen,fireEvent,cleanup,act,waitFor}=require('@testing-library/react');
let searchImpl=async()=>({items:[]});let pushed=[];let role='owner';let updates=[];const mockApi={search:(...args)=>searchImpl(...args),updateDocument:async(id,payload)=>{updates.push({id,...payload});return {id,...payload,version_number:2,tags:payload.tags.map(name=>({name}))};},createDocument:async(_id,payload)=>{updates.push(payload);return {id:'created',...payload};},listRevisions:async()=>[]};
const original=Module._load;
Module._load=function(id,parent,isMain){if(id==='next/link')return function Link({href,children,...rest}){return React.createElement('a',{href,...rest,onClick:e=>{e.preventDefault();rest.onClick?.(e);}},children);};if(id==='next/navigation')return{useRouter:()=>({push:(href)=>pushed.push(href)})};if(id==='@/lib/api')return{api:mockApi};if(id==='@/lib/workspaceContext')return{useWorkspace:()=>({workspace:{user_role:role}})};if(id==='@uiw/react-codemirror')return function Editor(props){return React.createElement('textarea',{'aria-label':'Markdown source',value:props.value,onChange:e=>props.onChange(e.target.value)});};if(id.startsWith('@/'))id=path.resolve(__dirname,'../src',id.slice(2));return original.call(this,id,parent,isMain);};
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {CommandPaletteModal}=require('../src/components/CommandPaletteModal.tsx');
const {SearchField,ConfirmDialog,Snippet}=require('../src/components/ui.tsx');
const {documentHref}=require('../src/lib/documentLinks.ts');
const el=React.createElement;const pause=ms=>act(()=>new Promise(resolve=>setTimeout(resolve,ms)));
afterEach(()=>{cleanup();searchImpl=async()=>({items:[]});pushed=[];role='owner';updates=[];});
test('closed command palette does not mount a dialog',()=>{const {container}=render(el(CommandPaletteModal,{workspaceId:'ws',isOpen:false,onClose(){}}));assert.equal(container.childElementCount,0);});
test('search modes expose selection to assistive technology',()=>{render(el(CommandPaletteModal,{workspaceId:'ws',isOpen:true,onClose(){}}));const button=screen.getByRole('button',{name:'Keyword',exact:true});fireEvent.click(button);assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(screen.getByRole('button',{name:'Hybrid (RRF)'}).getAttribute('aria-pressed'),'false');});
test('clearing a search updates immediately and returns input focus',()=>{function Harness(){const [value,setValue]=React.useState('cache');return el(SearchField,{value,onChange:setValue});}render(el(Harness));fireEvent.click(screen.getByRole('button',{name:'Clear search'}));const input=screen.getByRole('searchbox');assert.equal(input.value,'');assert.equal(document.activeElement,input);});
test('search results are real links into the cited source section',async()=>{searchImpl=async()=>({items:[{title:'Caching strategy',document_id:'doc1',section_id:'sec1',heading_path:'Caching > TTL',snippet:'Use <b>Redis</b> for short-lived entries.'}]});let closed=0;render(el(CommandPaletteModal,{workspaceId:'ws',isOpen:true,onClose(){closed++;}}));fireEvent.change(screen.getByRole('searchbox'),{target:{value:'cache'}});await pause(350);const link=screen.getByRole('link',{name:/Caching strategy/});assert.equal(link.getAttribute('href'),'/workspaces/ws/documents/doc1#section-sec1');fireEvent.click(link);assert.equal(closed,1);});
test('late search responses cannot replace newer results',async()=>{let resolveOld;searchImpl=(_ws,p)=>p.q==='old'?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve({items:[{title:'New result',document_id:'new',section_id:'new',snippet:''}]});render(el(CommandPaletteModal,{workspaceId:'ws',isOpen:true,onClose(){}}));fireEvent.change(screen.getByRole('searchbox'),{target:{value:'old'}});await pause(330);fireEvent.change(screen.getByRole('searchbox'),{target:{value:'new'}});await pause(330);await act(async()=>resolveOld({items:[{title:'Stale result',document_id:'old',section_id:'old'}]}));assert.ok(screen.getByRole('link',{name:/New result/}));assert.equal(screen.queryByText('Stale result'),null);});
test('search errors are actionable and not presented as empty results',async()=>{searchImpl=async()=>{throw new Error('Search service unavailable');};render(el(CommandPaletteModal,{workspaceId:'ws',isOpen:true,onClose(){}}));fireEvent.change(screen.getByRole('searchbox'),{target:{value:'cache'}});await pause(330);assert.match(screen.getByRole('alert').textContent,/Search service unavailable/);assert.equal(screen.queryByText(/No documents matched/),null);});
test('IME composition waits before searching',async()=>{let requests=0;searchImpl=async()=>{requests++;return {items:[]};};render(el(CommandPaletteModal,{workspaceId:'ws',isOpen:true,onClose(){}}));const input=screen.getByRole('searchbox');fireEvent.compositionStart(input);fireEvent.change(input,{target:{value:'database'}});await pause(330);assert.equal(requests,0);fireEvent.compositionEnd(input);await pause(330);assert.equal(requests,1);});
test('destructive dialog cancellation never invokes the action',()=>{let confirmed=0,closed=0;render(el(ConfirmDialog,{open:true,title:'Delete document?',description:'This document can be restored.',onClose(){closed++;},onConfirm(){confirmed++;}}));fireEvent.click(screen.getByRole('button',{name:'Cancel'}));assert.equal(closed,1);assert.equal(confirmed,0);});
test('snippets highlight supported marks without injecting HTML',()=>{const {container}=render(el(Snippet,{text:'<img src=x onerror=alert(1)> and <mark>cache</mark>'}));assert.equal(container.querySelector('img'),null);assert.equal(container.querySelector('mark').textContent,'cache');assert.match(container.textContent,/<img/);});
test('citation URLs prefer exact section identity',()=>{assert.equal(documentHref('ws',{document_id:'doc',section_id:'s2',heading_path:'A > B'}),'/workspaces/ws/documents/doc#section-s2');assert.equal(documentHref('ws',{document_id:'doc',heading_path:'A > Cache Strategy'}),'/workspaces/ws/documents/doc#cache-strategy');});

const {MarkdownEditor}=require('../src/components/MarkdownEditor.tsx');
const initialDocument={id:'doc1',title:'Architecture',markdown:'# Architecture\n\nOriginal notes.',version_number:1,tags:[{name:'backend'}],sections:[],outgoing_links:[],backlinks:[],related_documents:[]};
test('saving edits preserves the current title, Markdown, and tags',async()=>{
 render(el(MarkdownEditor,{workspaceId:'ws',initialDocument}));
 fireEvent.change(screen.getByRole('textbox',{name:'Document Title'}),{target:{value:'Architecture decisions'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Markdown source'}),{target:{value:'# Architecture decisions\n\nNew content.'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Add tag'}),{target:{value:'design'}});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'Add tag'}),{key:'Enter'});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save',exact:true})));
 assert.equal(updates.length,1);assert.equal(updates[0].title,'Architecture decisions');assert.deepEqual(updates[0].tags,['backend','design']);assert.match(updates[0].markdown,/New content/);
 assert.match(screen.getByRole('status').textContent,/All changes saved/);
});
test('viewer receives a read-only preview without editing actions',()=>{
 role='viewer';render(el(MarkdownEditor,{workspaceId:'ws',initialDocument}));
 assert.equal(screen.queryByRole('button',{name:'Save',exact:true}),null);
 assert.equal(screen.getByRole('textbox',{name:'Document Title'}).readOnly,true);
 assert.equal(screen.queryByRole('textbox',{name:'Markdown source'}),null);
 assert.ok(screen.getByText(/Viewer access/));
});
test('title and tag edits are included in debounced autosave',async()=>{
 render(el(MarkdownEditor,{workspaceId:'ws',initialDocument}));
 fireEvent.change(screen.getByRole('textbox',{name:'Document Title'}),{target:{value:'Saved automatically'}});
 fireEvent.change(screen.getByRole('textbox',{name:'Add tag'}),{target:{value:'autosave'}});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'Add tag'}),{key:'Enter'});
 await pause(3100);assert.equal(updates.length,1);assert.equal(updates[0].title,'Saved automatically');assert.deepEqual(updates[0].tags,['backend','autosave']);
});
test('new documents are saved only by an explicit Save action',async()=>{
 render(el(MarkdownEditor,{workspaceId:'ws',isNew:true}));
 fireEvent.change(screen.getByRole('textbox',{name:'Document Title'}),{target:{value:'New note'}});
 await pause(3100);assert.equal(updates.length,0);
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Save',exact:true})));assert.equal(updates.length,1);
});
test('preview headings include exact section citation targets',()=>{
 const doc={...initialDocument,sections:[{id:'sec1',heading_path:'Architecture'}]};
 render(el(MarkdownEditor,{workspaceId:'ws',initialDocument:doc}));
 assert.ok(document.getElementById('section-sec1'));assert.ok(document.getElementById('architecture'));
});
