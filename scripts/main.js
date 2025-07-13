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
      npcsOnly: false,
      hideTaken: false
    };
    this._currentContextMenuData = null;
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
    // Register module settings
    game.settings.register(NPCNexusModule.ID, 'strapiUrl', {
      name: game.i18n.localize('npc-nexus.settings.strapiUrl.name'),
      hint: game.i18n.localize('npc-nexus.settings.strapiUrl.hint'),
      scope: 'world',
      config: true,
      type: String,
      default: 'https://tokens.rolandodados.com.br'
    });

    game.settings.register(NPCNexusModule.ID, 'jwtToken', {
      name: 'Chave JWT',
      hint: 'Token JWT para autenticação com o Strapi (necessário para deletar NPCs)',
      scope: 'world',
      config: true,
      type: String,
      default: ''
    });

    game.settings.register(NPCNexusModule.ID, 'visibleCampaigns', {
      name: 'Campanhas Visíveis',
      hint: 'Lista de campanhas que devem aparecer no dropdown, separadas por vírgula. Deixe vazio para mostrar todas. Exemplo: Campanha1, Campanha2, Campanha3',
      scope: 'world',
      config: true,
      type: String,
      default: ''
    });

    game.settings.register(NPCNexusModule.ID, 'tokenSize', {
      name: 'Tamanho das Imagens de Token',
      hint: 'Controla o tamanho das imagens dos tokens no painel',
      scope: 'client',
      config: true,
      type: String,
      choices: {
        "small": "Pequeno (80px)",
        "medium": "Médio (120px)",
        "large": "Grande (160px)",
        "xlarge": "Extra Grande (200px)"
      },
      default: "medium",
      onChange: () => {
        // Re-render the panel if it's open to apply new size
        if (this.isOpen) {
          this._filterAndRenderNPCs();
        }
      }
    });

    game.settings.register(NPCNexusModule.ID, 'panelSide', {
      name: 'Lado do Painel',
      hint: 'Escolha em qual lado da tela o painel deve aparecer',
      scope: 'client',
      config: true,
      type: String,
      choices: {
        "right": "Direita",
        "left": "Esquerda"
      },
      default: "right",
      onChange: () => {
        // Update panel position if it's open
        if (this.isOpen) {
          this._updatePanelPosition();
        }
      }
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
  }

  /**
   * Adds the NPC button to the actors sidebar.
   * @param {jQuery} html - The sidebar HTML element.
   */
  _addNPCButton(html) {
    const button = $(`
      <button class="npc-nexus-btn" title="${game.i18n.localize('npc-nexus.ui.title')}">
        <i class="fas fa-users"></i> ${game.i18n.localize('npc-nexus.ui.openButton')}
      </button>
    `);

    button.click(() => this.togglePanel());
    html.find('.directory-header').append(button);
  }

  /**
   * Creates the main side panel using the HTML template.
   */
  async _createSidePanel() {
    try {
      const html = await renderTemplate('modules/npc-nexus/templates/npc-nexus-panel.html', {});
      $('body').append(html);

      // Apply token size CSS class
      this._applyTokenSize();
      this._updatePanelPosition();
    } catch (error) {
      console.error('Error creating side panel:', error);
      // Fallback to creating panel manually if template fails
      this._createSidePanelFallback();
    }
  }

  /**
   * Fallback method to create side panel if template loading fails
   */
  _createSidePanelFallback() {
    const panel = $(`
      <div id="npc-nexus-panel" class="npc-nexus-panel">
        <div class="panel-header">
          <h3><i class="fas fa-users"></i>${game.i18n.localize('npc-nexus.ui.title')}</h3>
          <button class="close-btn" title="${game.i18n.localize('npc-nexus.ui.close')}">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="panel-content">
          <div class="campaign-selector">
            <label for="campaign-select">${game.i18n.localize('npc-nexus.ui.selectCampaign')}:</label>
            <select id="campaign-select">
              <option value="">${game.i18n.localize('npc-nexus.ui.chooseCampaign')}...</option>
            </select>
            <button id="load-campaign-btn" disabled>${game.i18n.localize('npc-nexus.ui.loadCampaign')}</button>
          </div>

          <div class="filters-section" style="display: none;">
            <div class="filter-group">
              <input type="text" id="name-filter" placeholder="${game.i18n.localize('npc-nexus.ui.filters.name')}" />
              <select id="type-filter">
                <option value="">${game.i18n.localize('npc-nexus.ui.filters.allTypes')}</option>
              </select>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="npcs-only-filter" />
                  <span>${game.i18n.localize('npc-nexus.ui.filters.npcsOnly')}</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="hide-taken-filter" />
                  <span>${game.i18n.localize('npc-nexus.ui.filters.hideTaken')}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="npcs-grid" id="npcs-grid">
            <div class="info-message">${game.i18n.localize('npc-nexus.ui.selectCampaignMessage')}</div>
          </div>
        </div>
      </div>
    `);

    $('body').append(panel);
    this._applyTokenSize();
  }

  /**
   * Apply the token size setting to the panel
   */
  _applyTokenSize() {
    const tokenSize = game.settings.get(NPCNexusModule.ID, 'tokenSize');
    const panel = $('#npc-nexus-panel');
    
    // Remove existing size classes
    panel.removeClass('token-size-small token-size-medium token-size-large token-size-xlarge');
    
    // Add current size class
    panel.addClass(`token-size-${tokenSize}`);
  }

  /**
   * Update panel position based on settings
   */
  _updatePanelPosition() {
    const panelSide = game.settings.get(NPCNexusModule.ID, 'panelSide');
    const panel = $('#npc-nexus-panel');
    
    // Remove existing position classes
    panel.removeClass('panel-left panel-right');
    
    // Add current position class
    panel.addClass(`panel-${panelSide}`);
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
        $('#npcs-grid').html(`<div class="info-message">${game.i18n.localize('npc-nexus.ui.selectCampaignMessage')}</div>`);
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

    $(document).on('change', '#npcs-only-filter', (e) => {
      this.filters.npcsOnly = e.target.checked;
      this._filterAndRenderNPCs();
    });

    $(document).on('change', '#hide-taken-filter', (e) => {
      this.filters.hideTaken = e.target.checked;
      this._filterAndRenderNPCs();
    });

    // NPC token click - modificar token selecionado
    $(document).on('click', '.token-item', (e) => {
      const tokenUrl = $(e.currentTarget).data('token-url');
      const npcName = $(e.currentTarget).data('npc-name');
      const npcId = $(e.currentTarget).data('npc-id');
      const npcText = $(e.currentTarget).data('npc-text');
      this._updateSelectedToken(tokenUrl, npcName, npcId, npcText);
    });

    // NPC token right-click - show context menu
    $(document).on('contextmenu', '.token-item', (e) => {
      e.preventDefault();
      const tokenElement = $(e.currentTarget);
      const npcId = tokenElement.data('npc-id');
      const npcName = tokenElement.data('npc-name');
      
      this._currentContextMenuData = { npcId, npcName };
      this._showContextMenu(e.pageX, e.pageY);
    });

    // Context menu item clicks
    $(document).on('click', '.context-menu-item', (e) => {
      const action = $(e.currentTarget).data('action');
      this._hideContextMenu();
      
      if (!this._currentContextMenuData) return;
      
      switch (action) {
        case 'view-notes':
          this._showNPCNotes();
          break;
        case 'edit-npc':
          this._showEditNPCDialog();
          break;
        case 'delete-npc':
          this._showDeleteNPCDialog();
          break;
      }
    });

    // Hide context menu when clicking outside
    $(document).on('click', (e) => {
      if (!$(e.target).closest('.context-menu').length) {
        this._hideContextMenu();
      }
    });

    // Type header collapse/expand
    $(document).on('click', '.type-header', (e) => {
      const typeGroup = $(e.currentTarget).closest('.type-group');
      typeGroup.toggleClass('collapsed');
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

      // Apply token size when opening
      this._applyTokenSize();

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

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
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
      // Buscar todas as campanhas usando paginação
      let allNPCs = [];
      let page = 1;
      let hasMorePages = true;
      const pageSize = 100;

      while (hasMorePages) {
        const data = await this._fetchFromStrapi('api/npcs', {
          fields: ['campaign'],
          pagination: {
            page: page,
            pageSize: pageSize
          }
        });

        if (data && data.data && Array.isArray(data.data)) {
          allNPCs = allNPCs.concat(data.data);
        }

        // Verificar se há mais páginas
        if (data.meta && data.meta.pagination) {
          const { page: currentPage, pageCount } = data.meta.pagination;
          hasMorePages = currentPage < pageCount;
          page++;
          
          console.log(`NPC Nexus: ${game.i18n.localize('npc-nexus.ui.loading')} - Página ${currentPage} de ${pageCount}`);
        } else {
          hasMorePages = false;
        }
      }

      const campaignSet = new Set();

      // Processar todos os NPCs carregados
      allNPCs.forEach(npc => {
        // Verificar se tem campaign
        const campaign = npc.campaign || npc.attributes?.campaign;
        if (campaign) {
          campaignSet.add(campaign.trim());
        }
      });

      this.campaigns = Array.from(campaignSet).sort();
      console.log('NPC Nexus: Total de campanhas encontradas:', this.campaigns.length, this.campaigns);
      this._populateCampaignSelect();

      if (this.campaigns.length === 0) {
        $('#npcs-grid').html(`<div class="info-message">${game.i18n.localize('npc-nexus.ui.noCampaignsFound')}</div>`);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      ui.notifications.error(game.i18n.localize('npc-nexus.ui.error'));
      $('#npcs-grid').html(`<div class="error-message">${game.i18n.localize('npc-nexus.ui.error')}</div>`);
    }
  }

  /**
   * Populates the campaign select dropdown filtering by visible campaigns setting.
   */
  _populateCampaignSelect() {
    const campaignSelect = $('#campaign-select');
    campaignSelect.find('option:not(:first)').remove(); // Keep "Choose campaign" option

    // Get visible campaigns setting
    const visibleCampaignsString = game.settings.get(NPCNexusModule.ID, 'visibleCampaigns');
    let visibleCampaigns = [];

    if (visibleCampaignsString && visibleCampaignsString.trim()) {
      // Parse the comma-separated list and trim whitespace
      visibleCampaigns = visibleCampaignsString
        .split(',')
        .map(campaign => campaign.trim())
        .filter(campaign => campaign.length > 0);
    }

    // Filter campaigns based on settings
    let campaignsToShow = this.campaigns;
    if (visibleCampaigns.length > 0) {
      campaignsToShow = this.campaigns.filter(campaign => 
        visibleCampaigns.includes(campaign)
      );
    }

    campaignsToShow.forEach(campaign => {
      campaignSelect.append(`<option value="${campaign}">${campaign}</option>`);
    });

    // Show message if no campaigns match the filter
    if (campaignsToShow.length === 0 && visibleCampaigns.length > 0) {
      $('#npcs-grid').html(`<div class="info-message">${game.i18n.localize('npc-nexus.ui.noCampaignsMatchFilter')}.<br>
         ${game.i18n.localize('npc-nexus.ui.availableCampaigns')}: ${this.campaigns.join(', ')}<br>
         ${game.i18n.localize('npc-nexus.ui.currentFilter')}: ${visibleCampaigns.join(', ')}</div>`);
    }
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
    grid.html(`<div class="loading-message"><i class="fas fa-spinner fa-spin"></i> ${game.i18n.localize('npc-nexus.ui.loading')}</div>`);

    try {
      // Buscar todos os NPCs da campanha específica usando paginação
      let allNPCs = [];
      let page = 1;
      let hasMorePages = true;
      const pageSize = 100;

      while (hasMorePages) {
        const data = await this._fetchFromStrapi('api/npcs', {
          'populate[token][populate]': '*',
          filters: {
            campaign: {
              '$containsi': campaign.trim()
            }
          },
          pagination: {
            page: page,
            pageSize: pageSize
          }
        });

        if (data && data.data && Array.isArray(data.data)) {
          allNPCs = allNPCs.concat(data.data);
        }

        // Verificar se há mais páginas
        if (data.meta && data.meta.pagination) {
          const { page: currentPage, pageCount } = data.meta.pagination;
          hasMorePages = currentPage < pageCount;
          page++;
          
          console.log(`NPC Nexus: Carregando NPCs da campanha "${campaign}" - Página ${currentPage} de ${pageCount}`);
        } else {
          hasMorePages = false;
        }
      }

      if (allNPCs.length > 0) {
        // Process NPCs to normalize structure
        const processedNPCs = allNPCs.map(npc => {
          // Check if NPC has attributes structure (Strapi v4 format)
          if (npc.attributes) {
            return {
              id: npc.id,
              documentId: npc.documentId, // Store both id and documentId for Strapi 5
              ...npc.attributes
            };
          } else {
            return {
              ...npc,
              documentId: npc.documentId || npc.id // Fallback to id if no documentId
            };
          }
        });
        
        this.npcs.set(campaign, processedNPCs);
        this.loadedCampaigns.add(campaign);
        
        console.log(`NPC Nexus: Total de NPCs carregados para "${campaign}":`, processedNPCs.length);

        // Extrair tipos únicos para este campaign
        const typeSet = new Set();
        processedNPCs.forEach(npc => {
          if (npc && npc.type) {
            typeSet.add(npc.type);
          }
        });
        this._populateTypeFilter(Array.from(typeSet));

      } else {
        this.npcs.set(campaign, []);
        this.loadedCampaigns.add(campaign);
        console.log(`NPC Nexus: Nenhum NPC encontrado para a campanha "${campaign}"`);
      }

    } catch (error) {
      console.error('Error loading NPCs for campaign:', error);
      grid.html(`<div class="error-message">${game.i18n.localize('npc-nexus.ui.error')}</div>`);
    }
  }

  /**
   * Applies filters and renders the NPCs in the grid.
   */
  _filterAndRenderNPCs() {
    const grid = $('#npcs-grid');
    const campaignNPCs = this.npcs.get(this.activeCampaign) || [];

    if (campaignNPCs.length === 0) {
      grid.html(`<div class="empty-message">${game.i18n.localize('npc-nexus.ui.empty')}</div>`);
      return;
    }

    const filteredNPCs = this._applyFilters(campaignNPCs);

    if (filteredNPCs.length === 0) {
      grid.html(`<div class="empty-message">${game.i18n.localize('npc-nexus.ui.emptyFiltered')}</div>`);
      return;
    }

    // Group NPCs by type
    const groupedNPCs = {};
    filteredNPCs.forEach(npc => {
      const type = npc.type || 'Outros'; // Use 'Outros' for NPCs without type
      if (!groupedNPCs[type]) {
        groupedNPCs[type] = [];
      }
      groupedNPCs[type].push(npc);
    });

    // Sort types alphabetically
    const sortedTypes = Object.keys(groupedNPCs).sort();

    let html = '';
    
    // Iterate through each type group
    sortedTypes.forEach(type => {
      const npcsInGroup = groupedNPCs[type];
      
      // Collect all tokens for this type
      let allTokensForType = [];
      npcsInGroup.forEach(npc => {
        if (!npc) return;
        
        const tokens = this._extractTokenImages(npc.token);
        tokens.forEach(token => {
          const fullUrl = `${this.strapiUrl}${token.url}`;
          const thumbnailUrl = this._getThumbnailUrl(token);
          const displayUrl = thumbnailUrl ? `${this.strapiUrl}${thumbnailUrl}` : fullUrl;
          
          allTokensForType.push({
            fullUrl,
            displayUrl,
            npcName: npc.name,
            npcId: npc.id,
            npcDocumentId: npc.documentId, // Store both for reference
            tokenName: token.name || 'Token',
            isNPC: npc.isNPC,
            isTaken: npc.isTaken,
            npcText: npc.text || ''
          });
        });
      });
      
      // Create one box for all tokens of this type
      html += `
        <div class="type-group">
          <h3 class="type-header">
            <div class="type-header-content">
              <span>${type} (${allTokensForType.length})</span>
            </div>
            <div class="type-toggle">
              <i class="fas fa-chevron-down"></i>
            </div>
          </h3>
          <div class="tokens-container">
            ${allTokensForType.map(tokenData => `
              <div class="token-item ${tokenData.isTaken ? 'token-taken' : ''}" 
                   data-token-url="${tokenData.fullUrl}" 
                   data-npc-name="${tokenData.npcName}" 
                   data-npc-id="${tokenData.npcId}"
                   data-npc-document-id="${tokenData.npcDocumentId}"
                   data-npc-text="${tokenData.npcText}"
                   title="${game.i18n.localize('npc-nexus.ui.clickToChangeToken')}">
                <img src="${tokenData.displayUrl}" alt="${tokenData.tokenName}" loading="lazy" />
                <div class="token-badges">
                  ${tokenData.isNPC === true ? `<span class="npc-badge">NPC</span>` : ''}
                  ${tokenData.isNPC === false ? `<span class="pc-badge">PC</span>` : ''}
                  ${tokenData.isTaken ? `<span class="taken-badge">Ocupado</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
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
        id: token.id,
        url: token.attributes.url,
        name: token.attributes.name,
        formats: token.attributes.formats,
        alternativeText: token.attributes.alternativeText
      };
    }

    // Se é um objeto direto da imagem
    if (token.url) {
      return {
        id: token.id,
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

      const matchesNPCsOnly = !this.filters.npcsOnly ||
        npc.isNPC === true;

      const matchesHideTaken = !this.filters.hideTaken ||
        npc.isTaken !== true;

      return matchesName && matchesType && matchesNPCsOnly && matchesHideTaken;
    });
  }

  /**
   * Finds the correct path for notes/biography field based on the actor's system
   * @param {object} systemData - The actor's system data
   * @returns {string|null} The path to the notes field or null if not found
   */
  _getValidNotesPath(systemData) {
    // Check for GURPS-style notes object
    if (systemData.notes && typeof systemData.notes === 'object' && 'notes' in systemData.notes) {
      return 'system.notes';
    }
    
    // Check for simple notes string
    if ('notes' in systemData && typeof systemData.notes === 'string') {
      return 'system.notes';
    }
    
    // Check for bio field (common in many systems)
    if ('bio' in systemData) {
      return 'system.bio';
    }
    
    // Check for biography field
    if ('biography' in systemData) {
      return 'system.biography';
    }
    
    // Check for details.notes (D&D 5e style)
    if (systemData.details && 'notes' in systemData.details) {
      return 'system.details.notes';
    }
    
    // Check for details.biography (D&D 5e style)
    if (systemData.details && 'biography' in systemData.details) {
      return 'system.details.biography';
    }
    
    // Check for character.bio (some systems)
    if (systemData.character && 'bio' in systemData.character) {
      return 'system.character.bio';
    }
    
    return null;
  }

  /**
   * Updates the selected token's image and optionally name.
   * @param {string} tokenUrl - The URL of the new token image.
   * @param {string} npcName - The name of the NPC.
   * @param {string} npcId - The ID of the NPC.
   * @param {string} npcText - The notes/text of the NPC.
   */
  async _updateSelectedToken(tokenUrl, npcName, npcId, npcText) {
    try {
      const controlled = canvas.tokens.controlled;
      if (controlled.length !== 1) {
        ui.notifications.warn(game.i18n.localize('npc-nexus.ui.selectExactlyOneToken'));
        return;
      }

      const token = controlled[0];
      const actor = token.actor;
      if (!actor) {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.tokenNotAssociatedWithActor'));
        return;
      }

      // Prepare actor update data
      const actorUpdateData = {
        'prototypeToken.texture.src': tokenUrl,
        'prototypeToken.img': tokenUrl,
        img: tokenUrl,
        name: npcName
      };

      // Add notes if available and find valid path
      if (npcText && actor.system) {
        const notesPath = this._getValidNotesPath(actor.system);
        if (notesPath) {
          if (notesPath === 'system.notes' && actor.system.notes && typeof actor.system.notes === 'object') {
            // GURPS-style notes object
            actorUpdateData['system.notes.notes'] = npcText;
          } else {
            // Simple string field
            actorUpdateData[notesPath] = npcText;
          }
        }
      }

      // Update the actor first
      await actor.update(actorUpdateData);

      // Then update the token document in the scene
      await token.document.update({
        'texture.src': tokenUrl,
        img: tokenUrl,
        name: npcName
      });

      // Force refresh of the token to ensure changes are visible
      await token.refresh();

      // Force refresh of the actor sheet (if open)
      const sheet = actor.sheet;
      if (sheet?.rendered) {
        sheet.render(true);
      }

      const message = npcText 
        ? game.i18n.localize('npc-nexus.ui.tokenActorAndNotesUpdated')
        : game.i18n.localize('npc-nexus.ui.tokenAndActorUpdated');
      ui.notifications.info(message);

    } catch (err) {
      console.error(err);
      ui.notifications.error(game.i18n.localize('npc-nexus.ui.errorUpdatingToken'));
    }
  }

  /**
   * Show context menu for NPC token
   */
  _showContextMenu(x, y) {
    // Remove existing context menu
    this._hideContextMenu();

    const menu = $(`
      <div class="context-menu" style="position: fixed; left: ${x}px; top: ${y}px;">
        <button class="context-menu-item" data-action="view-notes">
          <i class="fas fa-book"></i> ${game.i18n.localize('npc-nexus.ui.contextMenu.viewNotes')}
        </button>
        <button class="context-menu-item" data-action="edit-npc">
          <i class="fas fa-edit"></i> ${game.i18n.localize('npc-nexus.ui.contextMenu.editNpc')}
        </button>
        <button class="context-menu-item context-menu-delete" data-action="delete-npc">
          <i class="fas fa-trash"></i> ${game.i18n.localize('npc-nexus.ui.contextMenu.deleteNpc')}
        </button>
        </div>
    `);

    $('body').append(menu);
  }

  /**
   * Hide context menu
   */
  _hideContextMenu() {
    $('.context-menu').remove();
  }

  /**
   * Show NPC notes in a dialog
   */
  _showNPCNotes() {
    if (!this._currentContextMenuData) return;

    const { npcId, npcName } = this._currentContextMenuData;
    const campaignNPCs = this.npcs.get(this.activeCampaign) || [];
    const foundNpc = campaignNPCs.find(npc => npc.id.toString() === npcId.toString());

    if (!foundNpc) {
      ui.notifications.warn(game.i18n.localize('npc-nexus.ui.npcNotFound'));
      return;
    }

    const content = foundNpc.text || game.i18n.localize('npc-nexus.ui.noNotesAvailable');

    new Dialog({
      title: game.i18n.format('npc-nexus.ui.editDialog.notesTitle', { name: npcName }),
      content: `<div class="notes-dialog">
        <div class="notes-content">${content}</div>
      </div>`,
      buttons: {
        close: {
          label: game.i18n.localize('npc-nexus.ui.editDialog.close'),
          callback: () => {}
        }
      },
      default: "close",
      classes: ["notes-dialog"]
    }, {
      classes: ["notes-dialog"],
      width: 500,
      height: 400
    }).render(true);
  }

  /**
   * Show edit NPC dialog
   */
  _showEditNPCDialog() {
    if (!this._currentContextMenuData) return;

    const { npcId, npcName } = this._currentContextMenuData;
    
    const campaignNPCs = this.npcs.get(this.activeCampaign) || [];
    const foundNpc = campaignNPCs.find(npc => npc.id.toString() === npcId.toString());

    if (!foundNpc) {
      ui.notifications.warn(game.i18n.localize('npc-nexus.ui.npcNotFound'));
      return;
    }

    const content = `
      <div class="edit-npc-dialog">
        <form id="edit-npc-form">
          <div class="form-group">
            <label for="edit-name" class="form-label">Nome:</label>
            <input type="text" id="edit-name" name="name" value="${foundNpc.name || ''}" class="form-input" />
          </div>
          
          <div class="form-group">
            <label for="edit-type" class="form-label">Tipo:</label>
            <input type="text" id="edit-type" name="type" value="${foundNpc.type || ''}" class="form-input" />
          </div>
          
          <div class="form-group">
            <label for="edit-campaign" class="form-label">Campanha:</label>
            <input type="text" id="edit-campaign" name="campaign" value="${foundNpc.campaign || ''}" class="form-input" />
          </div>
          
          <div class="form-group">
            <label for="edit-text" class="form-label">Anotações:</label>
            <textarea id="edit-text" name="text" rows="6" class="form-textarea">${foundNpc.text || ''}</textarea>
          </div>
          
          <div class="checkbox-container">
            <input type="checkbox" id="edit-isNPC" name="isNPC" ${foundNpc.isNPC ? 'checked' : ''} class="checkbox-input" />
            <label for="edit-isNPC" class="checkbox-label">É NPC</label>
          </div>
          
          <div class="checkbox-container">
            <input type="checkbox" id="edit-isTaken" name="isTaken" ${foundNpc.isTaken ? 'checked' : ''} class="checkbox-input" />
            <label for="edit-isTaken" class="checkbox-label">Está Ocupado</label>
          </div>
        </form>
      </div>
    `;

    new Dialog({
      title: game.i18n.format('npc-nexus.ui.editDialog.title', { name: npcName }),
      content: content,
      buttons: {
        save: {
          label: game.i18n.localize('npc-nexus.ui.editDialog.save'),
          callback: (html) => this._saveNPCChanges(html, foundNpc)
        },
        cancel: {
          label: game.i18n.localize('npc-nexus.ui.editDialog.cancel'),
          callback: () => {}
        }
      },
      default: "save",
      render: (html) => {
        // Focus on name field when dialog opens
        html.find('#edit-name').focus();
      },
      classes: ["edit-npc-dialog"]
    }, {
      classes: ["edit-npc-dialog"],
      width: 500,
      height: 600
    }).render(true);
  }

  /**
   * Show delete NPC confirmation dialog
   */
  _showDeleteNPCDialog() {
    if (!this._currentContextMenuData) return;

    const { npcId, npcName } = this._currentContextMenuData;
    
    // Check if JWT token is configured
    const jwtToken = game.settings.get(NPCNexusModule.ID, 'jwtToken');
    if (!jwtToken || jwtToken.trim() === '') {
      ui.notifications.error(game.i18n.localize('npc-nexus.ui.deleteDialog.jwtRequired'));
      return;
    }

    const campaignNPCs = this.npcs.get(this.activeCampaign) || [];
    const foundNpc = campaignNPCs.find(npc => npc.id.toString() === npcId.toString());

    if (!foundNpc) {
      ui.notifications.warn(game.i18n.localize('npc-nexus.ui.npcNotFound'));
      return;
    }

    new Dialog({
      title: game.i18n.format('npc-nexus.ui.deleteDialog.title', { name: npcName }),
      content: `<div class="delete-npc-dialog">
        <p class="delete-warning">${game.i18n.localize('npc-nexus.ui.deleteDialog.confirmMessage')}</p>
      </div>`,
      buttons: {
        delete: {
          label: game.i18n.localize('npc-nexus.ui.deleteDialog.confirmDelete'),
          callback: () => this._deleteNPC(foundNpc)
        },
        cancel: {
          label: game.i18n.localize('npc-nexus.ui.deleteDialog.cancel'),
          callback: () => {}
        }
      },
      default: "cancel",
      classes: ["delete-npc-dialog"]
    }, {
      classes: ["delete-npc-dialog"],
      width: 400,
      height: 200
    }).render(true);
  }

  /**
   * Delete NPC from Strapi including associated media
   */
  async _deleteNPC(npc) {
    try {
      const jwtToken = game.settings.get(NPCNexusModule.ID, 'jwtToken');
      
      if (!jwtToken || jwtToken.trim() === '') {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.deleteDialog.jwtRequired'));
        return;
      }

      // Show loading notification
      ui.notifications.info(game.i18n.localize('npc-nexus.ui.deleteDialog.deleting'));

      // First, delete associated media files
      if (npc.token) {
        const tokens = this._extractTokenImages(npc.token);
        for (const token of tokens) {
          if (token && token.id) {
            try {
              await fetch(`${this.strapiUrl}/api/upload/files/${token.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${jwtToken}`,
                  'Content-Type': 'application/json'
                }
              });
              console.log(`Media file ${token.id} deleted successfully`);
            } catch (mediaError) {
              console.warn('Error deleting media file:', mediaError);
              // Continue with NPC deletion even if media deletion fails
            }
          }
        }
      }

      // Delete the NPC using documentId for Strapi 5
      const documentId = npc.documentId || npc.id;
      const deleteUrl = `${this.strapiUrl}/api/npcs/${documentId}`;

      console.log(`Attempting to delete NPC at: ${deleteUrl}`);
      console.log(`Using JWT token: ${jwtToken ? 'Token present' : 'No token'}`);
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('JWT_INVALID');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Remove from local cache
      const campaignNPCs = this.npcs.get(this.activeCampaign) || [];
      const npcIndex = campaignNPCs.findIndex(n => n.id === npc.id);
      if (npcIndex !== -1) {
        campaignNPCs.splice(npcIndex, 1);
      }

      // Re-render the view
      this._filterAndRenderNPCs();

      ui.notifications.info(game.i18n.localize('npc-nexus.ui.deleteDialog.deletedSuccessfully'));

    } catch (error) {
      console.error('Error deleting NPC:', error);
      
      if (error.message === 'JWT_INVALID') {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.deleteDialog.jwtInvalid'));
      } else {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.deleteDialog.errorDeleting'));
      }
    }
  }

  /**
   * Save NPC changes via PUT request to Strapi using documentId for Strapi 5
   */
  async _saveNPCChanges(html, originalNpc) {
    try {
      // Get form data
      const formData = {
        name: html.find('#edit-name').val().trim(),
        type: html.find('#edit-type').val().trim(),
        campaign: html.find('#edit-campaign').val().trim(),
        text: html.find('#edit-text').val().trim(),
        isNPC: html.find('#edit-isNPC').is(':checked'),
        isTaken: html.find('#edit-isTaken').is(':checked')
      };

      // Validate required fields
      if (!formData.name) {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.nameRequired'));
        return;
      }

      if (!formData.campaign) {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.campaignRequired'));
        return;
      }

      // Show loading notification
      ui.notifications.info(game.i18n.localize('npc-nexus.ui.savingChanges'));

      // For Strapi 5, use documentId instead of id for updates
      const documentId = originalNpc.documentId || originalNpc.id;
      
      // Construct the complete URL using documentId
      const updateUrl = `${this.strapiUrl}/api/npcs/${documentId}`;

      if (!documentId) {
        ui.notifications.error(game.i18n.localize('npc-nexus.ui.errorSavingChanges'));
        return;
      }

      // Make PUT request to Strapi using documentId
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: formData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedData = await response.json();

      // Update local cache using id for the search
      const campaignNPCs = this.npcs.get(this.activeCampaign) || [];
      const npcIndex = campaignNPCs.findIndex(npc => npc.id === originalNpc.id);
      if (npcIndex !== -1) {
        // Merge the updated data with the original NPC data
        campaignNPCs[npcIndex] = {
          ...originalNpc,
          ...formData,
          id: originalNpc.id, // Ensure ID is preserved
          documentId: originalNpc.documentId // Ensure documentId is preserved
        };
      }

      // If campaign changed, we need to reload campaigns and NPCs
      if (formData.campaign !== originalNpc.campaign) {
        // Clear loaded campaigns to force reload
        this.loadedCampaigns.clear();
        this.campaigns = [];
        
        // Reload campaigns
        await this._loadCampaigns();
        
        // If the new campaign is different from current active, switch to it
        if (formData.campaign !== this.activeCampaign) {
          // Update campaign selector
          $('#campaign-select').val(formData.campaign);
          await this.setActiveCampaign(formData.campaign);
        } else {
          // Reload current campaign
          await this._loadNPCsForCampaign(this.activeCampaign);
        }
      } else {
        // Just re-render the current view
        this._filterAndRenderNPCs();
      }

      ui.notifications.info(game.i18n.localize('npc-nexus.ui.npcUpdatedSuccessfully'));

    } catch (error) {
      console.error('Error updating NPC:', error);
      ui.notifications.error(game.i18n.localize('npc-nexus.ui.errorSavingChanges'));
    }
  }
}

// Initialize module when Foundry is ready
Hooks.once('init', NPCNexusModule.initialize);