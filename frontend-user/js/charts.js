/* ========================================
   图表组件
   ======================================== */

class ChartManager {
    constructor() {
        this.charts = {};
        this.observers = {};
    }

    /* ---------- 数据校验：分群无样本时返回空，避免图表显示为 0 ---------- */

    getValidFunnelData() {
        const source = (typeof funnelData !== 'undefined' && Array.isArray(funnelData)) ? funnelData : [];
        return source.filter(item => item && typeof item.value === 'number' && isFinite(item.value));
    }

    getValidRadarData() {
        const source = (typeof radarData !== 'undefined' && radarData) ? radarData : {};
        const indicators = Array.isArray(source.indicators) ? source.indicators : [];
        const series = Array.isArray(source.series) ? source.series : [];

        const validSeries = series
            .filter(s => s && Array.isArray(s.value) && s.value.some(v => typeof v === 'number' && isFinite(v)))
            .map(s => ({
                ...s,
                // 与指标维度对齐，缺失值用 null（留空）而不是 0
                value: indicators.map((_, i) => {
                    const v = s.value[i];
                    return (typeof v === 'number' && isFinite(v)) ? v : null;
                })
            }));

        return { indicators, series: validSeries };
    }

    /* ---------- 实例与容器清理：防止重复初始化残留旧实例 ---------- */

    disposeChart(key) {
        const chart = this.charts[key];
        if (chart) {
            if (typeof chart.isDisposed !== 'function' || !chart.isDisposed()) {
                chart.dispose();
            }
            delete this.charts[key];
        }
        if (this.observers[key]) {
            this.observers[key].disconnect();
            delete this.observers[key];
        }
    }

    resetContainer(container) {
        // 容器上可能残留未登记在册的旧实例，先销毁再清空占位内容
        const existing = echarts.getInstanceByDom(container);
        if (existing) {
            existing.dispose();
        }
        container.innerHTML = '';
    }

    /* ---------- 数据缺失占位 ---------- */

    showEmptyState(container, message) {
        container.innerHTML = `
            <div class="chart-empty-state">
                <span class="chart-empty-icon">📭</span>
                <span class="chart-empty-text">${message}</span>
            </div>
        `;
        return null;
    }

    /* ---------- 容器尺寸监听：窗口缩放/断点切换时自动重绘 ---------- */

    observeContainer(key, container, chart) {
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            if (typeof chart.isDisposed === 'function' && chart.isDisposed()) return;
            chart.resize();
        });
        observer.observe(container);
        this.observers[key] = observer;
    }

    /* ---------- 漏斗图 ---------- */

    initFunnelChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.disposeChart('funnel');
        this.resetContainer(container);

        const data = this.getValidFunnelData();
        if (!data.length) {
            return this.showEmptyState(container, '该分群暂无漏斗样本数据');
        }

        const chart = echarts.init(container);
        this.charts.funnel = chart;

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}%',
                backgroundColor: 'rgba(20, 20, 35, 0.95)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                borderWidth: 1,
                textStyle: { color: '#f8fafc' },
                extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
            },
            series: [{
                type: 'funnel',
                left: '10%',
                right: '10%',
                top: '8%',
                bottom: '8%',
                width: '80%',
                min: 0,
                max: 100,
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 3,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: '{b}\n{c}%',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                },
                labelLine: { show: false },
                itemStyle: {
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                    borderWidth: 2,
                    shadowBlur: 20,
                    shadowColor: 'rgba(168, 85, 247, 0.3)'
                },
                emphasis: {
                    label: { fontSize: 15 },
                    itemStyle: {
                        shadowBlur: 30,
                        shadowColor: 'rgba(168, 85, 247, 0.5)'
                    }
                },
                data: data.map(item => ({
                    value: item.value,
                    name: item.name,
                    itemStyle: { color: item.color }
                }))
            }]
        };

        chart.setOption(option);

        // 点击事件
        chart.on('click', (params) => {
            window.toast.info('漏斗分析', `${params.name}: 转化率 ${params.value}%`);
        });

        this.observeContainer('funnel', container, chart);

        return chart;
    }

    /* ---------- 雷达图 ---------- */

    initRadarChart(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.disposeChart('radar');
        this.resetContainer(container);

        const { indicators, series } = this.getValidRadarData();
        if (!indicators.length || !series.length) {
            return this.showEmptyState(container, '该分群暂无雷达样本数据');
        }

        const chart = echarts.init(container);
        this.charts.radar = chart;

        const option = {
            backgroundColor: 'transparent',
            legend: {
                data: series.map(s => s.name),
                bottom: 0,
                textStyle: { color: '#94a3b8', fontSize: 12 },
                itemWidth: 16,
                itemHeight: 10,
                itemGap: 20
            },
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(20, 20, 35, 0.95)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                borderWidth: 1,
                textStyle: { color: '#f8fafc' },
                extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
            },
            radar: {
                indicator: indicators,
                shape: 'polygon',
                splitNumber: 4,
                center: ['50%', '45%'],
                radius: '65%',
                axisName: {
                    color: '#94a3b8',
                    fontSize: 12,
                    fontWeight: 500
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(168, 85, 247, 0.15)',
                        width: 1
                    }
                },
                splitArea: {
                    areaStyle: {
                        color: ['rgba(168, 85, 247, 0.02)', 'rgba(168, 85, 247, 0.06)']
                    }
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(168, 85, 247, 0.2)'
                    }
                }
            },
            series: [{
                type: 'radar',
                data: series.map(s => ({
                    value: s.value,
                    name: s.name,
                    symbol: 'circle',
                    symbolSize: 8,
                    lineStyle: {
                        color: s.color,
                        width: 2,
                        shadowBlur: 10,
                        shadowColor: s.color
                    },
                    areaStyle: { color: s.areaColor },
                    itemStyle: {
                        color: s.color,
                        borderColor: '#fff',
                        borderWidth: 2
                    }
                }))
            }]
        };

        chart.setOption(option);

        // 点击事件：只响应数据系列，名称与数值按指标维度一一对应
        chart.on('click', (params) => {
            if (params.componentType !== 'series' || !params.name) return;
            const values = Array.isArray(params.value) ? params.value : [];
            const detail = indicators
                .map((ind, i) => `${ind.name} ${values[i] != null ? values[i] : '缺失'}`)
                .join('，');
            window.toast.info('能力对比', `${params.name}：${detail}`);
        });

        this.observeContainer('radar', container, chart);

        return chart;
    }

    /* ---------- 响应式调整 ---------- */

    resize() {
        Object.keys(this.charts).forEach(key => {
            const chart = this.charts[key];
            if (!chart) return;
            if (typeof chart.isDisposed === 'function' && chart.isDisposed()) {
                delete this.charts[key];
                return;
            }
            chart.resize();
        });
    }

    /* ---------- 销毁图表 ---------- */

    dispose() {
        const keys = new Set([...Object.keys(this.charts), ...Object.keys(this.observers)]);
        keys.forEach(key => this.disposeChart(key));
        this.charts = {};
        this.observers = {};
    }
}

// 创建全局实例
window.chartManager = new ChartManager();
