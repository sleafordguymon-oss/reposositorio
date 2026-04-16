(function(){
  var inp = document.getElementById('plateInput');
  var btn = document.getElementById('searchBtn');
  var checks = document.querySelectorAll('.card__form .chk input[type=checkbox]');

  function updateBtn(){
    var raw = inp.value.replace(/-/g,'');
    var allChecked = true;
    for(var i=0;i<checks.length;i++){if(!checks[i].checked)allChecked=false;}
    if(raw.length>=7 && allChecked){
      btn.classList.remove('is-disabled');
      btn.removeAttribute('aria-disabled');
    } else {
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled','');
    }
  }

  if(inp) {
    inp.addEventListener('input',function(){
      var raw = this.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
      if(raw.length>7) raw=raw.substring(0,7);
      if(raw.length>3){
        this.value = raw.substring(0,3)+'-'+raw.substring(3);
      } else {
        this.value = raw;
      }
      updateBtn();
    });
  }

  for(var i=0;i<checks.length;i++){
    checks[i].addEventListener('change',updateBtn);
  }

  if (btn) {
    btn.addEventListener('click',function(e){
      e.preventDefault();
      if(this.classList.contains('is-disabled')) return;
      this.classList.add('is-disabled');
      var plate = inp.value;
      var plateClean = plate.replace(/[^a-zA-Z0-9]/g,'').toUpperCase();

      var overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.innerHTML = '<div class="loading-card"><div class="loading-spinner"></div><p class="loading-text">Buscando débitos...</p><p class="loading-plate">' + plate + '</p></div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(function(){ overlay.classList.add('is-visible'); });

      var vehicleResult = null;
      var vehicleDone = false;
      var timerDone = false;
      var handled = false;

      fetch('/api/vehicle-lookup?plate=' + encodeURIComponent(plateClean))
        .then(function(r){ return r.json(); })
        .then(function(data){ vehicleResult = data; vehicleDone = true; checkReady(); })
        .catch(function(){ vehicleDone = true; checkReady(); });

      var delay = 1500;
      setTimeout(function(){ timerDone = true; checkReady(); }, delay);

      function hasVehicleData(data){
        return data && data.success && data.brand && data.model
          && data.brand.replace(/\*/g,'').trim()
          && data.model.replace(/\*/g,'').trim();
      }

      function checkReady(){
        if(handled) return;
        if(vehicleDone && hasVehicleData(vehicleResult)){
          handled = true;
          var lo = document.getElementById('loadingOverlay');
          if(lo) lo.remove();
          showVehicleModal(vehicleResult, plate);
        } else if(timerDone) {
          handled = true;
          var lo2 = document.getElementById('loadingOverlay');
          if(lo2) lo2.remove();
          if(hasVehicleData(vehicleResult)){
            showVehicleModal(vehicleResult, plate);
          } else {
            goToPlateInfo(plate);
          }
        }
      }
    });
  }

  function goToPlateInfo(plate){
    var overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = '<div class="loading-card"><div class="loading-spinner"></div><p class="loading-text">Buscando débitos...</p><p class="loading-plate">' + plate + '</p></div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function(){ overlay.classList.add('is-visible'); });
    setTimeout(function(){ location.href = 'plate-info.html?plate=' + encodeURIComponent(plate); }, 500);
  }

  function colorToHex(cor){
    if(!cor) return '#6b7280';
    var map={'PRETO':'#1a1a1a','PRETA':'#1a1a1a','BRANCO':'#94a3b8','BRANCA':'#94a3b8','PRATA':'#9ca3af','CINZA':'#6b7280','VERMELHO':'#dc2626','VERMELHA':'#dc2626','AZUL':'#2563eb','VERDE':'#16a34a','AMARELO':'#eab308','AMARELA':'#eab308','MARROM':'#78350f','BEGE':'#d4a574','DOURADO':'#b8860b','DOURADA':'#b8860b','VINHO':'#7f1d1d','LARANJA':'#ea580c'};
    return map[(cor||'').toUpperCase()]||'#6b7280';
  }

  function showVehicleModal(data, plate){
    var ch = colorToHex(data.color);
    var logoHtml = data.logo
      ? '<img src="'+data.logo+'" alt="'+data.brand+'" style="max-width:56px;max-height:56px;object-fit:contain">'
      : '<span style="font-size:28px;font-weight:800;color:#0b2239">'+((data.brand||'?').charAt(0))+'</span>';

    var yearStr = '';
    if(data.year_fab && data.year_model) yearStr = data.year_fab+'/'+data.year_model;
    else yearStr = data.year_model || data.year_fab || '—';

    var html = '<div class="vm-overlay" id="vehicleModalOverlay">'
      +'<div class="vm-card">'
        +'<div class="vm-grab"></div>'
        +'<div class="vm-header">'
          +'<div class="vm-logo">'+logoHtml+'</div>'
          +'<div class="vm-info">'
            +'<div class="vm-name">'+data.brand+' '+data.model+'</div>'
            +'<div class="vm-plate">'+plate+'</div>'
          +'</div>'
        +'</div>'
        +'<div class="vm-details">'
          +'<div class="vm-detail"><span class="vm-label">Marca</span><span class="vm-value">'+data.brand+'</span></div>'
          +'<div class="vm-detail"><span class="vm-label">Modelo</span><span class="vm-value">'+data.model+'</span></div>'
          +'<div class="vm-detail"><span class="vm-label">Ano</span><span class="vm-value">'+yearStr+'</span></div>'
          +'<div class="vm-detail"><span class="vm-label">Cor</span><span class="vm-value"><span class="vm-color-dot" style="background:'+ch+'"></span>'+data.color+'</span></div>'
        +'</div>'
        +'<button class="vm-btn-confirm" id="vmConfirm">Confirmar veículo</button>'
        +'<button class="vm-btn-change" id="vmChange">Mudar placa</button>'
      +'</div>'
    +'</div>';

    var container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    var modal = document.getElementById('vehicleModalOverlay');
    requestAnimationFrame(function(){ modal.classList.add('is-visible'); });

    sessionStorage.setItem('vehicleData', JSON.stringify({brand:data.brand,model:data.model,color:data.color,year:data.year_model||data.year_fab||''}));

    document.getElementById('vmConfirm').onclick = function(){
      modal.classList.remove('is-visible');
      setTimeout(function(){ container.remove(); goToPlateInfo(plate); }, 300);
    };
    document.getElementById('vmChange').onclick = function(){
      modal.classList.remove('is-visible');
      setTimeout(function(){ container.remove(); inp.focus(); inp.select(); }, 300);
    };
  }
})();
