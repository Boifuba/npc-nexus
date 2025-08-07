/**
 * Name Generator Module for NPC Nexus
 * Handles random name generation based on nation, gender, and format
 */

import { NAME_DATA } from '../name-data.js';

export class NameGenerator {
  constructor() {
    this.nameData = NAME_DATA;
    this.nations = Object.keys(this.nameData);
  }

  /**
   * Get available nations
   * @returns {string[]} Array of nation names
   */
  getNations() {
    return this.nations;
  }

  /**
   * Get a random name from specified nation and gender
   * @param {string} nation - The nation to get names from
   * @param {string} gender - 'male' or 'female'
   * @param {string} format - 'full', 'first', or 'last'
   * @returns {string} Generated name
   */
  generateName(nation, gender, format = 'full') {
    if (!this.nameData[nation]) {
      throw new Error(`Nation "${nation}" not found`);
    }

    if (!this.nameData[nation][gender]) {
      throw new Error(`Gender "${gender}" not found for nation "${nation}"`);
    }

    const names = this.nameData[nation][gender];
    if (names.length === 0) {
      throw new Error(`No names available for ${gender} in ${nation}`);
    }

    const randomName = names[Math.floor(Math.random() * names.length)];
    
    return this._formatName(randomName, format);
  }

  /**
   * Format name based on the requested format
   * @param {string} fullName - The full name to format
   * @param {string} format - 'full', 'first', or 'last'
   * @returns {string} Formatted name
   */
  _formatName(fullName, format) {
    const nameParts = fullName.split(' ');
    
    switch (format) {
      case 'first':
        return nameParts[0];
      case 'last':
        return nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
      case 'full':
      default:
        return fullName;
    }
  }

  /**
   * Get formatted nation name for display
   * @param {string} nation - The nation key
   * @returns {string} Formatted nation name
   */
  getFormattedNationName(nation) {
    const nationNames = {
      'roman-greek': 'Roman-Greek',
      'al-haz': 'Al-Haz',
      'al-wazif': 'Al-Wazif',
      'cardiel': 'Cardiel',
      'english': 'English',
      'japanese': 'Japanese',
      'zarak': 'Zarak',
      'araterre': 'Araterre',
      'orcs': 'Orcs',
      'nomad-territories': 'Nomad Territories',
      'southwest-wildlands': 'Southwest Wildlands',
      'aztec': 'Aztec',
      'tredroy': 'Tredroy',
      'arabic': 'Arabic',
      'black-forest': 'Black Forest',
      'dwarven': 'Dwarven',
      'elven': 'Elven',
    };
    
    return nationNames[nation] || nation;
  }

  /**
   * Show name generator dialog
   */
  async showNameGeneratorDialog() {
    const nations = this.getNations();
    
    let content;
    try {
      content = await renderTemplate('modules/npc-nexus/templates/name-generator-dialog.html', {});
    } catch (error) {
      console.error('Error loading name generator template:', error);
      // Fallback to simple content
      content = '<div class="panel-content"><p>Error loading name generator template</p></div>';
    }

    const dialog = new Dialog({
      title: "Name Generator",
      content: content,
      buttons: {},
      render: (html) => {
        // Populate nation options
        const nationSelect = html.find('#nation-select');
        nations.forEach(nation => {
          nationSelect.append(`<option value="${nation}">${this.getFormattedNationName(nation)}</option>`);
        });
        
        // Generate initial name
        this._generateAndDisplayName(html);
        
        // Bind generate button
        html.find('#generate-name-btn').click(() => {
          this._generateAndDisplayName(html);
        });
        
        // Bind apply name to token button
        html.find('#apply-name-to-token-btn').click(() => {
          const generatedName = html.find('#generated-name').val();
          this._applyGeneratedNameToSelectedTokenAndActor(generatedName);
        });
        
        // Bind close button
        html.find('#close-dialog-btn').click(() => {
          dialog.close();
        });
        
        // Bind change events to regenerate name
        html.find('#nation-select, #gender-select, #format-select').change(() => {
          this._generateAndDisplayName(html);
        });
      },
      default: ""
    }, { classes: ["npc-nexus-dialog-wrapper"] });

    dialog.render(true);
  }

  /**
   * Generate and display name in dialog
   */
  _generateAndDisplayName(html) {
    try {
      const nation = html.find('#nation-select').val();
      const gender = html.find('#gender-select').val();
      const format = html.find('#format-select').val();
      
      const generatedName = this.generateName(nation, gender, format);
      html.find('#generated-name').val(generatedName);
    } catch (error) {
      console.error('Error generating name:', error);
      html.find('#generated-name').val('Error generating name');
      ui.notifications.error('Error generating name: ' + error.message);
    }
  }

  /**
   * Apply generated name to selected token and actor
   */
  async _applyGeneratedNameToSelectedTokenAndActor(name) {
    if (!name || name.trim() === '') {
      ui.notifications.warn('No name was generated to apply.');
      return;
    }

    // Check if any tokens are selected
    const selectedTokens = canvas.tokens.controlled;
    if (selectedTokens.length === 0) {
      ui.notifications.warn('No token selected. Select a token on the map first.');
      return;
    }

    try {
      let updatedCount = 0;
      
      // If multiple tokens are selected, generate random names for each
      if (selectedTokens.length > 1) {
        // Get current settings from the dialog
        const nation = document.querySelector('#nation-select')?.value || this.nations[0];
        const gender = document.querySelector('#gender-select')?.value || 'male';
        const format = document.querySelector('#format-select')?.value || 'full';
        
        console.log(`Generating random names for ${selectedTokens.length} tokens using ${nation}, ${gender}, ${format}`);
        
        for (const token of selectedTokens) {
          // Generate a random name for each token
          const randomName = this.generateName(nation, gender, format);
          console.log(`Applying random name to token: ${randomName}`);
          
          // Update token name
          await token.document.update({
            name: randomName.trim(),
            actorLink: true
          });
          
          // Update actor name if token has an actor
          if (token.actor) {
            await token.actor.update({
              name: randomName.trim()
            });
          }
          
          updatedCount++;
        }
        
        ui.notifications.info(`Random names applied to ${updatedCount} token(s) and actor(s) successfully!`);
        
      } else {
        // Single token selected - use the specific generated name
        for (const token of selectedTokens) {
          // Update token name
          await token.document.update({
            name: name.trim(),
            actorLink: true
          });
          
          // Update actor name if token has an actor
          if (token.actor) {
            await token.actor.update({
              name: name.trim()
            });
          }
          
          updatedCount++;
        }
        
        ui.notifications.info(`Name "${name}" applied to ${updatedCount} token(s) and actor(s) successfully!`);
      }
      
    } catch (error) {
      console.error('Error applying name:', error);
      ui.notifications.error('Error applying name to token/actor');
    }
  }
}