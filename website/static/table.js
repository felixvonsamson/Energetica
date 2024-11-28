/**
 * This file contains JavaScript code for creating, updating, and interfacing with HTML tables.
 * 
 * The code in this file is responsible for
 * - Creating a table from a JSON object
 * - Updating a table with new data, adding and removing rows if necessary
 */

/**
 * @typedef {Object} DataColumnConfig
 * @property {string} key - The key in the table data to use for this column.
 * @property {string} display_name - The display name for the column in the `<th>` element.
 * @property {"string"|"number"|"gauge"} data_type - The type of the data (string, number, or gauge).
 * @property {boolean} [sortable=false] - Whether the column supports sorting.
 * @property {"gauge"} [special_render] - Special mode for the column.
 * @property {(data: Object, row_key: number | string, value: any) => string} [gauge_class] - A function to generate the
 * class for the gauge.
 * @property {"ascending"|"descending"} [default_sort_order="descending"] - Whether the column is sorted ascending by 
 * default.
 * @property {(data: Object, row_key: number | string, value: any) => string} [render_cell] - A function to generate the 
 * cell's inner HTML.
 * @property {(cell_element: HTMLTableCellElement, data: Object, row_key: number | string, value: any) => void} [populate_cell_content]
 *  - A function to populate the cell with custom content.
 */

class Table {
    /** @type {HTMLTableElement} */ table;
    /** @type {Object.<string, DataColumnConfig>} */ columns = {};
    /** @type {HTMLTableSectionElement} */ table_body;
    /** @type {Object.<string|number, boolean>} */ row_visibility;
    /** @type {null | { key: string, order: "ascending"|"descending" }} */ sort_state = null;
    /** @type {Object.<string, HTMLTableCellElement>} */ table_header_cells = {};
    /** @type {Object.<string|number, Object>} */ table_data;

    /**
     * @param {HTMLTableElement} table - The table element as an HTMLTableElement
     * @param {Array<DataColumnConfig>} columns_config - The configuration for the columns
     * @param {null | { key: string, order: "ascending"|"descending" }} default_sort_state - The default sort state
     */
    constructor(table, columns_config, default_sort_state = null) {
        this.table = table;
        // Create the table header
        this.create_table_header(columns_config);
        // Create the table body
        this.table_body = this.table.createTBody();
        if (default_sort_state !== null) {
            this.set_sort_state(default_sort_state);
        }
    }

    /** 
     * @param {DataColumnConfig[]} columns_config - The configuration for the columns
     * @returns {void} 
     * */
    create_table_header(columns_config) {
        const table_header = this.table.createTHead();
        const header_row = table_header.insertRow();
        for (let column_config of columns_config) {
            const table_header_element = document.createElement("th");
            if (column_config.sortable === undefined) {
                column_config.sortable = true;
            }
            if (column_config.sortable) {
                const button = document.createElement("button");
                button.classList.add("sort-button");
                button.onclick = () => {
                    if (this.sort_state !== null && this.sort_state.key === column_config.key) {
                        // If the column is already sorted, toggle the sort direction
                        if (this.sort_state.order === "ascending") {
                            this.set_sort_state({ key: column_config.key, order: "descending" });
                        } else {
                            this.set_sort_state({ key: column_config.key, order: "ascending" });
                        }
                    } else {
                        // If the column is not sorted, sort it ascending by default
                        if (column_config.default_sort_order != undefined) {
                            this.set_sort_state({ key: column_config.key, order: column_config.default_sort_order });
                        } else {
                            this.set_sort_state({ key: column_config.key, order: "descending" });
                        }
                    }
                };
                button.innerText = column_config.display_name;
                table_header_element.appendChild(button);
            } else {
                table_header_element.innerText = column_config.display_name;
            }
            header_row.appendChild(table_header_element);
            this.table_header_cells[column_config.key] = table_header_element;
            this.columns[column_config.key] = column_config;
        }
    }

