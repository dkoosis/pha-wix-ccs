class CeramicsFiringCalculator extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        // Business rule constants
        this.MIN_DAYS_AHEAD = 1;
        this.DEFAULT_DAYS_AHEAD = 10;
        this.MIN_DIMENSION = 2;  // Minimum 2 inches for all dimensions
        this.MAX_DIMENSION = 55; // Maximum 55 inches for all dimensions
        this.MAX_QUANTITY = 120;
        this.rushJobDays = 3;
        this.rushJobPremium = 25;

        // Default firing options (can be overridden by config)
        this.FIRING_OPTIONS = {
            "Bisque": 0.03,
            "Slipcast Bisque": 0.04,
            "Oxidation ∆ 6": 0.03,
            "Reduction ∆ 10": 0.03
        };

        // Image processing constants
        this.MAX_IMAGE_WIDTH = 800;
        this.MAX_IMAGE_HEIGHT = 800;
        this.THUMBNAIL_WIDTH = 100;
        this.THUMBNAIL_HEIGHT = 100;
        this.MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

        // Note: WORKSHEET_HEADERS moved to static getter for consistency

        // Try to load configuration from external config file
        this._loadConfiguration();

        // Initialize formatters and state
        this.USDformatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        });

        this.lineItems = [];
        this.totalCost = 0;
    }

    /**
     * Table headers for worksheet columns
     */
    static get HEADERS() {
        return [
            "Firing Type",
            "Unit Cost",
            "Height",
            "Width",
            "Length",
            "Volume",
            "Quantity",
            "Price",
            "Due Date",
            "Special Directions",
            "Photo Upload",
            "Preview",
            "" // Delete button column
        ];
    }

    /**
     * SVG icon constants for better maintainability
     */
    static get ICONS() {
        return {
            CAMERA: `
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
            `,
            TRASH: `
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            `
        };
    }

    /**
     * CSS styles template for better organization
     */
    static get STYLES() {
        return `
        /* Loader styles */
        #loader {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        #loader.hidden {
            display: none;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid rgba(0, 0, 0, 0.1);
            border-top: 5px solid black;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Base styles */
        :host {
            font-family: Arial, sans-serif;
            display: block;
            padding: 20px;
            background-color: white;
            border-radius: 10px;
        }

        /* Table styles */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: white;
            border: none;
        }

        th {
            padding: 12px;
            background-color: #343a40;
            color: white;
            font-weight: bold;
            text-align: left;
            border: none;
        }

        td {
            padding: 12px;
            border: none;
            text-align: left;
            font-size: 14px;
            color: #666;
        }

        td:has(input), td:has(select), td:has(textarea), td:has(button) {
            color: inherit;
        }

        tr:nth-child(even) {
            background-color: #fafafa;
        }

        tfoot tr {
            border-top: 2px solid #343a40;
        }

        tfoot td {
            padding: 12px;
            font-weight: bold;
        }

        /* Form controls - Base */
        input, select, textarea {
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            font-size: 14px;
            font-family: Arial, sans-serif;
            background-color: #f8f9fa;
            color: inherit;
            padding: 12px 8px;
        }

        /* Form controls - Specific types */
        select {
            width: 90%;
        }

        input[type="number"] {
            width: 50px;
        }

        input[type="date"] {
            width: 110px;
        }

        textarea {
            width: 90%;
            height: 38px;
            min-height: 38px;
            resize: vertical;
        }

        /* Form control states */
        input:hover, select:hover, textarea:hover {
            border-color: #999;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #666;
            background-color: white;
        }

        .invalid-input {
            border-color: #dc3545;
            background-color: white;
        }

        /* Error display */
        td[data-error]::after {
            content: attr(data-error);
            color: #dc3545;
            font-size: 12px;
            display: block;
            margin-top: 4px;
        }

        .error-message {
            color: #dc3545;
            font-size: 12px;
            margin-top: 4px;
            display: block;
        }

        /* File upload and preview */
        .file-input-container {
            position: relative;
            width: 40px;
            height: 40px;
        }

        .file-input-container input[type="file"] {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            opacity: 0;
            cursor: pointer;
        }

        .camera-icon {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }

        .preview-cell {
            width: 100px;
            height: 100px;
            padding: 4px;
            text-align: center;
            vertical-align: middle;
            background-color: transparent;
        }

        .thumbnail {
            max-width: 100px;
            max-height: 100px;
            object-fit: contain;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            display: block;
            margin: 0 auto;
        }

        /* Button styles */
        .icon-button {
            background: none;
            border: none;
            padding: 8px;
            cursor: pointer;
            color: #666;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s ease;
        }

        .icon-button:hover {
            color: #F15A29;
            background: none;
        }

        .icon-button:disabled {
            color: #ccc;
            cursor: not-allowed;
        }

        .button-container {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }

        .button-container button {
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            background-color: #343a40;
            color: white;
            border: none;
            transition: background-color 0.2s ease;
        }

        .button-container button:hover {
            background-color: #F15A29;
        }

        .button-container button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }

        /* Mobile styles */
        @media (max-width: 768px) {
            thead {
                display: none;
            }

            table, tbody, tr, tfoot {
                display: block;
            }

            tr {
                margin-bottom: 20px;
                padding: 15px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            td {
                display: flex;
                padding: 8px 0;
                align-items: center;
                border: none;
            }

            td::before {
                content: attr(data-label);
                font-weight: bold;
                width: 40%;
                min-width: 90px;
                margin-right: 10px;
            }

            td > input,
            td > select,
            td > textarea {
                flex: 1;
                width: 60%;
                margin: 0;
            }

            td[data-label="Photo Upload"] {
                flex-direction: column;
                align-items: flex-start;
            }

            td[data-label="Photo Upload"]::before {
                margin-bottom: 8px;
                width: 100%;
            }

            .preview-cell {
                width: 100%;
                height: auto;
            }

            .thumbnail {
                margin: 8px 0;
            }

            .icon-button {
                width: 100%;
                justify-content: flex-start;
                padding: 12px 0;
            }

            .file-input-container {
                width: 100%;
                height: 44px;
            }

            .button-container {
                flex-direction: column;
            }
            
            .button-container button {
                width: 100%;
            }

            tfoot tr {
                margin-top: 20px;
                padding: 15px;
                border-top: 2px solid #343a40;
            }

            td:empty {
                display: none;
            }
        }
        `;
    }

    /**
     * Load configuration from external config file if available
     * @private
     */
    _loadConfiguration() {
        try {
            const config = require('../config.json');
            this.FIRING_OPTIONS = config.firingOptions || this.FIRING_OPTIONS;
            this.rushJobDays = config.rushJobDays || this.rushJobDays;
            this.rushJobPremium = config.rushJobPremium || this.rushJobPremium;
        } catch (error) {
            console.warn('Config file not found, using default values:', error);
        }
    }

    /**
     * Lifecycle method called when element is added to DOM
     */
    connectedCallback() {
        this._renderTemplate();
        this._initializeComponent();
        this._attachEventListeners();
    }

    /**
     * Observed attributes for Wix Editor integration
     */
    static get observedAttributes() {
        return ["loader"];
    }

    /**
     * Handle attribute changes (primarily for loader state management)
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "loader") {
            const loader = this.shadowRoot?.getElementById('loader');
            if (!loader) return;

            if (newValue === "hide") {
                loader.classList.add('hidden');
            } else if (newValue === "show") {
                loader.classList.remove('hidden');
            }
        }
    }

    /**
     * Render the component template
     * @private
     */
    _renderTemplate() {
        const template = document.createElement('template');
        template.innerHTML = `
            <style>${CeramicsFiringCalculator.STYLES}</style>
            <div id="loader" class="hidden">
                <div class="spinner"></div>
            </div>
            <table>
                <thead>
                    <tr>
                        ${CeramicsFiringCalculator.HEADERS.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody id="data-rows"></tbody>
                <tfoot>
                    <tr>
                        <td colspan="7" data-label="Total Price">Total Price:</td>
                        <td id="total-price">$0.00</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            </table>
        
            <div class="button-container">
                <button id="add-row-button">Add Row</button>
                <button id="submit-worksheet-button">Submit Worksheet</button>
            </div>
        `;

        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    /**
     * Initialize component state and DOM references
     * @private
     */
    _initializeComponent() {
        this.dataRows = this.shadowRoot.getElementById('data-rows');
        
        // Add initial row and update UI
        this.addRow();
        this.updateTotalCost();
        this.updateDeleteButtonState();
    }

    /**
     * Attach event listeners to component elements
     * @private
     */
    _attachEventListeners() {
        const addRowButton = this.shadowRoot.getElementById('add-row-button');
        const submitWorksheetButton = this.shadowRoot.getElementById('submit-worksheet-button');

        // Delegate events for dynamic content
        this.dataRows.addEventListener('change', this.handleRowChange.bind(this));
        this.dataRows.addEventListener('click', this.handleDelete.bind(this));
        
        // Button events
        addRowButton.addEventListener('click', () => this.addRow());
        submitWorksheetButton.addEventListener('click', () => this.submitWorksheet());
    }

    /**
     * Handle input changes in worksheet rows
     * @param {Event} event - The change event
     */
    handleRowChange(event) {
        const target = event.target;
        const row = target.closest('tr');
        const cell = target.closest('td');

        // Handle firing type selection changes
        if (target.tagName === 'SELECT' && target.hasAttribute('data-field')) {
            if (target.getAttribute('data-field') === 'firing-type') {
                this._updateUnitCost(row, target.value);
            }
        }
        // Handle date validation
        else if (target.type === 'date') {
            const error = this._validateDate(target.value);
            this._displayFieldError(cell, target, error);
            // For date errors, don't calculate if invalid
            if (error) return;
        }
        // Handle number input validation
        else if (target.type === 'number') {
            const fieldType = target.getAttribute('data-field');
            const error = this._validateNumberInput(target.value, fieldType);
            this._displayFieldError(cell, target, error);
            // Note: Continue to calculate even with validation errors for live updates
        }

        // Always recalculate row values and totals (except for invalid dates)
        this.calculateRowValues(row);
        this.updateTotalCost();
    }

    /**
     * Handle delete button clicks
     * @param {Event} event - The click event
     */
    handleDelete(event) {
        const deleteButton = event.target.closest('.icon-button');
        if (deleteButton && deleteButton.hasAttribute('data-action') && 
            deleteButton.getAttribute('data-action') === 'delete') {
            const row = deleteButton.closest('tr');
            row.remove();
            this.updateDeleteButtonState();
            this.updateTotalCost();
        }
    }

    /**
     * Update unit cost when firing type changes
     * @param {HTMLTableRowElement} row - The table row
     * @param {string} firingType - Selected firing type
     * @private
     */
    _updateUnitCost(row, firingType) {
        const unitCostCell = row.querySelector('[data-field="unit-cost"]');
        const unitCost = this.FIRING_OPTIONS[firingType] || 0;
        unitCostCell.textContent = this.USDformatter.format(unitCost);
    }

    /**
     * Validate date input
     * @param {string} dateValue - The date value to validate
     * @returns {string|null} Error message or null if valid
     * @private
     */
    _validateDate(dateValue) {
        if (!dateValue) return "Date required";
        
        const selectedDate = new Date(dateValue);
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + this.MIN_DAYS_AHEAD);

        if (selectedDate < minDate) {
            return 'Due date must be at least tomorrow';
        }
        return null;
    }

    /**
     * Validate number inputs with field-specific rules
     * @param {string} value - The input value
     * @param {string} fieldType - The type of field (dimension, quantity, etc.)
     * @returns {string|null} Error message or null if valid
     * @private
     */
    _validateNumberInput(value, fieldType) {
        if (!value) return "Field required";
        
        const num = parseInt(value);
        if (isNaN(num)) return "Must be a number";
        if (num <= 0) return "Must be positive";

        // Field-specific validation
        switch (fieldType) {
            case 'height':
            case 'width':
            case 'length':
                if (num < this.MIN_DIMENSION) return `Min ${this.MIN_DIMENSION} inches`;
                if (num > this.MAX_DIMENSION) return `Max ${this.MAX_DIMENSION} inches`;
                break;
            case 'quantity':
                if (num > this.MAX_QUANTITY) return `Max ${this.MAX_QUANTITY} pieces`;
                break;
        }
        
        return null;
    }

    /**
     * Display or clear field validation errors
     * @param {HTMLElement} cell - The table cell containing the field
     * @param {HTMLElement} input - The input element
     * @param {string|null} error - Error message or null
     * @private
     */
    _displayFieldError(cell, input, error) {
        if (error) {
            cell.setAttribute('data-error', error);
            input.classList.add('invalid-input');
        } else {
            cell.removeAttribute('data-error');
            input.classList.remove('invalid-input');
        }
    }

    /**
     * Update delete button state based on number of rows
     */
    updateDeleteButtonState() {
        const rows = this.dataRows.querySelectorAll('tr');
        const deleteButtons = this.dataRows.querySelectorAll('[data-action="delete"]');

        // Disable delete buttons if only one row exists
        deleteButtons.forEach(button => {
            button.disabled = rows.length === 1;
        });
    }

    /**
     * Process uploaded image file
     * @param {File} file - The uploaded file
     * @param {HTMLTableRowElement} row - The table row
     * @returns {Promise<boolean>} Success status
     */
    async processImage(file, row) {
        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            throw new Error('Please upload an image file');
        }

        if (file.size > this.MAX_FILE_SIZE) {
            throw new Error('File size exceeds 5MB limit');
        }

        try {
            // Create optimized version and thumbnail in parallel
            const [optimizedImage, thumbnail] = await Promise.all([
                this._createOptimizedImage(file),
                this._createThumbnail(file)
            ]);

            // Store optimized image data in row for backend submission
            // FIXED: Using consistent naming 'photoBuffer' to match backend expectations
            row.dataset.photoBuffer = optimizedImage;

            // Update preview cell with thumbnail
            const previewCell = row.querySelector('[data-field="preview"]');
            const img = document.createElement('img');
            img.src = thumbnail;
            img.alt = 'Photo preview';
            img.className = 'thumbnail';
            previewCell.innerHTML = '';
            previewCell.appendChild(img);

            return true;
        } catch (error) {
            console.error('Image processing failed:', error);
            throw new Error('Failed to process image');
        }
    }

    /**
     * Create optimized version of uploaded image
     * @param {File} file - The image file
     * @returns {Promise<string>} Base64 encoded optimized image
     * @private
     */
    async _createOptimizedImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > this.MAX_IMAGE_WIDTH || height > this.MAX_IMAGE_HEIGHT) {
                    const ratio = Math.min(
                        this.MAX_IMAGE_WIDTH / width,
                        this.MAX_IMAGE_HEIGHT / height
                    );
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP if supported, fallback to JPEG
                try {
                    const webpData = canvas.toDataURL('image/webp', 0.8);
                    resolve(webpData.split(',')[1]); // Return base64 without data URL prefix
                } catch {
                    const jpegData = canvas.toDataURL('image/jpeg', 0.8);
                    resolve(jpegData.split(',')[1]);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Create thumbnail version of uploaded image
     * @param {File} file - The image file
     * @returns {Promise<string>} Data URL of thumbnail
     * @private
     */
    async _createThumbnail(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = this.THUMBNAIL_WIDTH;
                canvas.height = this.THUMBNAIL_HEIGHT;

                const ctx = canvas.getContext('2d');
                const scale = Math.max(
                    this.THUMBNAIL_WIDTH / img.width,
                    this.THUMBNAIL_HEIGHT / img.height
                );
                const width = img.width * scale;
                const height = img.height * scale;
                const x = (this.THUMBNAIL_WIDTH - width) / 2;
                const y = (this.THUMBNAIL_HEIGHT - height) / 2;

                // Fill background and draw centered image
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(0, 0, this.THUMBNAIL_WIDTH, this.THUMBNAIL_HEIGHT);
                ctx.drawImage(img, x, y, width, height);

                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = () => reject(new Error('Failed to create thumbnail'));
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Add a new row to the worksheet
     */
    addRow() {
        const row = document.createElement('tr');

        // Create all cells for the row
        row.appendChild(this._createFiringTypeCell());
        row.appendChild(this._createUnitCostCell());
        row.appendChild(this._createDimensionCell('height', 'Height'));
        row.appendChild(this._createDimensionCell('width', 'Width'));
        row.appendChild(this._createDimensionCell('length', 'Length'));
        row.appendChild(this._createVolumeCell());
        row.appendChild(this._createQuantityCell());
        row.appendChild(this._createPriceCell());
        row.appendChild(this._createDueDateCell());
        row.appendChild(this._createDirectionsCell());
        row.appendChild(this._createPhotoUploadCell());
        row.appendChild(this._createPreviewCell());
        row.appendChild(this._createDeleteCell());

        this.dataRows.appendChild(row);
        
        // Update calculations and UI state
        this.calculateRowValues(row);
        this.updateTotalCost();
        this.updateDeleteButtonState();
    }

    /**
     * Create firing type selection cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createFiringTypeCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Firing Type');
        cell.setAttribute('data-field', 'firing-type');

        const select = document.createElement('select');
        select.setAttribute('data-field', 'firing-type');
        select.setAttribute('aria-label', 'Select firing type');

        Object.keys(this.FIRING_OPTIONS).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });

        cell.appendChild(select);
        return cell;
    }

    /**
     * Create unit cost display cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createUnitCostCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Unit Cost');
        cell.setAttribute('data-field', 'unit-cost');
        
        // Set initial unit cost based on first firing option
        const firstFiringType = Object.keys(this.FIRING_OPTIONS)[0];
        const initialUnitCost = this.FIRING_OPTIONS[firstFiringType] || 0;
        cell.textContent = this.USDformatter.format(initialUnitCost);
        
        return cell;
    }

    /**
     * Create dimension input cell (height, width, length)
     * @param {string} fieldName - The field name (height, width, length)
     * @param {string} label - Display label for the field
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createDimensionCell(fieldName, label) {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', label);
        cell.setAttribute('data-field', fieldName);

        const input = document.createElement('input');
        input.type = 'number';
        input.min = String(this.MIN_DIMENSION);
        input.max = String(this.MAX_DIMENSION);
        input.value = String(this.MIN_DIMENSION); // Default to minimum dimension
        input.setAttribute('data-field', fieldName);
        input.setAttribute('aria-label', `${label} in inches (${this.MIN_DIMENSION}-${this.MAX_DIMENSION})`);

        cell.appendChild(input);
        return cell;
    }

    /**
     * Create volume display cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createVolumeCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Volume');
        cell.setAttribute('data-field', 'volume');
        cell.textContent = String(this.MIN_DIMENSION ** 3); // Volume of minimum dimensions (2×2×2 = 8)
        return cell;
    }

    /**
     * Create quantity input cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createQuantityCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Quantity');
        cell.setAttribute('data-field', 'quantity');

        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = String(this.MAX_QUANTITY);
        input.value = '1';
        input.setAttribute('data-field', 'quantity');
        input.setAttribute('aria-label', 'Number of pieces');

        cell.appendChild(input);
        return cell;
    }

    /**
     * Create price display cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createPriceCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Price');
        cell.setAttribute('data-field', 'price');
        cell.textContent = this.USDformatter.format(0);
        return cell;
    }

    /**
     * Create due date input cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createDueDateCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Due Date');
        cell.setAttribute('data-field', 'due-date');

        // Calculate min and default dates
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + this.MIN_DAYS_AHEAD);
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + this.DEFAULT_DAYS_AHEAD);

        const input = document.createElement('input');
        input.type = 'date';
        input.min = minDate.toISOString().split('T')[0];
        input.value = defaultDate.toISOString().split('T')[0];
        input.setAttribute('data-field', 'due-date');
        input.setAttribute('aria-label', 'Due date for firing');

        cell.appendChild(input);
        return cell;
    }

    /**
     * Create special directions textarea cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createDirectionsCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Special Directions');
        cell.setAttribute('data-field', 'directions');

        const textarea = document.createElement('textarea');
        textarea.setAttribute('data-field', 'directions');
        textarea.setAttribute('aria-label', 'Special firing directions');
        textarea.placeholder = 'Any special instructions...';

        cell.appendChild(textarea);
        return cell;
    }

    /**
     * Create photo upload cell with camera icon
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createPhotoUploadCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Photo Upload');
        cell.setAttribute('data-field', 'photo-upload');

        const fileContainer = document.createElement('div');
        fileContainer.className = 'file-input-container';

        const photoInput = document.createElement('input');
        photoInput.type = 'file';
        photoInput.accept = 'image/*';
        photoInput.setAttribute('capture', 'environment'); // Suggests back camera on mobile
        photoInput.setAttribute('data-field', 'photo');
        photoInput.setAttribute('aria-label', 'Upload photo of ceramic piece');

        // Handle file selection
        photoInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const row = event.target.closest('tr');
            const loader = this.shadowRoot.getElementById('loader');

            try {
                loader.classList.remove('hidden');
                await this.processImage(file, row);
            } catch (error) {
                // Display error inline instead of using alert
                this._showImageError(cell, error.message);
                photoInput.value = ''; // Clear the input
            } finally {
                loader.classList.add('hidden');
            }
        });

        // Create camera icon SVG
        const cameraIcon = this._createSVGIcon(CeramicsFiringCalculator.ICONS.CAMERA, 'camera-icon');
        
        fileContainer.appendChild(photoInput);
        fileContainer.appendChild(cameraIcon);
        cell.appendChild(fileContainer);
        
        return cell;
    }

    /**
     * Create preview cell for image thumbnails
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createPreviewCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', 'Preview');
        cell.setAttribute('data-field', 'preview');
        cell.className = 'preview-cell';
        return cell;
    }

    /**
     * Create delete button cell
     * @returns {HTMLTableCellElement}
     * @private
     */
    _createDeleteCell() {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', '');
        cell.setAttribute('data-field', 'delete');

        const deleteButton = document.createElement('button');
        deleteButton.className = 'icon-button';
        deleteButton.setAttribute('data-action', 'delete');
        deleteButton.setAttribute('aria-label', 'Delete this row');

        const trashIcon = this._createSVGIcon(CeramicsFiringCalculator.ICONS.TRASH);
        deleteButton.appendChild(trashIcon);
        cell.appendChild(deleteButton);
        
        return cell;
    }

    /**
     * Create SVG icon element
     * @param {string} pathData - SVG path data
     * @param {string} className - Optional CSS class name
     * @returns {SVGElement}
     * @private
     */
    _createSVGIcon(pathData, className = '') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        
        if (className) {
            svg.classList.add(className);
        }
        
        svg.innerHTML = pathData;
        return svg;
    }

    /**
     * Show image upload error inline
     * @param {HTMLElement} cell - The cell to show error in
     * @param {string} message - Error message
     * @private
     */
    _showImageError(cell, message) {
        // Remove any existing error messages
        const existingError = cell.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        cell.appendChild(errorDiv);

        // Auto-remove error after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    /**
     * Calculate pricing and volume for a specific row
     * @param {HTMLTableRowElement} row - The table row to calculate
     */
    calculateRowValues(row) {
        // Get input values using data attributes for reliable selection
        const height = parseInt(row.querySelector('[data-field="height"]').value) || 0;
        const width = parseInt(row.querySelector('[data-field="width"]').value) || 0;
        const length = parseInt(row.querySelector('[data-field="length"]').value) || 0;
        const quantity = parseInt(row.querySelector('[data-field="quantity"]').value) || 0;
        const dueDate = row.querySelector('[data-field="due-date"]').value;

        // Calculate volume
        const volume = height * width * length;
        
        // Get unit cost from display cell
        const unitCostText = row.querySelector('[data-field="unit-cost"]').textContent;
        const unitCost = parseFloat(unitCostText.replace(/[^0-9.-]+/g, '')) || 0;
        
        // Calculate base price
        let price = volume * quantity * unitCost;

        // Apply rush job premium if applicable
        if (dueDate) {
            const daysDiff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= this.rushJobDays) {
                price *= (1 + this.rushJobPremium / 100);
            }
        }

        // Update display cells
        row.querySelector('[data-field="volume"]').textContent = volume;
        row.querySelector('[data-field="price"]').textContent = this.USDformatter.format(price);
    }

    /**
     * Update the total cost display
     */
    updateTotalCost() {
        const total = Array.from(this.dataRows.querySelectorAll('tr'))
            .reduce((sum, row) => {
                const priceText = row.querySelector('[data-field="price"]').textContent;
                const price = parseFloat(priceText.replace(/[^0-9.-]+/g, '')) || 0;
                return sum + price;
            }, 0);

        const totalPriceCell = this.shadowRoot.getElementById('total-price');
        totalPriceCell.textContent = this.USDformatter.format(total);
    }

    /**
     * Submit worksheet data to backend
     * Dispatches custom event with structured data for Wix integration
     */
    submitWorksheet() {
        try {
            const data = Array.from(this.dataRows.querySelectorAll('tr')).map(row => {
                // Extract all data using reliable selectors
                const firingType = row.querySelector('[data-field="firing-type"]').value;
                const height = parseInt(row.querySelector('[data-field="height"]').value) || 0;
                const width = parseInt(row.querySelector('[data-field="width"]').value) || 0;
                const length = parseInt(row.querySelector('[data-field="length"]').value) || 0;
                const quantity = parseInt(row.querySelector('[data-field="quantity"]').value) || 0;
                const unitCostText = row.querySelector('[data-field="unit-cost"]').textContent;
                const unitCost = parseFloat(unitCostText.replace(/[^0-9.-]+/g, '')) || 0;
                const volume = parseInt(row.querySelector('[data-field="volume"]').textContent) || 0;
                const priceText = row.querySelector('[data-field="price"]').textContent;
                const totalPrice = parseFloat(priceText.replace(/[^0-9.-]+/g, '')) || 0;
                const dueDate = row.querySelector('[data-field="due-date"]').value || null;
                const specialDirections = row.querySelector('[data-field="directions"]').value || null;
                
                // FIXED: Use consistent naming for image data
                const photoBuffer = row.dataset.photoBuffer || null;

                return {
                    _id: this.generateProductID({ firingType, height, width, length }),
                    firingType,
                    unitCost,
                    height,
                    width,
                    length,
                    volume,
                    quantity,
                    price: quantity > 0 ? totalPrice / quantity : 0, // Per-item price for backend
                    dueDate,
                    specialDirections,
                    photoBuffer // This now matches backend expectations
                };
            });

            // Validate data before submission
            const validationErrors = this._validateWorksheetData(data);
            if (validationErrors.length > 0) {
                throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
            }

            // Dispatch event for Wix backend integration
            this.dispatchEvent(new CustomEvent('submitWorksheet', {
                detail: { data },
                bubbles: true
            }));

        } catch (error) {
            console.error('Error preparing worksheet submission:', error);
            throw error;
        }
    }

    /**
     * Validate worksheet data before submission
     * @param {Array} data - Worksheet data to validate
     * @returns {Array} Array of validation error messages
     * @private
     */
    _validateWorksheetData(data) {
        const errors = [];

        data.forEach((item, index) => {
            const rowNum = index + 1;
            
            if (!item.firingType) errors.push(`Row ${rowNum}: Firing type required`);
            if (item.height < this.MIN_DIMENSION || item.height > this.MAX_DIMENSION) {
                errors.push(`Row ${rowNum}: Height must be ${this.MIN_DIMENSION}-${this.MAX_DIMENSION} inches`);
            }
            if (item.width < this.MIN_DIMENSION || item.width > this.MAX_DIMENSION) {
                errors.push(`Row ${rowNum}: Width must be ${this.MIN_DIMENSION}-${this.MAX_DIMENSION} inches`);
            }
            if (item.length < this.MIN_DIMENSION || item.length > this.MAX_DIMENSION) {
                errors.push(`Row ${rowNum}: Length must be ${this.MIN_DIMENSION}-${this.MAX_DIMENSION} inches`);
            }
            if (item.quantity <= 0 || item.quantity > this.MAX_QUANTITY) {
                errors.push(`Row ${rowNum}: Quantity must be 1-${this.MAX_QUANTITY} pieces`);
            }
            if (!item.dueDate) errors.push(`Row ${rowNum}: Due date required`);
        });

        return errors;
    }

    /**
     * Generate unique product ID based on firing parameters
     * @param {Object} params - Parameters for ID generation
     * @param {string} params.firingType - Type of firing
     * @param {number} params.height - Height dimension
     * @param {number} params.width - Width dimension  
     * @param {number} params.length - Length dimension
     * @returns {string} Generated product ID
     */
    generateProductID({ firingType, height, width, length }) {
        const rawID = `${firingType}-${height}-${width}-${length}`;
        let hash = 0;
        
        // Simple hash function for ID generation
        for (let i = 0; i < rawID.length; i++) {
            hash = (hash << 5) - hash + rawID.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        
        return `${Math.abs(hash)}`;
    }
}

// Register the custom element for use in Wix sites
customElements.define('ceramics-firing-calculator', CeramicsFiringCalculator);
