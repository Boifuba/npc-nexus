import { NameGenerator } from './name-generator.js';

class NPCNexusModule {
  constructor() {
    this.folderPath = '';
    this.npcs = [];
    this.filteredNpcs = [];
    this.isOpen = false;
    this.filters = {
      campaign: '',
      type: '',
      gender: ''
    };
    this.nameGenerator = new NameGenerator();
    this._init();
  }

  static ID = 'npc-nexus';
  static instance = null;

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
    game.settings.register(NPCNexusModule.ID, 'folderPath', {
      name: 'NPCs Folder',
      hint: 'Path to the folder containing NPC image files (e.g., npcs)',
      scope: 'world',
      config: true,
      type: String,
      default: 'npcs'
    });

    game.settings.register(NPCNexusModule.ID, 'tokenSize', {
      name: 'Token Image Size',
      hint: 'Controls the size of token images in the panel',
      scope: 'client',
      config: true,
      type: String,
      choices: {
        "small": "Small (80px)",
        "medium": "Medium (120px)",
        "large": "Large (160px)",
        "xlarge": "Extra Large (200px)"
      },
      default: "medium",
      onChange: () => {
        if (this.isOpen) {
          this._filterAndRenderNPCs();
        }
      }
    });

    game.settings.register(NPCNexusModule.ID, 'panelSide', {
      name: 'Panel Side',
      hint: 'Choose which side of the screen the panel should appear on',
      scope: 'client',
      config: true,
      type: String,
      choices: {
        "right": "Right",
        "left": "Left"
      },
      default: "right",
      onChange: () => {
        if (this.isOpen) {
          this._updatePanelPosition();
        }
      }
    });

    this.folderPath = game.settings.get(NPCNexusModule.ID, 'folderPath');

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
    
