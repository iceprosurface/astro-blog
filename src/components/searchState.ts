
export const searchModalState = {
  isOpen: false,
  open: function () {
    this.isOpen = true;
    this.emit('change');
  },
  close: function () {
    this.isOpen = false;
    this.emit('change');
  },
  toggle: function () {
    this.isOpen = !this.isOpen;
    this.emit('change');
  },
  openTagMode: function () {
    this.isOpen = true;
    this.emit('change');
    return '#';
  },
  subscribers: new Set(),
  emit: function (event) {
    this.subscribers.forEach(callback => callback(event, this.isOpen));
  },
  subscribe: function (callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  },
};

let keyboardInitialized = false;
let buttonHandlersInitialized = false;

export function initSearchKeyboardShortcuts() {
  if (keyboardInitialized) return;
  keyboardInitialized = true;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
      e.preventDefault();
      searchModalState.openTagMode();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchModalState.toggle();
      return;
    }

    if (e.key === 'Escape' && searchModalState.isOpen) {
      searchModalState.close();
    }
  });
}

export function initSearchButtonHandlers() {
  if (buttonHandlersInitialized) return;
  buttonHandlersInitialized = true;

  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (!target) return;

    const searchBtn = target.closest('#search-btn');
    const sidebarSearchBtn = target.closest('#sidebar-search-btn');

    if (searchBtn || sidebarSearchBtn) {
      e.preventDefault();
      searchModalState.toggle();
    }
  });
}
