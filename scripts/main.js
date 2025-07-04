class NPCNexusModule {
  constructor() {
    this.strapiUrl = '';
    this.campaigns = [];
    this.npcs = new Map(); // Stores NPCs by campaign: Map<campaignName, Array<NPC>>
    this.loadedCampaigns = new Set();
    this.isOpen = false;
    this.activeCampaign = '';
    this.filters = {
      name: '',
      type: '',
      isNPC: null
    };
    this._init();
  }

  static ID = 'npc-nexus';
  static instance = null; // Singleton instance

  static initialize() {
    if (!NPCNexusModule.instance) {
      NPCNexusModule.instance = new NPCNexusModule();
    }
    return NPCNexusModule.instance;
  }

  /**
   * Initialize the module
   */
  _init() {
    game.settings.register(NPCNexusModule.ID, 'strapiUrl', {
      name: 'Strapi URL',
      hint: 'URL do seu servidor Strapi (ex: http://localhost:1337)',
      scope: 'world',
      config: true,
      type: String,
      default: 'https://tokens.rolandodados.com.br'
    });

    this.strapiUrl = this._normalizeBaseUrl(game.settings.get(NPCNexusModule.ID, 'strapiUrl'));

    // Add controls to the left sidebar
    Hooks.on('renderSidebarTab', (app, html) => {
      if (app.tabName === 'actors') {
        this._addNPCButton(html);
      }
    });

    // Initialize when ready
    Hooks.once('ready', () => {
      this._createSidePanel();
      this._bindEvents();
      this._exposeAPI();
    });
  }

  /**
   * Normalizes the base URL by removing trailing slashes
   * @param {string} url - The base URL to normalize
   * @returns {string} The normalized URL without trailing slash
   */
  _normalizeBaseUrl(url) {
    if (!url) return '';
    return url.replace(/\/+$/, ''); // Remove all trailing slashes
  }

  /**
   * Normalizes an endpoint by ensuring it starts with a slash
   * @param {string} endpoint - The endpoint to normalize
   * @returns {string} The normalized endpoint starting with a slash
   */
  _normalizeEndpoint(endpoint) {
    if (!endpoint) return '/';
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  }

  /**
   * Expose API for macros and external access
   */
  _exposeAPI() {
    // Expose on the module
    const module = game.modules.get(NPCNexusModule.ID);
    if (module) {
      module.api = {
        togglePanel: () => this.togglePanel(),
        openPanel: () => this.openPanel(),
        closePanel: () => this.closePanel(),
        getInstance: () => this
      };
    }

    // Also expose globally for easier macro access
    window.NPCNexusModule = {
      togglePanel: () => this.togglePanel(),
      openPanel: () => this.openPanel(),
      closePanel: () => this.closePanel(),
      getInstance: () => this
    };

    // And on the game object
    game.npcNexus = {
      togglePanel: () => this.togglePanel(),
      openPanel: () => this.openPanel(),
      closePanel: () => this.closePanel(),
      getInstance: () => this
    };

    console.log('NPC Nexus Module API exposed successfully');
  }

  /**
   * Adds the NPC button to the actors sidebar.
   * @param {jQuery} html - The sidebar HTML element.
   */
  _addNPCButton(html) {
    const button = $(`
      <button class="npc-nexus-btn" title="NPCs Strapi">
        <i class="fas fa-users"></i> NPCs Strapi
      </button>
    `);

    button.click(() => this.togglePanel());
    html.find('.directory-header').append(button);
  }

  /**
   * Creates the main side panel HTML structure.
   */
  _createSidePanel() {
    const panel = $(`
      <div id="npc-nexus-panel" class="npc-nexus-panel">
        <div class="panel-header">
          <h3><i class="fas fa-users"></i> NPCs - Strapi</h3>
          <button class="close-btn" title="Fechar">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="panel-content">
          <div class="campaign-selector">
            <label for="campaign-select">Selecionar Campanha:</label>
            <select id="campaign-select">
              <option value="">Escolha uma campanha...</option>
            </select>
            <button id="load-campaign-btn" disabled>Carregar Campanha</button>
          </div>

          <div class="filters-section" style="display: none;">
            <div class="filter-group">
              <input type="text" id="name-filter" placeholder="Filtrar por nome..." />
              <select id="type-filter">
                <option value="">Todos os tipos</option>
              </select>
              <select id="isnpc-filter">
                <option value="">Todos</option>
                <option value="true">Apenas NPCs</option>
                <option value="false">Apenas PCs</option>
              </select>
            </div>
          </div>

          <div class="npcs-grid" id="npcs-grid">
            <div class="info-message">Selecione uma campanha para carregar os NPCs</div>
          </div>
        </div>
      </div>
    `);

    $('body').append(panel);
  }

  /**
   * Binds event listeners to the panel elements.
   */
  _bindEvents() {
    // Close button
    $(document).on('click', '.npc-nexus-panel .close-btn', () => {
      this.togglePanel();
    });

    // Campaign selector
    $(document).on('change', '#campaign-select', (e) => {
      const selectedCampaign = e.target.value;
      const loadBtn = $('#load-campaign-btn');
      
      if (selectedCampaign) {
        loadBtn.prop('disabled', false);
      } else {
        loadBtn.prop('disabled', true);
        $('.filters-section').hide();
        $('#npcs-grid').html(`<div class="info-message">Selecione uma campanha para carregar os NPCs</div>`);
      }
    });

    // Load campaign button
    $(document).on('click', '#load-campaign-btn', (e) => {
      const selectedCampaign = $('#campaign-select').val();
      if (selectedCampaign) {
        this.setActiveCampaign(selectedCampaign);
      }
    });

    // Filters
    $(document).on('input', '#name-filter', (e) => {
      this.filters.name = e.target.value;
      this._filterAndRenderNPCs();
    });

    $(document).on('change', '#type-filter', (e) => {
      this.filters.type = e.target.value;
      this._filterAndRenderNPCs();
    });

    $(document).on('change', '#isnpc-filter', (e) => {
      this.filters.isNPC = e.target.value === '' ? null : e.target.value === 'true';
      this._filterAndRenderNPCs();
    });

    // NPC token click - modificar token selecionado
    $(document).on('click', '.npc-token', (e) => {
      const tokenUrl = $(e.currentTarget).data('token-url');
      const npcName = $(e.currentTarget).data('npc-name');
      this._updateSelectedToken(tokenUrl, npcName);
    });
  }

  /**
   * Toggles the visibility of the side panel.
   */
  async togglePanel() {
    const panel = $('#npc-nexus-panel');

    if (this.isOpen) {
      panel.removeClass('open');
      this.isOpen = false;
    } else {
      panel.addClass('open');
      this.isOpen = true;

      if (this.campaigns.length === 0) {
        await this._loadCampaigns();
      }
    }
  }

  /**
   * Opens the side panel.
   */
  async openPanel() {
    if (!this.isOpen) {
      await this.togglePanel();
    }
  }

  /**
   * Closes the side panel.
   */
  closePanel() {
    if (this.isOpen) {
      this.togglePanel();
    }
  }

  /**
   * Fetches data from the Strapi API with proper URL construction.
   * @param {string} endpoint - The API endpoint (e.g., 'api/npcs').
   * @param {object} params - Query parameters.
   * @returns {Promise<object>} The JSON response data.
   */
  async _fetchFromStrapi(endpoint, params = {}) {
    // Normalize the endpoint - remove leading slash if present
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const fullUrl = `${this.strapiUrl}/${normalizedEndpoint}`;
    
    const url = new URL(fullUrl);
    
    // Add query parameters properly
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects like pagination and filters
        Object.keys(value).forEach(subKey => {
          if (typeof value[subKey] === 'object' && value[subKey] !== null) {
            // Handle deeper nesting like filters[campaign][$containsi]
            Object.keys(value[subKey]).forEach(deepKey => {
              url.searchParams.append(`${key}[${subKey}][${deepKey}]`, value[subKey][deepKey]);
            });
          } else {
            url.searchParams.append(`${key}[${subKey}]`, value[subKey]);
          }
        });
      } else {
        url.searchParams.append(key, value);
      }
    });

    console.log(`Fetching from Strapi: ${url.toString()}`);

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Strapi response:', data);
      return data;
    } catch (error) {
      console.error('Strapi fetch error:', error);
      throw error;
    }
  }

  /**
   * Loads all unique campaigns from Strapi.
   */
  async _loadCampaigns() {
    try {
      // Buscar campanhas com parâmetros corretos
      const data = await this._fetchFromStrapi('api/npcs', {
        fields: ['campaign'],
        pagination: {
          limit: 1000
        }
      });

      const campaignSet = new Set();

      // Verificar se data e data.data existem
      if (data && data.data && Array.isArray(data.data)) {
        data.data.forEach(npc => {
          // Verificar se tem campaign
          if (npc && npc.campaign) {
            campaignSet.add(npc.campaign.trim());
          }
        });
      }

      this.campaigns = Array.from(campaignSet).sort();
      console.log('Campaigns found:', this.campaigns);
      this._populateCampaignSelect();

      if (this.campaigns.length === 0) {
        $('#npcs-grid').html(`<div class="info-message">Nenhuma campanha encontrada</div>`);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      ui.notifications.error('Erro ao conectar com o Strapi. Verifique a URL nas configurações.');
      $('#npcs-grid').html(`<div class="error-message">Erro ao conectar com o Strapi. Verifique a URL nas configurações.</div>`);
    }
  }

  /**
   * Populates the campaign select dropdown.
   */
  _populateCampaignSelect() {
    const campaignSelect = $('#campaign-select');
    campaignSelect.find('option:not(:first)').remove(); // Keep "Choose campaign" option

    this.campaigns.forEach(campaign => {
      campaignSelect.append(`<option value="${campaign}">${campaign}</option>`);
    });
  }

  /**
   * Populates the type filter dropdown with unique NPC types.
   * @param {string[]} types - Array of unique NPC types.
   */
  _populateTypeFilter(types) {
    const typeFilter = $('#type-filter');
    typeFilter.find('option:not(:first)').remove(); // Keep "All types" option

    types.sort().forEach(type => {
      typeFilter.append(`<option value="${type}">${type}</option>`);
    });
  }

  /**
   * Sets the active campaign and loads/renders NPCs for it.
   * @param {string} campaign - The name of the campaign to activate.
   */
  async setActiveCampaign(campaign) {
    this.activeCampaign = campaign;

    // Load NPCs for this campaign if not already loaded
    if (!this.loadedCampaigns.has(campaign)) {
      await this._loadNPCsForCampaign(campaign);
    }

    // Show filters section
    $('.filters-section').show();
    
    this._filterAndRenderNPCs();
  }

  /**
   * Loads NPCs for a specific campaign from Strapi with correct populate.
   * @param {string} campaign - The campaign name.
   */
  async _loadNPCsForCampaign(campaign) {
    const grid = $('#npcs-grid');
    grid.html(`<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> Carregando NPCs...</div>`);

    try {
      // Buscar NPCs da campanha específica
      const data = await this._fetchFromStrapi('api/npcs', {
        'populate[token][populate]': '*',
        filters: {
          campaign: {
            '$containsi': campaign.trim()
          }
        },
        pagination: {
          limit: 1000
        }
      });

      console.log('NPCs loaded for campaign:', campaign, data);

      if (data && data.data && Array.isArray(data.data)) {
        this.npcs.set(campaign, data.data);
        this.loadedCampaigns.add(campaign);

        // Extrair tipos únicos para este campaign
        const typeSet = new Set();
        data.data.forEach(npc => {
          if (npc && npc.type) {
            typeSet.add(npc.type);
          }
        });
        this._populateTypeFilter(Array.from(typeSet));

        console.log(`Loaded ${data.data.length} NPCs for campaign: ${campaign}`);
      } else {
        this.npcs.set(campaign, []);
        this.loadedCampaigns.add(campaign);
        console.log(`No NPCs found for campaign: ${campaign}`);
      }

    } catch (error) {
      console.error('Error loading NPCs for campaign:', error);
      grid.html(`<div class="error-message">Erro ao conectar com o Strapi. Verifique a URL nas configurações.</div>`);
    }
  }

  /**
   * Applies filters and renders the NPCs in the grid.
   */
  _filterAndRenderNPCs() {
    const grid = $('#npcs-grid');
    const campaignNPCs = this.npcs.get(this.activeCampaign) || [];

    console.log('Filtering NPCs for campaign:', this.activeCampaign, campaignNPCs);

    if (campaignNPCs.length === 0) {
      grid.html(`<div class="empty-message">Nenhum NPC encontrado nesta campanha</div>`);
      return;
    }

    const filteredNPCs = this._applyFilters(campaignNPCs);

    if (filteredNPCs.length === 0) {
      grid.html(`<div class="empty-message">Nenhum NPC encontrado com os filtros aplicados</div>`);
      return;
    }

    let html = '';
    filteredNPCs.forEach(npc => {
      // Verificar se npc existe
      if (!npc) {
        console.warn('NPC without data found:', npc);
        return;
      }

      // Acessar as imagens de token de forma mais robusta
      const tokens = this._extractTokenImages(npc.token);
      console.log('Tokens extracted for NPC:', npc.name, tokens);

      html += `
        <div class="npc-card">
          <div class="npc-header">
            <h4>${npc.name || 'Unknown'}</h4>
            <span class="npc-type">${npc.type || 'Unknown'}</span>
            ${npc.isNPC ? `<span class="npc-badge">NPC</span>` : `<span class="pc-badge">PC</span>`}
          </div>
          <div class="npc-tokens">
            ${tokens.map(token => {
              const fullUrl = `${this.strapiUrl}${token.url}`;
              const thumbnailUrl = this._getThumbnailUrl(token);
              const displayUrl = thumbnailUrl ? `${this.strapiUrl}${thumbnailUrl}` : fullUrl;

              return `
                <div class="npc-token" data-token-url="${fullUrl}" data-npc-name="${npc.name}" title="Clique para alterar token selecionado">
                  <img src="${displayUrl}" alt="${token.name || 'Token'}" loading="lazy" />
                </div>
              `;
            }).join('')}
          </div>
          ${tokens.length === 0 ? '<div class="no-tokens">Nenhum token disponível</div>' : ''}
        </div>
      `;
    });

    grid.html(html);
  }

  /**
   * Extracts token images from Strapi response handling different possible structures.
   * @param {*} tokenData - The token data from Strapi response
   * @returns {Array} Array of token image objects
   */
  _extractTokenImages(tokenData) {
    if (!tokenData) return [];

    // Se for um array direto
    if (Array.isArray(tokenData)) {
      return tokenData.map(token => this._normalizeTokenData(token));
    }

    // Se tiver estrutura data
    if (tokenData.data) {
      if (Array.isArray(tokenData.data)) {
        return tokenData.data.map(token => this._normalizeTokenData(token));
      } else {
        return [this._normalizeTokenData(tokenData.data)];
      }
    }

    // Se for um objeto único
    if (tokenData.attributes || tokenData.url) {
      return [this._normalizeTokenData(tokenData)];
    }

    return [];
  }

  /**
   * Normalizes token data from different Strapi response structures.
   * @param {*} token - Token data object
   * @returns {object} Normalized token object
   */
  _normalizeTokenData(token) {
    if (!token) return null;

    // Se já tem estrutura attributes
    if (token.attributes) {
      return {
        url: token.attributes.url,
        name: token.attributes.name,
        formats: token.attributes.formats,
        alternativeText: token.attributes.alternativeText
      };
    }

    // Se é um objeto direto da imagem
    if (token.url) {
      return {
        url: token.url,
        name: token.name,
        formats: token.formats,
        alternativeText: token.alternativeText
      };
    }

    return null;
  }

  /**
   * Gets the best thumbnail URL for a token image.
   * @param {object} token - Token image object
   * @returns {string|null} Thumbnail URL or null
   */
  _getThumbnailUrl(token) {
    if (!token || !token.formats) return null;

    // Prioridade: thumbnail > small > medium
    if (token.formats.thumbnail) {
      return token.formats.thumbnail.url;
    }
    if (token.formats.small) {
      return token.formats.small.url;
    }
    if (token.formats.medium) {
      return token.formats.medium.url;
    }

    return null;
  }

  /**
   * Applies the current filters to a list of NPCs.
   * @param {Array<object>} npcs - The list of NPCs to filter.
   * @returns {Array<object>} The filtered list of NPCs.
   */
  _applyFilters(npcs) {
    return npcs.filter(npc => {
      // Verificar se npc existe
      if (!npc) return false;

      const matchesName = !this.filters.name ||
        (npc.name && npc.name.toLowerCase().includes(this.filters.name.toLowerCase()));

      const matchesType = !this.filters.type ||
        npc.type === this.filters.type;

      const matchesIsNPC = this.filters.isNPC === null ||
        npc.isNPC === this.filters.isNPC;

      return matchesName && matchesType && matchesIsNPC;
    });
  }

  /**
   * Updates the selected token's image and optionally name.
   * @param {string} tokenUrl - The URL of the new token image.
   * @param {string} npcName - The name of the NPC.
   */
  async _updateSelectedToken(tokenUrl, npcName) {
    console.log('=== TOKEN UPDATE DEBUG ===');
    console.log('Attempting to update token with URL:', tokenUrl);
    console.log('NPC Name:', npcName);
    console.log('Strapi URL base:', this.strapiUrl);
    
    try {
      // Verificar se há tokens selecionados
      const controlled = canvas.tokens.controlled;
      console.log('Controlled tokens:', controlled.length);
      
      if (controlled.length === 0) {
        ui.notifications.warn('Selecione um token na cena para alterar sua imagem');
        return;
      }

      if (controlled.length > 1) {
        ui.notifications.warn('Selecione apenas um token por vez');
        return;
      }

      const token = controlled[0];
      console.log('Selected token:', token);
      console.log('Current token image:', token.document.img);
      
      // Atualizar a imagem do token
      await token.document.update({
      "texture.src": tokenUrl,        name: npcName
      });
      token.refresh();

      console.log('Token updated successfully with URL:', tokenUrl);
      ui.notifications.info(`Token atualizado com a imagem de "${npcName}"`);

    } catch (error) {
      console.error('Error updating token:', error);
      ui.notifications.error('Erro ao atualizar o token');
    }
  }
}

// Initialize module when Foundry is ready
Hooks.once('init', NPCNexusModule.initialize);