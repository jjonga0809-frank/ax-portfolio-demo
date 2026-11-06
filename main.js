const $ = id => document.getElementById(id);
const status = $('status');
const API = 'https://api.github.com';
const HEADERS = {Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
const escapeHTML = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function usernameFromInput(raw){
 const value=raw.trim();
 if(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value))return value;
 let url;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:'||!['github.com','www.github.com'].includes(url.hostname))return null;
 const path=url.pathname.split('/').filter(Boolean);
 return path.length===1&&/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(path[0])?path[0]:null;
}
async function getJSON(url,{optional=false}={}){
 const r=await fetch(url,{headers:HEADERS});
 if(optional&&r.status===404)return null;
 if(!r.ok){let reason=`HTTP ${r.status}`;if(r.status===404)reason='자료를 찾을 수 없습니다 (404)';if(r.status===403||r.status===429)reason='GitHub API 요청 제한 또는 접근 거부';throw new Error(reason);}
 return r.json();
}
function message(s,kind='progress'){status.innerHTML=`<div class="${kind}">${escapeHTML(s)}</div>`;}
// Metadata and README provide evidence of repository contents, NOT a person's contribution or proficiency.
const SKILLS=[
 {name:'Python',files:/\.py$/i,readme:/\bpython\b/i},
 {name:'JavaScript',files:/\.(js|jsx|mjs)$/i,readme:/\bjavascript\b/i},
 {name:'TypeScript',files:/\.(ts|tsx)$/i,readme:/\btypescript\b/i},
 {name:'React',files:/\.(jsx|tsx)$/i,readme:/\breact\b/i},
 {name:'SQL',files:/\.sql$/i,readme:/\b(sql|postgresql|mysql|sqlite)\b/i},
 {name:'Docker',files:/(^|\/)Dockerfile$|(^|\/)compose\.ya?ml$/i,readme:/\bdocker\b/i},
 {name:'Jupyter',files:/\.ipynb$/i,readme:/\b(jupyter|notebook)\b/i},
 {name:'PyTorch',files:null,readme:/\b(pytorch|torch)\b/i},
 {name:'TensorFlow',files:null,readme:/\btensorflow\b/i}
];
function skillEvidence(repo){
 const found=[];
 for(const s of SKILLS){
  const sources=[];
  if(repo.filePaths?.some(p=>s.files?.test(p)))sources.push('파일명');
  if(repo.readmeText&&s.readme.test(repo.readmeText))sources.push('README');
  if(repo.language?.toLowerCase()===s.name.toLowerCase())sources.push('주요 언어');
  if(sources.length)found.push({name:s.name,sources});
 }
 return found;
}
function repoCard(repo){
 const href=escapeHTML(repo.html_url),name=escapeHTML(repo.name);
 const readme=repo.readme==='present'?'README 본문 확인':repo.readme==='missing'?'README 없음':repo.readme==='unknown'?'README 확인 실패':'README 미검사';
 const tags=(repo.topics||[]).map(t=>`<span class="tag">${escapeHTML(t)} · 태그</span>`).join('');
 const evidence=(repo.evidence||[]).map(e=>`<span class="tag">${escapeHTML(e.name)} · ${escapeHTML(e.sources.join('/'))}</span>`).join('');
 const paths=(repo.filePaths||[]).slice(0,16).map(p=>`<li><code>${escapeHTML(p)}</code></li>`).join('');
 const readmeURL=`${repo.html_url}#readme`;
 const detail=repo.inspected?`<details><summary>분석 근거 보기 · ${repo.filePaths?.length||0}개 파일 경로 확인</summary><p class="meta">파일명 및 README의 단어는 기술 사용의 단서일 뿐, 실제 사용 여부·작성자·숙련도는 추가 확인이 필요합니다.</p>${paths?`<ul class="filelist">${paths}</ul>`:'<p class="meta">확인 가능한 파일 경로가 없거나 조회에 실패했습니다.</p>'}${repo.readme==='present'?`<p class="meta"><a href="${escapeHTML(readmeURL)}" target="_blank" rel="noopener noreferrer">원본 README 확인</a> · 본문은 화면에 재게시하지 않음</p>`:''}</details>`:'';
 return `<article class="card"><h3><a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a></h3><p>${escapeHTML(repo.description||'저장소 설명 없음')}</p><p class="meta">주요 언어: ${escapeHTML(repo.language||'미확인')} · ${readme} · ⭐ ${Number(repo.stargazers_count)||0}</p>${tags}<h4>확인된 기술 단서</h4>${evidence||'<p class="meta">추출된 기술 단서 없음 · 기술 미보유를 의미하지 않습니다.</p>'}${detail}<p class="meta">출처: <a href="${href}" target="_blank" rel="noopener noreferrer">GitHub 공개 저장소</a> · 개인 기여도는 확인하지 않았습니다.</p></article>`;
}
async function inspectRepo(username,repo){
 repo.inspected=true;repo.filePaths=[];repo.readmeText='';repo.readme='unknown';repo.errors=[];
 const base=`${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}`;
 // Two bounded requests per inspected repository. No recursive tree or full source downloads.
 const results=await Promise.allSettled([
  getJSON(`${base}/readme`,{optional:true}),
  getJSON(`${base}/git/trees/${encodeURIComponent(repo.default_branch||'HEAD')}?recursive=1`,{optional:true})
 ]);
 const readme=results[0];
 if(readme.status==='fulfilled'){
  if(readme.value===null)repo.readme='missing';
  else if(readme.value?.encoding==='base64'&&readme.value?.content){
   try{
    const binary=atob(readme.value.content.replace(/\s/g,''));
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    repo.readmeText=new TextDecoder('utf-8',{fatal:false}).decode(bytes).slice(0,100000);
    repo.readme='present';
   }catch{repo.readme='unknown';repo.errors.push('README 디코딩 실패');}
  }else{repo.readme='unknown';repo.errors.push('README 본문 형식 미지원');}
 }else repo.errors.push('README API 오류');
 const tree=results[1];
 if(tree.status==='fulfilled'&&tree.value?.tree){
  repo.filePaths=tree.value.tree.filter(f=>f.type==='blob').slice(0,5000).map(f=>f.path);
  if(tree.value.truncated)repo.errors.push('GitHub 트리 응답 일부 생략');
 }else repo.errors.push('파일 구조 조회 실패');
 repo.evidence=skillEvidence(repo);
}
async function analyze(e){
 e.preventDefault();const username=usernameFromInput($('github').value);
 if(!username){message('GitHub 사용자명 또는 https://github.com/사용자명 형식으로 입력하세요.','error');return;}
 $('go').disabled=true;$('workspace').hidden=true;
 try{
  message('1/3 공개 프로필 확인 중…');const profile=await getJSON(`${API}/users/${encodeURIComponent(username)}`);
  if(profile.type!=='User')throw new Error('개인 사용자 프로필만 지원합니다.');
  message('2/3 공개 저장소 목록 조회 중…');let repos=[],partial=false;
  for(let page=1;page<=3;page++){
   const batch=await getJSON(`${API}/users/${encodeURIComponent(username)}/repos?per_page=100&page=${page}&sort=updated`);
   repos.push(...batch.filter(r=>!r.private));if(batch.length<100)break;if(page===3)partial=true;
  }
  const inspected=repos.slice(0,5);
  message(`3/3 최근 저장소 ${inspected.length}개 README 및 파일 구조 분석 중…`);
  // Limit concurrent calls to reduce rate-limit pressure.
  for(const repo of inspected)await inspectRepo(username,repo);
  repos.slice(5).forEach(r=>{r.readme='not_checked';r.evidence=skillEvidence(r);});
  $('profile').innerHTML=`<div class="card"><img class="avatar" src="${escapeHTML(profile.avatar_url)}" alt=""><h2>${escapeHTML(profile.name||profile.login)}</h2><p><a href="${escapeHTML(profile.html_url)}" target="_blank" rel="noopener noreferrer">@${escapeHTML(profile.login)}</a></p><p class="meta">공개 프로필 조회 · 인증 없음 · 확인 시각 ${escapeHTML(new Date().toLocaleString('ko-KR'))}</p><div style="clear:both"></div></div>`;
  $('count').textContent=`조회 ${repos.length}개`;
  const failures=inspected.filter(r=>r.errors.length);
  $('repos').innerHTML=(partial?'<div class="warning">최근 업데이트 순 최대 300개까지만 조회했습니다.</div>':'')+(repos.length>5?'<div class="warning">README와 파일 구조는 최근 저장소 5개만 검사했습니다. 나머지는 메타데이터만 표시합니다.</div>':'')+(failures.length?`<div class="warning">${failures.length}개 저장소에서 일부 분석이 제한되었습니다. 미확인 결과를 기술 부재로 해석하지 마세요.</div>`:'')+(repos.length?repos.map(repoCard).join(''):'<div class="card">공개 저장소가 없습니다.</div>');
  analyzedRepos=repos;
  $('workspace').hidden=false;
  message(`저장소 ${repos.length}개 조회, 최근 ${inspected.length}개 README·파일 구조 검사 완료. 인증·개인 기여도·실제 코드 실행은 수행하지 않았습니다.`);
 }catch(err){message(`분석 실패: ${err.message}. 잠시 후 다시 시도하거나 다른 공개 계정을 입력하세요.`,'error');}
 finally{$('go').disabled=false;}
}
$('search').addEventListener('submit',analyze);
document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==button.dataset.tab);}));


