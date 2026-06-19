window.PG = window.PG || {};
PG.pokedex = {
  render(gridEl, progressEl, state) {
    gridEl.innerHTML = '';
    PG.data.ROSTER.forEach(p => {
      const caught = state.caught.has(p.id);
      const shiny = state.caughtShiny.has(p.id);
      const card = document.createElement('div');
      card.className = 'dex-card ' + (caught ? 'caught' : 'uncaught') + (shiny ? ' shiny' : '');
      card.setAttribute('data-testid', 'dex-card-' + p.id);
      if (shiny) {
        const badge = document.createElement('span');
        badge.className = 'shiny-badge';
        badge.textContent = '✨';
        badge.setAttribute('data-testid', 'shiny-badge-' + p.id);
        card.appendChild(badge);
      }
      if (caught) {
        const num = document.createElement('span');
        num.className = 'dex-num';
        num.textContent = '#' + String(p.id).padStart(3, '0');
        card.appendChild(num);
      }
      const img = document.createElement('img');
      img.className = 'dex-img';
      img.src = PG.data.spritePath(p.id, shiny);
      img.alt = caught ? p.name : '';
      const name = document.createElement('div');
      name.className = 'dex-name';
      name.textContent = caught ? p.name : PG.data.t('unknownName');
      card.appendChild(img);
      card.appendChild(name);
      gridEl.appendChild(card);
    });
    if (progressEl) {
      progressEl.textContent =
        PG.data.t('progress', { x: state.caught.size, n: PG.data.ROSTER.length }) +
        '  ·  ' + PG.data.t('shinyProgress', { y: state.caughtShiny.size });
    }
  },
};