    /**
     * @param {Object.<string|number, Object>} table_data - The data to update the table with
     * @returns {void}
     * */
    update_table_body(table_data) {
        // Clear the table body
        this.table_body.replaceChildren();
        // TODO: remove this; it's a workaround for the alternating row colors
        this.table_body.insertRow();
        // Populate the table body with the new data
        for (let row_key in table_data) {
            const row_element = this.table_body.insertRow();
            // Store the row key in the row element so it can be used for sorting
            row_element.setAttribute("data-row-key", row_key);
            const row_data = table_data[row_key];
            for (let column of Object.values(this.columns)) {
                const cell_data = row_data[column.key];
                const cell_element = row_element.insertCell();
                if (cell_data === undefined || cell_data === null) {
                    cell_element.innerText = '-';
                } else {
                    if (column.special_render === "gauge") {
                        const gauge = document.createElement("div");
                        gauge.classList.add("capacityGauge-background");
                        const gauge_fill = document.createElement("div");
                        gauge_fill.classList.add("capacityGauge");
                        if (column.gauge_class !== undefined) {
                            gauge_fill.classList.add(column.gauge_class(row_data, row_key, cell_data));
                        }
                        gauge_fill.style.setProperty("--width", cell_data);
                        const gauge_text = document.createElement("div");
                        gauge_text.classList.add("capacityGauge-txt");
                        gauge_text.innerText = `${Math.round(cell_data * 100)}%`;
                        gauge.appendChild(gauge_fill);
                        gauge.appendChild(gauge_text);
                        cell_element.appendChild(gauge);
                    } else {
                        if (column.populate_cell_content === undefined) {
                            const render_cell = column.render_cell;
                            if (render_cell === undefined) {
                                cell_element.innerText = cell_data;
                            } else {
                                cell_element.innerHTML = render_cell(row_data, row_key, cell_data);
                            }
                        } else {
                            column.populate_cell_content(cell_element, row_data, row_key, cell_data);
                        }
                    }
                }
            }
        }
        this.table_data = table_data;
        this.sort_table_body();
    }

    /** @returns {void} */
    sort_table_body() {
        if (this.table_data === undefined) {
            return;
        }
        if (this.sort_state === null) {
            throw new Error("Cannot sort table body, no ordering specified: sort state is null");
        }
        const sort_key = this.sort_state.key;
        const sort_order = this.sort_state.order;
        const column = this.columns[this.sort_state.key];
        let rows = Array.from(this.table_body.rows);
        // TODO: remove this; it's a workaround for the alternating row colors
        rows = rows.slice(1);
        rows.sort((a, b) => {
            const a_key = a.getAttribute("data-row-key");
            const b_key = b.getAttribute("data-row-key");
            // assert a and b keys are not null
            if (a_key === null || b_key === null) {
                throw new Error("Cannot sort table body, row key is null");
            }
            const a_data = this.table_data[a_key][sort_key];
            const b_data = this.table_data[b_key][sort_key];
            if (a_data === null) {
                return 1;
            }
            if (b_data === null) {
                return -1;
            }
            if (column.data_type === "string") {
                return sort_order == "ascending" ? a_data.localeCompare(b_data) : b_data.localeCompare(a_data);
            } else {
                return sort_order == "ascending" ? a_data - b_data : b_data - a_data;
            }
        });
        // TODO: remove this; it's a workaround for the alternating row colors
        rows.unshift(this.table_body.rows[0]);
        this.table_body.replaceChildren(...rows);
    }

    /**
     * @param {{ key: string, order: "ascending"|"descending" }} new_sort_state - The new sort state
     * @returns {void}
     * */
    set_sort_state(new_sort_state) {
        this.reset_sort_indicator();
        const sort_indicator = document.createElement("i");
        sort_indicator.classList.add("fa");
        if (new_sort_state.order === "ascending") {
            sort_indicator.classList.add("fa-caret-up");
        } else {
            sort_indicator.classList.add("fa-caret-down");
        }
        if (!(new_sort_state.key in this.columns)) {
            throw new Error(`Cannot sort: column ${new_sort_state.key} does not exist`);
        }
        const button = this.table_header_cells[new_sort_state.key].firstChild;
        if (!(button instanceof HTMLElement)) {
            throw new Error(`Cannot sort: column ${new_sort_state.key} does not have a button`);
        }
        button.innerText += " ";
        button.appendChild(sort_indicator);
        this.sort_state = new_sort_state;
        this.sort_table_body();
    }

    /** @returns {void} */
    reset_sort_indicator() {
        if (this.sort_state !== null) {
            const button = this.table_header_cells[this.sort_state.key].firstChild;
            if (button instanceof HTMLElement) {
                const caret = button.lastChild;
                if (caret instanceof HTMLElement) {
                    caret.remove();
                }
                button.innerText = button.innerText.trim();
            }
        }
    }
}
