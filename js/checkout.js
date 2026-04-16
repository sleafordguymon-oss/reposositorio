(function(){
  var currentTxId = null;
  var currentPixCode = null;
  var currentPlate = null;
  var statusInterval = null;
  var countdownInterval = null;
  var pollAttempts = 0;
  var successShown = false;
  var retryShown = false;
  var totalSeconds = 15 * 60;

  function clearStatusInterval(){
    if(statusInterval){
      clearInterval(statusInterval);
      statusInterval = null;
    }
  }

  function clearCountdownInterval(){
    if(countdownInterval){
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function resetPollingState(){
    clearStatusInterval();
    clearCountdownInterval();
    pollAttempts = 0;
    totalSeconds = 15 * 60;
    successShown = false;
    retryShown = false;
  }

  function showSuccessModal(){
    if(successShown || retryShown) return;
    successShown = true;
    clearStatusInterval();
    clearCountdownInterval();

    var errorModal = document.getElementById('errorModal');
    if(errorModal) errorModal.classList.remove('active');

    var successModal = document.getElementById('successModal');
    if(successModal) successModal.classList.add('active');

    setTimeout(function(){
      location.href = 'index.html';
    }, 5000);
  }

  function showRetryModal(){
    if(retryShown || successShown) return;
    retryShown = true;
    clearStatusInterval();
    clearCountdownInterval();

    var successModal = document.getElementById('successModal');
    if(successModal) successModal.classList.remove('active');

    var errorModal = document.getElementById('errorModal');
    if(errorModal) errorModal.classList.add('active');
  }

  function initCheckout(){
    var params = new URLSearchParams(location.search);
    var plate = (params.get('plate')||'').toUpperCase();
    var selectedDebits = [];
    try {
      selectedDebits = JSON.parse(sessionStorage.getItem('selectedDebits') || '[]');
      if (!Array.isArray(selectedDebits)) selectedDebits = [];
    } catch (e) {
      selectedDebits = [];
    }

    var storedAmount = parseFloat(sessionStorage.getItem('debitoTotal') || '0');
    var amount = parseFloat(params.get('amount')) || storedAmount || 38.90;

    function formatMoney(v){ return 'R$ ' + v.toFixed(2).replace('.',','); }
    var amountStr = formatMoney(amount);
    sessionStorage.setItem('debitoTotal', String(amount));

    var summaryValue = document.getElementById('summaryValue');
    var pixValue = document.getElementById('pixValue');

    if(!summaryValue || !pixValue){
      setTimeout(initCheckout, 100);
      return;
    }

    summaryValue.textContent = amountStr;
    pixValue.textContent = amountStr;

    var _vData = JSON.parse(sessionStorage.getItem('vehicleData')||'{}');
    if(plate){
      var plateText = 'Veículo: ' + plate;
      var summaryPlate = document.getElementById('summaryPlate');
      if(summaryPlate) summaryPlate.textContent = plateText;
      if(_vData.brand && _vData.model){
        var vLine = document.createElement('p');
        vLine.style.cssText = 'font-size:13px;color:#374151;margin-top:4px;font-weight:500';
        var parts = [_vData.brand + ' ' + _vData.model];
        if(_vData.year) parts.push(_vData.year);
        if(_vData.color) parts.push(_vData.color);
        vLine.textContent = parts.join(' · ');
        if(summaryPlate && summaryPlate.parentNode) summaryPlate.parentNode.appendChild(vLine);
      }
      if(selectedDebits.length && summaryPlate && summaryPlate.parentNode){
        var debitLine = document.createElement('p');
        debitLine.style.cssText = 'font-size:13px;color:#374151;margin-top:4px';
        debitLine.textContent = selectedDebits.length + ' débito(s) selecionado(s) para pagamento';
        summaryPlate.parentNode.appendChild(debitLine);
      }
      var backLink = document.getElementById('backLink');
      if(backLink) backLink.href = 'plate-info.html?plate=' + encodeURIComponent(plate);
    }

    var btnGerarPix = document.getElementById('btnGerarPix');
    if(btnGerarPix && !btnGerarPix.dataset.bound){
      btnGerarPix.dataset.bound = 'true';
      btnGerarPix.addEventListener('click', function(){
        var btn = this;
        resetPollingState();
        btn.disabled = true;
        btn.textContent = 'Gerando...';

        var payload = {
          amount: amount,
          plate: plate
        };

        fetch('/api/pix', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        })
        .then(function(r){ return r.json(); })
        .then(function(data){
          if(!data.success){
            btn.textContent = 'Erro - Tentar novamente';
            btn.style.background = '#dc2626';
            btn.disabled = false;
            alert('Erro ao gerar pagamento: ' + (data.error || 'Tente novamente'));
            return;
          }

          currentTxId = data.transactionId;
          currentPixCode = data.pixCode;
          currentPlate = plate;
          btn.textContent = 'Pix gerado';
          btn.style.opacity = '0.6';

          var pixQrSection = document.getElementById('pixQrSection');
          if(pixQrSection) pixQrSection.style.display = 'block';

          var pixCode = document.getElementById('pixCode');
          if(pixCode) pixCode.value = data.pixCode || '';

          var qrContainer = document.querySelector('.pix-qr');
          if(qrContainer){
            qrContainer.innerHTML = '';
            if(data.qrImage){
              var img = document.createElement('img');
              var src = data.qrImage;
              if(src && !src.startsWith('data:') && !src.startsWith('http')){
                src = 'data:image/png;base64,' + src;
              }
              img.src = src;
              img.style.cssText = 'width:180px;height:180px;object-fit:contain';
              qrContainer.appendChild(img);
            } else if(data.pixCode && typeof qrcode !== 'undefined'){
              var qr = qrcode(0, 'L');
              qr.addData(data.pixCode);
              qr.make();
              qrContainer.innerHTML = qr.createImgTag(4, 8);
              var qrImg = qrContainer.querySelector('img');
              if(qrImg) qrImg.style.cssText = 'width:180px;height:180px;image-rendering:pixelated';
            } else {
              qrContainer.innerHTML = '<p style="color:#6b7280;font-size:13px;padding:20px">Use o código abaixo para pagar</p>';
            }
          }

          startTimer();
          pollStatus();
          setTimeout(function(){
            if(pixQrSection) pixQrSection.scrollIntoView({behavior:'smooth'});
          }, 300);
        })
        .catch(function(err){
          btn.textContent = 'Erro - Tentar novamente';
          btn.style.background = '#dc2626';
          btn.disabled = false;
          console.error('Erro ao gerar pagamento:', err);
        });
      });
    }

    function pollStatus(){
      if(!currentPixCode) return;

      function checkStatus(){
        pollAttempts++;
        var url = '/api/check-payment';
        var query = [];

        if(currentTxId) query.push('transactionId=' + encodeURIComponent(currentTxId));
        if(currentPixCode) query.push('pixCode=' + encodeURIComponent(currentPixCode));
        if(currentPlate) query.push('plate=' + encodeURIComponent(currentPlate));
        if(query.length) url += '?' + query.join('&');

        fetch(url)
          .then(function(r){ return r.json(); })
          .then(function(data){
            var status = data && data.status ? String(data.status).toLowerCase() : 'pending';

            if(status === 'paid'){
              showSuccessModal();
              return;
            }

            if(['failed','expired','refunded','cancelled'].indexOf(status) !== -1){
              showRetryModal();
            }
          })
          .catch(function(err){
            console.log('Erro ao verificar status:', err);
          });
      }

      checkStatus();
      clearStatusInterval();
      statusInterval = setInterval(checkStatus, 5000);
    }

    function startTimer(){
      var display = document.getElementById('timerDisplay');
      if(!display) return;

      clearCountdownInterval();
      display.textContent = '15:00';

      countdownInterval = setInterval(function(){
        totalSeconds--;
        if(totalSeconds <= 0){
          clearCountdownInterval();
          display.textContent = 'Expirado';
          showRetryModal();
          return;
        }
        var m = Math.floor(totalSeconds / 60);
        var s = totalSeconds % 60;
        display.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      }, 1000);
    }

    var btnNovoPixModal = document.getElementById('btnNovoPixModal');
    if(btnNovoPixModal && !btnNovoPixModal.dataset.bound){
      btnNovoPixModal.dataset.bound = 'true';
      btnNovoPixModal.addEventListener('click', function(){
        var errorModal = document.getElementById('errorModal');
        if(errorModal) errorModal.classList.remove('active');

        var pixQrSection = document.getElementById('pixQrSection');
        if(pixQrSection) pixQrSection.style.display = 'none';

        var btn = document.getElementById('btnGerarPix');
        if(btn){
          btn.disabled = false;
          btn.textContent = 'Gerar Pix';
          btn.style.opacity = '1';
          btn.style.background = '';
        }

        currentTxId = null;
        currentPixCode = null;
        resetPollingState();

        setTimeout(function(){ if(btn) btn.click(); }, 300);
      });
    }

    var btnCopy = document.getElementById('btnCopy');
    if(btnCopy && !btnCopy.dataset.bound){
      btnCopy.dataset.bound = 'true';
      btnCopy.addEventListener('click', function(){
        var code = document.getElementById('pixCode');
        if(code){
          code.select();
          document.execCommand('copy');
          this.textContent = 'Copiado!';
          var self = this;
          setTimeout(function(){ self.textContent = 'Copiar'; }, 2000);
        }
      });
    }

    var btnFecharSucesso = document.getElementById('btnFecharSucesso');
    if(btnFecharSucesso && !btnFecharSucesso.dataset.bound){
      btnFecharSucesso.dataset.bound = 'true';
      btnFecharSucesso.addEventListener('click', function(){
        var successModal = document.getElementById('successModal');
        if(successModal) successModal.classList.remove('active');
        location.href = 'index.html';
      });
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initCheckout);
  } else {
    initCheckout();
  }
})();