    // Add scene control buttons
    Hooks.on("getSceneControlButtons", (controls) => {
      const tokenControls = controls.tokens;

      if (tokenControls && tokenControls.tools) {
        tokenControls.tools["npc-nexus-button"] = {
          name: "npc-nexus-button",
          title: "Open NPC Nexus",
          icon: "fas fa-users",
          button: true,
          onClick: () => {
            NPCNexusModule.instance.togglePanel();
          },
          visible: true
        };

        tokenControls.tools["name-generator-button"] = {
          name: "name-generator-button",
          title: "Name Generator",
          icon: "fas fa-dice",
          button: true,
          onClick: () => {
            NPCNexusModule.instance.showNameGeneratorDialog();
          },
          visible: true
        };
      }
    });
  }

  /**
   * Load NPCs from local folder
   */
  async loadNPCsFromFolder() {
    try {
      this.npcs = [];
      await this._loadRecursive(this.folderPath);
      this._filterAndRenderNPCs();
      ui.notifications.info(`Loaded ${this.npcs.length} NPCs from folder ${this.folderPath}`);
    } catch (error) {
      console.error('Error loading NPCs:', error);
      ui.notifications.error('Error loading NPCs from folder');
    }
  }

  /**
   * Recursively load files from folder structure
   */
  async _loadRecursive(caminho, nivel = 0) {
    try {
      let response = await FilePicker.browse("data", caminho);
      
      // Debug: Check raw FilePicker paths
      console.log("Raw FilePicker file paths:", response.files);
      
      // Process files in current folder
      if (response.files && response.files.length > 0) {
        for (const file of response.files) {
          // Only process image files
          if (this._isImageFile(file)) {
            const fileName = file.split('/').pop();
            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
            
            // Extract metadata from path and filename
            const pathParts = caminho.split('/');
            // Remove the base folder path to get relative path parts
            const relativeParts = pathParts.slice(1); // Skip the base folder
            
            let campaign = '';
            let type = '';
            let gender = '';
            
            // If we have relative parts, first one is campaign
            if (relativeParts.length > 0) {
              campaign = relativeParts[0];
            }
            
            // Type is always the second folder
            if (relativeParts.length > 1) {
              type = relativeParts[1];
            }
            
            // Look for gender in any part of the path
            if (pathParts.includes('male')) {
              gender = 'male';
            } else if (pathParts.includes('female')) {
              gender = 'female';
            }

            // Extract metadata from filename if possible (fallback)
            const npcDataFromFilename = this._parseFileName(nameWithoutExt);
            
            this.npcs.push({
              id: file, // Use file path as ID
              name: npcDataFromFilename.name,
              img: file,
              type: type || npcDataFromFilename.type || 'NPC',
              gender: gender || npcDataFromFilename.gender || '',
              campaign: campaign || npcDataFromFilename.campaign || '',
              text: '',
              path: file,
              folder: caminho
            });
          }
        }
      }
      
      // Process subfolders
      if (response.dirs && response.dirs.length > 0) {
        for (let dir of response.dirs) {
          await this._loadRecursive(dir, nivel + 1);
        }
      }
      
    } catch (error) {
      console.log(`Error accessing: ${caminho}`, error);
    }
  }

  /**
   * Check if file is an image
   */
  _isImageFile(filePath) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  /**
   * Format machine names to human-readable display names
   * Converts underscores to spaces and capitalizes words
   * Also decodes URL-encoded characters
   */
  _formatDisplayName(machineName) {
    if (!machineName) return '';
    
    // First decode any URL-encoded characters
const decoded = decodeURIComponent(machineName).replace(/_/g, ' ');

const capitalized = decoded
  .split(' ')
  .map(word => {
    if (!word) return word;
    const [first, ...rest] = [...word];
    return first.toUpperCase() + rest.join('').toLowerCase();
  })
  .join(' ');

return capitalized;


  }

  /**
   * Parse filename to extract metadata (fallback for when not in folders)
   * Expected format: name_type_gender_campaign.ext
   * Or just: name.ext
   */
  _parseFileName(fileName) {
    const parts = fileName.split('_');
    
    if (parts.length === 1) {
      return { name: parts[0] };
    }
    
    return {
      name: parts[0] || fileName,
      type: parts[1] || '',
      gender: parts[2] || '',
      campaign: parts[3] || ''
    };
  }

  /**
   * Expose API for macros and external access
   */
  _exposeAPI() {
    const module = game.modules.get(NPCNexusModule.ID);
    if (module) {
      module.api = {
        togglePanel: () => this.togglePanel(),
        openPanel: () => this.openPanel(),
        closePanel: () => this.closePanel(),
        getInstance: () => this
      };
    }

    window.NPCNexusModule = {
      togglePanel: () => this.togglePanel(),
      openPanel: () => this.openPanel(),
      closePanel: () => this.closePanel(),
      getInstance: () => this
    };

    game.npcNexus = {
      togglePanel: () => this.togglePanel(),
      openPanel: () => this.openPanel(),
      closePanel: () => this.closePanel(),
      getInstance: () => this
    };
  }

  /**
   * Add NPC button to actors sidebar
   */
  _addNPCButton(html) {
    const button = $(`
      <button class="npc-nexus-btn" title="NPC Nexus">
        <i class="fas fa-users"></i> NPC Nexus
      </button>
    `);

    button.click(() => this.togglePanel());
    html.find('.directory-header').append(button);
  }

  /**
   * Create the main side panel
   */
  async _createSidePanel() {
    try {
      const html = await renderTemplate('modules/npc-nexus/templates/npc-nexus-panel.html', {});
      $('body').append(html);
      this._applyTokenSize();
      this._updatePanelPosition();
      // Initial load of NPCs when panel is created
      this.loadNPCsFromFolder();
    } catch (error) {
      console.error('Error creating side panel:', error);
      this._createSidePanelFallback();
    }
  }

  /**
   * Fallback panel creation
   */
  _createSidePanelFallback() {
    const panel = $(`
      <div id="npc-nexus-panel" class="npc-nexus-panel">
        <div class="panel-header">
          <h3><i class="fas fa-users"></i>NPC Nexus</h3>
          <button class="close-btn" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="panel-content">
          <div class="filters-section">
            <div class="filter-group">
              <input type="text" id="name-filter" placeholder="Filter by name..." />
              <select id="campaign-filter">
                <option value="">All Campaigns</option>
              </select>
              <select id="type-filter">
                <option value="">All Types</option>
              </select>
              <select id="gender-filter">
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div class="npcs-accordion" id="npcs-accordion">
            <div class="info-message">Loading NPCs...</div>
          </div>
        </div>
      </div>
    `);

    $('body').append(panel);
    this._applyTokenSize();
    this.loadNPCsFromFolder(); // Load NPCs on fallback panel creation as well
  }

  /**
   * Apply token size setting
   */
  _applyTokenSize() {
    const tokenSize = game.settings.get(NPCNexusModule.ID, 'tokenSize');
    const panel = $('#npc-nexus-panel');
    
    panel.removeClass('token-small token-medium token-large token-xlarge');
    panel.addClass(`token-${tokenSize}`);
  }

  /**
   * Update panel position
   */
  _updatePanelPosition() {
    const panelSide = game.settings.get(NPCNexusModule.ID, 'panelSide');
    const panel = $('#npc-nexus-panel');
    
    panel.removeClass('panel-left panel-right');
    panel.addClass(`panel-${panelSide}`);
  }

  /**
   * Bind events
   */
  _bindEvents() {
    $(document).on('click', '#npc-nexus-panel .close-btn', () => {
      this.closePanel();
    });

    $(document).on('click', '#name-generator-btn', () => {
      this.showNameGeneratorDialog();
    });

    $(document).on('change', '#campaign-filter', () => {
      this.filters.campaign = $('#campaign-filter').val();
      this._filterAndRenderNPCs();
    });

    $(document).on('change', '#type-filter', () => {
      this.filters.type = $('#type-filter').val();
      this._filterAndRenderNPCs();
    });

    $(document).on('change', '#gender-filter', () => {
      this.filters.gender = $('#gender-filter').val();
      this._filterAndRenderNPCs();
    });

    $(document).on('click', '.npc-item', (e) => {
      const npcId = $(e.currentTarget).data('npc-id');
      this._applyNpcImageToSelectedToken(npcId);
    });

    $(document).on('contextmenu', '.npc-item', (e) => {
      e.preventDefault();
      const npcId = $(e.currentTarget).data('npc-id');
      this._showContextMenu(e, npcId);
    });
  }

  /**
   * Filter and render NPCs
   */
  _filterAndRenderNPCs() {
    // Start with all NPCs
    let filteredNpcs = [...this.npcs];
    
    // Apply campaign filter only
    if (this.filters.campaign) {
      filteredNpcs = filteredNpcs.filter(npc => npc.campaign === this.filters.campaign);
    }
    
    // Update type filter based on campaign-filtered NPCs
    this._updateTypeFilter(filteredNpcs);
    
    // Apply type filter
    if (this.filters.type) {
      filteredNpcs = filteredNpcs.filter(npc => npc.type === this.filters.type);
    }
    
    // Update gender filter (static)
    this._updateGenderFilter();
    
    // Apply gender filter
    if (this.filters.gender) {
      filteredNpcs = filteredNpcs.filter(npc => npc.gender === this.filters.gender);
    }
    
    this.filteredNpcs = filteredNpcs;

    this._renderNPCs();
    this._updateCampaignFilter();
  }

  /**
   * Render NPCs in accordion organized by type
   */
  _renderNPCs() {
    const accordion = $('#npcs-accordion');
    
    if (this.filteredNpcs.length === 0) {
      accordion.html('<div class="info-message">No NPCs found</div>');
      return;
    }

    // Group NPCs by type
    const npcsByType = {};
    this.filteredNpcs.forEach(npc => {
      const type = npc.type || 'No Type';
      if (!npcsByType[type]) {
        npcsByType[type] = [];
      }
      npcsByType[type].push(npc);
    });

    // Create accordion sections for each type
    const accordionSections = Object.keys(npcsByType).map(type => {
      const npcsInType = npcsByType[type];
      const typeId = type.toLowerCase().replace(/\s+/g, '-');
      
      const npcElements = npcsInType.map(npc => {
        const genderClass = npc.gender ? `gender-${npc.gender}` : '';
        return `
          <div class="npc-item ${genderClass}" data-npc-id="${npc.id}" title="${npc.name}">
            <div class="npc-image">
              <img src="${npc.img}" alt="${npc.name}" loading="lazy">
            </div>
          </div>
        `;
      }).join('');

      const displayType = this._formatDisplayName(type);

      return `
        <div class="accordion-section">
          <div class="accordion-header" data-type="${typeId}">
            <h4>${displayType} (${npcsInType.length})</h4>
            <i class="fas fa-chevron-down accordion-icon"></i>
          </div>
          <div class="accordion-content" id="accordion-${typeId}">
            <div class="npcs-grid">
              ${npcElements}
            </div>
          </div>
        </div>
      `;
    }).join('');

    accordion.html(accordionSections);

    // Add accordion functionality
    this._bindAccordionEvents();
  }

  /**
   * Bind accordion events
   */
  _bindAccordionEvents() {
    $(document).off('click', '.accordion-header').on('click', '.accordion-header', function() {
      const $header = $(this);
      const $content = $header.next('.accordion-content');
      const $icon = $header.find('.accordion-icon');
      
      // Toggle content visibility
      $content.slideToggle();
      
      // Toggle icon rotation
      $icon.toggleClass('rotated');
      
      // Toggle active state
      $header.toggleClass('active');
    });
  }

  /**
   * Update campaign filter options
   */
  _updateCampaignFilter() {
    const campaignFilter = $('#campaign-filter');
    const currentValue = campaignFilter.val();
    
    const campaigns = [...new Set(this.npcs.map(npc => npc.campaign).filter(campaign => campaign))];
    
    campaignFilter.empty();
    campaignFilter.append('<option value="">All Campaigns</option>');
    
    campaigns.forEach(campaign => {
      const displayCampaign = this._formatDisplayName(campaign);
      campaignFilter.append(`<option value="${campaign}">${displayCampaign}</option>`);
    });
    
    campaignFilter.val(currentValue);
  }

  /**
   * Update type filter options
   */
  _updateTypeFilter(npcsToConsider = this.npcs) {
    const typeFilter = $('#type-filter');
    const currentValue = typeFilter.val();
    
    const types = [...new Set(npcsToConsider.map(npc => npc.type).filter(type => type))];
    
    typeFilter.empty();
    typeFilter.append('<option value="">All Types</option>');
    
    types.forEach(type => {
      const displayType = this._formatDisplayName(type);
      typeFilter.append(`<option value="${type}">${displayType}</option>`);
    });
    
    typeFilter.val(currentValue);
  }

  /**
   * Update gender filter options
   */
  _updateGenderFilter() {
    const genderFilter = $('#gender-filter');
    const currentValue = genderFilter.val();
    
    genderFilter.empty();
    genderFilter.append('<option value="">All Genders</option>');
    genderFilter.append('<option value="male">Male</option>');
    genderFilter.append('<option value="female">Female</option>');
    
    genderFilter.val(currentValue);
  }

  /**
   * Get all images in a specific folder (recursively)
   */
  async _getImagesInFolder(folderPath) {
    const images = [];
    
    try {
      const response = await FilePicker.browse("data", folderPath);
      
      // Process files in current folder
      if (response.files && response.files.length > 0) {
        for (const file of response.files) {
          if (this._isImageFile(file)) {
            images.push(file);
          }
        }
      }
      
      // Process subfolders recursively
      if (response.dirs && response.dirs.length > 0) {
        for (const dir of response.dirs) {
          const subImages = await this._getImagesInFolder(dir);
          images.push(...subImages);
        }
      }
      
    } catch (error) {
      console.log(`Error accessing folder: ${folderPath}`, error);
    }
    
    return images;
  }

  /**
   * Apply NPC image to selected token
   */
  async _applyNpcImageToSelectedToken(npcId) {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return;

    // Check if any tokens are selected
    const selectedTokens = canvas.tokens.controlled;
    if (selectedTokens.length === 0) {
      ui.notifications.warn('No token selected. Select a token on the map first.');
      return;
    }

    console.log("Applying NPC image:", npc.img);
    console.log("Complete NPC data:", npc);
    try {
      let updatedCount = 0;
      
      // If multiple tokens are selected, use random images from the same folder
      if (selectedTokens.length > 1) {
        console.log("Multiple tokens selected, getting random images from folder:", npc.folder);
        const folderImages = await this._getImagesInFolder(npc.folder);
        
        if (folderImages.length === 0) {
          ui.notifications.warn('No images found in the selected NPC folder.');
          return;
        }
        
        console.log(`Found ${folderImages.length} images in folder for random selection`);
        
        // Create a shuffled copy of the images array to avoid repetition
        const shuffledImages = [...folderImages].sort(() => Math.random() - 0.5);
        
        for (const token of selectedTokens) {
          // Use images from shuffled array, cycling if we have more tokens than images
          const imageIndex = updatedCount % shuffledImages.length;
          const randomImage = shuffledImages[imageIndex];
          console.log(`Applying random image to token: ${randomImage}`);
          
          // Update token image
          const updateData = {
            "texture.src": randomImage,
            actorLink: true
          };
          
          // Check if image is from Montarias folder and apply scale
          if (randomImage && randomImage.toLowerCase().includes('montarias')) {
            updateData["texture.scaleX"] = 3;
            updateData["texture.scaleY"] = 3;
          }
          
          await token.document.update(updateData);
          
          // Update actor image if token has an actor
          if (token.actor) {
            await token.actor.update({
              img: randomImage
            });
          }
          
          updatedCount++;
        }
        
        ui.notifications.info(`Random images from the same folder applied to ${updatedCount} token(s) successfully!`);
        
      } else {
        // Single token selected - use the specific clicked image
        for (const token of selectedTokens) {
          // Update token image
          const updateData = {
            "texture.src": npc.img,
            actorLink: true
          };
          
          // Check if NPC is from Montarias folder and apply scale
          if (npc.img && npc.img.toLowerCase().includes('montarias')) {
            updateData["texture.scaleX"] = 3;
            updateData["texture.scaleY"] = 3;
          }
          
          await token.document.update(updateData);
          
          // Update actor image if token has an actor
          if (token.actor) {
            await token.actor.update({
              img: npc.img
            });
          }
          
          updatedCount++;
        }
        
        ui.notifications.info(`Image applied to ${updatedCount} token(s) successfully!`);
      }
      
    } catch (error) {
      console.error('Error applying NPC image:', error);
      ui.notifications.error('Error applying NPC image');
    }
  }

  /**
   * Show context menu
   */
  _showContextMenu(event, npcId) {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return;

    const contextMenu = new ContextMenu($('body'), '.npc-item', [
      {
        name: "Copy Path",
        icon: '<i class="fas fa-copy"></i>',
        callback: () => {
          navigator.clipboard.writeText(npc.path);
          ui.notifications.info('Path copied to clipboard');
        }
      },
      {
        name: "Apply to Selected Token",
        icon: '<i class="fas fa-image"></i>',
        callback: () => this._applyNpcImageToSelectedToken(npcId)
      }
    ]);
  }

  /**
   * Show name generator dialog
   */
  showNameGeneratorDialog() {
    this.nameGenerator.showNameGeneratorDialog();
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    if (this.isOpen) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  /**
   * Open panel
   */
  openPanel() {
    $('#npc-nexus-panel').addClass('open');
    this.isOpen = true;
    
    // Load NPCs if folder is set
    if (this.folderPath && this.npcs.length === 0) {
      this.loadNPCsFromFolder();
    }
  }

  /**
   * Close panel
   */
  closePanel() {
    $('#npc-nexus-panel').removeClass('open');
    this.isOpen = false;
  }
}

// Initialize when Foundry is ready
Hooks.once('init', () => {
  NPCNexusModule.initialize();
});

// Export for external access
export { NPCNexusModule };