/* Mini-rendu maison (vanilla) : <sc-if>, <sc-for>, {{ chemin }}, onClick, ref — sans framework. */
(function(){
var NS='http://www.w3.org/1999/xhtml',RE=/\{\{\s*([\w.$]+)\s*\}\}/g,WH=/^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/;
var EVS=['onclick','onchange','oninput','onpointerdown','onpointermove','onpointerup'];
function look(s,p){var v=s;p.split('.').forEach(function(k){v=v==null?undefined:v[k];});return v;}
function itp(s,sc){return s.replace(RE,function(m,p){var v=look(sc,p);return(v==null||v===false)?'':String(v);});}
function kids(n,sc){var o=[];n.childNodes.forEach(function(c){mk(c,sc).forEach(function(x){o.push(x);});});return o;}
function mk(n,sc){
  if(n.nodeType===3)return[document.createTextNode(itp(n.data,sc))];
  if(n.nodeType!==1)return[];
  var t=n.localName;
  if(t==='sc-if'){var m=n.getAttribute('value').match(WH);return look(sc,m[1])?kids(n,sc):[];}
  if(t==='sc-for'){var l=look(sc,n.getAttribute('list').match(WH)[1])||[],as=n.getAttribute('as'),out=[];
    l.forEach(function(it,i){var s=Object.create(sc);s[as]=it;s.$i=i;kids(n,s).forEach(function(x){out.push(x);});});return out;}
  var el=n.namespaceURI===NS?document.createElement(t):document.createElementNS(n.namespaceURI,t);
  Array.prototype.slice.call(n.attributes).forEach(function(a){
    var nm=a.name,v=a.value,w=v.match(WH);
    if(nm==='ref'){if(w)el.__ref=look(sc,w[1]);return;}
    if(nm.indexOf('on')===0&&w){el[nm]=look(sc,w[1])||null;return;}
    if(w){var val=look(sc,w[1]);
      if(val===false||val==null){if(nm==='value'&&'value' in el)el.value='';return;}
      if(nm==='value'&&'value' in el){el.value=String(val);el.setAttribute('value',String(val));return;}
      el.setAttribute(nm,String(val));return;}
    el.setAttribute(nm,v.indexOf('{{')>=0?itp(v,sc):v);
  });
  kids(n,sc).forEach(function(c){el.appendChild(c);});
  return[el];
}
function attrs(a,b){
  Array.prototype.slice.call(a.attributes).forEach(function(x){if(!b.hasAttribute(x.name))a.removeAttribute(x.name);});
  Array.prototype.slice.call(b.attributes).forEach(function(x){if(a.getAttribute(x.name)!==x.value)a.setAttribute(x.name,x.value);});
}
function morphKids(a,b){
  var bc=Array.prototype.slice.call(b.childNodes);
  for(var i=0;i<bc.length;i++){
    var x=a.childNodes[i],y=bc[i];
    if(!x){a.appendChild(y);continue;}
    if(x.nodeType===3&&y.nodeType===3){if(x.data!==y.data)x.data=y.data;continue;}
    if(x.nodeType===1&&y.nodeType===1&&x.localName===y.localName&&x.namespaceURI===y.namespaceURI){morph(x,y);continue;}
    a.replaceChild(y,x);
  }
  while(a.childNodes.length>bc.length)a.removeChild(a.lastChild);
}
function morph(a,b){
  attrs(a,b);
  EVS.forEach(function(e){a[e]=b[e]||null;});
  if((b.tagName==='INPUT'||b.tagName==='TEXTAREA')&&a.value!==b.value)a.value=b.value;
  a.__ref=b.__ref||null;
  morphKids(a,b);
}
function walk(el){if(el.__ref)el.__ref.current=el;for(var i=0;i<el.children.length;i++)walk(el.children[i]);}
window.SARender=function(tpl,host,scope){
  var wrap=document.createElement('div');
  tpl.content.childNodes.forEach(function(c){mk(c,scope).forEach(function(x){wrap.appendChild(x);});});
  morphKids(host,wrap);walk(host);
};
})();
