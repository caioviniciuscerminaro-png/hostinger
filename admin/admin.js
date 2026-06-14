(function(){
  "use strict";

  const PASSWORD_KEY = "recupere_admin_password_v4";
  const PAGE_SIZE = 20;
  const QUESTION_LABELS = {
    age:"Faixa etaria",pilates:"Experiencia com Pilates",complaint:"Incomodo principal",region:"Regioes de dor",
    duration:"Tempo de dor",tried:"O que ja tentou",limitation:"Condicoes associadas",flexibility:"Flexibilidade",
    morning:"Como acorda",activity:"Movimentos do dia",fear:"Impacto emocional",routine:"Rotina",dailyTime:"Tempo diario"
  };
  const UTM_COLUMNS = [
    ["source","Source"],["medium","Medium"],["campaign","Campanha"],["content","Criativo"],["term","Term"],
    ["visitors","Visitantes"],["visits","Visitas"],["p1","P1"],["p5","P5"],["p10","P10"],["p15","P15"],
    ["completed","Concluiu"],["result","Resultado"],["video2","Video 2"],["offer","Oferta"],["checkout","Checkout"],
    ["exitViewed","Saida vista"],["exitAccepted","Saida aceita"],["checkoutRate","Taxa checkout"]
  ];
  const state = {data:null,password:"",utmPage:1,visitorPage:1,utmSort:{key:"visitors",direction:-1}};
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const demoMode = new URLSearchParams(location.search).get("demo") === "1";

  function escapeHtml(value){return String(value == null ? "" : value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);}
  function number(value){const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;}
  function percent(part,total){return total?Math.round(part/total*1000)/10:0;}
  function formatNumber(value){return number(value).toLocaleString("pt-BR");}
  function formatSeconds(value){const seconds=Math.max(0,Math.round(number(value)));if(seconds<60)return seconds+"s";const minutes=Math.floor(seconds/60);return minutes+"m "+(seconds%60)+"s";}
  function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?"-":date.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}
  function getPassword(){try{return localStorage.getItem(PASSWORD_KEY)||""}catch(_){return ""}}
  function savePassword(value){try{localStorage.setItem(PASSWORD_KEY,value)}catch(_){}}
  function clearPassword(){try{localStorage.removeItem(PASSWORD_KEY)}catch(_){}}

  function currentFilters(){
    return {dateFrom:$("#dateFrom").value,dateTo:$("#dateTo").value,utmSource:$("#utmSource").value,utmMedium:$("#utmMedium").value,
      utmCampaign:$("#utmCampaign").value,utmContent:$("#utmContent").value,utmTerm:$("#utmTerm").value,region:$("#region").value,
      city:$("#city").value,device:$("#device").value,resultLevel:$("#resultLevel").value};
  }

  async function apiRequest(action,password,filters){
    const url=new URL("../api/admin-proxy.php",location.href);url.searchParams.set("action",action);url.searchParams.set("password",password);url.searchParams.set("_t",Date.now());
    Object.entries(filters||{}).forEach(([key,value])=>{if(value)url.searchParams.set(key,value)});
    const response=await fetch(url.toString(),{cache:"no-store"});const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok===false){const error=new Error(data.error==="unauthorized"?"Senha incorreta.":data.error==="not_configured"?"A URL do Apps Script ainda nao foi configurada no servidor.":(data.error||"Nao foi possivel carregar o painel."));error.code=data.error;throw error;}
    return data;
  }

  async function loadData(password){
    setStatus("Atualizando dados...",false);$("#errorState").classList.add("hidden");
    try{
      const data=demoMode?demoData():await apiRequest("stats",password,currentFilters());
      state.password=password;state.data=data;savePassword(password);populateFilters(data.options||{});renderAll();
      $("#loginOverlay").classList.add("hidden");$("#loginError").textContent="";
      setStatus("Atualizado em "+formatDate(data.generatedAt)+" · "+formatNumber(data.summary.uniqueVisitors)+" visitantes unicos · "+formatNumber(data.summary.totalVisits)+" visitas analisadas",false);
    }catch(error){
      $("#errorState").textContent="Erro ao carregar: "+error.message;$("#errorState").classList.remove("hidden");
      $("#loginError").textContent=error.message;$("#loginOverlay").classList.remove("hidden");setStatus("Falha na conexao com os dados.",true);
    }
  }

  function setStatus(message,isError){const strip=$("#statusStrip");strip.textContent=message;strip.style.color=isError?"#9e2933":"";strip.style.background=isError?"#fde8eb":"";}

  function populateFilters(options){
    const mapping={utmSource:options.utmSources,utmMedium:options.utmMediums,utmCampaign:options.utmCampaigns,utmContent:options.utmContents,utmTerm:options.utmTerms,region:options.regions,city:options.cities,device:options.devices,resultLevel:options.resultLevels};
    Object.entries(mapping).forEach(([id,values])=>fillSelect($("#"+id),values));
    fillSelect($("#utmTableSource"),options.utmSources);fillSelect($("#utmTableMedium"),options.utmMediums);fillSelect($("#utmTableCampaign"),options.utmCampaigns);fillSelect($("#utmTableContent"),options.utmContents);fillSelect($("#utmTableTerm"),options.utmTerms);
  }

  function fillSelect(select,values){
    if(!select)return;const current=select.value;const first=select.options[0]?select.options[0].outerHTML:'<option value="">Todos</option>';
    select.innerHTML=first+(values||[]).map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    if(Array.from(select.options).some(option=>option.value===current))select.value=current;
  }

  function renderAll(){renderSummary();renderFunnel();renderUtm();renderConversions();renderTraffic();renderDropoffs();renderGeo();renderVisitors();renderAudience();}

  function renderSummary(){
    const s=state.data.summary||{};const cards=[
      ["Visitantes unicos",s.uniqueVisitors,formatNumber(s.totalVisits)+" visitas no total"],
      ["Concluiram o diagnostico",s.quizCompleted,(s.completionRate||0)+"% dos visitantes"],
      ["Viram a oferta",s.offerViewed,percent(s.offerViewed,s.uniqueVisitors)+"% dos visitantes"],
      ["Cliques no checkout",s.checkoutClicked,(s.checkoutRate||0)+"% de quem viu a oferta"],
      ["Visitantes recorrentes",s.repeatVisitors,percent(s.repeatVisitors,s.uniqueVisitors)+"% retornaram"],
      ["Media de visitas",s.averageVisits,"por visitante"],
      ["Tempo ate concluir",formatSeconds(s.averageCompletionSeconds),"media entre inicio e diagnostico"],
      ["Assistiram ao Video 2",s.video2Started,percent(s.video2Started,s.resultViewed||s.uniqueVisitors)+"% apos o resultado"],
      ["Popup de saida",s.exitPopupViewed,(s.exitAcceptanceRate||0)+"% aceitaram a oferta"],
      ["Aceites do desconto",s.exitPopupAccepted,"condicao especial ativada"]
    ];
    $("#summaryCards").innerHTML=cards.map(card=>`<article class="metric"><small>${escapeHtml(card[0])}</small><strong>${escapeHtml(card[1])}</strong><span>${escapeHtml(card[2])}</span></article>`).join("");
  }

  function renderFunnel(){
    const rows=state.data.funnel||[];const max=Math.max(1,...rows.map(row=>number(row.viewed)));
    $("#funnelBars").innerHTML=rows.map((row,index)=>`<div class="funnel-row"><span>${index+1}. ${escapeHtml(row.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,number(row.viewed)/max*100)}%"></div></div><strong>${percent(row.viewed,state.data.summary.uniqueVisitors)}%</strong></div>`).join("");
    $("#funnelTable").innerHTML=rows.map((row,index)=>`<tr><td>${index+1}. ${escapeHtml(row.label)}</td><td>${formatNumber(row.viewed)}</td><td>${formatNumber(row.advanced)}</td><td>${number(row.retention)}%</td><td>${formatNumber(row.abandonment)}</td><td>${formatSeconds(row.averageSeconds)}</td></tr>`).join("");
  }

  function filteredUtmRecords(){
    const search=$("#utmSearch").value.trim().toLowerCase();const filters={source:$("#utmTableSource").value,medium:$("#utmTableMedium").value,campaign:$("#utmTableCampaign").value,content:$("#utmTableContent").value,term:$("#utmTableTerm").value};
    return (state.data.utmRecords||[]).filter(row=>{
      if(search&&!Object.values({source:row.source,medium:row.medium,campaign:row.campaign,content:row.content,term:row.term}).join(" ").toLowerCase().includes(search))return false;
      return Object.entries(filters).every(([key,value])=>!value||String(row[key]||"")===value);
    });
  }

  function groupUtm(records){
    const groupKey=$("#utmGroup").value;const groups={};
    records.forEach(row=>{const key=String(row[groupKey]||"sem "+groupKey);if(!groups[key])groups[key]={records:[],source:new Set(),medium:new Set(),campaign:new Set(),content:new Set(),term:new Set(),visitors:0,visits:0,p1:0,p5:0,p10:0,p15:0,completed:0,result:0,video2:0,offer:0,checkout:0,exitViewed:0,exitAccepted:0};const group=groups[key];group.records.push(row);["source","medium","campaign","content","term"].forEach(field=>{if(row[field])group[field].add(row[field])});group.visitors++;["visits","p1","p5","p10","p15","completed","result","video2","offer","checkout","exitViewed","exitAccepted"].forEach(field=>group[field]+=number(row[field]));});
    return Object.values(groups).map(group=>{["source","medium","campaign","content","term"].forEach(field=>{const values=Array.from(group[field]);group[field]=values.length===1?values[0]:values.length>1?"varios":"-"});group.checkoutRate=percent(group.checkout,group.offer||group.visitors);delete group.records;return group;});
  }

  function renderUtm(){
    const rows=groupUtm(filteredUtmRecords());const sort=state.utmSort;rows.sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];if(typeof av==="number"||typeof bv==="number")return(number(av)-number(bv))*sort.direction;return String(av).localeCompare(String(bv),"pt-BR")*sort.direction});
    const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));state.utmPage=Math.min(Math.max(1,state.utmPage),pages);const visible=rows.slice((state.utmPage-1)*PAGE_SIZE,state.utmPage*PAGE_SIZE);
    $("#utmHead").innerHTML="<tr>"+UTM_COLUMNS.map(([key,label])=>`<th class="sortable${sort.key===key?" active":""}" data-sort="${key}">${label}${sort.key===key?(sort.direction<0?" ↓":" ↑"):" ↕"}</th>`).join("")+"</tr>";
    $("#utmBody").innerHTML=visible.length?visible.map(row=>"<tr>"+UTM_COLUMNS.map(([key])=>`<td>${key==="checkoutRate"?number(row[key])+"%":escapeHtml(row[key])}</td>`).join("")+"</tr>").join(""):'<tr><td colspan="19">Nenhum registro encontrado.</td></tr>';
    $("#utmCount").textContent=rows.length+" grupos";$("#utmSortLabel").textContent="Ordenado por "+sort.key+(sort.direction<0?" (decrescente)":" (crescente)");$("#utmPage").textContent=`Pagina ${state.utmPage} de ${pages}`;$("#utmPrev").disabled=state.utmPage<=1;$("#utmNext").disabled=state.utmPage>=pages;
    $$("#utmHead .sortable").forEach(header=>header.addEventListener("click",()=>{const key=header.dataset.sort;state.utmSort=state.utmSort.key===key?{key,direction:state.utmSort.direction*-1}:{key,direction:-1};state.utmPage=1;renderUtm();}));
  }

  function renderConversions(){$("#conversionList").innerHTML=(state.data.conversions||[]).map(row=>`<div class="conversion-item"><span>${escapeHtml(row.label)}<small>${number(row.rate)}%</small></span><strong>${formatNumber(row.count)}</strong></div>`).join("");}
  function renderTraffic(){renderCountList($("#deviceList"),state.data.devices||[]);renderCountList($("#sourceList"),state.data.sources||[]);}
  function renderCountList(target,rows){target.innerHTML=rows.slice(0,8).map(row=>`<div class="traffic-item"><span>${escapeHtml(row.label)}</span><strong>${formatNumber(row.count)}</strong></div>`).join("")||'<div class="traffic-item">Sem dados</div>';}
  function renderDropoffs(){$("#dropoffList").innerHTML=(state.data.dropoffs||[]).map((row,index)=>`<div class="dropoff-item"><strong>#${index+1}. ${escapeHtml(row.label)}</strong><span>Perda<b>${formatNumber(row.abandonment)}</b></span><span>Avanco<b style="color:#17262b">${number(row.retention)}%</b></span><span>Tempo medio<b style="color:#17262b">${formatSeconds(row.averageSeconds)}</b></span></div>`).join("");}

  function renderGeo(){renderGeoList($("#stateList"),state.data.states||[]);renderGeoList($("#cityList"),state.data.cities||[]);}
  function renderGeoList(target,rows){const max=Math.max(1,...rows.map(row=>number(row.count)));target.innerHTML=rows.slice(0,16).map(row=>`<div class="geo-item"><span>${escapeHtml(row.label)}</span><div class="geo-bar"><span style="width:${number(row.count)/max*100}%"></span></div><strong>${formatNumber(row.count)}</strong></div>`).join("")||"Sem dados";}

  function filteredVisitors(){const search=$("#visitorSearch").value.trim().toLowerCase();const checkout=$("#visitorCheckout").value;return(state.data.visitors||[]).filter(row=>{if(search&&!([row.visitorId,row.city,row.region,row.utmSource,row.utmCampaign,row.resultLevel].join(" ").toLowerCase().includes(search)))return false;if(checkout==="yes"&&!row.checkoutClicked)return false;if(checkout==="no"&&row.checkoutClicked)return false;return true;});}
  function renderVisitors(){
    const rows=filteredVisitors();const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));state.visitorPage=Math.min(Math.max(1,state.visitorPage),pages);const visible=rows.slice((state.visitorPage-1)*PAGE_SIZE,state.visitorPage*PAGE_SIZE);
    $("#visitorBody").innerHTML=visible.length?visible.map((row,index)=>`<tr><td>${formatDate(row.updatedAt)}</td><td><strong>${escapeHtml(shortId(row.visitorId))}</strong></td><td><strong>${escapeHtml(row.city||"Nao identificado")}</strong><br><small>${escapeHtml(row.region||row.country||"")}</small></td><td>${formatNumber(row.visitCount)}</td><td>${formatNumber(row.maxStepIndex)}/22<br><small>${escapeHtml(row.currentStep)}</small></td><td>${escapeHtml(row.resultLevel||"-")}</td><td>${escapeHtml(row.utmSource||"direto")}</td><td><span class="status-pill${row.checkoutClicked?" yes":""}">${row.checkoutClicked?"Clicou":"Nao clicou"}</span></td><td><button class="answer-button" data-visitor="${escapeHtml(row.visitorId)}" type="button">Ver respostas</button></td></tr>`).join(""):'<tr><td colspan="9">Nenhum visitante encontrado.</td></tr>';
    $("#visitorPage").textContent=`Pagina ${state.visitorPage} de ${pages} · ${rows.length} visitantes`;$("#visitorPrev").disabled=state.visitorPage<=1;$("#visitorNext").disabled=state.visitorPage>=pages;
    $$(".answer-button").forEach(button=>button.addEventListener("click",()=>openAnswers(button.dataset.visitor)));
  }

  function shortId(value){const clean=String(value||"");return clean.length>16?clean.slice(0,8)+"..."+clean.slice(-5):clean||"-";}
  function openAnswers(visitorId){const row=(state.data.visitors||[]).find(item=>String(item.visitorId)===String(visitorId));if(!row)return;$("#modalTitle").textContent="Respostas de "+shortId(row.visitorId);const answers=row.answers||{};const items=Object.keys(QUESTION_LABELS).map(key=>`<div class="answer-row"><small>${escapeHtml(QUESTION_LABELS[key])}</small><strong>${escapeHtml(formatAnswer(answers[key]))}</strong></div>`);items.push(`<div class="answer-row"><small>Resultado</small><strong>${escapeHtml(row.resultLevel||"Nao concluido")}</strong></div>`);items.push(`<div class="answer-row"><small>Origem</small><strong>${escapeHtml([row.utmSource,row.utmCampaign,row.utmContent].filter(Boolean).join(" · ")||"direto")}</strong></div>`);$("#modalContent").innerHTML='<div class="answer-grid">'+items.join("")+'</div>';$("#answerModal").classList.remove("hidden");}
  function formatAnswer(value){if(value==null||value==="")return"Nao respondeu";return Array.isArray(value)?value.join(", "):String(value);}

  function renderAudience(){
    const s=state.data.summary||{};const highIntent=(state.data.visitors||[]).filter(row=>row.offerViewed||row.checkoutClicked||row.exitPopupAccepted).length;
    $("#audienceSummary").innerHTML=[["Publico analisado",s.uniqueVisitors],["Alta intencao",highIntent],["Taxa de conclusao",(s.completionRate||0)+"%"],["Taxa de checkout",(s.checkoutRate||0)+"%"]].map(row=>`<article class="audience-card"><span>${escapeHtml(row[0])}</span><strong>${escapeHtml(row[1])}</strong></article>`).join("");
    $("#insightList").innerHTML=(state.data.insights||[]).map(item=>`<li>${escapeHtml(item)}</li>`).join("")||"<li>Ainda nao ha volume suficiente para gerar insights.</li>";
    const total=Object.fromEntries((state.data.distributions||[]).map(block=>[block.key,block]));const intent=Object.fromEntries((state.data.highIntentDistributions||[]).map(block=>[block.key,block]));
    $("#distributionGrid").innerHTML=Object.keys(total).map(key=>{const all=total[key],focused=intent[key]||{values:[]};return`<article class="distribution-card"><h3>${escapeHtml(all.label)}</h3><div class="distribution-columns"><div><h4>Publico total</h4>${distributionRows(all.values)}</div><div><h4>Alta intencao</h4>${distributionRows(focused.values)}</div></div></article>`}).join("");
  }
  function distributionRows(rows){return(rows||[]).slice(0,7).map(row=>`<div class="dist-row"><span>${escapeHtml(row.label)}</span><strong>${formatNumber(row.count)}</strong></div>`).join("")||'<div class="dist-row"><span>Sem dados</span><strong>-</strong></div>';}

  function clearGeneralFilters(){["dateFrom","dateTo","utmSource","utmMedium","utmCampaign","utmContent","utmTerm","region","city","device","resultLevel"].forEach(id=>$("#"+id).value="");loadData(state.password);}
  function clearTableFilters(){["utmSearch","utmTableSource","utmTableMedium","utmTableCampaign","utmTableContent","utmTableTerm"].forEach(id=>$("#"+id).value="");state.utmPage=1;renderUtm();}

  async function runMaintenance(){if(demoMode){alert("Modo demonstracao: nenhuma planilha foi alterada.");return}if(!confirm("Consolidar agora as linhas antigas duplicadas por visitante?"))return;setStatus("Consolidando linhas duplicadas...",false);try{const result=await apiRequest("deduplicate",state.password,{});setStatus(`Consolidacao concluida: ${result.removed||0} linhas duplicadas removidas.`,false);await loadData(state.password);}catch(error){setStatus("Falha na consolidacao: "+error.message,true);}}

  function bindEvents(){
    $("#loginForm").addEventListener("submit",event=>{event.preventDefault();loadData($("#loginPassword").value)});$("#refreshBtn").addEventListener("click",()=>loadData(state.password));$("#applyFilters").addEventListener("click",()=>{state.utmPage=1;state.visitorPage=1;loadData(state.password)});$("#clearFilters").addEventListener("click",clearGeneralFilters);$("#maintenanceBtn").addEventListener("click",runMaintenance);
    $("#logoutBtn").addEventListener("click",()=>{clearPassword();state.password="";$("#loginPassword").value="";$("#loginOverlay").classList.remove("hidden")});
    $$(".tab").forEach(tab=>tab.addEventListener("click",()=>{$$(".tab").forEach(item=>item.classList.toggle("active",item===tab));$$(".tab-panel").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===tab.dataset.tab))}));
    ["utmSearch","utmGroup","utmTableSource","utmTableMedium","utmTableCampaign","utmTableContent","utmTableTerm"].forEach(id=>$("#"+id).addEventListener(id==="utmSearch"?"input":"change",()=>{state.utmPage=1;renderUtm()}));$("#clearUtmTable").addEventListener("click",clearTableFilters);$("#utmPrev").addEventListener("click",()=>{state.utmPage--;renderUtm()});$("#utmNext").addEventListener("click",()=>{state.utmPage++;renderUtm()});
    $("#visitorSearch").addEventListener("input",()=>{state.visitorPage=1;renderVisitors()});$("#visitorCheckout").addEventListener("change",()=>{state.visitorPage=1;renderVisitors()});$("#visitorPrev").addEventListener("click",()=>{state.visitorPage--;renderVisitors()});$("#visitorNext").addEventListener("click",()=>{state.visitorPage++;renderVisitors()});
    $("#closeModal").addEventListener("click",()=>$("#answerModal").classList.add("hidden"));$("#answerModal").addEventListener("click",event=>{if(event.target===$("#answerModal"))$("#answerModal").classList.add("hidden")});
  }

  function demoData(){
    const stepLabels=["Faixa etaria","Boas-vindas","Experiencia com Pilates","Conceito","Incomodo principal","Regioes de dor","Leitura inicial","Tempo de dor","O que ja tentou","Diagnostico parcial","Video 1","Condicoes associadas","Flexibilidade","Como acorda","Movimentos do dia","Impacto emocional","Rotina","Tempo diario","Processamento","Resultado","Video 2","Oferta"];
    const visitorCount=73;const records=[];const visitors=[];const sources=["FB","Instagram","direto","Google"];const campaigns=["RECUPERE_TESTE","MOBILIDADE","ORGANICO"];const contents=["02","08","19_video","25_mecanismo","carrossel"];const cities=["Sao Paulo","Rio de Janeiro","Porto Alegre","Goiania","Recife","Belo Horizonte"];const regions=["Sao Paulo","Rio de Janeiro","Rio Grande do Sul","Goias","Pernambuco","Minas Gerais"];const devices=["mobile","mobile","mobile","tablet","desktop"];
    for(let i=0;i<visitorCount;i++){const max=Math.max(1,22-Math.floor((i%17)/2));const completed=max>=19;const offer=max>=22;const checkout=offer&&i%7===0;const source=sources[i%sources.length];const record={source,medium:source==="FB"?"paid_social":"organic",campaign:campaigns[i%campaigns.length],content:contents[i%contents.length],term:i%3?"mobilidade":"dor lombar",visits:1+(i%9===0?1:0),p1:1,p5:max>=5?1:0,p10:max>=10?1:0,p15:max>=15?1:0,completed:completed?1:0,result:max>=20?1:0,video2:max>=21?1:0,offer:offer?1:0,checkout:checkout?1:0,exitViewed:offer&&i%4===0?1:0,exitAccepted:offer&&i%12===0?1:0};records.push(record);visitors.push({updatedAt:new Date(Date.now()-i*3600000).toISOString(),firstSeen:new Date(Date.now()-i*3900000).toISOString(),visitorId:"rcv_demo_"+String(i+1).padStart(4,"0"),visitCount:record.visits,device:devices[i%devices.length],country:"Brasil",region:regions[i%regions.length],city:cities[i%cities.length],currentStep:stepLabels[max-1],maxStepIndex:max,resultLevel:completed?["Leve","Moderada","Avancada"][i%3]:"",complaint:["lombar","cervical","mobilidade"][i%3],age:["40-49","50-59","60+"][i%3],routine:["seated","standing","mixed"][i%3],dailyTime:["5","10","15"][i%3],offerViewed:offer,checkoutClicked:checkout,exitPopupAccepted:record.exitAccepted===1,utmSource:source,utmMedium:record.medium,utmCampaign:record.campaign,utmContent:record.content,utmTerm:record.term,answers:{age:["40-49","50-59","60+"][i%3],complaint:["lumbar","neck","mobility"][i%3],region:["lumbar","shoulders"],duration:"months",tried:"stretch",routine:["seated","standing","mixed"][i%3],dailyTime:["5","10","15"][i%3]},result:{level:completed?["Leve","Moderada","Avancada"][i%3]:""}});}
    const funnel=stepLabels.map((label,index)=>{const viewed=visitors.filter(v=>v.maxStepIndex>=index+1).length;const advanced=index<21?visitors.filter(v=>v.maxStepIndex>=index+2).length:visitors.filter(v=>v.checkoutClicked).length;return{stepId:"s"+index,label,viewed,advanced,retention:percent(advanced,viewed),abandonment:Math.max(0,viewed-advanced),averageSeconds:11+(index%5)*5}});const summary={uniqueVisitors:visitorCount,totalVisits:visitors.reduce((t,v)=>t+v.visitCount,0),repeatVisitors:visitors.filter(v=>v.visitCount>1).length,quizStarted:visitorCount,quizCompleted:visitors.filter(v=>v.maxStepIndex>=19).length,resultViewed:visitors.filter(v=>v.maxStepIndex>=20).length,video1Started:visitors.filter(v=>v.maxStepIndex>=11).length,video2Started:visitors.filter(v=>v.maxStepIndex>=21).length,offerViewed:visitors.filter(v=>v.offerViewed).length,checkoutClicked:visitors.filter(v=>v.checkoutClicked).length,exitPopupViewed:records.reduce((t,r)=>t+r.exitViewed,0),exitPopupAccepted:records.reduce((t,r)=>t+r.exitAccepted,0),averageVisits:1.1,completionRate:percent(visitors.filter(v=>v.maxStepIndex>=19).length,visitorCount),checkoutRate:percent(visitors.filter(v=>v.checkoutClicked).length,visitors.filter(v=>v.offerViewed).length),exitAcceptanceRate:percent(records.reduce((t,r)=>t+r.exitAccepted,0),records.reduce((t,r)=>t+r.exitViewed,0)),averageCompletionSeconds:276};
    const counts=key=>Object.entries(visitors.reduce((acc,row)=>{const value=row[key]||"Nao identificado";acc[value]=(acc[value]||0)+1;return acc},{})).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);const distributions=[{key:"age",label:"Faixa etaria",values:[{label:"50-59",count:25},{label:"40-49",count:24},{label:"60+",count:24}]},{key:"complaint",label:"Incomodo principal",values:[{label:"lombar",count:25},{label:"cervical",count:24},{label:"mobilidade",count:24}]},{key:"routine",label:"Rotina",values:[{label:"sentada",count:25},{label:"em pe",count:24},{label:"mista",count:24}]},{key:"dailyTime",label:"Tempo diario",values:[{label:"5 minutos",count:25},{label:"10 minutos",count:24},{label:"15 minutos",count:24}]}];
    return{ok:true,generatedAt:new Date().toISOString(),summary,funnel,dropoffs:funnel.slice().sort((a,b)=>b.abandonment-a.abandonment).slice(0,5),conversions:[["Iniciaram o quiz",summary.quizStarted],["Assistiram ao Video 1",summary.video1Started],["Concluiram o diagnostico",summary.quizCompleted],["Viram o resultado",summary.resultViewed],["Viram a oferta",summary.offerViewed],["Clicaram no checkout",summary.checkoutClicked]].map(([label,count])=>({label,count,rate:percent(count,visitorCount)})),devices:counts("device"),sources:counts("utmSource"),countries:[{label:"Brasil",count:73}],states:counts("region"),cities:counts("city"),distributions,highIntentDistributions:distributions.map(block=>({...block,values:block.values.map(row=>({...row,count:Math.max(1,Math.floor(row.count*.32))}))})),utmRecords:records,visitors,options:{utmSources:sources,utmMediums:["paid_social","organic"],utmCampaigns:campaigns,utmContents:contents,utmTerms:["mobilidade","dor lombar"],regions,cities,devices:["mobile","tablet","desktop"],resultLevels:["Leve","Moderada","Avancada"]},insights:["A dor lombar aparece como principal porta de entrada do publico.","Visitantes recorrentes chegam mais longe no funil do que visitantes de uma unica sessao.","O Video 2 concentra uma oportunidade de retencao antes da oferta.","Mobile domina o trafego e deve continuar sendo a referencia de layout."]};
  }

  bindEvents();
  if(demoMode){loadData("demo");return}const saved=getPassword();if(saved){$("#loginPassword").value=saved;loadData(saved)}else{$("#loginOverlay").classList.remove("hidden")}
})();