// STEP 5: Educational sample jobs and user-provided text; no third-party job scraping.
const JOB_STORAGE_KEY='ax-portfolio-step5-jobs-v1';
let allJobs=[],selectedJobId=null;
let analyzedRepos=[];
let currentMatch=null;
const safeText=v=>String(v??'').trim();
function getUserJobs(){try{const value=JSON.parse(localStorage.getItem(JOB_STORAGE_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
function persistUserJobs(){try{localStorage.setItem(JOB_STORAGE_KEY,JSON.stringify(allJobs.filter(j=>j.source_type==='user_text'||j.edited)));return true;}catch{return false;}}
function displayJobs(){
 const category=$('job-filter').value,query=$('job-query').value.trim().toLocaleLowerCase();
 const filtered=allJobs.filter(j=>(category==='all'||j.category===category)&&[j.title,j.company,j.duties,j.required,j.preferred,...(j.tags||[])].join(' ').toLocaleLowerCase().includes(query));
 $('job-list').innerHTML=filtered.length?filtered.map(j=>`<article class="card"><h3>${escapeHTML(j.title)}</h3><p class="meta">${escapeHTML(j.company)} · ${j.source_type==='sample'?'가상 예시 / 실제 채용 아님':'사용자 입력 / 사실 미검증'} · 마감일 미확인</p><p>필수: ${escapeHTML(j.required||'미확인')}</p><button type="button" class="job-open" data-id="${escapeHTML(j.id)}">요건 확인·수정</button></article>`).join(''):'<div class="card">조건에 맞는 공고가 없습니다.</div>';
 $('job-status').textContent=`${filtered.length}개 표시 · 실제 채용공고 조회 없음`;
}
function openJob(id){
 const job=allJobs.find(j=>j.id===id);if(!job)return;
 selectedJobId=id;$('job-detail').hidden=false;
 $('detail-title').textContent=job.title;
 $('detail-source').textContent=job.source_type==='sample'?'가상 공고 · 교육용 예시 · 채용 중 아님':`사용자 입력 · 원문 검증하지 않음${job.url?' · URL 직접 입력됨':''}`;
 for(const k of ['duties','required','preferred'])$('detail-'+k).value=job[k]||'';
 $('detail-feedback').textContent='';$('job-detail').scrollIntoView({behavior:'smooth',block:'start'});
}
function parseSections(text){
 const result={duties:'',required:'',preferred:''};let current='duties';
 for(const line of text.split(/\r?\n/)){
  const match=line.match(/^\s*(?:\[|【)?\s*(주요\s*업무|담당\s*업무|하는\s*일|필수\s*(?:요건|자격|사항)|자격\s*요건|지원\s*자격|우대\s*(?:사항|조건|요건))\s*(?:\]|】|:|：|-)?\s*(.*)$/i);
  if(match){const heading=match[1].replace(/\s/g,'');current=/우대/.test(heading)?'preferred':/필수|자격|지원/.test(heading)?'required':'duties';if(match[2])result[current]+=(result[current]?'\n':'')+match[2];}
  else if(line.trim())result[current]+=(result[current]?'\n':'')+line.trim();
 }
 return result;
}
async function initJobs(){
 try{
  const response=await fetch('data/sample-jobs.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const samples=await response.json();if(!Array.isArray(samples))throw new Error('데이터 형식 오류');
  const saved=getUserJobs();allJobs=samples.map(j=>saved.find(s=>s.id===j.id)||j).concat(saved.filter(j=>j.source_type==='user_text'));
  displayJobs();
 }catch(err){$('job-status').innerHTML=`<div class="error">예시 공고를 불러오지 못했습니다: ${escapeHTML(err.message)}. 파일을 직접 열었다면 로컬 서버에서 실행해 주세요.</div>`;}
}
$('job-filter').addEventListener('change',displayJobs);
$('job-query').addEventListener('input',displayJobs);
$('job-list').addEventListener('click',e=>{const btn=e.target.closest('.job-open');if(btn)openJob(btn.dataset.id);});
$('manual-add').addEventListener('click',()=>{
 const title=safeText($('manual-title').value),body=safeText($('manual-body').value),url=safeText($('manual-url').value);
 if(!title||!body){$('job-status').textContent='공고 제목과 본문을 모두 입력하세요.';return;}
 if(url){try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw Error();}catch{$('job-status').textContent='원문 URL은 http(s) 형식만 허용합니다.';return;}}
 const sections=parseSections(body),id=`user-${Date.now()}-${Math.floor(Math.random()*100000)}`;
 const job={id,title,company:'사용자 입력',category:'직접 입력',source_type:'user_text',source:'사용자 제공 텍스트',url:url||null,verified_at:null,deadline:null,tags:[],...sections,raw_text:body};
 allJobs.unshift(job);$('job-filter').value='all';$('job-query').value='';displayJobs();openJob(id);
 $('job-status').textContent=persistUserJobs()?'사용자 공고를 추가했습니다. 요건을 확인하고 수정하세요.':'공고를 추가했지만 브라우저 저장에 실패했습니다.';
});
$('detail-save').addEventListener('click',()=>{
 const job=allJobs.find(j=>j.id===selectedJobId);if(!job)return;
 for(const k of ['duties','required','preferred'])job[k]=safeText($('detail-'+k).value);
 job.edited=true;job.edited_at=new Date().toISOString();
 $('detail-feedback').textContent=persistUserJobs()?'저장 완료 (이 브라우저에만 보관)':'저장 실패: 브라우저 저장 공간 또는 설정을 확인하세요.';
 displayJobs();$('match-results').hidden=true;$('portfolio-builder').hidden=true;currentMatch=null;
});
initJobs();


// STEP 6 — deterministic, explainable weighted maximum coverage.
// Evidence is about public repository content, never authorship or hiring probability.
const MATCH_SKILLS=['Python','JavaScript','TypeScript','React','SQL','Docker','Jupyter','PyTorch','TensorFlow','Git','AWS','C++','C'];
const REQUIRED_WEIGHT=3, PREFERRED_WEIGHT=1;
function skillsInText(text){
 const t=String(text||'');
 const patterns={
  'Python':/\bpython\b/i,'JavaScript':/\bjavascript\b/i,'TypeScript':/\btypescript\b/i,
  'React':/\breact(?:\.js)?\b/i,'SQL':/\b(?:sql|mysql|postgresql|sqlite)\b/i,
  'Docker':/\bdocker\b/i,'Jupyter':/\b(?:jupyter|ipynb)\b/i,
  'PyTorch':/\b(?:pytorch|torch)\b/i,'TensorFlow':/\btensorflow\b/i,
  'Git':/\bgit\b/i,'AWS':/\baws\b|amazon web services/i,
  'C++':/(?:^|[^a-z0-9])c\+\+(?=$|[^a-z0-9])/i,
  'C':/(?:^|[,;\s])c(?=$|[,;\s])/i
 };
 return MATCH_SKILLS.filter(s=>patterns[s].test(t));
}
function requirements(job){
 const required=skillsInText(job.required),preferred=skillsInText(job.preferred).filter(s=>!required.includes(s));
 return [...required.map(name=>({name,weight:REQUIRED_WEIGHT,kind:'필수'})),...preferred.map(name=>({name,weight:PREFERRED_WEIGHT,kind:'우대'}))];
}
function repoSkills(repo){
 const s=new Set((repo.evidence||[]).map(e=>e.name));
 // A repository's GitHub language is a metadata signal, not proof of personal work.
 if(MATCH_SKILLS.includes(repo.language))s.add(repo.language);
 return s;
}
function combinations(arr,k){
 const result=[];
 function walk(start,pick){if(pick.length===k){result.push(pick.slice());return;}for(let i=start;i<=arr.length-(k-pick.length);i++){pick.push(arr[i]);walk(i+1,pick);pick.pop();}}
 walk(0,[]);return result;
}
function optimizeMatch(repos,req,k){
 const weightTotal=req.reduce((sum,r)=>sum+r.weight,0);
 const pool=repos.filter(r=>repoSkills(r).size>0).slice(0,20);
 const maxK=Math.min(k,pool.length);
 let best={chosen:[],covered:[],score:0};
 for(let count=1;count<=maxK;count++){
  for(const chosen of combinations(pool,count)){
   const union=new Set(chosen.flatMap(r=>[...repoSkills(r)]));
   const covered=req.filter(r=>union.has(r.name));
   const score=covered.reduce((sum,r)=>sum+r.weight,0);
   if(score>best.score || (score===best.score && chosen.length<best.chosen.length))best={chosen,covered,score};
  }
 }
 return {...best,weightTotal,percent:weightTotal?100*best.score/weightTotal:0,poolCount:pool.length};
}
function showMatch(){
 const job=allJobs.find(j=>j.id===selectedJobId),out=$('match-results');
 if(!job)return;
 const req=requirements(job),k=Number($('max-projects').value);
 out.hidden=false;
 currentMatch=null;$('portfolio-builder').hidden=true;
 if(!req.length){out.innerHTML='<div class="warning">지원 기술 사전에서 인식한 필수·우대 기술이 없습니다. 공고의 요건을 확인해 주세요. 미인식 기술을 0점으로 평가하지 않습니다.</div>';return;}
 if(!analyzedRepos.length){out.innerHTML='<div class="warning">먼저 상단에서 GitHub 공개 저장소를 분석해 주세요.</div>';return;}
 const result=optimizeMatch(analyzedRepos,req,k);currentMatch={job,req,result,username:usernameFromInput($('github').value)};$('portfolio-builder').hidden=false;$('portfolio-editor').hidden=true;$('portfolio-feedback').textContent='매칭 결과를 바탕으로 초안을 만들 수 있습니다.';const matched=new Set(result.covered.map(r=>r.name));
 const list=req.map(r=>`<li>${escapeHTML(r.name)} (${r.kind}, 가중치 ${r.weight}) — <strong>${matched.has(r.name)?'저장소에서 단서 발견':'분석 범위에서 단서 미발견'}</strong></li>`).join('');
 const selected=result.chosen.map(r=>`<li><a href="${escapeHTML(r.html_url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.name)}</a> — ${escapeHTML([...repoSkills(r)].filter(s=>req.some(x=>x.name===s)).join(', ')||'관련 단서 없음')}</li>`).join('');
 out.innerHTML=`<h3>수학적 매칭 결과 · ${escapeHTML(job.title)}</h3>
 <p><strong>가중 기술 커버리지 ${result.percent.toFixed(1)}%</strong> (${result.score}/${result.weightTotal}점)</p>
 <p class="meta">필수 기술 3점, 우대 기술 1점. 최대 ${k}개 저장소 조합을 완전탐색하여 기술 중복 없이 합산했습니다. 검토 후보는 기술 단서가 있는 최근 저장소 최대 20개입니다.</p>
 <h4>선택된 프로젝트 (${result.chosen.length}개)</h4>${selected?`<ol>${selected}</ol>`:'<p>해당 기술의 단서가 있는 저장소가 없습니다.</p>'}
 <h4>요건별 분석 근거</h4><ul>${list}</ul>
 <p class="warning">이 수치는 공개 저장소의 기술 단서 커버리지이며 채용 합격 확률, 개인 역량, 기여도, 프로젝트 품질을 의미하지 않습니다. README의 단순 언급이나 파일 확장자로 인한 오탐 가능성이 있습니다. 최근 5개 저장소만 상세 검사했으며, 나머지는 메타데이터만 활용했습니다. C/C++·Git·AWS 등은 현재 GitHub 기술 추출 범위에 포함되지 않아 누락될 수 있습니다.</p>`;
 out.scrollIntoView({behavior:'smooth',block:'start'});
}
$('run-match').addEventListener('click',showMatch);


// STEP 7 — transparent deterministic draft; no LLM call or fabricated contribution.
const PORTFOLIO_STORAGE_KEY='ax-portfolio-step7-records-v1';
let activePortfolioId=null;
function getPortfolioRecords(){try{const value=JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
function putPortfolioRecords(records){try{localStorage.setItem(PORTFOLIO_STORAGE_KEY,JSON.stringify(records));return true;}catch{return false;}}
function markdownSafe(v){return String(v??'').replace(/\r/g,'').trim();}
function draftPortfolio(match,contribution,outcome){
 const {job,req,result,username}=match;
 const lines=[`# ${job.title} 지원용 프로젝트 포트폴리오 초안`,'',`> 생성 방식: 규칙 기반 템플릿 (생성형 AI API 미사용)`,`> 채용공고: ${job.source_type==='sample'?'교육용 가상 공고':'사용자 제공 공고 — 진위 미검증'}`,`> GitHub 공개 프로필: https://github.com/${username}`,'', '## 공고에서 요구하는 기술'];
 for(const r of req){lines.push(`- ${r.name} (${r.kind}, 가중치 ${r.weight})`);}
 lines.push('','## 기술 단서 매칭 결과',`- 공개 저장소 기술 단서 커버리지: **${result.score}/${result.weightTotal}점 (${result.percent.toFixed(1)}%)**`,'- 이 점수는 기술 단서의 발견 여부만 반영하며 역량·기여도·합격 가능성을 의미하지 않습니다.','');
 if(result.chosen.length){lines.push('## 선택된 공개 프로젝트');for(const repo of result.chosen){const hits=req.filter(r=>repoSkills(repo).has(r.name));lines.push('',`### ${repo.name}`,`- 원본 저장소: ${repo.html_url}`,`- 공개 저장소 설명: ${markdownSafe(repo.description)||'확인되지 않음'}`,`- 공고 관련 기술 단서: ${hits.length?hits.map(r=>r.name).join(', '):'없음'}`,'- 기술 단서는 저장소의 파일명·README·언어 메타데이터에 기반합니다. 작성자나 실제 사용 경험은 확인되지 않았습니다.');}}
 else lines.push('## 선택된 공개 프로젝트','- 분석 범위에서 일치하는 프로젝트를 찾지 못했습니다.');
 lines.push('','## 본인이 직접 확인한 기여 내용',contribution||'작성 전 확인 필요: 본인의 실제 역할과 기여 내용을 직접 작성하세요.','', '## 검증 가능한 성과',outcome||'작성 전 확인 필요: 실제 검증한 결과만 기재하세요.','', '## 제출 전 확인 사항','- [ ] 프로젝트 소유·기여 여부 확인','- [ ] 기술 키워드가 실제 사용 기술인지 원본 확인','- [ ] 수치·성과·채용공고 출처 확인','- [ ] 저작권·개인정보·AI 사용 표시 확인');
 return lines.join('\n');
}
$('generate-portfolio').addEventListener('click',()=>{
 if(!currentMatch){$('portfolio-feedback').textContent='먼저 수학적 매칭을 계산하세요.';return;}
 const contribution=markdownSafe($('contribution').value),outcome=markdownSafe($('outcome').value);
 $('portfolio-text').value=draftPortfolio(currentMatch,contribution,outcome);
 $('portfolio-editor').hidden=false;activePortfolioId=null;
 $('portfolio-feedback').textContent='템플릿 기반 초안 생성 완료. 아래에서 내용을 직접 검토하고 수정하세요.';
 $('portfolio-editor').scrollIntoView({behavior:'smooth',block:'start'});
});
$('save-portfolio').addEventListener('click',()=>{
 const content=markdownSafe($('portfolio-text').value);if(!content){$('portfolio-feedback').textContent='저장할 본문이 없습니다.';return;}
 const records=getPortfolioRecords(),id=activePortfolioId||`portfolio-${Date.now()}`;
 const record={id,title:currentMatch?.job?.title||'저장된 포트폴리오',content,updatedAt:new Date().toISOString()};
 const i=records.findIndex(r=>r.id===id);if(i>=0)records[i]=record;else records.unshift(record);
 if(putPortfolioRecords(records)){activePortfolioId=id;$('portfolio-feedback').textContent='저장 완료. 포폴기록 탭에서 다시 열 수 있습니다.';renderPortfolioRecords();}
 else $('portfolio-feedback').textContent='저장 실패. 브라우저 저장 공간 또는 개인정보 보호 설정을 확인하세요.';
});
function downloadMarkdown(content,title){
 const blob=new Blob([content],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=(title||'portfolio').replace(/[\\/:*?"<>|]/g,'_').slice(0,70)+'.md';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download-portfolio').addEventListener('click',()=>{
 const content=markdownSafe($('portfolio-text').value);if(content)downloadMarkdown(content,currentMatch?.job?.title||'portfolio');
});
function renderPortfolioRecords(){
 const records=getPortfolioRecords();$('portfolio-records').innerHTML=records.length?records.map(r=>`<article class="card"><h3>${escapeHTML(r.title)}</h3><p class="meta">마지막 저장: ${escapeHTML(new Date(r.updatedAt).toLocaleString('ko-KR'))}</p><button type="button" class="record-open" data-id="${escapeHTML(r.id)}">다시 열기</button> <button type="button" class="record-download" data-id="${escapeHTML(r.id)}">다운로드</button> <button type="button" class="record-delete" data-id="${escapeHTML(r.id)}">삭제</button></article>`).join(''):'<div class="card">아직 저장된 포트폴리오가 없습니다. 추천공고에서 수학적 매칭 후 초안을 생성해 보세요.</div>';
}
$('portfolio-records').addEventListener('click',e=>{
 const btn=e.target.closest('button[data-id]');if(!btn)return;
 const records=getPortfolioRecords(),record=records.find(r=>r.id===btn.dataset.id);if(!record)return;
 if(btn.classList.contains('record-delete')){if(!confirm('이 포트폴리오 기록을 삭제할까요?'))return;putPortfolioRecords(records.filter(r=>r.id!==record.id));renderPortfolioRecords();return;}
 if(btn.classList.contains('record-download')){downloadMarkdown(record.content,record.title);return;}
 if(btn.classList.contains('record-open')){
  // Records can be edited without recomputing the match; no stale job state is assumed.
  document.querySelector('.tab[data-tab="jobs"]').click();
  $('job-detail').hidden=false;$('portfolio-builder').hidden=false;$('portfolio-editor').hidden=false;
  currentMatch=null;$('portfolio-text').value=record.content;activePortfolioId=record.id;
  $('portfolio-feedback').textContent='저장된 초안을 열었습니다. 수정 후 다시 저장할 수 있습니다.';
  $('portfolio-editor').scrollIntoView({behavior:'smooth',block:'start'});
 }
});
renderPortfolioRecords();
