'use strict';

const OverlayPlugin = require('./util/OverlayPlugin');
const {slider, switchButton} = require('./util/components');

/**
 * Instance battery plugin.
 * Provides battery level and state control.
 */
module.exports = class Battery extends OverlayPlugin {
    static get name() {
        return 'Battery';
    }
    /**
     * Plugin initialization.
     *
     * @param {Object} instance Associated instance.
     * @param {Object} i18n     Translations keys for the UI.
     */
    constructor(instance, i18n) {
        super(instance);

        // Reference instance
        this.instance = instance;
        this.i18n = i18n || {};

        // Register plugin
        this.instance.battery = this;

        // Display widget
        this.renderToolbarButton();
        this.renderWidget();

        // Listen for battery messages: "state mode <discharging/charging/full> <value>"
        this.instance.registerEventCallback('battery', (message) => {
            const values = message.split(' ').splice(-2);

            if (values.length !== 2) {
                return;
            }

            // Excecute this only once at start to set the initial value
            if (this.state.isCharging === null) {
                this.state.isCharging = values[0] !== 'discharging';
            }
            this.chargeSlider.setValue(values[1]);
            this.chargeInput.value = values[1];
            this.updateUIBatteryChargingPercent(values[1]);
        });

        this.state = new Proxy(
            {
                isCharging: null,
            },
            {
                set: (state, prop, value) => {
                    const oldValue = state[prop];
                    state[prop] = value;

                    switch (prop) {
                        case 'isCharging':
                            // todo get the value from the switch button
                            if (oldValue !== value) {
                                this.chargingInput.setState(value);
                                this.sendDataToInstance();
                                this.updateUIBatteryChargingState();
                            }
                            break;
                        default:
                            break;
                    }
                    return true;
                },
            },
        );
    }

    /**
     * Add the button to the renderer toolbar.
     */
    renderToolbarButton() {
        const toolbars = this.instance.getChildByClass(this.instance.root, 'gm-toolbar');
        if (!toolbars) {
            return; // if we don't have toolbar, we can't spawn the widget
        }

        const toolbar = toolbars.children[0];
        this.toolbarBtn = document.createElement('li');
        this.toolbarBtnImage = document.createElement('div');
        this.toolbarBtnImage.className = 'gm-icon-button gm-battery-button';
        this.toolbarBtnImage.title = this.i18n.BATTERY_TITLE || 'Battery';
        this.toolbarBtn.appendChild(this.toolbarBtnImage);
        this.toolbarBtn.onclick = this.toggleWidget.bind(this);
        toolbar.appendChild(this.toolbarBtn);
    }

    /**
     * Render the widget.
     */
    renderWidget() {
        // Create elements

        const {modal, container} = this.createTemplateModal(this.i18n.BATTERY_TITLE || 'Battery', 'gm-battery-plugin');
        this.widget = modal;
        this.container = container;
        // Generate input rows
        const inputs = document.createElement('div');
        inputs.className = 'gm-inputs';
        const batteryLevelLabel = this.i18n.BATTERY_CHARGE_LEVEL || 'Charge level';
        inputs.innerHTML = '<label>' + batteryLevelLabel + '</label>';

        // Create charge level inputs
        inputs.appendChild(this.createLevelSection());

        // Add charging label
        const chargingLabel = document.createElement('label');
        chargingLabel.innerHTML = this.i18n.BATTERY_CHARGE_STATE || 'State of charge';
        inputs.appendChild(chargingLabel);

        // Add charging section
        inputs.appendChild(this.createChargingSection());

        // Setup
        this.container.appendChild(inputs);

        this.instance.root.appendChild(this.widget);
    }

    /**
     * Create and return the widget "charging" section.
     *
     * @return {HTMLElement} Charging section.
     */
    createChargingSection() {
        const chargingGroup = document.createElement('div');
        this.chargingStatus = document.createElement('div');
        chargingGroup.className = 'gm-charging-group';

        // TODO: implement svg battery charging icon
        // Charging image
        this.chargingImage = document.createElement('div');
        this.chargingImage.className = 'gm-charging-image';
        chargingGroup.appendChild(this.chargingImage);

        //Switch button for charging state
        this.chargingInput = switchButton.createSwitch({
            onChange: (value) => {
                this.state.isCharging = value;
            },
        });
        this.chargingStatus.className = 'gm-charging-status';
        this.chargingStatus.innerHTML = 'Discharging';
        chargingGroup.appendChild(this.chargingStatus);
        chargingGroup.appendChild(this.chargingInput);

        return chargingGroup;
    }

    /**
     * Create and return the widget "level" section.
     *
     * @return {HTMLElement} Level section.
     */
    createLevelSection() {
        const chargeGroup = document.createElement('div');
        chargeGroup.className = 'gm-charge-level-group';

        // Charge level image
        //TOdo implement svg battery icon and color
        const chargeImageGroup = document.createElement('div');
        this.chargeImage = document.createElement('div');
        this.chargeImageOverlay = document.createElement('div');
        this.chargeImage.className = 'gm-charge-image';
        this.chargeImageOverlay.className = 'gm-charge-image-overlay';
        this.chargeImageOverlay.style.cssText = 'height: ' + 40 + '%;';
        chargeImageGroup.appendChild(this.chargeImage);
        this.chargeImage.appendChild(this.chargeImageOverlay);
        chargeGroup.appendChild(chargeImageGroup);

        const sliderGroup = document.createElement('div');

        // slider range for battery level
        this.chargeSlider = slider.createSlider({
            min: 0,
            max: 100,
            value: 20,
            onChange: (event) => {
                this.chargeInput.value = event.target.value;
                this.updateUIBatteryChargingPercent(event.target.value);
                this.sendDataToInstance();
            },
            onCursorMove: (event) => {
                // update UI withous sending data to instance
                this.chargeInput.value = event.target.value;
                this.updateUIBatteryChargingPercent(event.target.value);
            },
        });

        sliderGroup.appendChild(this.chargeSlider);
        chargeGroup.appendChild(sliderGroup);

        // Charge level input
        const inputGroup = document.createElement('div');
        this.chargeInput = document.createElement('input');
        const chargeInputLabel = document.createElement('span');
        chargeInputLabel.innerHTML = '%';
        this.chargeInput.className = 'gm-charge-input';
        this.chargeInput.type = 'number';
        this.chargeInput.value = 50;
        this.chargeInput.max = 100;
        this.chargeInput.min = 0;
        this.chargeInput.step = 1;
        this.chargeInput.oninput = (event) => {
            this.chargeSlider.setValue(event.target.value);
            this.updateUIBatteryChargingPercent(event.target.value);
        };
        this.chargeInput.onchange = (event) => {
            this.chargeSlider.setValue(event.target.value);
            this.updateUIBatteryChargingPercent(event.target.value);
            this.sendDataToInstance();
        };
        inputGroup.appendChild(this.chargeInput);
        inputGroup.appendChild(chargeInputLabel);
        chargeGroup.appendChild(inputGroup);

        return chargeGroup;
    }

    /**
     * Display or hide the widget.
     */

    /**
     * Update widget charging state UI.
     *
     * @param {boolean} charging Whether or not the battery is charging.
     */
    updateUIBatteryChargingState() {
        this.chargingStatus.classList[this.state.isCharging ? 'add' : 'remove']('charging');

        const chargingLabel = this.i18n.BATTERY_CHARGING || 'Charging';
        const dischargingLabel = this.i18n.BATTERY_DISCHARGING || 'Discharging';

        this.chargingStatus.innerHTML = this.state.isCharging ? chargingLabel : dischargingLabel;
    }

    /**
     * Synchronize widget UI.
     *
     * @param  {number}  value Battery level.
     * @return {boolean}       Whether or not battery level has been applied.
     */
    updateUIBatteryChargingPercent(value) {
        value = Number(value);
        if (Number.isNaN(value)) {
            return false;
        }

        value = Math.min(Math.max(0, value), 100);
        this.chargeImageOverlay.style.cssText = 'height: ' + (value * 0.7 + 4.5) + '%;';
        return true;
    }

    /**
     * Send information to instance.
     */
    sendDataToInstance() {
        const level = Number(this.chargeInput.value);
        const charging = this.state.isCharging ? 'charging' : 'discharging';
        const json = {
            channel: 'battery',
            messages: ['set state level ' + level, 'set state status ' + charging],
        };
        this.instance.sendEvent(json);
    }
};
