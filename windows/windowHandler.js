/* Window manager for opening, closing, focusing, and dragging UI windows. */
(function (root, factory) {
    const WindowHandler = factory();
    if (typeof module === "object" && module.exports) module.exports = WindowHandler;
    if (root) root.WindowHandler = WindowHandler;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    class WindowHandler {
        constructor(options = {}) {
            this.windowSelector = options.windowSelector || "[data-window], .window";
            this.handleSelector = options.dragHandleSelector || "[data-window-drag], .window-header, .titlebar";
            this.closeSelector = options.closeSelector || "[data-window-close], .window-close";
            this.minimizeSelector = options.minimizeSelector || "[data-window-minimize], .window-minimize";
            this.maximizeSelector = options.maximizeSelector || "[data-window-maximize], .window-maximize";
            this.windows = new Map();
            this.zIndex = Number(options.startZIndex) || 100;
            this.drag = null;

            if (typeof document !== "undefined") {
                this.onClick = (event) => this._handleControl(event);
                this.onMove = (event) => this._move(event);
                this.onUp = () => this._stopDrag();
                document.querySelectorAll(this.windowSelector).forEach((element) => this.register(element));
                document.addEventListener("click", this.onClick);
            }
        }

        register(element, id) {
            if (typeof element === "string") {
                id = element;
                element = this._find(id);
            }
            if (!element) return null;
            id = String(id || element.dataset.window || element.id || `window-${this.windows.size + 1}`);
            if (this.windows.has(id)) this.unregister(id);
            const record = { element, display: element.style.display, maximized: false, bounds: null };
            element.dataset.window = id;
            if (!element.style.position) element.style.position = "absolute";
            this.windows.set(id, record);

            const handle = element.querySelector(this.handleSelector);
            if (handle) {
                record.handle = handle;
                record.pointerDown = (event) => {
                    if ((event.button !== undefined && event.button !== 0) || record.maximized) return;
                    if (event.target.closest("button, a, input, select, textarea, [data-no-drag]")) return;
                    const rect = element.getBoundingClientRect();
                    this.drag = { record, pointerId: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
                    this.focus(id);
                    document.addEventListener("pointermove", this.onMove);
                    document.addEventListener("pointerup", this.onUp);
                    document.addEventListener("pointercancel", this.onUp);
                    event.preventDefault();
                };
                handle.addEventListener("pointerdown", record.pointerDown);
            }
            return element;
        }

        unregister(id) {
            const record = this.windows.get(String(id));
            if (!record) return false;
            if (record.handle) record.handle.removeEventListener("pointerdown", record.pointerDown);
            this.windows.delete(String(id));
            return true;
        }

        open(id) {
            const record = this._record(id);
            if (!record) return false;
            record.element.hidden = false;
            record.element.style.display = record.display && record.display !== "none" ? record.display : "block";
            record.element.setAttribute("aria-hidden", "false");
            delete record.element.dataset.minimized;
            this.focus(id);
            this._emit(record.element, "window:open", { id: String(id) });
            return true;
        }

        close(id) {
            const record = this._record(id);
            if (!record) return false;
            record.element.hidden = true;
            record.element.style.display = "none";
            record.element.setAttribute("aria-hidden", "true");
            this._emit(record.element, "window:close", { id: String(id) });
            return true;
        }

        toggle(id) {
            const record = this._record(id);
            if (!record) return false;
            return record.element.hidden || record.element.style.display === "none" ? this.open(id) : this.close(id);
        }

        minimize(id) {
            const record = this._record(id);
            if (!record) return false;
            record.element.dataset.minimized = "true";
            record.element.hidden = true;
            record.element.style.display = "none";
            this._emit(record.element, "window:minimize", { id: String(id) });
            return true;
        }

        maximize(id) {
            const record = this._record(id);
            if (!record) return false;
            if (record.maximized) return this.restore(id);
            const element = record.element;
            const rect = element.getBoundingClientRect();
            record.bounds = { position: element.style.position, left: element.style.left, top: element.style.top, width: element.style.width, height: element.style.height, rect };
            Object.assign(element.style, { position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh" });
            record.maximized = true;
            element.dataset.maximized = "true";
            this.focus(id);
            this._emit(element, "window:maximize", { id: String(id) });
            return true;
        }

        restore(id) {
            const record = this._record(id);
            if (!record) return false;
            if (record.maximized && record.bounds) {
                const { position, left, top, width, height, rect } = record.bounds;
                Object.assign(record.element.style, {
                    position: position || "absolute",
                    left: left || `${rect.left}px`, top: top || `${rect.top}px`,
                    width: width || `${rect.width}px`, height: height || `${rect.height}px`,
                });
            }
            record.maximized = false;
            record.bounds = null;
            delete record.element.dataset.maximized;
            this.open(id);
            this._emit(record.element, "window:restore", { id: String(id) });
            return true;
        }

        focus(id) {
            const record = this._record(id);
            if (!record) return false;
            record.element.style.zIndex = String(++this.zIndex);
            this._emit(record.element, "window:focus", { id: String(id) });
            return true;
        }

        destroy() {
            if (typeof document === "undefined") return;
            document.removeEventListener("click", this.onClick);
            this._stopDrag();
            for (const id of Array.from(this.windows.keys())) this.unregister(id);
        }

        _record(id) {
            const key = String(id);
            if (!this.windows.has(key)) {
                const element = this._find(key);
                if (element) this.register(element, key);
            }
            return this.windows.get(key) || null;
        }

        _find(id) {
            if (typeof document === "undefined") return null;
            const element = document.getElementById(String(id));
            if (element) return element;
            return Array.from(document.querySelectorAll("[data-window]")).find((item) => item.dataset.window === String(id)) || null;
        }

        _move(event) {
            if (!this.drag || (this.drag.pointerId !== undefined && event.pointerId !== this.drag.pointerId)) return;
            const { record, x, y } = this.drag;
            record.element.style.left = `${Math.max(0, event.clientX - x)}px`;
            record.element.style.top = `${Math.max(0, event.clientY - y)}px`;
        }

        _stopDrag() {
            this.drag = null;
            if (typeof document !== "undefined") {
                document.removeEventListener("pointermove", this.onMove);
                document.removeEventListener("pointerup", this.onUp);
                document.removeEventListener("pointercancel", this.onUp);
            }
        }

        _handleControl(event) {
            const control = event.target.closest(`${this.closeSelector}, ${this.minimizeSelector}, ${this.maximizeSelector}`);
            if (!control) return;
            const element = control.closest(this.windowSelector) || this._find(control.dataset.windowTarget);
            if (!element) return;
            const id = element.dataset.window || element.id;
            if (control.matches(this.closeSelector)) this.close(id);
            else if (control.matches(this.minimizeSelector)) this.minimize(id);
            else this.maximize(id);
            event.preventDefault();
        }

        _emit(element, name, detail) {
            if (typeof CustomEvent !== "undefined") element.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
        }
    }

    return WindowHandler;
});
