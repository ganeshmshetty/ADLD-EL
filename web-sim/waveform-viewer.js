/**
 * Waveform Viewer for Web Simulation
 * Mimics EPWave style digital waveform display
 */

class WaveformViewer {
    constructor(canvasId, containerId, signals) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        this.signals = signals; // Array of { name, type: 'binary'|'bus', color, label }

        this.data = []; // Array of { time, values: {} }
        this.startTime = 0;
        this.timeScale = 10; // Pixels per time unit

        this.rowHeight = 40;
        this.labelWidth = 100;
        this.headerHeight = 30;

        this.colors = {
            background: '#121212',
            grid: '#333333',
            text: '#e0e0e0',
            signal: '#00e676', // Green
            bus: '#ffd740',    // Amber
            cursor: '#ff1744'
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initial state
        this.addDataPoint(0, {});
    }

    resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = Math.max((this.signals.length * this.rowHeight) + this.headerHeight, 200);
        this.draw();
    }

    addDataPoint(time, values) {
        // Fill in missing values from previous state
        const lastPoint = this.data.length > 0 ? this.data[this.data.length - 1] : null;
        const newValues = { ...values };

        this.signals.forEach(sig => {
            if (newValues[sig.name] === undefined) {
                newValues[sig.name] = lastPoint ? lastPoint.values[sig.name] : 0;
            }
        });

        // If time is same as last point, update last point instead of adding new one
        if (lastPoint && lastPoint.time === time) {
            lastPoint.values = { ...lastPoint.values, ...newValues };
        } else {
            this.data.push({ time, values: newValues });
        }

        // Auto-scroll logic: shift startTime if we go off screen
        const maxTime = time;
        const visibleTimeSpan = (this.canvas.width - this.labelWidth) / this.timeScale;

        if (maxTime > this.startTime + visibleTimeSpan) {
            this.startTime = maxTime - visibleTimeSpan + 10; // Scroll to keep new data in view with some padding
        }

        this.draw();
    }

    reset() {
        this.data = [];
        this.startTime = 0;
        this.addDataPoint(0, {});
        this.draw();
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, w, h);

        // Draw Header
        ctx.fillStyle = this.colors.text;
        ctx.font = '12px Inter, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Signals', 10, 20);
        ctx.fillText('Time (ns)', this.labelWidth + 10, 20);

        // Draw Grid and Signal Names
        this.signals.forEach((sig, index) => {
            const y = this.headerHeight + (index * this.rowHeight);

            // Name background
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(0, y, this.labelWidth, this.rowHeight);

            // Name
            ctx.fillStyle = this.colors.text;
            ctx.textAlign = 'right';
            ctx.fillText(sig.label || sig.name, this.labelWidth - 10, y + (this.rowHeight / 2) + 4);

            // Horizontal Grid line
            ctx.strokeStyle = this.colors.grid;
            ctx.beginPath();
            ctx.moveTo(0, y + this.rowHeight);
            ctx.lineTo(w, y + this.rowHeight);
            ctx.stroke();

            // Render Signal Trace
            this.drawSignalTrace(ctx, sig, index, y);
        });

        // Vertical Divider
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.labelWidth, 0);
        ctx.lineTo(this.labelWidth, h);
        ctx.stroke();
    }

    drawSignalTrace(ctx, sig, index, yBase) {
        const yTop = yBase + 5;
        const yBot = yBase + this.rowHeight - 5;
        const yMid = yBase + (this.rowHeight / 2);

        ctx.save();
        // Clip to drawing area
        ctx.beginPath();
        ctx.rect(this.labelWidth, yBase, this.canvas.width - this.labelWidth, this.rowHeight);
        ctx.clip();

        ctx.strokeStyle = sig.color || (sig.type === 'bus' ? this.colors.bus : this.colors.signal);
        ctx.lineWidth = 2;

        let prevX = this.labelWidth;

        // Find start index based on startTime
        let startIndex = 0;
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].time >= this.startTime) {
                startIndex = Math.max(0, i - 1);
                break;
            }
        }

        // If no data
        if (this.data.length === 0) {
            ctx.restore();
            return;
        }

        let prevVal = this.data[startIndex].values[sig.name];
        let prevTime = this.data[startIndex].time;

        // Calculate initial X relative to startTime
        prevX = this.labelWidth + (prevTime - this.startTime) * this.timeScale;

        for (let i = startIndex + 1; i < this.data.length; i++) {
            const point = this.data[i];
            const val = point.values[sig.name];
            const time = point.time;

            const x = this.labelWidth + (time - this.startTime) * this.timeScale;

            if (x < this.labelWidth) {
                prevVal = val;
                prevTime = time;
                prevX = x;
                continue;
            }

            if (sig.type === 'binary') {
                const yPrev = prevVal ? yTop : yBot;
                const yCurr = val ? yTop : yBot;

                ctx.beginPath();
                ctx.moveTo(prevX, yPrev);

                // Horizontal line to transition point
                ctx.lineTo(x, yPrev);

                // Vertical transition line
                if (val !== prevVal) {
                    ctx.lineTo(x, yCurr);
                }

                ctx.stroke();
            } else {
                // Bus rendering

                // Top and bottom lines
                ctx.beginPath();
                ctx.moveTo(prevX, yTop);
                ctx.lineTo(x, yTop);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(prevX, yBot);
                ctx.lineTo(x, yBot);
                ctx.stroke();

                // Draw Value Text in simplified Hex
                if (x - prevX > 20) {
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.font = '10px monospace';
                    const text = this.formatValue(prevVal);
                    const textX = Math.max(this.labelWidth, prevX) + (x - Math.max(this.labelWidth, prevX)) / 2;

                    // Only draw if within bounds
                    if (textX > this.labelWidth) {
                        ctx.fillText(text, textX, yMid + 3);
                    }
                }

                // Transition Cross
                if (val !== prevVal) {
                    ctx.strokeStyle = sig.color || this.colors.bus;
                    ctx.beginPath();
                    ctx.moveTo(x - 2, yTop);
                    ctx.lineTo(x + 2, yBot);
                    ctx.moveTo(x - 2, yBot);
                    ctx.lineTo(x + 2, yTop);
                    ctx.stroke();
                }
            }

            prevVal = val;
            prevTime = time;
            prevX = x;
        }

        // Draw line primarily to the end of canvas or current time simulation
        // Extend to right edge for continuity
        const endX = this.canvas.width;
        if (endX > prevX) {
            if (sig.type === 'binary') {
                const yLast = prevVal ? yTop : yBot;
                ctx.beginPath();
                ctx.moveTo(prevX, yLast);
                ctx.lineTo(endX, yLast);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(prevX, yTop);
                ctx.lineTo(endX, yTop);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(prevX, yBot);
                ctx.lineTo(endX, yBot);
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.font = '10px monospace';
                const text = this.formatValue(prevVal);

                const textCenter = prevX + (endX - prevX) / 2;
                if (textCenter > this.labelWidth)
                    ctx.fillText(text, textCenter, yMid + 3);
            }
        }

        ctx.restore();
    }

    formatValue(val) {
        if (val === undefined || val === null) return 'X';
        if (typeof val === 'number') {
            return 'h' + val.toString(16).toUpperCase();
        }
        return val.toString();
    }
}
