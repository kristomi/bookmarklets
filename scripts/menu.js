javascript:(function(){
var configUrl='https://raw.githubusercontent.com/kristomi/bookmarklets/main/config.json';
var existingMenu=document.getElementById('bookmarklet-menu-overlay');
if(existingMenu){existingMenu.remove();return;}

// Show loading
var loader=document.createElement('div');
loader.id='bookmarklet-loader';
loader.style.cssText='position:fixed;top:20px;right:20px;background:#333;color:#fff;padding:10px 15px;border-radius:5px;z-index:999999;font-family:Arial,sans-serif;font-size:12px;';
loader.textContent='⏳ Loading scripts...';
document.body.appendChild(loader);

// Fetch config
fetch(configUrl)
.then(response=>response.json())
.then(config=>{
  document.body.removeChild(loader);
  showMenu(config);
})
.catch(error=>{
  document.body.removeChild(loader);
  alert('Failed to load script configuration: '+error.message);
});

function showMenu(config){
var overlay=document.createElement('div');
overlay.id='bookmarklet-menu-overlay';
overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

var menu=document.createElement('div');
menu.style.cssText='background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-width:450px;width:90%;max-height:80vh;overflow-y:auto;';

var header=document.createElement('div');
header.style.cssText='padding:24px 24px 16px;border-bottom:1px solid #e5e7eb;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:12px 12px 0 0;';
header.innerHTML='<h2 style="margin:0;font-size:20px;font-weight:600;">'+config.title+'</h2><p style="margin:8px 0 0;opacity:0.9;font-size:14px;">'+config.description+'</p>';

var content=document.createElement('div');
content.style.cssText='padding:20px 24px;';

Object.keys(config.categories).forEach(function(categoryName){
var category=config.categories[categoryName];
var categoryHeader=document.createElement('div');
categoryHeader.style.cssText='font-weight:600;font-size:14px;color:#374151;margin:16px 0 12px 0;text-transform:uppercase;letter-spacing:0.5px;';
if(Object.keys(config.categories).indexOf(categoryName)===0){categoryHeader.style.marginTop='0';}
categoryHeader.textContent=categoryName;
content.appendChild(categoryHeader);

Object.keys(category).forEach(function(scriptName){
var scriptUrl=category[scriptName];
var button=document.createElement('button');
button.textContent=scriptName;
button.style.cssText='display:block;width:100%;margin:8px 0;padding:14px 16px;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;transition:all 0.2s ease;text-align:left;';
button.onmouseover=function(){this.style.background='#f3f4f6';this.style.borderColor='#9ca3af';};
button.onmouseout=function(){this.style.background='#fff';this.style.borderColor='#d1d5db';};
button.onclick=function(){loadScript(scriptUrl,scriptName);closeMenu();};
content.appendChild(button);
});
});

var footer=document.createElement('div');
footer.style.cssText='padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;border-radius:0 0 12px 12px;';
var closeButton=document.createElement('button');
closeButton.textContent='Cancel';
closeButton.style.cssText='width:100%;padding:12px;border:1px solid #d1d5db;background:#fff;color:#6b7280;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;';
closeButton.onclick=closeMenu;
footer.appendChild(closeButton);

menu.appendChild(header);
menu.appendChild(content);
menu.appendChild(footer);
overlay.appendChild(menu);
document.body.appendChild(overlay);

function closeMenu(){if(overlay&&overlay.parentNode){overlay.remove();}}
overlay.onclick=function(e){if(e.target===overlay){closeMenu();}};
}

function loadScript(url,name){
var script=document.createElement('script');
script.src=url;
script.onerror=function(){alert('Error loading script: '+name);};
script.onload=function(){console.log('Loaded: '+name);};
document.head.appendChild(script);
}
})();