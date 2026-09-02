(function () {
  const API_BASE_URL = 'https://meylin-mono.onrender.com';
  const PREPAYMENT_AMOUNT = 300;
  const INTERNATIONAL_DELIVERY_FEE = 0;
  const SCRIPT_VERSION = 'i18n-2026-06-18-1238';
  const SHOPIFY_ROUTES_ROOT = window.Shopify?.routes?.root || '/';
  const UPSELL_PRODUCTS = window.WOODEN_UPSELL_PRODUCTS || [
    // {
    //   handle: 'gift-packaging',
    //   description: 'Додамо красиве пакування до замовлення',
    // },
  ];

  const form = document.querySelector('#customCheckoutForm');
  const submitBtn = document.querySelector('#submit-btn');
  const amountField = document.querySelector('#amount');
  const productsList = document.querySelector('#products-list');
  const cartTotalEl = document.querySelector('#cart-total');
  const cartItemsCountEl = document.querySelector('#cart-items-count');
  let upsellSection = null;
  let installmentPartCounts = [2, 3, 4];

  const TEXTS = {
    uk: {
      consent: 'Я даю згоду на обробку персональних даних',
      shippingMethod: 'Спосіб доставки',
      novaPoshta: 'Нова пошта',
      internationalDelivery: 'Доставка за кордон',
      branch: 'Відділення',
      postomat: 'Поштомат',
      address: 'Адреса',
      cityNovaPoshta: 'Місто (Нова Пошта)',
      chooseCity: 'Оберіть місто *',
      chooseBranch: 'Оберіть відділення *',
      choosePostomat: 'Оберіть поштомат *',
      courierAddressNote: "Кур'єрська доставка Нової пошти на адресу",
      deliveryAddress: 'Адреса доставки',
      street: 'Вулиця *',
      house: 'Будинок',
      housePlaceholder: 'Будинок *',
      apartmentOffice: 'Квартира / офіс',
      apartmentOfficePlaceholder: 'Квартира, офіс',
      internationalNote: 'Доставка за кордон обробляється менеджером після оформлення.',
      internationalFeeNote: 'Доставка за кордон узгоджується менеджером',
      country: 'Країна',
      chooseCountry: 'Оберіть країну *',
      city: 'Місто',
      yourCity: 'Ваше місто *',
      yourAddress: 'Ваша адреса *',
      apartmentRoom: 'Квартира / кімната',
      apartmentRoomPlaceholder: 'Квартира, кімната, тощо',
      postcode: 'Поштовий індекс',
      postcodePlaceholder: 'Поштовий індекс *',
      pcs: 'шт.',
      cartLoadError: 'Не вдалося завантажити кошик',
      upsellTitle: 'Додайте до замовлення',
      add: 'Додати',
      added: 'Додано',
      adding: 'Додаємо...',
      upsellNotFound: 'Допродаж не знайдено',
      addProductError: 'Не вдалося додати товар',
      clearCartError: 'Не вдалося очистити кошик',
      requestFailed: 'Запит не вдався',
      npTimeout: 'Сервер Нової пошти відповідає занадто довго',
      searchingCities: 'Шукаємо міста...',
      citiesPhoneError: 'Помилка міст: відповідь не обробилась на телефоні. Оновіть сторінку або спробуйте ще раз.',
      cityNotFound: 'Місто не знайдено',
      citiesErrorPrefix: 'Помилка міст',
      searchingWarehouses: 'Шукаємо відділення...',
      warehousesPhoneError: 'Помилка відділень: відповідь не обробилась на телефоні. Оновіть сторінку або спробуйте ще раз.',
      warehouseNotFound: 'Відділення не знайдено',
      warehousesErrorPrefix: 'Помилка відділень',
      emptyCart: 'Кошик порожній',
      creatingPayment: 'Створюємо оплату...',
      createPaymentError: 'Не вдалося створити оплату',
      clearingCart: 'Очищаємо кошик...',
      paymentCreateAlert: 'Помилка створення оплати',
      cartUnavailable: 'Кошик недоступний',
      firstName: "Ім'я",
      lastName: 'Прізвище',
      phone: 'Телефон',
      email: 'E-mail',
      comment: 'Коментар до замовлення',
      submit: 'Оформити замовлення',
      fullPayment: 'Повна оплата',
      prepayment: 'Передплата 300 грн',
      installments: 'Оплата частинами',
      paymentMethod: 'Спосіб оплати',
      fullPaymentSubtitle: 'Оплата 100% вартості онлайн',
      fullPaymentBadge: 'Ви економите 2%+20 грн комісії',
      internationalDeliveryBadge: 'Доставка за кордон узгоджується менеджером',
      prepaymentCard: 'Передплата 300 ₴',
      prepaymentSubtitle: 'Решту суми — при отриманні',
      prepaymentBadge: 'Додатково 2%+20 грн комісії',
      installmentsCard: 'Оплата частинами',
      installmentsSubtitle: 'Підтвердження у застосунку monobank',
      installmentsBadge: 'Покупка Частинами',
      installmentsPartsLabel: 'Кількість платежів',
      installmentsPartsOption: '{count} платежі',
      installmentsRequestSent: 'Запит на Покупку Частинами надіслано у застосунок monobank. Підтвердіть оплату в застосунку.',
      orderSummaryTitle: 'Загальна сума',
      cartItemsLabel: 'Товарів у кошику',
      totalLabel: 'Сума',
    },
    en: {
      consent: 'I consent to the processing of my personal data',
      shippingMethod: 'Delivery method',
      novaPoshta: 'Nova Poshta',
      internationalDelivery: 'International delivery',
      branch: 'Branch',
      postomat: 'Parcel locker',
      address: 'Address',
      cityNovaPoshta: 'City (Nova Poshta)',
      chooseCity: 'Choose city *',
      chooseBranch: 'Choose branch *',
      choosePostomat: 'Choose parcel locker *',
      courierAddressNote: 'Nova Poshta courier delivery to your address',
      deliveryAddress: 'Delivery address',
      street: 'Street *',
      house: 'Building',
      housePlaceholder: 'Building *',
      apartmentOffice: 'Apartment / office',
      apartmentOfficePlaceholder: 'Apartment, office',
      internationalNote: 'International delivery is handled by a manager after checkout.',
      internationalFeeNote: 'International delivery is agreed with a manager',
      country: 'Country',
      chooseCountry: 'Choose country *',
      city: 'City',
      yourCity: 'Your city *',
      yourAddress: 'Your address *',
      apartmentRoom: 'Apartment / room',
      apartmentRoomPlaceholder: 'Apartment, room, etc.',
      postcode: 'Postal code',
      postcodePlaceholder: 'Postal code *',
      pcs: 'pcs.',
      cartLoadError: 'Could not load cart',
      upsellTitle: 'Add to your order',
      add: 'Add',
      added: 'Added',
      adding: 'Adding...',
      upsellNotFound: 'Upsell product was not found',
      addProductError: 'Could not add product',
      clearCartError: 'Could not clear cart',
      requestFailed: 'Request failed',
      npTimeout: 'Nova Poshta server is taking too long to respond',
      searchingCities: 'Searching cities...',
      citiesPhoneError: 'City error: response could not be processed on mobile. Refresh the page or try again.',
      cityNotFound: 'City not found',
      citiesErrorPrefix: 'City error',
      searchingWarehouses: 'Searching branches...',
      warehousesPhoneError: 'Branch error: response could not be processed on mobile. Refresh the page or try again.',
      warehouseNotFound: 'Branch not found',
      warehousesErrorPrefix: 'Branch error',
      emptyCart: 'Your cart is empty',
      creatingPayment: 'Creating payment...',
      createPaymentError: 'Could not create payment',
      clearingCart: 'Clearing cart...',
      paymentCreateAlert: 'Payment creation error',
      cartUnavailable: 'Cart is unavailable',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      email: 'E-mail',
      comment: 'Order comment',
      submit: 'Place order',
      fullPayment: 'Full payment',
      prepayment: 'Prepayment 300 UAH',
      installments: 'Split payment',
      paymentMethod: 'Payment method',
      fullPaymentSubtitle: 'Pay 100% of the order online',
      fullPaymentBadge: 'You save 2% + 20 UAH commission',
      internationalDeliveryBadge: 'International delivery is agreed with a manager',
      prepaymentCard: 'Prepayment 300 UAH',
      prepaymentSubtitle: 'Pay the rest on delivery',
      prepaymentBadge: 'Additional 2% + 20 UAH commission',
      installmentsCard: 'Split payment',
      installmentsSubtitle: 'Confirm in the monobank app',
      installmentsBadge: 'monobank split payment',
      installmentsPartsLabel: 'Number of payments',
      installmentsPartsOption: '{count} payments',
      installmentsRequestSent: 'The split payment request was sent to the monobank app. Confirm it in the app.',
      orderSummaryTitle: 'Order summary',
      cartItemsLabel: 'Items in cart',
      totalLabel: 'Total',
    },
    pl: {
      consent: 'Wyrażam zgodę na przetwarzanie moich danych osobowych',
      shippingMethod: 'Sposób dostawy',
      novaPoshta: 'Nova Poshta',
      internationalDelivery: 'Dostawa za granicę',
      branch: 'Oddział',
      postomat: 'Paczkomat',
      address: 'Adres',
      cityNovaPoshta: 'Miasto (Nova Poshta)',
      chooseCity: 'Wybierz miasto *',
      chooseBranch: 'Wybierz oddział *',
      choosePostomat: 'Wybierz paczkomat *',
      courierAddressNote: 'Dostawa kurierska Nova Poshta pod wskazany adres',
      deliveryAddress: 'Adres dostawy',
      street: 'Ulica *',
      house: 'Budynek',
      housePlaceholder: 'Budynek *',
      apartmentOffice: 'Mieszkanie / biuro',
      apartmentOfficePlaceholder: 'Mieszkanie, biuro',
      internationalNote: 'Dostawa zagraniczna zostanie ustalona przez menedżera po złożeniu zamówienia.',
      internationalFeeNote: 'Dostawa zagraniczna zostanie ustalona przez menedżera',
      country: 'Kraj',
      chooseCountry: 'Wybierz kraj *',
      city: 'Miasto',
      yourCity: 'Twoje miasto *',
      yourAddress: 'Twój adres *',
      apartmentRoom: 'Mieszkanie / pokój',
      apartmentRoomPlaceholder: 'Mieszkanie, pokój itd.',
      postcode: 'Kod pocztowy',
      postcodePlaceholder: 'Kod pocztowy *',
      pcs: 'szt.',
      cartLoadError: 'Nie udało się załadować koszyka',
      upsellTitle: 'Dodaj do zamówienia',
      add: 'Dodaj',
      added: 'Dodano',
      adding: 'Dodajemy...',
      upsellNotFound: 'Nie znaleziono produktu dodatkowego',
      addProductError: 'Nie udało się dodać produktu',
      clearCartError: 'Nie udało się wyczyścić koszyka',
      requestFailed: 'Żądanie nie powiodło się',
      npTimeout: 'Serwer Nova Poshta odpowiada zbyt długo',
      searchingCities: 'Szukamy miast...',
      citiesPhoneError: 'Błąd miasta: odpowiedź nie została przetworzona na telefonie. Odśwież stronę lub spróbuj ponownie.',
      cityNotFound: 'Nie znaleziono miasta',
      citiesErrorPrefix: 'Błąd miasta',
      searchingWarehouses: 'Szukamy oddziałów...',
      warehousesPhoneError: 'Błąd oddziałów: odpowiedź nie została przetworzona na telefonie. Odśwież stronę lub spróbuj ponownie.',
      warehouseNotFound: 'Nie znaleziono oddziału',
      warehousesErrorPrefix: 'Błąd oddziałów',
      emptyCart: 'Koszyk jest pusty',
      creatingPayment: 'Tworzymy płatność...',
      createPaymentError: 'Nie udało się utworzyć płatności',
      clearingCart: 'Czyścimy koszyk...',
      paymentCreateAlert: 'Błąd tworzenia płatności',
      cartUnavailable: 'Koszyk jest niedostępny',
      firstName: 'Imię',
      lastName: 'Nazwisko',
      phone: 'Telefon',
      email: 'E-mail',
      comment: 'Komentarz do zamówienia',
      submit: 'Złóż zamówienie',
      fullPayment: 'Pełna płatność',
      prepayment: 'Przedpłata 300 UAH',
      installments: 'Płatność w częściach',
      paymentMethod: 'Sposób płatności',
      fullPaymentSubtitle: 'Zapłać 100% wartości zamówienia online',
      fullPaymentBadge: 'Oszczędzasz 2% + 20 UAH prowizji',
      internationalDeliveryBadge: 'Dostawa zagraniczna zostanie ustalona przez menedżera',
      prepaymentCard: 'Przedpłata 300 UAH',
      prepaymentSubtitle: 'Pozostała kwota przy odbiorze',
      prepaymentBadge: 'Dodatkowo 2% + 20 UAH prowizji',
      installmentsCard: 'Płatność w częściach',
      installmentsSubtitle: 'Potwierdź w aplikacji monobank',
      installmentsBadge: 'Płatność w częściach monobank',
      installmentsPartsLabel: 'Liczba płatności',
      installmentsPartsOption: '{count} płatności',
      installmentsRequestSent: 'Wniosek o płatność w częściach wysłano do aplikacji monobank. Potwierdź go w aplikacji.',
      orderSummaryTitle: 'Podsumowanie zamówienia',
      cartItemsLabel: 'Produktów w koszyku',
      totalLabel: 'Suma',
    },
  };

  let npCityInput = null;
  let npWarehouseInput = null;
  let citySuggestions = null;
  let warehouseSuggestions = null;
  let npWarehouseLabel = null;
  let npPickupFields = null;
  let npAddressFields = null;
  let internationalFields = null;
  let domesticFields = null;

  if (!form || !submitBtn || !amountField) return;

  function normalizeLocale(value) {
    const code = String(value || '').toLowerCase().split(/[-_]/)[0];
    return TEXTS[code] ? code : '';
  }

  function getLocaleFromPath(path) {
    return normalizeLocale(String(path || '').split('/').filter(Boolean)[0]);
  }

  function getCurrentLocale() {
    const params = new URLSearchParams(window.location.search);
    const formLocale = form?.dataset?.locale || form?.getAttribute('data-locale');
    const candidates = [
      formLocale,
      window.WOODEN_CHECKOUT_LOCALE,
      params.get('locale'),
      params.get('language'),
      params.get('lang'),
      getLocaleFromPath(window.location.pathname),
      getLocaleFromPath(SHOPIFY_ROUTES_ROOT),
      window.Shopify?.locale,
      window.Shopify?.shopLocale,
      document.documentElement.lang,
      ...(navigator.languages || []),
      navigator.language,
    ];

    for (const candidate of candidates) {
      const locale = normalizeLocale(candidate);
      if (locale) return locale;
    }

    return 'uk';
  }

  const CURRENT_LOCALE = getCurrentLocale();

  function t(key) {
    return TEXTS[CURRENT_LOCALE]?.[key] || TEXTS.uk[key] || key;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function translateStaticTextNodes(root) {
    if (!root) return;

    const replacements = new Map([
      ['Спосіб оплати', t('paymentMethod')],
      ['Payment method', t('paymentMethod')],
      ['Sposób płatności', t('paymentMethod')],
      ['Повна оплата', t('fullPayment')],
      ['Full payment', t('fullPayment')],
      ['Pełna płatność', t('fullPayment')],
      ['Оплата частинами', t('installmentsCard')],
      ['Split payment', t('installmentsCard')],
      ['Płatność w częściach', t('installmentsCard')],
      ['Оплата 100% вартості онлайн', t('fullPaymentSubtitle')],
      ['Pay 100% of the order online', t('fullPaymentSubtitle')],
      ['Zapłać 100% wartości zamówienia online', t('fullPaymentSubtitle')],
      ['Ви економите 2%+20 грн комісії', t('fullPaymentBadge')],
      ['You save 2% + 20 UAH commission', t('fullPaymentBadge')],
      ['Oszczędzasz 2% + 20 UAH prowizji', t('fullPaymentBadge')],
      ['Передплата 500 ₴', t('prepaymentCard')],
      ['Передплата 500 грн', t('prepaymentCard')],
      ['Prepayment 500 UAH', t('prepaymentCard')],
      ['Przedpłata 500 UAH', t('prepaymentCard')],
      ['Передплата 300 ₴', t('prepaymentCard')],
      ['Передплата 300 грн', t('prepaymentCard')],
      ['Prepayment 300 UAH', t('prepaymentCard')],
      ['Przedpłata 300 UAH', t('prepaymentCard')],
      ['Решту суми — при отриманні', t('prepaymentSubtitle')],
      ['Решту суми - при отриманні', t('prepaymentSubtitle')],
      ['Pay the rest on delivery', t('prepaymentSubtitle')],
      ['Pozostała kwota przy odbiorze', t('prepaymentSubtitle')],
      ['Додатково 2%+20 грн комісії', t('prepaymentBadge')],
      ['Additional 2% + 20 UAH commission', t('prepaymentBadge')],
      ['Dodatkowo 2% + 20 UAH prowizji', t('prepaymentBadge')],
      ['Підтвердження у застосунку monobank', t('installmentsSubtitle')],
      ['Confirm in the monobank app', t('installmentsSubtitle')],
      ['Potwierdź w aplikacji monobank', t('installmentsSubtitle')],
      ['Загальна сума', t('orderSummaryTitle')],
      ['Order summary', t('orderSummaryTitle')],
      ['Podsumowanie zamówienia', t('orderSummaryTitle')],
      ['Сума:', `${t('totalLabel')}:`],
      ['Total:', `${t('totalLabel')}:`],
      ['Suma:', `${t('totalLabel')}:`],
    ]);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return replacements.has(normalizeText(node.textContent))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      node.textContent = replacements.get(normalizeText(node.textContent));
    });

    document.querySelectorAll('body *').forEach((element) => {
      const text = normalizeText(element.textContent);
      const cartItemsMatch = text.match(/^(Товарів у кошику|Items in cart|Produktów w koszyku):\s*(\d+)$/);
      if (cartItemsMatch && element.children.length === 0) {
        element.textContent = `${t('cartItemsLabel')}: ${cartItemsMatch[2]}`;
      }
    });
  }

  function shopifyRoute(path) {
    return `${SHOPIFY_ROUTES_ROOT.replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`;
  }

  function setFieldLabel(selector, textKey) {
    const input = form.querySelector(selector);
    if (!input) return;
    const id = input.id;
    const label = id ? form.querySelector(`label[for="${CSS.escape(id)}"]`) : input.closest('label');
    if (label) label.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        node.textContent = t(textKey);
      }
    });
    if (label && !Array.from(label.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) {
      label.insertBefore(document.createTextNode(t(textKey)), label.firstChild);
    }
  }

  function applyStaticTranslations() {
    setFieldLabel('input[name="first_name"], #first_name', 'firstName');
    setFieldLabel('input[name="last_name"], #last_name', 'lastName');
    setFieldLabel('input[name="phone"], #phone', 'phone');
    setFieldLabel('input[name="email"], #email', 'email');
    setFieldLabel('textarea[name="comment"], #comment', 'comment');

    const fullPayment = form.querySelector('input[name="payment_type"][value="full"]')?.closest('label');
    if (fullPayment) fullPayment.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = t('fullPayment');
    });

    const prepayment = form.querySelector('input[name="payment_type"][value="prepayment"]')?.closest('label');
    if (prepayment) prepayment.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = t('prepayment');
    });

    const installments = form.querySelector('input[name="payment_type"][value="installments"]')?.closest('label');
    if (installments) installments.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = t('installments');
    });

    if (submitBtn) submitBtn.textContent = t('submit');
    translateStaticTextNodes(document.body);
  }

  function findTextElement(root, text) {
    if (!root || !text) return null;
    const expected = normalizeText(text);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return normalizeText(node.textContent) === expected
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    return walker.nextNode() ? walker.currentNode.parentElement : null;
  }

  function setPaymentInputChangeHandler(input) {
    input.addEventListener('change', function () {
      syncPaymentCardState();
      setPaymentAmount();
      trackCheckoutEvent('add_payment_info');
    });
  }

  function syncPaymentCardState() {
    form.querySelectorAll('input[name="payment_type"]').forEach((input) => {
      input.closest('label')?.classList.toggle('active', input.checked);
    });
  }

  function selectPaymentType(type) {
    const target = form.querySelector(`input[name="payment_type"][value="${type}"]`);
    if (!target || target.disabled) return false;

    form.querySelectorAll('input[name="payment_type"]').forEach((input) => {
      input.checked = input === target;
    });

    const legacyHidden = document.querySelector('#payment_type_hidden');
    if (legacyHidden) legacyHidden.value = type;

    syncPaymentCardState();
    setPaymentAmount();
    return true;
  }

  function normalizeInstallmentPartCounts(value) {
    const items = Array.isArray(value) ? value : [];
    const counts = items
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
    return [...new Set(counts)].sort((a, b) => a - b);
  }

  function formatInstallmentPartsOption(count) {
    return t('installmentsPartsOption').replace('{count}', String(count));
  }

  function getSelectedInstallmentPartsCount() {
    const value = Number(form.querySelector('input[name="installments_parts_count"]')?.value || 0);
    return installmentPartCounts.includes(value) ? value : installmentPartCounts[0] || 3;
  }

  function syncInstallmentPartsSelector(container, selectedCount) {
    if (!container) return;
    container.querySelectorAll('[data-parts-count]').forEach((button) => {
      const count = Number(button.getAttribute('data-parts-count'));
      button.classList.toggle('active', count === selectedCount);
      button.setAttribute('aria-pressed', count === selectedCount ? 'true' : 'false');
    });
  }

  function ensureInstallmentPartsSelector(card) {
    if (!card) return;

    const existing = card.querySelector('[data-installment-parts]');
    if (existing) existing.remove();

    const selectedCount = getSelectedInstallmentPartsCount();
    const safeSelectedCount = installmentPartCounts.includes(selectedCount)
      ? selectedCount
      : installmentPartCounts[0] || 3;
    const options = installmentPartCounts.map((count) => `
      <button
        type="button"
        class="installment-parts-option${count === safeSelectedCount ? ' active' : ''}"
        data-parts-count="${count}"
        aria-pressed="${count === safeSelectedCount ? 'true' : 'false'}"
      >${formatInstallmentPartsOption(count)}</button>
    `).join('');

    card.insertAdjacentHTML('beforeend', `
      <div class="installment-parts" data-installment-parts>
        <span class="installment-parts-label">${t('installmentsPartsLabel')}</span>
        <div class="installment-parts-options">${options}</div>
        <input type="hidden" name="installments_parts_count" value="${safeSelectedCount}">
      </div>
    `);

    const container = card.querySelector('[data-installment-parts]');
    const hiddenInput = container?.querySelector('input[name="installments_parts_count"]');
    container?.querySelectorAll('[data-parts-count]').forEach((button) => {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        const count = Number(button.getAttribute('data-parts-count'));
        if (!installmentPartCounts.includes(count)) return;
        if (hiddenInput) hiddenInput.value = String(count);
        syncInstallmentPartsSelector(container, count);
        selectPaymentType('installments');
        trackCheckoutEvent('add_payment_info');
      });
    });

  }

  function updatePaymentCardText(card, titleKey, subtitleKey, badgeKey) {
    if (!card) return;
    const title = card.querySelector('.payment-card-title, [data-payment-title]');
    const subtitle = card.querySelector('.payment-card-subtitle, [data-payment-subtitle]');
    const badge = card.querySelector('.payment-card-badge, [data-payment-badge]');

    if (title) title.textContent = t(titleKey);
    if (subtitle) subtitle.textContent = t(subtitleKey);
    if (badge) badge.textContent = t(badgeKey);

    const textNodes = [];
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    if (textNodes[0] && !title) textNodes[0].textContent = t(titleKey);
    if (textNodes[1] && !subtitle) textNodes[1].textContent = t(subtitleKey);
    if (textNodes[2] && !badge) textNodes[2].textContent = t(badgeKey);
  }

  function removeInstallmentsPaymentOption() {
    const input = form.querySelector('input[name="payment_type"][value="installments"]');
    const label = input?.closest('label');
    if (input?.checked) {
      const full = form.querySelector('input[name="payment_type"][value="full"]');
      if (full) full.checked = true;
      setPaymentAmount();
    }
    label?.remove();
  }

  function ensureInstallmentsPaymentOption() {
    const existingInput = form.querySelector('input[name="payment_type"][value="installments"]');
    if (existingInput) {
      const existingCard = existingInput.closest('label');
      ensureInstallmentPartsSelector(existingCard);
      return;
    }

    const sourceInput = form.querySelector('input[name="payment_type"][value="prepayment"]')
      || form.querySelector('input[name="payment_type"][value="full"]');
    const sourceLabel = sourceInput?.closest('label');
    if (!sourceInput || !sourceLabel || !sourceLabel.parentNode) return;

    const label = sourceLabel.cloneNode(true);
    const input = label.querySelector('input[name="payment_type"]');
    if (!input) return;

    input.value = 'installments';
    input.checked = false;
    input.disabled = false;
    input.id = 'payment-installments';
    label.id = 'card-installments';
    label.classList.remove('active');
    updatePaymentCardText(label, 'installmentsCard', 'installmentsSubtitle', 'installmentsBadge');
    ensureInstallmentPartsSelector(label);
    setPaymentInputChangeHandler(input);

    sourceLabel.parentNode.insertBefore(label, sourceLabel.nextSibling);
  }

  async function syncPaymentOptions() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payment-options`);
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.monobankParts?.enabled) {
        const counts = normalizeInstallmentPartCounts(data.monobankParts.partsCounts);
        if (counts.length) installmentPartCounts = counts;
        ensureInstallmentsPaymentOption();
      } else {
        removeInstallmentsPaymentOption();
      }
    } catch (error) {
      console.warn('Payment options load failed:', error);
      removeInstallmentsPaymentOption();
    }
  }

  function syncFullPaymentBadgeVisibility() {
    const fullPaymentCard = form.querySelector('#card-full')
      || form.querySelector('input[name="payment_type"][value="full"]')?.closest('label');
    const fullPaymentBadge = fullPaymentCard?.querySelector('.payment-card-badge')
      || findTextElement(fullPaymentCard, t('fullPaymentBadge'))
      || findTextElement(fullPaymentCard, t('internationalDeliveryBadge'));
    if (!fullPaymentBadge) return;

    if (getShippingType() === 'international') {
      fullPaymentBadge.textContent = t('internationalDeliveryBadge');
    } else {
      fullPaymentBadge.textContent = t('fullPaymentBadge');
    }
  }

  applyStaticTranslations();
  syncPaymentOptions();
  enhanceDeliveryUi(form);
  npCityInput = document.querySelector('#np-city');
  npWarehouseInput = document.querySelector('#np-warehouse');
  citySuggestions = document.querySelector('#city-suggestions');
  warehouseSuggestions = document.querySelector('#warehouse-suggestions');
  npWarehouseLabel = document.querySelector('#np-warehouse-label');
  npPickupFields = document.querySelector('#np-pickup-fields');
  npAddressFields = document.querySelector('#np-address-fields');
  internationalFields = document.querySelector('#international-fields');
  domesticFields = document.querySelector('#domestic-fields');

  const POPULAR_NP_CITIES = [
    { name: 'Київ', ref: '8d5a980d-391c-11dd-90d9-001a92567626' },
    { name: 'Львів', ref: 'db5c88f5-391c-11dd-90d9-001a92567626' },
    { name: 'Одеса', ref: 'db5c88d0-391c-11dd-90d9-001a92567626' },
    { name: 'Дніпро', ref: 'db5c88f0-391c-11dd-90d9-001a92567626' },
    { name: 'Харків', ref: 'db5c88e0-391c-11dd-90d9-001a92567626' },
  ];

  let cart = null;
  let cartTotalAmount = 0;
  let selectedCityRef = '';
  let selectedWarehouseRef = '';
  let citySearchTimer = null;
  let warehouseSearchTimer = null;
  let configuredUpsells = [];
  const citySearchCache = new Map();
  const warehouseSearchCache = new Map();
  const isNpDebug = new URLSearchParams(window.location.search).has('npdebug');
  let debugPanel = null;
  const debugLines = [];
  const TRACKING_STORAGE_KEY = 'meylin_tracking';
  const TRACKING_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'gbraid',
    'wbraid',
    'fbclid',
    'ttclid',
    'msclkid',
  ];

  function showDebugStatus(message) {
    if (!isNpDebug || !form) return;
    if (!debugPanel) {
      debugPanel = document.createElement('div');
      debugPanel.style.margin = '10px 0 18px';
      debugPanel.style.padding = '10px 12px';
      debugPanel.style.border = '1px solid #f0c36d';
      debugPanel.style.borderRadius = '8px';
      debugPanel.style.background = '#fff8e5';
      debugPanel.style.color = '#5f4700';
      debugPanel.style.fontSize = '13px';
      debugPanel.style.lineHeight = '1.4';
      debugPanel.style.whiteSpace = 'pre-wrap';
      form.prepend(debugPanel);
    }
    debugLines.push(`${new Date().toLocaleTimeString('uk-UA')} ${message}`);
    while (debugLines.length > 8) debugLines.shift();
    debugPanel.textContent = `${SCRIPT_VERSION}\n${debugLines.join('\n')}`;
  }

  function makeRequestId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function debugLog(stage, requestId, message, value) {
    try {
      const params = new URLSearchParams({
        stage: String(stage || ''),
        rid: String(requestId || ''),
        message: String(message || ''),
        value: String(value || ''),
        t: String(Date.now()),
      });
      const image = new Image();
      image.src = `${API_BASE_URL}/api/debug/log?${params.toString()}`;
      fetch(`${API_BASE_URL}/api/debug/log?${params.toString()}`, {
        mode: 'no-cors',
        keepalive: true,
      }).catch(() => {});
    } catch (error) {
      console.warn('Debug log failed:', error);
    }
  }

  showDebugStatus('script loaded');
  debugLog('script_loaded', SCRIPT_VERSION, window.location.href, navigator.userAgent);

  function readJsonStorage(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch (error) {
      return {};
    }
  }

  function getCookie(name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function collectTrackingData() {
    const params = new URLSearchParams(window.location.search);
    const saved = readJsonStorage(TRACKING_STORAGE_KEY);
    const tracking = {
      ...saved,
      landing_page: saved.landing_page || window.location.href,
      referrer: saved.referrer || document.referrer || '',
      user_agent: navigator.userAgent || '',
      page_url: window.location.href,
      fbp: getCookie('_fbp') || saved.fbp || '',
      fbc: getCookie('_fbc') || saved.fbc || '',
      ga_client_id: getCookie('_ga') || saved.ga_client_id || '',
      ga_session_id: getCookie('_ga_*') || saved.ga_session_id || '',
    };

    TRACKING_PARAMS.forEach((name) => {
      const value = params.get(name);
      if (value) tracking[name] = value;
    });

    if (tracking.fbclid && !tracking.fbc) {
      tracking.fbc = `fb.1.${Date.now()}.${tracking.fbclid}`;
    }

    localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(tracking));
    return tracking;
  }

  function getEventId(eventName) {
    return `${eventName}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getTrackingItems() {
    return (cart?.items || []).map((item) => ({
      item_id: String(item.sku || item.variant_id || item.key || ''),
      item_name: item.product_title,
      price: item.final_price / 100,
      quantity: item.quantity,
    }));
  }

  function trackCheckoutEvent(eventName, extra = {}) {
    const eventId = getEventId(eventName);
    const payload = {
      event_id: eventId,
      currency: 'UAH',
      value: cartTotalAmount || Number(amountField.value || 0) || 0,
      items: getTrackingItems(),
      payment_type: getPaymentType(),
      shipping_type: form.querySelector('input[name="shipping_type"]:checked')?.value || 'ukraine',
      np_delivery_type: getNpDeliveryType(),
      tracking: collectTrackingData(),
      ...extra,
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...payload });

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, payload);
    }
    if (typeof window.fbq === 'function') {
      const metaEvent = eventName === 'begin_checkout'
        ? 'InitiateCheckout'
        : eventName === 'add_payment_info'
          ? 'AddPaymentInfo'
          : eventName === 'add_shipping_info'
            ? 'AddShippingInfo'
            : eventName;
      window.fbq('track', metaEvent, {
        currency: payload.currency,
        value: payload.value,
        content_ids: payload.items.map((item) => item.item_id).filter(Boolean),
        contents: payload.items,
      }, { eventID: eventId });
    }
    if (window.ttq && typeof window.ttq.track === 'function') {
      const tiktokEvent = eventName === 'begin_checkout' ? 'InitiateCheckout' : eventName;
      window.ttq.track(tiktokEvent, {
        currency: payload.currency,
        value: payload.value,
        contents: payload.items,
      });
    }
  }

  function ensurePersonalDataConsent() {
    if (!form || form.querySelector('#personal-data-consent')) return;

    const label = document.createElement('label');
    label.className = 'personal-data-consent';
    label.htmlFor = 'personal-data-consent';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'personal-data-consent';
    checkbox.name = 'personal_data_consent';
    checkbox.required = true;

    const text = document.createElement('span');
    text.textContent = t('consent');

    label.appendChild(checkbox);
    label.appendChild(text);

    if (submitBtn.parentNode === form) {
      form.insertBefore(label, submitBtn);
    } else {
      submitBtn.parentNode.insertBefore(label, submitBtn);
    }
  }

  collectTrackingData();

  function enhanceDeliveryUi(currentForm) {
    if (!currentForm || currentForm.dataset.deliveryEnhanced === 'true') return;
    currentForm.dataset.deliveryEnhanced = 'true';

    const style = document.createElement('style');
    style.textContent = `
      #customCheckoutForm .shipping-type {
        border: 1px solid #e2eee7;
        border-radius: 12px;
        padding: 16px;
        background: #f8faf7;
      }
      #customCheckoutForm .shipping-type legend {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      #customCheckoutForm .shipping-type label {
        display: grid !important;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        width: 100%;
        margin: 8px 0 0 !important;
        padding: 14px 16px;
        border: 1px solid #dfe3e8;
        border-radius: 10px;
        background: #fff;
        gap: 10px;
      }
      #customCheckoutForm .shipping-type label.active {
        border-color: #97C459;
        background: #EAF3DE;
      }
      .shipping-option-text {
        font-weight: 600;
        min-width: 0;
      }
      .shipping-option-logo {
        justify-self: end;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        flex: 0 0 auto;
      }
      .shipping-option-logo svg {
        display: block;
        width: 24px;
        height: 24px;
      }
      @media (max-width: 760px) {
        #customCheckoutForm .shipping-type label {
          grid-template-columns: auto minmax(0, 1fr) 22px;
          min-height: 64px;
        }
        .shipping-option-logo,
        .shipping-option-logo svg {
          width: 22px;
          height: 22px;
        }
      }
      .delivery-panel {
        border: 1px solid #cfe6d9;
        border-radius: 12px;
        padding: 18px;
        margin-bottom: 24px;
        background: #eef8f2;
      }
      .delivery-panel[hidden] { display: none !important; }
      #customCheckoutForm .personal-data-consent {
        display: flex !important;
        align-items: flex-start;
        gap: 10px;
        margin: 18px 0 20px !important;
        padding: 14px 16px;
        border: 1px solid #e2eee7;
        border-radius: 10px;
        background: #f8faf7;
        color: #212b36 !important;
        font-size: 14px !important;
        line-height: 1.4;
        font-weight: 400 !important;
        cursor: pointer;
        text-align: left !important;
      }
      #customCheckoutForm .personal-data-consent input {
        width: 18px !important;
        height: 18px !important;
        margin: 1px 0 0 !important;
        flex: 0 0 auto;
        accent-color: #3B6D11;
        appearance: auto !important;
        -webkit-appearance: auto !important;
      }
      #customCheckoutForm .personal-data-consent span {
        display: block;
      }
      .installment-parts {
        grid-column: 1 / -1;
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }
      .installment-parts-label {
        display: block;
        color: #637381;
        font-size: 13px;
        font-weight: 600;
      }
      .installment-parts-options {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .installment-parts-option {
        min-height: 34px;
        border: 1px solid #97C459;
        border-radius: 999px;
        padding: 6px 12px;
        background: #fff;
        color: #3B6D11;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }
      .installment-parts-option.active {
        background: #C7E89A;
        color: #27500A;
      }
      .checkout-upsells {
        margin: 0 0 18px;
        padding: 14px;
        border: 1px solid #e2eee7;
        border-radius: 10px;
        background: #f8faf7;
      }
      .checkout-upsells[hidden] {
        display: none !important;
      }
      .checkout-upsells h3 {
        margin: 0 0 10px;
        font-size: 15px;
        line-height: 1.25;
        color: #212b36;
      }
      .upsell-item {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr);
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid #e5e8ec;
      }
      .upsell-item:first-of-type {
        border-top: 0;
        padding-top: 0;
      }
      .upsell-item img {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        object-fit: cover;
        background: #fff;
      }
      .upsell-body {
        min-width: 0;
      }
      .upsell-title {
        margin: 0 0 3px;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.25;
        color: #212b36;
      }
      .upsell-meta {
        margin: 0 0 8px;
        font-size: 13px;
        color: #637381;
      }
      .upsell-action {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .upsell-price {
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
        color: #212b36;
      }
      .upsell-add-btn {
        flex: 0 0 auto;
        border: 0;
        border-radius: 8px;
        padding: 7px 10px;
        background: #3B6D11;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .upsell-add-btn:disabled {
        background: #dfe3e8;
        color: #637381;
        cursor: default;
      }
      .np-type-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 18px;
      }
      .np-type-card {
        position: relative;
        margin: 0 !important;
        padding: 12px 12px !important;
        border: 1px solid #dfe3e8;
        border-radius: 10px;
        background: #fff;
        cursor: pointer;
        text-align: center !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        color: #212b36 !important;
      }
      .np-type-card input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .np-type-card.active {
        border-color: #3B6D11;
        background: #EAF3DE;
        color: #27500A !important;
      }
      .delivery-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .delivery-muted {
        margin: -4px 0 16px;
        color: #637381;
        font-size: 13px;
      }
      @media (max-width: 760px) {
        .np-type-grid,
        .delivery-row { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);

    const shippingLegend = currentForm.querySelector('.shipping-type legend');
    if (shippingLegend) shippingLegend.textContent = t('shippingMethod');

    const domesticRadio = currentForm.querySelector('input[name="shipping_type"][value="ukraine"]');
    const internationalRadio = currentForm.querySelector('input[name="shipping_type"][value="international"]');

    function decorateShippingOption(input, labelText, logoHtml) {
      const label = input?.parentElement;
      if (!label || label.dataset.decorated === 'true') return;
      label.dataset.decorated = 'true';
      input.remove();
      label.textContent = '';
      label.appendChild(input);
      label.insertAdjacentHTML('beforeend', `
        <span class="shipping-option-text">${labelText}</span>
        ${logoHtml ? `<span class="shipping-option-logo" aria-hidden="true">${logoHtml}</span>` : ''}
      `);
    }

    const novaPoshtaLogo = `
      <svg viewBox="900 2700 2150 2100" role="img" aria-label="Нова пошта">
        <path fill="#ED1C24" d="M2584 3345c6,-2 14,2 22,13 0,0 0,0 362,352 21,21 21,53 0,69 0,0 0,0 -362,358 -8,10 -16,13 -22,10 -6,-3 -10,-13 -10,-26l0 -753c0,-13 4,-21 10,-23z"></path>
        <path fill="#ED1C24" d="M1965 2758l26 0 24 10c0,0 0,0 373,369 16,21 10,36 -16,36 0,0 0,0 -155,0 -26,0 -48,22 -48,48 0,0 0,0 0,274 0,26 -21,47 -53,47 0,0 0,0 -271,0 -27,0 -48,-21 -48,-47 0,0 0,0 0,-274 0,-26 -21,-48 -48,-48l-165 0c-27,0 -32,-15 -16,-36 0,0 0,0 373,-369l24 -10 0 0z"></path>
        <path fill="#ED1C24" d="M1382 3337c6,4 10,13 10,26l0 768c0,14 -4,22 -10,24 -7,3 -16,0 -27,-8 0,0 0,0 -367,-368 -21,-16 -21,-48 0,-69 0,0 0,0 367,-363 11,-10 20,-13 27,-10l0 0z"></path>
        <path fill="#ED1C24" d="M1845 3942c0,0 0,0 271,0 32,0 54,21 54,48 0,0 0,0 0,289 0,32 21,53 47,53l144 0c27,0 37,15 16,31 0,0 0,0 -362,363 -11,11 -24,16 -37,16 -13,0 -27,-5 -37,-16 0,0 0,0 -362,-363 -22,-16 -11,-31 15,-31 0,0 0,0 155,0 27,0 48,-21 48,-53 0,0 0,0 0,-289 0,-27 21,-48 48,-48l0 0z"></path>
      </svg>
    `;

    decorateShippingOption(domesticRadio, t('novaPoshta'), novaPoshtaLogo);
    decorateShippingOption(internationalRadio, t('internationalDelivery'), '');

    const domesticWrap = currentForm.querySelector('#domestic-fields');
    if (domesticWrap) {
      domesticWrap.classList.add('delivery-panel');
      domesticWrap.innerHTML = `
        <div class="np-type-grid">
          <label class="np-type-card"><input type="radio" name="np_delivery_type" value="branch" checked>${t('branch')}</label>
          <label class="np-type-card"><input type="radio" name="np_delivery_type" value="postomat">${t('postomat')}</label>
          <label class="np-type-card"><input type="radio" name="np_delivery_type" value="address">${t('address')}</label>
        </div>

        <label for="np-city">${t('cityNovaPoshta')}</label>
        <input type="text" id="np-city" name="city" autocomplete="off" placeholder="${t('chooseCity')}">
        <div id="city-suggestions" class="suggestions"></div>

        <div id="np-pickup-fields">
          <label for="np-warehouse" id="np-warehouse-label">${t('branch')}</label>
          <input type="text" id="np-warehouse" name="warehouse" autocomplete="off" placeholder="${t('chooseBranch')}" disabled>
          <div id="warehouse-suggestions" class="suggestions"></div>
        </div>

        <div id="np-address-fields" hidden>
          <p class="delivery-muted">${t('courierAddressNote')}</p>
          <label for="np-street">${t('deliveryAddress')}</label>
          <input type="text" id="np-street" name="np_street" placeholder="${t('street')}">
          <div class="delivery-row">
            <div>
              <label for="np-house">${t('house')}</label>
              <input type="text" id="np-house" name="np_house" placeholder="${t('housePlaceholder')}">
            </div>
            <div>
              <label for="np-apartment">${t('apartmentOffice')}</label>
              <input type="text" id="np-apartment" name="np_apartment" placeholder="${t('apartmentOfficePlaceholder')}">
            </div>
          </div>
        </div>
      `;
    }

    const internationalWrap = currentForm.querySelector('#international-fields');
    if (internationalWrap) {
      internationalWrap.classList.add('delivery-panel');
      internationalWrap.innerHTML = `
        <p class="delivery-muted">${t('internationalNote')}</p>
        <label for="intl-country">${t('country')}</label>
        <input type="text" id="intl-country" name="country" placeholder="${t('chooseCountry')}">
        <label for="intl-city">${t('city')}</label>
        <input type="text" id="intl-city" name="intl_city" placeholder="${t('yourCity')}">
        <label for="intl-address">${t('deliveryAddress')}</label>
        <input type="text" id="intl-address" name="address" placeholder="${t('yourAddress')}">
        <div class="delivery-row">
          <div>
            <label for="intl-apartment">${t('apartmentRoom')}</label>
            <input type="text" id="intl-apartment" name="intl_apartment" placeholder="${t('apartmentRoomPlaceholder')}">
          </div>
          <div>
            <label for="intl-postcode">${t('postcode')}</label>
            <input type="text" id="intl-postcode" name="postcode" placeholder="${t('postcodePlaceholder')}">
          </div>
        </div>
        <input type="hidden" id="intl-warehouse" name="warehouse_np" value="">
      `;
    }
  }

  function formatMoney(amount) {
    const locale = CURRENT_LOCALE === 'en' ? 'en-US' : CURRENT_LOCALE === 'pl' ? 'pl-PL' : 'uk-UA';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'UAH',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }

  function getVisibleItemProperties(item) {
    return Object.entries(item?.properties || {})
      .filter(([key, value]) => key && !key.startsWith('_') && value !== null && value !== undefined && String(value).trim())
      .map(([key, value]) => ({
        name: key,
        value: String(value).trim(),
      }));
  }

  function renderItemProperties(item) {
    const properties = getVisibleItemProperties(item);
    if (properties.length === 0) return '';

    return `
      <div class="product-properties">
        ${properties.map((property) => `
          <p>${escapeHtml(property.name)}: ${escapeHtml(property.value)}</p>
        `).join('')}
      </div>
    `;
  }

  function getPaymentType() {
    const shippingType = form.querySelector('input[name="shipping_type"]:checked')?.value || 'ukraine';
    if (shippingType === 'international') return 'full';
    return form.querySelector('input[name="payment_type"]:checked')?.value || 'full';
  }

  function getNpDeliveryType() {
    return form.querySelector('input[name="np_delivery_type"]:checked')?.value || 'branch';
  }

  function getShippingType() {
    return form.querySelector('input[name="shipping_type"]:checked')?.value || 'ukraine';
  }

  function getShippingPrice() {
    return getShippingType() === 'international' ? INTERNATIONAL_DELIVERY_FEE : 0;
  }

  function getCheckoutTotal() {
    return cartTotalAmount + getShippingPrice();
  }

  function syncDeliveryVisibility() {
    const shippingType = getShippingType();
    const isInternational = shippingType === 'international';
    const npDeliveryType = getNpDeliveryType();
    const isAddressDelivery = npDeliveryType === 'address';
    const isPostomatDelivery = npDeliveryType === 'postomat';
    const intlCountry = document.querySelector('#intl-country');
    const intlCity = document.querySelector('#intl-city');
    const intlAddress = document.querySelector('#intl-address');
    const intlPostcode = document.querySelector('#intl-postcode');
    const intlApartment = document.querySelector('#intl-apartment');
    const npStreet = document.querySelector('#np-street');
    const npHouse = document.querySelector('#np-house');
    const npApartment = document.querySelector('#np-apartment');

    form.querySelectorAll('input[name="shipping_type"]').forEach((input) => {
      input.closest('label')?.classList.toggle('active', input.checked);
    });
    form.querySelectorAll('input[name="np_delivery_type"]').forEach((input) => {
      input.closest('label')?.classList.toggle('active', input.checked);
    });

    if (domesticFields) {
      domesticFields.hidden = isInternational;
      domesticFields.style.display = isInternational ? 'none' : '';
    }
    if (internationalFields) {
      internationalFields.hidden = !isInternational;
      internationalFields.style.display = isInternational ? '' : 'none';
    }
    if (npPickupFields) npPickupFields.hidden = isInternational || isAddressDelivery;
    if (npAddressFields) npAddressFields.hidden = isInternational || !isAddressDelivery;

    if (npWarehouseLabel) {
      npWarehouseLabel.textContent = isPostomatDelivery ? t('postomat') : t('branch');
    }
    if (npWarehouseInput) {
      npWarehouseInput.placeholder = isPostomatDelivery ? t('choosePostomat') : t('chooseBranch');
      npWarehouseInput.required = !isInternational && !isAddressDelivery;
      npWarehouseInput.disabled = isInternational || isAddressDelivery || !npCityInput?.value.trim();
      if (isAddressDelivery) npWarehouseInput.value = '';
    }
    if (npCityInput) {
      npCityInput.required = !isInternational;
      npCityInput.disabled = isInternational;
    }

    [npStreet, npHouse].forEach((input) => {
      if (!input) return;
      input.required = !isInternational && isAddressDelivery;
      input.disabled = isInternational || !isAddressDelivery;
    });
    if (npApartment) npApartment.disabled = isInternational || !isAddressDelivery;

    [intlCountry, intlCity, intlAddress, intlPostcode].forEach((input) => {
      if (!input) return;
      input.required = isInternational;
      input.disabled = !isInternational;
    });
    if (intlApartment) intlApartment.disabled = !isInternational;

    setPaymentAmount();
    syncFullPaymentBadgeVisibility();
  }

  function setPaymentAmount() {
    amountField.value = getPaymentType() === 'prepayment'
      ? PREPAYMENT_AMOUNT
      : getCheckoutTotal();
    if (cartTotalEl) cartTotalEl.textContent = formatMoney(getCheckoutTotal());
  }

  function renderCartSummary() {
    if (!cart) return;

    cartTotalAmount = cart.total_price / 100;
    window.cartTotalAmount = cartTotalAmount;
    if (typeof window.updateCartTotal === 'function') {
      window.updateCartTotal(cartTotalAmount);
    }

    if (cartTotalEl) cartTotalEl.textContent = formatMoney(getCheckoutTotal());
    if (cartItemsCountEl) cartItemsCountEl.textContent = String(cart.item_count);

    if (productsList) {
      productsList.innerHTML = cart.items.map((item) => `
        <div class="product-info">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : ''}
          <div class="product-details">
            <div class="product-text">
              <p>${escapeHtml(item.product_title)}</p>
              ${renderItemProperties(item)}
              <p>${item.quantity} ${t('pcs')}</p>
            </div>
            <div class="product-price">${formatMoney((item.final_price / 100) * item.quantity)}</div>
          </div>
        </div>
      `).join('');
    }

    renderUpsells();
    translateStaticTextNodes(document.body);

    setPaymentAmount();

    if (!sessionStorage.getItem('meylin_begin_checkout_tracked')) {
      sessionStorage.setItem('meylin_begin_checkout_tracked', 'true');
      trackCheckoutEvent('begin_checkout');
    }
  }

  async function loadCart() {
    const response = await fetch(shopifyRoute('cart.js'), {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });

    if (!response.ok) throw new Error(t('cartLoadError'));
    cart = await response.json();
    renderCartSummary();
  }

  function normalizeUpsellProduct(product) {
    const variantId = Number(product.variantId || product.variant_id || product.id || 0);
    return {
      variantId,
      handle: String(product.handle || '').trim(),
      title: String(product.title || product.name || '').trim(),
      description: String(product.description || '').trim(),
      price: Number(product.price || 0),
      image: String(product.image || '').trim(),
      quantity: Math.max(1, Math.round(Number(product.quantity || 1))),
      allowMultiple: Boolean(product.allowMultiple),
    };
  }

  function getConfiguredUpsells() {
    return configuredUpsells;
  }

  async function loadUpsellProduct(product) {
    const normalized = normalizeUpsellProduct(product);
    if (normalized.variantId && normalized.title) return normalized;
    if (!normalized.handle) return null;

    const response = await fetch(shopifyRoute(`products/${encodeURIComponent(normalized.handle)}.js`), {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });

    if (!response.ok) {
      console.warn('Upsell product not loaded:', normalized.handle);
      return null;
    }

    const shopifyProduct = await response.json();
    const variant = (shopifyProduct.variants || []).find((item) => item.available) || (shopifyProduct.variants || [])[0];
    if (!variant) return null;

    return {
      ...normalized,
      variantId: Number(variant.id),
      title: normalized.title || shopifyProduct.title,
      description: normalized.description,
      price: Number(variant.price) / 100,
      image: normalized.image || shopifyProduct.featured_image || '',
    };
  }

  async function loadUpsells() {
    const products = await Promise.all((UPSELL_PRODUCTS || []).map(loadUpsellProduct));
    configuredUpsells = products.filter((product) => product && product.variantId && product.title);
    renderUpsells();
  }

  function isUpsellInCart(variantId) {
    return Boolean((cart?.items || []).some((item) => Number(item.variant_id) === Number(variantId)));
  }

  function ensureUpsellSection() {
    if (upsellSection || !productsList) return;

    upsellSection = document.createElement('section');
    upsellSection.className = 'checkout-upsells';
    upsellSection.hidden = true;

    productsList.parentNode.insertBefore(upsellSection, productsList);
  }

  function renderUpsells() {
    ensureUpsellSection();
    if (!upsellSection) return;

    const upsells = getConfiguredUpsells();
    if (!upsells.length) {
      upsellSection.hidden = true;
      upsellSection.innerHTML = '';
      return;
    }

    upsellSection.hidden = false;
    upsellSection.innerHTML = `
      <h3>${t('upsellTitle')}</h3>
      ${upsells.map((product) => {
        const added = isUpsellInCart(product.variantId);
        const disabled = added && !product.allowMultiple;
        return `
          <div class="upsell-item" data-upsell-variant-id="${product.variantId}">
            ${product.image ? `<img src="${escapeHtml(product.image)}" alt="">` : '<div></div>'}
            <div class="upsell-body">
              <p class="upsell-title">${escapeHtml(product.title)}</p>
              ${product.description ? `<p class="upsell-meta">${escapeHtml(product.description)}</p>` : ''}
              <div class="upsell-action">
                <span class="upsell-price">${formatMoney(product.price)}</span>
                <button class="upsell-add-btn" type="button" data-upsell-add="${product.variantId}" ${disabled ? 'disabled' : ''}>
                  ${disabled ? t('added') : t('add')}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  async function addUpsellToCart(variantId) {
    const product = getConfiguredUpsells().find((item) => Number(item.variantId) === Number(variantId));
    if (!product) throw new Error(t('upsellNotFound'));

    const response = await fetch(shopifyRoute('cart/add.js'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        id: product.variantId,
        quantity: product.quantity,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.description || data.message || t('addProductError'));
    }

    await loadCart();
    renderUpsells();
  }

  async function clearCart() {
    const response = await fetch(shopifyRoute('cart/clear.js'), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });

    if (!response.ok) throw new Error(t('clearCartError'));
    cart = await response.json().catch(() => ({ items: [], item_count: 0, total_price: 0 }));
    cartTotalAmount = 0;
    renderCartSummary();
  }

  function hideSuggestions(container) {
    if (!container) return;
    container.style.display = 'none';
    container.innerHTML = '';
  }

  function renderSuggestions(container, items, onSelect) {
    if (!container) return;
    container.innerHTML = '';

    if (!items.length) {
      hideSuggestions(container);
      return;
    }

    items.forEach((item) => {
      const option = document.createElement('div');
      option.textContent = item.label;
      option.addEventListener('mousedown', function (event) {
        event.preventDefault();
        onSelect(item);
        hideSuggestions(container);
      });
      container.appendChild(option);
    });

    container.style.display = 'block';
  }

  function renderSuggestionMessage(container, message) {
    if (!container) return;
    container.innerHTML = '';
    const option = document.createElement('div');
    option.textContent = message;
    option.style.cursor = 'default';
    option.style.color = '#637381';
    container.appendChild(option);
    container.style.display = 'block';
  }

  function fetchJsonp(url, requestId) {
    return new Promise((resolve, reject) => {
      const callbackName = `npCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const requestUrl = new URL(url);
      requestUrl.searchParams.set('callback', callbackName);
      if (requestId) requestUrl.searchParams.set('rid', requestId);
      let isDone = false;
      debugLog('jsonp_start', requestId, callbackName, requestUrl.pathname);

      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };

      window[callbackName] = (data) => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timeoutId);
        debugLog('jsonp_callback', requestId, `keys:${Object.keys(data || {}).join(',')}`, '');
        cleanup();
        if (data && data.error) {
          reject(new Error(data.details || data.error));
          return;
        }
        resolve(data || {});
      };

      script.onerror = () => {
        if (isDone) return;
        isDone = true;
        clearTimeout(timeoutId);
        debugLog('jsonp_error', requestId, 'script.onerror', requestUrl.toString());
        cleanup();
        reject(new Error(t('requestFailed')));
      };

      script.onload = () => {
        debugLog('jsonp_load', requestId, isDone ? 'loaded_after_callback' : 'loaded_without_callback', callbackName);
      };

      const timeoutId = setTimeout(() => {
        if (isDone) return;
        isDone = true;
        debugLog('jsonp_timeout', requestId, callbackName, requestUrl.toString());
        cleanup();
        reject(new Error(t('npTimeout')));
      }, 12000);

      script.src = requestUrl.toString();
      document.head.appendChild(script);
    });
  }

  async function fetchJsonWithTimeout(url, timeoutMs = 5000, requestId = '') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, timeoutMs);

    try {
      debugLog('fetch_start', requestId, url, '');
      const response = await fetch(url, {
        signal: controller ? controller.signal : undefined,
        headers: {
          Accept: 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.details || data.error || t('requestFailed'));
      debugLog('fetch_success', requestId, `status:${response.status}`, `keys:${Object.keys(data || {}).join(',')}`);
      return data;
    } catch (error) {
      debugLog('fetch_error', requestId, error instanceof Error ? error.message : String(error), '');
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchJson(url, requestId = '') {
    if (url.includes('/api/np/')) {
      try {
        return await fetchJsonWithTimeout(url, 5000, requestId);
      } catch (error) {
        console.warn('Nova Poshta fetch failed, trying JSONP fallback:', error);
        showDebugStatus(`fetch failed, trying jsonp: ${error instanceof Error ? error.message : String(error)}`);
        debugLog('fallback_to_jsonp', requestId, error instanceof Error ? error.message : String(error), '');
        try {
          return await fetchJsonp(url, requestId);
        } catch (jsonpError) {
          const fetchMessage = error instanceof Error ? error.message : String(error);
          const jsonpMessage = jsonpError instanceof Error ? jsonpError.message : String(jsonpError);
          showDebugStatus(`both failed: fetch ${fetchMessage}; jsonp ${jsonpMessage}`);
          throw new Error(`fetch: ${fetchMessage}; jsonp: ${jsonpMessage}`);
        }
      }
    }

    return fetchJsonWithTimeout(url, 10000, requestId);
  }

  async function searchCities(query) {
    const cacheKey = query.trim().toLowerCase();
    if (citySearchCache.has(cacheKey)) {
      showDebugStatus(`cities cache hit: ${query}`);
      return citySearchCache.get(cacheKey);
    }

    const requestId = makeRequestId('cities');
    showDebugStatus(`cities search start: ${query} / ${requestId}`);
    debugLog('cities_search_start', requestId, query, '');
    const data = await fetchJson(`${API_BASE_URL}/api/np/cities?query=${encodeURIComponent(query)}&rid=${encodeURIComponent(requestId)}`, requestId);
    const cities = data.cities || [];
    showDebugStatus(`cities success: ${query}, count ${cities.length}`);
    debugLog('cities_search_success', requestId, query, `count:${cities.length}`);
    citySearchCache.set(cacheKey, cities);
    return cities;
  }

  function findPopularCity(query) {
    const normalized = query.trim().toLowerCase();
    return POPULAR_NP_CITIES.find((city) => city.name.toLowerCase() === normalized) || null;
  }

  function findPopularCityMatches(query) {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return POPULAR_NP_CITIES.filter((city) => city.name.toLowerCase().startsWith(normalized));
  }

  async function searchWarehouses(query) {
    const params = new URLSearchParams();
    params.set('query', query || '');
    if (selectedCityRef) {
      params.set('cityRef', selectedCityRef);
    } else if (npCityInput?.value) {
      params.set('city', npCityInput.value);
    }

    const cacheKey = `${getNpDeliveryType()}|${params.toString()}`.toLowerCase();
    if (warehouseSearchCache.has(cacheKey)) {
      showDebugStatus(`warehouses cache hit`);
      return warehouseSearchCache.get(cacheKey);
    }

    const requestId = makeRequestId('warehouses');
    params.set('rid', requestId);
    showDebugStatus(`warehouses search start: ${requestId}`);
    debugLog('warehouses_search_start', requestId, params.toString(), '');
    const data = await fetchJson(`${API_BASE_URL}/api/np/warehouses?${params.toString()}`, requestId);
    const warehouses = data.warehouses || [];
    showDebugStatus(`warehouses success: count ${warehouses.length}`);
    debugLog('warehouses_search_success', requestId, params.toString(), `count:${warehouses.length}`);
    const npDeliveryType = getNpDeliveryType();
    if (npDeliveryType === 'postomat') {
      const filtered = warehouses.filter((warehouse) => String(warehouse.name || '').toLowerCase().includes('поштомат'));
      warehouseSearchCache.set(cacheKey, filtered);
      return filtered;
    }
    if (npDeliveryType === 'branch') {
      const filtered = warehouses.filter((warehouse) => !String(warehouse.name || '').toLowerCase().includes('поштомат'));
      warehouseSearchCache.set(cacheKey, filtered);
      return filtered;
    }
    warehouseSearchCache.set(cacheKey, warehouses);
    return warehouses;
  }

  function setupNovaPoshtaAutocomplete() {
    if (!npCityInput || !npWarehouseInput || !citySuggestions || !warehouseSuggestions) return;

    const popularCities = document.createElement('div');
    popularCities.style.display = 'flex';
    popularCities.style.flexWrap = 'wrap';
    popularCities.style.gap = '8px';
    popularCities.style.margin = '-10px 0 20px';

    POPULAR_NP_CITIES.forEach((city) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = city.name;
      button.style.border = '1px solid #dfe3e8';
      button.style.background = '#f8faf7';
      button.style.color = '#212b36';
      button.style.borderRadius = '999px';
      button.style.padding = '7px 12px';
      button.style.fontSize = '14px';
      button.style.cursor = 'pointer';

      button.addEventListener('click', function () {
        npCityInput.value = city.name;
        selectedCityRef = city.ref;
        selectedWarehouseRef = '';
        hideSuggestions(citySuggestions);
        hideSuggestions(warehouseSuggestions);
        npWarehouseInput.value = '';
        syncDeliveryVisibility();
        if (getNpDeliveryType() !== 'address') {
          npWarehouseInput.disabled = false;
          npWarehouseInput.focus();
        }
      });

      popularCities.appendChild(button);
    });

    citySuggestions.insertAdjacentElement('afterend', popularCities);

    npCityInput.addEventListener('input', function () {
      const query = npCityInput.value.trim();
      selectedCityRef = '';
      selectedWarehouseRef = '';
      npWarehouseInput.value = '';
      npWarehouseInput.disabled = getNpDeliveryType() === 'address' || query.length < 2;
      hideSuggestions(warehouseSuggestions);
      syncDeliveryVisibility();

      clearTimeout(citySearchTimer);
      if (query.length < 2) {
        npWarehouseInput.disabled = true;
        hideSuggestions(citySuggestions);
        return;
      }

      renderSuggestionMessage(citySuggestions, t('searchingCities'));
      citySearchTimer = setTimeout(async function () {
        const uiTimeoutId = setTimeout(() => {
          renderSuggestionMessage(citySuggestions, t('citiesPhoneError'));
        }, 6500);

        try {
          const popularMatches = findPopularCityMatches(query);
          if (popularMatches.length) {
            clearTimeout(uiTimeoutId);
            renderSuggestions(
              citySuggestions,
              popularMatches.map((city) => ({
                label: city.name,
                value: city.name,
                ref: city.ref,
              })),
              function (city) {
                npCityInput.value = city.value;
                selectedCityRef = city.ref;
                selectedWarehouseRef = '';
                syncDeliveryVisibility();
                if (getNpDeliveryType() !== 'address') {
                  npWarehouseInput.disabled = false;
                  npWarehouseInput.focus();
                }
              },
            );
            return;
          }

          const popularCity = findPopularCity(query);
          if (popularCity) {
            clearTimeout(uiTimeoutId);
            selectedCityRef = popularCity.ref;
            selectedWarehouseRef = '';
            hideSuggestions(citySuggestions);
            syncDeliveryVisibility();
            if (getNpDeliveryType() !== 'address') {
              npWarehouseInput.disabled = false;
            }
            return;
          }

          const cities = await searchCities(query);
          clearTimeout(uiTimeoutId);
          if (!cities.length) {
            renderSuggestionMessage(citySuggestions, t('cityNotFound'));
            return;
          }
          renderSuggestions(
            citySuggestions,
            cities.map((city) => ({
              label: [city.name, city.area].filter(Boolean).join(', '),
              value: city.name,
              ref: city.ref,
            })),
            function (city) {
              npCityInput.value = city.value;
              selectedCityRef = city.ref;
              selectedWarehouseRef = '';
              syncDeliveryVisibility();
              if (getNpDeliveryType() !== 'address') {
                npWarehouseInput.disabled = false;
                npWarehouseInput.focus();
              }
            },
          );
        } catch (error) {
          clearTimeout(uiTimeoutId);
          console.error(error);
          renderSuggestionMessage(
            citySuggestions,
            `${t('citiesErrorPrefix')}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }, 300);
    });

    npWarehouseInput.addEventListener('input', function () {
      if (getNpDeliveryType() === 'address') {
        selectedWarehouseRef = '';
        hideSuggestions(warehouseSuggestions);
        return;
      }

      const query = npWarehouseInput.value.trim();
      selectedWarehouseRef = '';
      clearTimeout(warehouseSearchTimer);
      if (!selectedCityRef && !npCityInput.value.trim()) {
        hideSuggestions(warehouseSuggestions);
        return;
      }

      renderSuggestionMessage(warehouseSuggestions, t('searchingWarehouses'));
      warehouseSearchTimer = setTimeout(async function () {
        const uiTimeoutId = setTimeout(() => {
          renderSuggestionMessage(warehouseSuggestions, t('warehousesPhoneError'));
        }, 6500);

        try {
          const warehouses = await searchWarehouses(query);
          clearTimeout(uiTimeoutId);
          if (!warehouses.length) {
            renderSuggestionMessage(warehouseSuggestions, t('warehouseNotFound'));
            return;
          }
          renderSuggestions(
            warehouseSuggestions,
            warehouses.map((warehouse) => ({
              label: warehouse.name,
              value: warehouse.name,
              ref: warehouse.ref,
            })),
            function (warehouse) {
              npWarehouseInput.value = warehouse.value;
              selectedWarehouseRef = warehouse.ref || '';
            },
          );
        } catch (error) {
          clearTimeout(uiTimeoutId);
          console.error(error);
          renderSuggestionMessage(
            warehouseSuggestions,
            `${t('warehousesErrorPrefix')}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }, 300);
    });

    npCityInput.addEventListener('blur', function () {
      setTimeout(function () {
        hideSuggestions(citySuggestions);
      }, 150);
    });

    npWarehouseInput.addEventListener('focus', function () {
      if (!npWarehouseInput.value && (selectedCityRef || npCityInput.value.trim())) {
        npWarehouseInput.dispatchEvent(new Event('input'));
      }
    });

    npWarehouseInput.addEventListener('blur', function () {
      setTimeout(function () {
        hideSuggestions(warehouseSuggestions);
      }, 150);
    });
  }

  function collectPayload() {
    const formData = new FormData(form);
    const shippingType = String(formData.get('shipping_type') || 'ukraine');
    const paymentType = getPaymentType();
    const npDeliveryType = String(formData.get('np_delivery_type') || 'branch');
    const shippingPrice = getShippingPrice();

    return {
      locale: CURRENT_LOCALE,
      payment_type: paymentType,
      installments_parts_count: paymentType === 'installments' ? getSelectedInstallmentPartsCount() : undefined,
      amount: paymentType === 'prepayment' ? PREPAYMENT_AMOUNT : getCheckoutTotal(),
      cart_total: cartTotalAmount,
      cart_token: cart?.token || '',
      customer: {
        first_name: String(formData.get('first_name') || '').trim(),
        last_name: String(formData.get('last_name') || '').trim(),
        phone: String(formData.get('phone') || '').trim(),
        email: String(formData.get('email') || '').trim(),
      },
      shipping_type: shippingType,
      shipping: shippingType === 'international'
        ? {
            type: 'international',
            country: String(formData.get('country') || '').trim(),
            intl_city: String(formData.get('intl_city') || '').trim(),
            address: String(formData.get('address') || '').trim(),
            apartment: String(formData.get('intl_apartment') || '').trim(),
            warehouse: String(formData.get('warehouse_np') || '').trim(),
            postcode: String(formData.get('postcode') || '').trim(),
            shipping_price: shippingPrice,
          }
        : {
            type: 'ukraine',
            delivery_method: npDeliveryType,
            city: String(formData.get('city') || '').trim(),
            city_ref: selectedCityRef,
            warehouse: npDeliveryType === 'address' ? '' : String(formData.get('warehouse') || '').trim(),
            warehouse_ref: npDeliveryType === 'address' ? '' : selectedWarehouseRef,
            street: String(formData.get('np_street') || '').trim(),
            house: String(formData.get('np_house') || '').trim(),
            apartment: String(formData.get('np_apartment') || '').trim(),
          },
      goods: (cart?.items || []).map((item) => ({
        code: item.sku || item.variant_id || item.key,
        variant_id: item.variant_id,
        variant_title: item.variant_title || '',
        name: item.product_title,
        price: item.final_price / 100,
        quantity: item.quantity,
        properties: getVisibleItemProperties(item),
      })),
      comment: String(formData.get('comment') || '').trim(),
      personal_data_consent: formData.get('personal_data_consent') === 'on',
      tracking: collectTrackingData(),
      utm: collectTrackingData(),
    };
  }

  document.querySelectorAll('input[name="payment_type"]').forEach((input) => {
    input.addEventListener('change', function () {
      syncPaymentCardState();
      setPaymentAmount();
      trackCheckoutEvent('add_payment_info');
    });
  });

  form.querySelector('.payment-cards')?.addEventListener('click', function (event) {
    const card = event.target?.closest?.('label');
    if (!card || !this.contains(card)) return;

    const input = card.querySelector('input[name="payment_type"]');
    if (!input) return;

    event.preventDefault();
    if (selectPaymentType(input.value)) {
      trackCheckoutEvent('add_payment_info');
    }
  });

  document.querySelectorAll('input[name="shipping_type"], input[name="np_delivery_type"]').forEach((input) => {
    input.addEventListener('change', function () {
      hideSuggestions(citySuggestions);
      hideSuggestions(warehouseSuggestions);
      if (input.name === 'np_delivery_type' && npWarehouseInput) {
        npWarehouseInput.value = '';
        selectedWarehouseRef = '';
      }
      syncDeliveryVisibility();
      trackCheckoutEvent('add_shipping_info');
    });
  });

  syncDeliveryVisibility();
  document.addEventListener('DOMContentLoaded', syncDeliveryVisibility);
  setTimeout(syncDeliveryVisibility, 0);

  setupNovaPoshtaAutocomplete();
  ensurePersonalDataConsent();
  ensureUpsellSection();
  loadUpsells().catch((error) => {
    console.warn('Upsells load failed:', error);
  });

  if (productsList?.parentNode) {
    productsList.parentNode.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-upsell-add]');
      if (!button) return;

      button.disabled = true;
      const previousText = button.textContent;
      button.textContent = t('adding');
      try {
        await addUpsellToCart(button.dataset.upsellAdd);
      } catch (error) {
        alert(error instanceof Error ? error.message : t('addProductError'));
        button.disabled = false;
        button.textContent = previousText;
      }
    });
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!form.reportValidity()) return;
    if (!cart) await loadCart();
    if (!cart || cart.item_count === 0) {
      alert(t('emptyCart'));
      return;
    }

    const previousText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = t('creatingPayment');
    trackCheckoutEvent('checkout_payment_redirect_start');

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectPayload()),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || (!data.invoiceUrl && data.paymentFlow !== 'monobank_parts')) {
        throw new Error(data.details || data.error || t('createPaymentError'));
      }

      submitBtn.textContent = t('clearingCart');
      await clearCart();

      if (data.paymentFlow === 'monobank_parts') {
        alert(data.message || t('installmentsRequestSent'));
        window.location.href = data.redirectUrl || shopifyRoute('/');
        return;
      }

      window.location.href = data.invoiceUrl;
    } catch (error) {
      alert(error instanceof Error ? error.message : t('paymentCreateAlert'));
      submitBtn.disabled = false;
      submitBtn.textContent = previousText;
    }
  });

  loadCart().catch((error) => {
    console.error(error);
    submitBtn.disabled = true;
    submitBtn.textContent = t('cartUnavailable');
  });
})();
