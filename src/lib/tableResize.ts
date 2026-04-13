type Cleanup = () => void;

function setupResizableTable(table: HTMLTableElement): Cleanup {
  if (table.dataset.resizeDisabled === 'true') return () => {};
  if (table.dataset.resizeReady === '1') return () => {};
  table.dataset.resizeReady = '1';

  const headerRow = table.tHead?.rows?.[0];
  if (!headerRow) return () => {};
  const headers = Array.from(headerRow.cells) as HTMLTableCellElement[];
  if (headers.length === 0) return () => {};
  const customMode = table.dataset.resizeMode === 'custom';

  let colGroup = table.querySelector('colgroup');
  if (!colGroup) {
    colGroup = document.createElement('colgroup');
    headers.forEach((th) => {
      const col = document.createElement('col');
      col.style.width = `${Math.max(48, Math.round(th.getBoundingClientRect().width || th.offsetWidth || 80))}px`;
      colGroup!.appendChild(col);
    });
    table.insertBefore(colGroup, table.firstChild);
  }

  const cols = Array.from(colGroup.querySelectorAll('col'));
  if (cols.length !== headers.length) return () => {};

  table.classList.add('resizable-table');
  table.style.tableLayout = 'fixed';

  const disposers: Cleanup[] = [];

  headers.forEach((th, index) => {
    th.classList.add('resizable-th');
    const explicitlyEnabled = th.dataset.resizable === 'true';
    const canResize = customMode ? explicitlyEnabled : index !== headers.length - 1;
    if (!canResize) return;

    const handle = document.createElement('span');
    handle.className = 'col-resize-handle';
    th.appendChild(handle);

    const onMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const currentWidth = cols[index].getBoundingClientRect().width || th.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(48, Math.round(currentWidth + delta));
        cols[index].style.width = `${nextWidth}px`;
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
    disposers.push(() => {
      handle.removeEventListener('mousedown', onMouseDown);
      handle.remove();
    });
  });

  return () => {
    disposers.forEach(fn => fn());
  };
}

export function enableGlobalTableResize(): Cleanup {
  const cleanups = new Map<HTMLTableElement, Cleanup>();

  const initAll = () => {
    const tables = Array.from(document.querySelectorAll('table'));
    tables.forEach((table) => {
      const el = table as HTMLTableElement;
      if (!cleanups.has(el)) cleanups.set(el, setupResizableTable(el));
    });
  };

  initAll();

  const observer = new MutationObserver(() => {
    initAll();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    cleanups.forEach((cleanup) => cleanup());
    cleanups.clear();
  };
}
